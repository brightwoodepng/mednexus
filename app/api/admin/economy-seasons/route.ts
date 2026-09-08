import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"
import { assertEconomySeasonSchema, EconomySeasonSchemaError } from "@/lib/economy-seasons"
import { applyNPCredits } from "@/lib/np-ledger"
import { randomUUID } from "node:crypto"
import { economyConfigDiff, getActiveEconomyConfig, validateEconomyConfig } from "@/lib/economy-runtime-config"

const confirmationFor=(name:string)=>`START ${name.trim().toUpperCase()}`
const slug=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)
const validRewards=(values:number[])=>values.length>0&&values.length<=100&&values.every(value=>Number.isInteger(value)&&value>=0&&value<=100000)
const failure=(error:string,code:string,status=400,fieldErrors?:Record<string,string>)=>NextResponse.json({error,code,retryable:status>=500,fieldErrors},{status})

type GiftInput={indexNumber:string;amount:number;reason:string}
function giftRows(body:Record<string,unknown>):GiftInput[]{
  const source=Array.isArray(body.gifts)?body.gifts:[{indexNumber:body.indexNumber,amount:body.amount,reason:body.reason??body.note}]
  return source.map(item=>{const row=item as Record<string,unknown>;return {indexNumber:String(row.indexNumber??"").trim(),amount:Number(row.amount??0),reason:String(row.reason??"").trim()}})
}

async function validateGiftRows(client:import("pg").PoolClient,rows:GiftInput[]){
  const normalized=rows.map(row=>row.indexNumber.toLowerCase()),duplicates=new Set(normalized.filter((value,index)=>normalized.indexOf(value)!==index))
  const errors:Array<{row:number;error:string}>=[]
  rows.forEach((row,index)=>{if(!row.indexNumber)errors.push({row:index+1,error:"Index number is required."});if(!Number.isInteger(row.amount)||row.amount<1||row.amount>100000)errors.push({row:index+1,error:"NP amount must be from 1 to 100,000."});if(row.reason.length<3)errors.push({row:index+1,error:"Reason must contain at least 3 characters."});if(duplicates.has(row.indexNumber.toLowerCase()))errors.push({row:index+1,error:"Duplicate index number in this gift batch."})})
  const users=normalized.length?await client.query(`SELECT r.uid,r.name,r.index_number,COALESCE(w.balance,0)::int balance FROM mednexus_registered_users r LEFT JOIN mednexus_economy_seasons s ON s.status='active' LEFT JOIN mednexus_season_wallets w ON w.season_id=s.id AND w.user_id=r.uid WHERE LOWER(r.index_number)=ANY($1::text[]) AND r.status='approved'`,[normalized]):{rows:[]}
  const byIndex=new Map(users.rows.map(user=>[String(user.index_number).toLowerCase(),user]))
  rows.forEach((row,index)=>{if(row.indexNumber&&!byIndex.has(row.indexNumber.toLowerCase()))errors.push({row:index+1,error:"No approved learner matches this index number."})})
  return {valid:errors.length===0,errors,rows:rows.map((row,index)=>({...row,row:index+1,learner:byIndex.get(row.indexNumber.toLowerCase())??null})),totalNP:rows.reduce((sum,row)=>sum+(Number.isInteger(row.amount)?row.amount:0),0)}
}

async function awardSeasonWinners(client: import("pg").PoolClient, season: Record<string,unknown>, administrator:string) {
  const rewards = Array.isArray(season.seasonal_rewards) ? season.seasonal_rewards.map(Number) : []
  if (!rewards.length) return
  const winners = await client.query(`WITH xp AS (
      SELECT user_id,SUM(amount)::bigint total_xp FROM mednexus_xp_transactions WHERE season_id=$1 AND competitive=TRUE GROUP BY user_id
    ),activity AS (
      SELECT user_id,SUM(questions_answered)::bigint questions,SUM(correct_answers)::bigint correct FROM mednexus_daily_activity WHERE season_id=$1 GROUP BY user_id
    ) SELECT r.uid,r.name,COALESCE(xp.total_xp,0) total_xp,ROW_NUMBER() OVER(ORDER BY COALESCE(xp.total_xp,0) DESC,
      CASE WHEN COALESCE(activity.questions,0)>0 THEN activity.correct::numeric/activity.questions ELSE 0 END DESC,r.uid) place
      FROM mednexus_registered_users r JOIN xp ON xp.user_id=r.uid JOIN activity ON activity.user_id=r.uid
      WHERE r.status='approved' AND COALESCE(activity.questions,0)>=$2 ORDER BY place LIMIT $3`,
    [season.id, Number(season.minimum_eligible_questions ?? 300), rewards.length])
  const runId=randomUUID(),config=await getActiveEconomyConfig(client),approved=await client.query("SELECT COUNT(*)::int count FROM mednexus_registered_users WHERE status='approved'")
  const totalNP=winners.rows.reduce((sum,winner)=>sum+(rewards[Number(winner.place)-1]??0),0)
  await client.query(`INSERT INTO mednexus_economy_reward_runs(id,season_id,reward_type,period_key,config_version,eligible_count,excluded_count,total_np,executed_by) VALUES($1,$2,'seasonal',$2,$3,$4,$5,$6,$7)`,[runId,season.id,config.version,winners.rowCount??0,Math.max(0,Number(approved.rows[0]?.count??0)-(winners.rowCount??0)),totalNP,administrator])
  for (const winner of winners.rows) {
    const amount = rewards[Number(winner.place)-1] ?? 0
    if (amount <= 0) continue
    await applyNPCredits(client,winner.uid,[{source:"leaderboard_reward",sourceId:`season:${season.id}:place:${winner.place}`,amount,countsTowardClinicalRank:false,ceilingPolicy:"exempt",metadata:{seasonId:season.id,place:Number(winner.place),xp:Number(winner.total_xp),rewardCategory:"season_winner"}}])
    await client.query(`INSERT INTO mednexus_economy_reward_recipients(run_id,user_id,place,score,np_amount) VALUES($1,$2,$3,$4,$5)`,[runId,winner.uid,winner.place,winner.total_xp,amount])
    await client.query(`INSERT INTO mednexus_user_notifications(id,user_id,type,message,action_url,action_label) VALUES($1,$2,'leaderboard',$3,'/?hub=rankings','View rankings') ON CONFLICT DO NOTHING`,[`season-winner-${season.id}-${winner.uid}`,winner.uid,`Season complete — you placed #${winner.place} and earned ${amount} NP.`])
  }
}

async function monthlyPreview(client: import("pg").PoolClient,season:Record<string,unknown>,month:string){
  if(!/^\d{4}-\d{2}$/.test(month))throw new Error("Choose a valid completed month.")
  const start=new Date(`${month}-01T00:00:00Z`),end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1))
  if(Number.isNaN(start.getTime())||end>new Date(new Date().toISOString().slice(0,7)+"-01T00:00:00Z"))throw new Error("Only completed months can be finalized.")
  const rewards=Array.isArray(season.monthly_rewards)?season.monthly_rewards.map(Number):[]
  const winners=await client.query(`WITH xp AS (
      SELECT user_id,SUM(amount)::bigint total_xp FROM mednexus_xp_transactions WHERE competitive=TRUE AND created_at>=$1 AND created_at<$2 AND season_id=$7 GROUP BY user_id
    ),activity AS (
      SELECT user_id,SUM(questions_answered)::bigint questions,SUM(correct_answers)::bigint correct FROM mednexus_daily_activity WHERE activity_date>=$3 AND activity_date<$4 AND season_id=$7 GROUP BY user_id
    ) SELECT r.uid,COALESCE(xp.total_xp,0) total_xp,ROW_NUMBER() OVER(ORDER BY COALESCE(xp.total_xp,0) DESC,
      CASE WHEN COALESCE(activity.questions,0)>0 THEN activity.correct::numeric/activity.questions ELSE 0 END DESC,r.uid) place
      FROM mednexus_registered_users r JOIN xp ON xp.user_id=r.uid JOIN activity ON activity.user_id=r.uid
      WHERE r.status='approved' AND COALESCE(activity.questions,0)>=$5 ORDER BY place LIMIT $6`,
    [start.toISOString(),end.toISOString(),`${month}-01`,end.toISOString().slice(0,10),Number(season.minimum_eligible_questions??300),rewards.length,season.id])
  const approved=await client.query("SELECT COUNT(*)::int count FROM mednexus_registered_users WHERE status='approved'")
  return {month,winners:winners.rows.map(winner=>({...winner,npAmount:rewards[Number(winner.place)-1]??0})),eligibleCount:winners.rowCount??0,excludedCount:Math.max(0,Number(approved.rows[0]?.count??0)-(winners.rowCount??0)),totalNP:winners.rows.reduce((sum,winner)=>sum+(rewards[Number(winner.place)-1]??0),0)}
}

async function awardMonthlyWinners(client: import("pg").PoolClient, season: Record<string,unknown>, month:string,administrator:string) {
  const preview=await monthlyPreview(client,season,month),config=await getActiveEconomyConfig(client),runId=randomUUID()
  await client.query(`INSERT INTO mednexus_economy_reward_runs(id,season_id,reward_type,period_key,config_version,eligible_count,excluded_count,total_np,executed_by) VALUES($1,$2,'monthly',$3,$4,$5,$6,$7,$8)`,[runId,season.id,month,config.version,preview.eligibleCount,preview.excludedCount,preview.totalNP,administrator])
  for(const winner of preview.winners){const amount=Number(winner.npAmount);if(amount<=0)continue
    await applyNPCredits(client,winner.uid,[{source:"leaderboard_reward",sourceId:`month:${season.id}:${month}:place:${winner.place}`,amount,countsTowardClinicalRank:false,ceilingPolicy:"exempt",metadata:{seasonId:season.id,month,place:Number(winner.place),xp:Number(winner.total_xp),rewardCategory:"monthly_winner"}}])
    await client.query(`INSERT INTO mednexus_economy_reward_recipients(run_id,user_id,place,score,np_amount) VALUES($1,$2,$3,$4,$5)`,[runId,winner.uid,winner.place,winner.total_xp,amount])
    await client.query(`INSERT INTO mednexus_user_notifications(id,user_id,type,message,action_url,action_label) VALUES($1,$2,'leaderboard',$3,'/?hub=rankings','View rankings') ON CONFLICT DO NOTHING`,[`month-winner-${month}-${winner.uid}`,winner.uid,`Monthly rankings finalized — you placed #${winner.place} and earned ${amount} NP.`])
  }
  return preview
}

function databaseCode(error:unknown){return typeof error==="object"&&error!==null&&"code" in error?String((error as {code?:unknown}).code??""):""}
function loadFailure(error:unknown){
  if(error instanceof EconomySeasonSchemaError)return {error:"Economy Seasons needs the latest database migration before it can be managed.",code:"ECONOMY_SCHEMA_NOT_READY",retryable:false,missing:error.missing}
  if(databaseCode(error).startsWith("08"))return {error:"The database could not be reached. Check the configured database URL and try again.",code:"DATABASE_UNREACHABLE",retryable:true}
  return {error:"Economy Seasons could not be loaded. The database responded, but the season data could not be verified.",code:"ECONOMY_SEASONS_INVALID",retryable:false}
}

async function payload(){
  const [seasons,dryRun,config,revisions,rewardRuns,gifts,learners]=await Promise.all([
    pool.query(`SELECT s.id,s.name,s.economy_version,s.status,s.starts_at,s.ends_at,s.created_at,s.activated_at,s.opening_grant,s.minimum_eligible_questions,s.monthly_rewards,s.seasonal_rewards,
      COUNT(w.user_id)::int member_count,COALESCE(SUM(w.balance),0)::bigint currency_supply,
      COALESCE(SUM(w.lifetime_earned),0)::bigint currency_earned,
      c.executed_at cutover_completed_at FROM mednexus_economy_seasons s
      LEFT JOIN mednexus_season_wallets w ON w.season_id=s.id LEFT JOIN mednexus_economy_cutovers c ON c.to_season_id=s.id
      GROUP BY s.id,c.executed_at ORDER BY s.starts_at DESC`),
    pool.query(`SELECT COUNT(*) FILTER(WHERE status='approved')::int approved_users,
      COUNT(*) FILTER(WHERE status<>'approved')::int ineligible_users FROM mednexus_registered_users`),
    getActiveEconomyConfig(pool),
    pool.query(`SELECT id,version,reason,is_active,created_by,created_at,activated_at FROM mednexus_economy_config_revisions ORDER BY created_at DESC LIMIT 20`),
    pool.query(`SELECT r.*,COALESCE(jsonb_agg(jsonb_build_object('userId',p.user_id,'name',u.name,'indexNumber',u.index_number,'place',p.place,'score',p.score,'npAmount',p.np_amount) ORDER BY p.place) FILTER(WHERE p.user_id IS NOT NULL),'[]') recipients FROM mednexus_economy_reward_runs r LEFT JOIN mednexus_economy_reward_recipients p ON p.run_id=r.id LEFT JOIN mednexus_registered_users u ON u.uid=p.user_id GROUP BY r.id ORDER BY r.executed_at DESC LIMIT 24`),
    pool.query(`SELECT g.id,g.index_number,g.amount,g.reason,g.kind,g.batch_id,g.created_by,g.created_at,u.name FROM mednexus_economy_gifts g LEFT JOIN mednexus_registered_users u ON u.uid=g.user_id ORDER BY g.created_at DESC LIMIT 50`),
    pool.query(`SELECT u.uid,u.name,u.index_number,COALESCE(w.balance,0)::int balance
      FROM mednexus_registered_users u
      LEFT JOIN mednexus_economy_seasons s ON s.status='active'
      LEFT JOIN mednexus_season_wallets w ON w.season_id=s.id AND w.user_id=u.uid
      WHERE u.status='approved' AND u.role='STUDENT'
      ORDER BY u.name,u.index_number LIMIT 2000`),
  ])
  return {seasons:seasons.rows,dryRunReport:dryRun.rows[0],activeSeason:seasons.rows.find(row=>row.status==="active")??null,config,revisions:revisions.rows,rewardRuns:rewardRuns.rows,gifts:gifts.rows,learners:learners.rows}
}

export async function GET(req:NextRequest){
  const admin=await requireAdminRequest(req,"manage_system");if(!admin)return adminAccessDenied(req)
  try{await assertEconomySeasonSchema(pool);const data=await payload();if(req.nextUrl.searchParams.get("download")==="1")return new NextResponse(JSON.stringify(data,null,2),{headers:{"content-type":"application/json","content-disposition":"attachment; filename=mednexus-season-dry-run.json"}});return NextResponse.json(data)}
  catch(error){console.error("[economy seasons GET]",error);return NextResponse.json(loadFailure(error),{status:503})}
}

export async function POST(req:NextRequest){
  const admin=await requireAdminRequest(req,"manage_system");if(!admin)return adminAccessDenied(req)
  if(admin.role!=="SUPER_ADMIN")return failure("Only a super administrator can change the economy.","SUPER_ADMIN_REQUIRED",403)
  try{
    await assertEconomySeasonSchema(pool);const body=await req.json() as Record<string,unknown>;const action=String(body.action??"")
    if(action==="preview_config"||action==="activate_config"){
      const npConfig=body.npConfig,xpConfig=body.xpConfig,reason=String(body.reason??"").trim(),current=await getActiveEconomyConfig(pool)
      const errors=validateEconomyConfig(npConfig,xpConfig),changes=economyConfigDiff(current,npConfig,xpConfig)
      if(errors.length)return failure("Correct the invalid economy rules.","INVALID_ECONOMY_CONFIG",400,Object.fromEntries(errors.map((value,index)=>[String(index),value])))
      if(!changes.length)return failure("No economy rule changes were found.","NO_CONFIG_CHANGES")
      if(action==="preview_config")return NextResponse.json({ok:true,changes,currentVersion:current.version,retryable:false})
      if(reason.length<3||body.confirmation!=="ACTIVATE RULES")return failure("Enter a reason and type ACTIVATE RULES to confirm.","CONFIG_CONFIRMATION_REQUIRED")
      const version=`economy-${new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14)}-${randomUUID().slice(0,8)}`
      const client=await pool.connect();try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus:economy-config'))");await client.query("UPDATE mednexus_economy_config_revisions SET is_active=FALSE WHERE is_active=TRUE");await client.query(`INSERT INTO mednexus_economy_config_revisions(id,version,np_config,xp_config,reason,is_active,created_by,activated_at) VALUES($1,$2,$3::jsonb,$4::jsonb,$5,TRUE,$6,NOW())`,[randomUUID(),version,JSON.stringify(npConfig),JSON.stringify(xpConfig),reason,admin.uid]);await auditAdmin(client,admin.uid,"activate","economy_config",version,{reason,changes});await client.query("COMMIT")}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
      return NextResponse.json({ok:true,...await payload()})
    }
    if(action==="validate_gifts"||action==="lookup_gift"){
      const client=await pool.connect();try{const validation=await validateGiftRows(client,giftRows(body));return NextResponse.json({ok:validation.valid,...validation})}finally{client.release()}
    }
    if(action==="preview_month"){
      const client=await pool.connect();try{const current=(await client.query("SELECT * FROM mednexus_economy_seasons WHERE status='active'")).rows[0];if(!current)return failure("No active season is available.","NO_ACTIVE_SEASON");const preview=await monthlyPreview(client,current,String(body.month??""));const duplicate=await client.query("SELECT 1 FROM mednexus_economy_reward_runs WHERE season_id=$1 AND reward_type='monthly' AND period_key=$2",[current.id,String(body.month??"")]);return NextResponse.json({ok:true,...preview,alreadyFinalized:Boolean(duplicate.rowCount),retryable:false})}finally{client.release()}
    }
    if(action==="preview_activation"){
      const target=await pool.query("SELECT * FROM mednexus_economy_seasons WHERE id=$1 AND status='planned'",[String(body.seasonId??"")]),current=await pool.query("SELECT * FROM mednexus_economy_seasons WHERE status='active'")
      if(!target.rows[0]||!current.rows[0])return failure("Choose a planned season and an active season.","INVALID_SEASON_SELECTION")
      const [learners,balance]=await Promise.all([pool.query("SELECT COUNT(*)::int count FROM mednexus_registered_users WHERE status='approved'"),pool.query("SELECT COALESCE(SUM(balance),0)::bigint total FROM mednexus_season_wallets WHERE season_id=$1",[current.rows[0].id])])
      return NextResponse.json({ok:true,impact:{affectedLearners:Number(learners.rows[0]?.count??0),carriedNP:Number(balance.rows[0]?.total??0),openingGrantPerLearner:Number(target.rows[0].opening_grant),openingGrantTotal:Number(learners.rows[0]?.count??0)*Number(target.rows[0].opening_grant),seasonalRewardTotal:(target.rows[0].seasonal_rewards??[]).reduce((sum:number,value:unknown)=>sum+Number(value),0)},retryable:false})
    }
    if(action==="edit_season"){
      const seasonId=String(body.seasonId??""),name=String(body.name??"").trim(),startsAt=new Date(String(body.startsAt??"")),openingGrant=Number(body.openingGrant)
      if(name.length<3||Number.isNaN(startsAt.getTime())||!Number.isInteger(openingGrant)||openingGrant<0||openingGrant>100000)return failure("Enter a valid name, start date, and opening NP grant.","INVALID_SEASON",400)
      const updated=await pool.query("UPDATE mednexus_economy_seasons SET name=$2,starts_at=$3,opening_grant=$4 WHERE id=$1 AND status='planned' RETURNING id",[seasonId,name,startsAt.toISOString(),openingGrant]);if(!updated.rowCount)return failure("Only planned seasons can be edited.","SEASON_NOT_EDITABLE")
      await auditAdmin(pool,admin.uid,"update","economy_season",seasonId,{name,startsAt:startsAt.toISOString(),openingGrant});return NextResponse.json({ok:true,...await payload()})
    }
    if(action==="update_rules"){
      const seasonId=String(body.seasonId??""),minimumEligibleQuestions=Number(body.minimumEligibleQuestions)
      const monthlyRewards=Array.isArray(body.monthlyRewards)?body.monthlyRewards.map(Number):[],seasonalRewards=Array.isArray(body.seasonalRewards)?body.seasonalRewards.map(Number):[]
      if(!seasonId||!Number.isInteger(minimumEligibleQuestions)||minimumEligibleQuestions<1||minimumEligibleQuestions>100000||!validRewards(monthlyRewards)||!validRewards(seasonalRewards))return NextResponse.json({error:"Enter valid eligibility and reward amounts."},{status:400})
      const client=await pool.connect();try{await client.query("BEGIN");const updated=await client.query(`UPDATE mednexus_economy_seasons SET minimum_eligible_questions=$2,monthly_rewards=$3::jsonb,seasonal_rewards=$4::jsonb WHERE id=$1 AND status IN ('planned','active') RETURNING id`,[seasonId,minimumEligibleQuestions,JSON.stringify(monthlyRewards),JSON.stringify(seasonalRewards)]);if(!updated.rowCount)throw new Error("Choose an active or planned season.");await auditAdmin(client,admin.uid,"update","economy_rules",seasonId,{minimumEligibleQuestions,monthlyRewards,seasonalRewards});await client.query("COMMIT")}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}return NextResponse.json({ok:true,...await payload()})
    }
    if(action==="gift_np"||action==="gift_nt"){
      const rows=giftRows(body),client=await pool.connect(),batchId=rows.length>1?randomUUID():null
      try{await client.query("BEGIN");const validation=await validateGiftRows(client,rows);if(!validation.valid){await client.query("ROLLBACK");return failure("Correct every invalid gift row before sending NP.","INVALID_GIFT_BATCH",400,Object.fromEntries(validation.errors.map(item=>[`row_${item.row}`,item.error])))}
        for(const item of validation.rows){const user=item.learner as {uid:string;name:string;index_number:string};const giftId=randomUUID();await applyNPCredits(client,user.uid,[{source:"admin_gift",sourceId:giftId,amount:item.amount,countsTowardClinicalRank:false,ceilingPolicy:"exempt",metadata:{reason:item.reason,administrator:admin.uid,indexNumber:user.index_number,displayCurrency:"NP",batchId}}]);const season=(await client.query("SELECT id FROM mednexus_economy_seasons WHERE status='active'")).rows[0];await client.query(`INSERT INTO mednexus_economy_gifts(id,season_id,user_id,index_number,amount,reason,kind,batch_id,created_by) VALUES($1,$2,$3,$4,$5,$6,'gift',$7,$8)`,[giftId,season.id,user.uid,user.index_number,item.amount,item.reason,batchId,admin.uid]);await client.query(`INSERT INTO mednexus_user_notifications(id,user_id,type,message,action_url,action_label) VALUES($1,$2,'economy',$3,'/','View balance') ON CONFLICT DO NOTHING`,[`admin-gift-${giftId}`,user.uid,`You received a gift of ${item.amount} NP from MedNexus: ${item.reason}`]);await auditAdmin(client,admin.uid,"gift","learner_np",user.uid,{giftId,batchId,indexNumber:user.index_number,amount:item.amount,reason:item.reason})}
        await client.query("COMMIT")
      }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}return NextResponse.json({ok:true,...await payload()})
    }
    if(action==="award_month"){
      if(admin.role!=="SUPER_ADMIN")return failure("Only a super administrator can finalize monthly rewards.","SUPER_ADMIN_REQUIRED",403)
      if(body.confirmation!==`FINALIZE ${String(body.month??"")}`)return failure(`Type FINALIZE ${String(body.month??"")} to confirm.`,"PAYOUT_CONFIRMATION_REQUIRED")
      const client=await pool.connect();try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus:monthly-leaderboard-award'))");const current=(await client.query("SELECT * FROM mednexus_economy_seasons WHERE status='active' FOR UPDATE")).rows[0];if(!current)throw new Error("No active season is available.");await awardMonthlyWinners(client,current,String(body.month??""),admin.uid);await auditAdmin(client,admin.uid,"award","monthly_leaderboard",String(body.month??""),{});await client.query("COMMIT")}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}return NextResponse.json({ok:true,...await payload()})
    }
    if(action==="create"){
      const name=typeof body.name==="string"?body.name.trim():"",version=typeof body.economyVersion==="string"?body.economyVersion.trim():""
      const openingGrant=Number(body.openingGrant),startsAt=typeof body.startsAt==="string"?new Date(body.startsAt):new Date(),minimumEligibleQuestions=Number(body.minimumEligibleQuestions)
      const monthlyRewards=Array.isArray(body.monthlyRewards)?body.monthlyRewards.map(Number):[],seasonalRewards=Array.isArray(body.seasonalRewards)?body.seasonalRewards.map(Number):[]
      if(name.length<3||!version||!Number.isInteger(openingGrant)||openingGrant<0||openingGrant>100000||!Number.isInteger(minimumEligibleQuestions)||minimumEligibleQuestions<1||minimumEligibleQuestions>100000||!validRewards(monthlyRewards)||!validRewards(seasonalRewards)||Number.isNaN(startsAt.getTime()))return NextResponse.json({error:"Enter valid season details, eligibility, and winner rewards."},{status:400})
      const id=`${slug(name)}-${Date.now().toString(36)}`
      const client=await pool.connect()
      try{
        await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus:economy-season-plan'))")
        const duplicate=await client.query("SELECT 1 FROM mednexus_economy_seasons WHERE status='planned' AND (LOWER(name)=LOWER($1) OR LOWER(economy_version)=LOWER($2))",[name,version])
        if(duplicate.rowCount)throw new Error("A planned season already uses this name or economy version.")
        await client.query(`INSERT INTO mednexus_economy_seasons(id,name,economy_version,status,starts_at,created_by,opening_grant,minimum_eligible_questions,monthly_rewards,seasonal_rewards) VALUES($1,$2,$3,'planned',$4,$5,$6,$7,$8::jsonb,$9::jsonb)`,[id,name,version,startsAt.toISOString(),admin.uid,openingGrant,minimumEligibleQuestions,JSON.stringify(monthlyRewards),JSON.stringify(seasonalRewards)])
        await auditAdmin(client,admin.uid,"create","economy_season",id,{name,version,openingGrant,startsAt:startsAt.toISOString()})
        await client.query("COMMIT")
      }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
      return NextResponse.json({ok:true,...await payload()},{status:201})
    }
    if(action!=="activate")return failure("Unknown season action.","UNKNOWN_ECONOMY_ACTION")
    const seasonId=typeof body.seasonId==="string"?body.seasonId:"",confirmation=typeof body.confirmation==="string"?body.confirmation:""
    const client=await pool.connect()
    try{
      await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus:economy-cutover'))")
      const targetResult=await client.query("SELECT * FROM mednexus_economy_seasons WHERE id=$1 FOR UPDATE",[seasonId]);const target=targetResult.rows[0]
      if(!target||target.status!=="planned")throw new Error("Choose a planned season that has not already started.")
      if(confirmation!==confirmationFor(target.name))throw new Error(`Type ${confirmationFor(target.name)} to confirm.`)
      const currentResult=await client.query("SELECT * FROM mednexus_economy_seasons WHERE status='active' FOR UPDATE");const current=currentResult.rows[0]
      if(!current)throw new Error("No active season is available to close.")
      const migrationId=`season-cutover-${current.id}-to-${target.id}`
      const repeated=await client.query("SELECT 1 FROM mednexus_economy_cutovers WHERE migration_id=$1",[migrationId]);if(repeated.rowCount)throw new Error("This season reset was already completed.")
      await awardSeasonWinners(client,current,admin.uid)
      const before=await client.query("SELECT COALESCE(SUM(balance),0)::bigint total FROM mednexus_season_wallets WHERE season_id=$1",[current.id])
      await client.query(`INSERT INTO mednexus_economy_season_archives(season_id,user_id,closing_balance,lifetime_np,rank_points,login_streak,longest_streak,mcq_activity,game_personal_bests,bounty_progress,weekly_goal_progress,inventory_value,closing_leaderboard_position,migration_id)
        SELECT $1,r.uid,COALESCE(w.balance,0),COALESCE(w.lifetime_earned,0),COALESCE((SELECT SUM(x.amount) FROM mednexus_xp_transactions x WHERE x.season_id=$1 AND x.user_id=r.uid AND x.competitive=TRUE),0),r.login_streak,r.longest_streak,COALESCE(p.data,'{}'),
        COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM mednexus_game_personal_bests g WHERE g.user_id=r.uid AND g.season_id=$1),'[]'),
        COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM mednexus_bounty_progress b WHERE b.uid=r.uid AND b.season_id=$1),'[]'),
        COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM mednexus_weekly_goal_progress q WHERE q.uid=r.uid AND q.season_id=$1),'[]'),
        COALESCE((SELECT SUM(i.quantity) FROM mednexus_user_inventory i WHERE i.uid=r.uid),0),ROW_NUMBER() OVER(ORDER BY COALESCE((SELECT SUM(x.amount) FROM mednexus_xp_transactions x WHERE x.season_id=$1 AND x.user_id=r.uid AND x.competitive=TRUE),0) DESC,r.uid),$2
        FROM mednexus_registered_users r LEFT JOIN mednexus_season_wallets w ON w.user_id=r.uid AND w.season_id=$1 LEFT JOIN mednexus_progress p ON p.uid=r.uid
        WHERE r.status='approved' ON CONFLICT(season_id,user_id) DO NOTHING`,[current.id,migrationId])
      await client.query("UPDATE mednexus_economy_seasons SET status='closed',ends_at=NOW() WHERE id=$1",[current.id])
      await client.query("UPDATE mednexus_economy_seasons SET status='active',starts_at=NOW(),activated_at=NOW(),activated_by=$2,activation_migration_id=$3 WHERE id=$1",[target.id,admin.uid,migrationId])
      await client.query("UPDATE mednexus_registered_users SET login_streak=0,longest_streak=0,last_login_date=NULL WHERE status='approved'")
      // Every earning/progress table is season-scoped. Keep the closed season's
      // rows for lifetime rankings and audits; the new season starts clean
      // naturally because all new writes use target.id.
      const users=await client.query("SELECT uid FROM mednexus_registered_users WHERE status='approved' ORDER BY uid")
      const affectedUsers=users.rowCount??users.rows.length
      await client.query(`WITH grants AS (
        INSERT INTO mednexus_np_transactions(id,user_id,season_id,source,source_id,amount,metadata)
        SELECT 'season-grant-'||$1||'-'||uid,uid,$1,'season_opening_grant',$1||':'||uid,$2,
          jsonb_build_object('economyVersion',$3::text,'seasonId',$1::text,'migrationId',$4::text)
        FROM mednexus_registered_users WHERE status='approved'
        ON CONFLICT(user_id,source,source_id) DO NOTHING RETURNING user_id,amount
      ) INSERT INTO mednexus_season_wallets(season_id,user_id,balance,lifetime_earned,rank_points)
        SELECT $1,g.user_id,COALESCE(previous.balance,0)+g.amount,COALESCE(previous.lifetime_earned,0)+g.amount,0
        FROM grants g LEFT JOIN mednexus_season_wallets previous ON previous.season_id=$5 AND previous.user_id=g.user_id
        ON CONFLICT(season_id,user_id) DO UPDATE SET
          balance=mednexus_season_wallets.balance+EXCLUDED.balance,
          lifetime_earned=mednexus_season_wallets.lifetime_earned+EXCLUDED.lifetime_earned,
          updated_at=NOW()`,[target.id,target.opening_grant,target.economy_version,migrationId,current.id])
      const after=await client.query("SELECT COALESCE(SUM(balance),0)::bigint total FROM mednexus_season_wallets WHERE season_id=$1",[target.id]);const expected=BigInt(before.rows[0].total)+BigInt(affectedUsers)*BigInt(target.opening_grant)
      if(BigInt(after.rows[0].total)!==expected)throw new Error(`Opening balance verification failed: expected ${expected}, received ${after.rows[0].total}.`)
      await client.query(`INSERT INTO mednexus_economy_cutovers(migration_id,from_season_id,to_season_id,affected_users,before_total,after_total,executed_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,[migrationId,current.id,target.id,affectedUsers,before.rows[0].total,after.rows[0].total,admin.uid])
      await client.query(`INSERT INTO mednexus_user_notifications(id,user_id,type,message,action_url,action_label) SELECT $1||'-'||uid,uid,'economy',$2,'/?hub=rankings','View season' FROM mednexus_registered_users WHERE status='approved' ON CONFLICT DO NOTHING`,[migrationId,`${target.name} has started. You received ${target.opening_grant} NP.`])
      await auditAdmin(client,admin.uid,"activate","economy_season",target.id,{fromSeasonId:current.id,migrationId,affectedUsers,beforeTotal:before.rows[0].total,afterTotal:after.rows[0].total})
      await client.query("COMMIT")
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
    return NextResponse.json({ok:true,...await payload()})
  }catch(error){
    console.error("[economy seasons POST]",error)
    if(error instanceof EconomySeasonSchemaError||databaseCode(error).startsWith("08"))return NextResponse.json(loadFailure(error),{status:503})
    return failure(error instanceof Error?error.message:"Unable to update economy seasons.",databaseCode(error)==="23505"?"DUPLICATE_ECONOMY_OPERATION":"ECONOMY_OPERATION_FAILED")
  }
}
