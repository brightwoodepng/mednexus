import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"
import { assertEconomySeasonSchema, EconomySeasonSchemaError } from "@/lib/economy-seasons"
import { applyNPCredits } from "@/lib/np-ledger"
import { randomUUID } from "node:crypto"

const confirmationFor=(name:string)=>`START ${name.trim().toUpperCase()}`
const slug=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)
const validRewards=(values:number[])=>values.length>0&&values.length<=100&&values.every(value=>Number.isInteger(value)&&value>=0&&value<=100000)

async function awardSeasonWinners(client: import("pg").PoolClient, season: Record<string,unknown>) {
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
  for (const winner of winners.rows) {
    const amount = rewards[Number(winner.place)-1] ?? 0
    if (amount <= 0) continue
    await applyNPCredits(client,winner.uid,[{source:"leaderboard_reward",sourceId:`season:${season.id}:place:${winner.place}`,amount,countsTowardClinicalRank:false,ceilingPolicy:"exempt",metadata:{seasonId:season.id,place:Number(winner.place),xp:Number(winner.total_xp),rewardCategory:"season_winner"}}])
    await client.query(`INSERT INTO mednexus_user_notifications(id,user_id,type,message,action_url,action_label) VALUES($1,$2,'leaderboard',$3,'/?hub=rankings','View rankings') ON CONFLICT DO NOTHING`,[`season-winner-${season.id}-${winner.uid}`,winner.uid,`Season complete — you placed #${winner.place} and earned ${amount} NT.`])
  }
}

async function awardMonthlyWinners(client: import("pg").PoolClient, season: Record<string,unknown>, month:string) {
  if(!/^\d{4}-\d{2}$/.test(month))throw new Error("Choose a valid completed month.")
  const start=new Date(`${month}-01T00:00:00Z`),end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1))
  if(Number.isNaN(start.getTime())||end>new Date(new Date().toISOString().slice(0,7)+"-01T00:00:00Z"))throw new Error("Only completed months can be finalized.")
  const rewards=Array.isArray(season.monthly_rewards)?season.monthly_rewards.map(Number):[]
  const winners=await client.query(`WITH xp AS (
      SELECT user_id,SUM(amount)::bigint total_xp FROM mednexus_xp_transactions WHERE competitive=TRUE AND created_at>=$1 AND created_at<$2 GROUP BY user_id
    ),activity AS (
      SELECT user_id,SUM(questions_answered)::bigint questions,SUM(correct_answers)::bigint correct FROM mednexus_daily_activity WHERE activity_date>=$3 AND activity_date<$4 GROUP BY user_id
    ) SELECT r.uid,COALESCE(xp.total_xp,0) total_xp,ROW_NUMBER() OVER(ORDER BY COALESCE(xp.total_xp,0) DESC,
      CASE WHEN COALESCE(activity.questions,0)>0 THEN activity.correct::numeric/activity.questions ELSE 0 END DESC,r.uid) place
      FROM mednexus_registered_users r JOIN xp ON xp.user_id=r.uid JOIN activity ON activity.user_id=r.uid
      WHERE r.status='approved' AND COALESCE(activity.questions,0)>=$5 ORDER BY place LIMIT $6`,
    [start.toISOString(),end.toISOString(),`${month}-01`,end.toISOString().slice(0,10),Number(season.minimum_eligible_questions??300),rewards.length])
  for(const winner of winners.rows){const amount=rewards[Number(winner.place)-1]??0;if(amount<=0)continue
    await applyNPCredits(client,winner.uid,[{source:"leaderboard_reward",sourceId:`month:${month}:place:${winner.place}`,amount,countsTowardClinicalRank:false,ceilingPolicy:"exempt",metadata:{month,place:Number(winner.place),xp:Number(winner.total_xp),rewardCategory:"monthly_winner"}}])
    await client.query(`INSERT INTO mednexus_user_notifications(id,user_id,type,message,action_url,action_label) VALUES($1,$2,'leaderboard',$3,'/?hub=rankings','View rankings') ON CONFLICT DO NOTHING`,[`month-winner-${month}-${winner.uid}`,winner.uid,`Monthly rankings finalized — you placed #${winner.place} and earned ${amount} NT.`])
  }
  return winners.rowCount??winners.rows.length
}

function databaseCode(error:unknown){return typeof error==="object"&&error!==null&&"code" in error?String((error as {code?:unknown}).code??""):""}
function loadFailure(error:unknown){
  if(error instanceof EconomySeasonSchemaError)return {error:"Economy Seasons needs the latest database migration before it can be managed.",code:"ECONOMY_SCHEMA_NOT_READY",missing:error.missing}
  if(databaseCode(error).startsWith("08"))return {error:"The database could not be reached. Check the configured database URL and try again.",code:"DATABASE_UNREACHABLE"}
  return {error:"Economy Seasons could not be loaded. The database responded, but the season data could not be verified.",code:"ECONOMY_SEASONS_INVALID"}
}

async function payload(){
  const [seasons,dryRun]=await Promise.all([
    pool.query(`SELECT s.id,s.name,s.economy_version,s.status,s.starts_at,s.ends_at,s.created_at,s.activated_at,s.opening_grant,s.minimum_eligible_questions,s.monthly_rewards,s.seasonal_rewards,
      COUNT(w.user_id)::int member_count,COALESCE(SUM(w.balance),0)::bigint currency_supply,
      COALESCE(SUM(w.lifetime_earned),0)::bigint currency_earned,
      c.executed_at cutover_completed_at FROM mednexus_economy_seasons s
      LEFT JOIN mednexus_season_wallets w ON w.season_id=s.id LEFT JOIN mednexus_economy_cutovers c ON c.to_season_id=s.id
      GROUP BY s.id,c.executed_at ORDER BY s.starts_at DESC`),
    pool.query(`SELECT COUNT(*) FILTER(WHERE status='approved')::int approved_users,
      COUNT(*) FILTER(WHERE status<>'approved')::int ineligible_users FROM mednexus_registered_users`),
  ])
  return {seasons:seasons.rows,dryRunReport:dryRun.rows[0],activeSeason:seasons.rows.find(row=>row.status==="active")??null}
}

export async function GET(req:NextRequest){
  const admin=await requireAdminRequest(req,"manage_system");if(!admin)return adminAccessDenied(req)
  try{await assertEconomySeasonSchema(pool);const data=await payload();if(req.nextUrl.searchParams.get("download")==="1")return new NextResponse(JSON.stringify(data,null,2),{headers:{"content-type":"application/json","content-disposition":"attachment; filename=mednexus-season-dry-run.json"}});return NextResponse.json(data)}
  catch(error){console.error("[economy seasons GET]",error);return NextResponse.json(loadFailure(error),{status:503})}
}

export async function POST(req:NextRequest){
  const admin=await requireAdminRequest(req,"manage_system");if(!admin)return adminAccessDenied(req)
  if(admin.role!=="SUPER_ADMIN")return NextResponse.json({error:"Only a super administrator can reset an economy season."},{status:403})
  try{
    await assertEconomySeasonSchema(pool);const body=await req.json() as Record<string,unknown>;const action=String(body.action??"")
    if(action==="update_rules"){
      const seasonId=String(body.seasonId??""),minimumEligibleQuestions=Number(body.minimumEligibleQuestions)
      const monthlyRewards=Array.isArray(body.monthlyRewards)?body.monthlyRewards.map(Number):[],seasonalRewards=Array.isArray(body.seasonalRewards)?body.seasonalRewards.map(Number):[]
      if(!seasonId||!Number.isInteger(minimumEligibleQuestions)||minimumEligibleQuestions<1||minimumEligibleQuestions>100000||!validRewards(monthlyRewards)||!validRewards(seasonalRewards))return NextResponse.json({error:"Enter valid eligibility and reward amounts."},{status:400})
      const client=await pool.connect();try{await client.query("BEGIN");const updated=await client.query(`UPDATE mednexus_economy_seasons SET minimum_eligible_questions=$2,monthly_rewards=$3::jsonb,seasonal_rewards=$4::jsonb WHERE id=$1 AND status IN ('planned','active') RETURNING id`,[seasonId,minimumEligibleQuestions,JSON.stringify(monthlyRewards),JSON.stringify(seasonalRewards)]);if(!updated.rowCount)throw new Error("Choose an active or planned season.");await auditAdmin(client,admin.uid,"update","economy_rules",seasonId,{minimumEligibleQuestions,monthlyRewards,seasonalRewards});await client.query("COMMIT")}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}return NextResponse.json({ok:true,...await payload()})
    }
    if(action==="gift_nt"){
      const indexNumber=String(body.indexNumber??"").trim(),amount=Number(body.amount??0),note=String(body.note??"").trim()
      if(!indexNumber||!Number.isInteger(amount)||amount<1||amount>100000||note.length<3)return NextResponse.json({error:"Enter a valid index number, an NT amount from 1 to 100,000, and a short gift note."},{status:400})
      const client=await pool.connect();try{await client.query("BEGIN");const user=await client.query("SELECT uid,name,index_number FROM mednexus_registered_users WHERE LOWER(index_number)=LOWER($1) AND status='approved' FOR UPDATE",[indexNumber]);if(!user.rowCount)throw new Error("No approved learner matches that index number.");const giftId=randomUUID();await applyNPCredits(client,user.rows[0].uid,[{source:"admin_gift",sourceId:giftId,amount,countsTowardClinicalRank:false,ceilingPolicy:"exempt",metadata:{note,administrator:admin.uid,indexNumber:user.rows[0].index_number,displayCurrency:"NT"}}]);await client.query(`INSERT INTO mednexus_user_notifications(id,user_id,type,message,action_url,action_label) VALUES($1,$2,'economy',$3,'/','View balance') ON CONFLICT DO NOTHING`,[`admin-gift-${giftId}`,user.rows[0].uid,`You received a gift of ${amount} NT from MedNexus: ${note}`]);await auditAdmin(client,admin.uid,"gift","learner_nt",user.rows[0].uid,{giftId,indexNumber:user.rows[0].index_number,amount,note});await client.query("COMMIT")}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}return NextResponse.json({ok:true,...await payload()})
    }
    if(action==="award_month"){
      if(admin.role!=="SUPER_ADMIN")return NextResponse.json({error:"Only a super administrator can finalize monthly rewards."},{status:403})
      const client=await pool.connect();try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus:monthly-leaderboard-award'))");const current=(await client.query("SELECT * FROM mednexus_economy_seasons WHERE status='active' FOR UPDATE")).rows[0];if(!current)throw new Error("No active season is available.");await awardMonthlyWinners(client,current,String(body.month??""));await auditAdmin(client,admin.uid,"award","monthly_leaderboard",String(body.month??""),{});await client.query("COMMIT")}catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}return NextResponse.json({ok:true,...await payload()})
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
    if(action!=="activate")return NextResponse.json({error:"Unknown season action."},{status:400})
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
      await awardSeasonWinners(client,current)
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
      await client.query(`INSERT INTO mednexus_user_notifications(id,user_id,type,message,action_url,action_label) SELECT $1||'-'||uid,uid,'economy',$2,'/?hub=rankings','View season' FROM mednexus_registered_users WHERE status='approved' ON CONFLICT DO NOTHING`,[migrationId,`${target.name} has started. You received ${target.opening_grant} NT.`])
      await auditAdmin(client,admin.uid,"activate","economy_season",target.id,{fromSeasonId:current.id,migrationId,affectedUsers,beforeTotal:before.rows[0].total,afterTotal:after.rows[0].total})
      await client.query("COMMIT")
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
    return NextResponse.json({ok:true,...await payload()})
  }catch(error){
    console.error("[economy seasons POST]",error)
    if(error instanceof EconomySeasonSchemaError||databaseCode(error).startsWith("08"))return NextResponse.json(loadFailure(error),{status:503})
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to update economy seasons."},{status:400})
  }
}
