import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"
import { provisionActiveSeasonWallet } from "@/lib/economy-seasons"

const confirmationFor=(name:string)=>`START ${name.trim().toUpperCase()}`
const slug=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)

async function payload(){
  const [seasons,dryRun]=await Promise.all([
    pool.query(`SELECT s.id,s.name,s.economy_version,s.status,s.starts_at,s.ends_at,s.created_at,s.activated_at,s.opening_grant,
      COUNT(w.user_id)::int member_count,COALESCE(SUM(w.lifetime_earned),0)::bigint currency_created,
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
  try{await ensureSchema();const data=await payload();if(req.nextUrl.searchParams.get("download")==="1")return new NextResponse(JSON.stringify(data,null,2),{headers:{"content-type":"application/json","content-disposition":"attachment; filename=mednexus-season-dry-run.json"}});return NextResponse.json(data)}
  catch(error){console.error("[economy seasons GET]",error);return NextResponse.json({error:"Economy seasons are temporarily unavailable. Retry after checking the database connection."},{status:503})}
}

export async function POST(req:NextRequest){
  const admin=await requireAdminRequest(req,"manage_system");if(!admin)return adminAccessDenied(req)
  if(admin.role!=="SUPER_ADMIN")return NextResponse.json({error:"Only a super administrator can reset an economy season."},{status:403})
  try{
    await ensureSchema();const body=await req.json() as Record<string,unknown>;const action=String(body.action??"")
    if(action==="create"){
      const name=typeof body.name==="string"?body.name.trim():"",version=typeof body.economyVersion==="string"?body.economyVersion.trim():""
      const openingGrant=Number(body.openingGrant),startsAt=typeof body.startsAt==="string"?new Date(body.startsAt):new Date()
      if(name.length<3||!version||!Number.isInteger(openingGrant)||openingGrant<0||openingGrant>100000||Number.isNaN(startsAt.getTime()))return NextResponse.json({error:"Enter a valid name, economy version, start time, and opening grant."},{status:400})
      const id=`${slug(name)}-${Date.now().toString(36)}`
      await pool.query(`INSERT INTO mednexus_economy_seasons(id,name,economy_version,status,starts_at,created_by,opening_grant) VALUES($1,$2,$3,'planned',$4,$5,$6)`,[id,name,version,startsAt.toISOString(),admin.uid,openingGrant])
      await auditAdmin(pool,admin.uid,"create","economy_season",id,{name,version,openingGrant,startsAt:startsAt.toISOString()})
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
      const previousMaintenance=await client.query("SELECT maintenance_enabled,maintenance_message FROM mednexus_system_settings WHERE id=1 FOR UPDATE")
      await client.query("UPDATE mednexus_system_settings SET maintenance_enabled=TRUE,maintenance_message='Economy season reset is in progress.' WHERE id=1")
      const before=await client.query("SELECT COALESCE(SUM(balance),0)::bigint total FROM mednexus_season_wallets WHERE season_id=$1",[current.id])
      await client.query(`INSERT INTO mednexus_economy_season_archives(season_id,user_id,closing_balance,lifetime_np,rank_points,login_streak,longest_streak,mcq_activity,game_personal_bests,bounty_progress,weekly_goal_progress,inventory_value,closing_leaderboard_position,migration_id)
        SELECT $1,r.uid,COALESCE(w.balance,0),COALESCE(w.lifetime_earned,0),COALESCE(w.rank_points,0),r.login_streak,r.longest_streak,COALESCE(p.data,'{}'),
        COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM mednexus_game_personal_bests g WHERE g.user_id=r.uid AND g.season_id=$1),'[]'),
        COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM mednexus_bounty_progress b WHERE b.uid=r.uid AND b.season_id=$1),'[]'),
        COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM mednexus_weekly_goal_progress q WHERE q.uid=r.uid AND q.season_id=$1),'[]'),
        COALESCE((SELECT SUM(i.quantity) FROM mednexus_user_inventory i WHERE i.uid=r.uid),0),ROW_NUMBER() OVER(ORDER BY COALESCE(w.lifetime_earned,0) DESC,r.uid),$2
        FROM mednexus_registered_users r LEFT JOIN mednexus_season_wallets w ON w.user_id=r.uid AND w.season_id=$1 LEFT JOIN mednexus_progress p ON p.uid=r.uid
        WHERE r.status='approved' ON CONFLICT(season_id,user_id) DO NOTHING`,[current.id,migrationId])
      await client.query("UPDATE mednexus_economy_seasons SET status='closed',ends_at=NOW() WHERE id=$1",[current.id])
      await client.query("UPDATE mednexus_economy_seasons SET status='active',starts_at=NOW(),activated_at=NOW(),activated_by=$2,activation_migration_id=$3 WHERE id=$1",[target.id,admin.uid,migrationId])
      await client.query("UPDATE mednexus_registered_users SET login_streak=0,longest_streak=0,last_login_date=NULL WHERE status='approved'")
      // Archived records remain available above; these season-scoped earning counters must start clean.
      await client.query("DELETE FROM mednexus_game_personal_bests WHERE season_id=$1",[current.id])
      await client.query("DELETE FROM mednexus_bounty_progress WHERE season_id=$1",[current.id])
      await client.query("DELETE FROM mednexus_weekly_goal_progress WHERE season_id=$1",[current.id])
      await client.query("DELETE FROM mednexus_daily_activity WHERE season_id=$1",[current.id])
      await client.query("DELETE FROM mednexus_discipline_np_log WHERE season_id=$1",[current.id])
      await client.query("DELETE FROM mednexus_user_question_progress WHERE season_id=$1",[current.id])
      const users=await client.query("SELECT uid FROM mednexus_registered_users WHERE status='approved' ORDER BY uid")
      for(const user of users.rows)await provisionActiveSeasonWallet(client,user.uid,migrationId)
      const affectedUsers=users.rowCount??users.rows.length
      const after=await client.query("SELECT COALESCE(SUM(balance),0)::bigint total FROM mednexus_season_wallets WHERE season_id=$1",[target.id]);const expected=affectedUsers*Number(target.opening_grant)
      if(Number(after.rows[0].total)!==expected)throw new Error(`Opening balance verification failed: expected ${expected}, received ${after.rows[0].total}.`)
      await client.query(`INSERT INTO mednexus_economy_cutovers(migration_id,from_season_id,to_season_id,affected_users,before_total,after_total,executed_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,[migrationId,current.id,target.id,affectedUsers,before.rows[0].total,after.rows[0].total,admin.uid])
      await client.query(`INSERT INTO mednexus_user_notifications(id,user_id,type,message) SELECT $1||'-'||uid,uid,'economy',$2 FROM mednexus_registered_users WHERE status='approved' ON CONFLICT DO NOTHING`,[migrationId,`${target.name} has started. You received ${target.opening_grant} NP.`])
      await auditAdmin(client,admin.uid,"activate","economy_season",target.id,{fromSeasonId:current.id,migrationId,affectedUsers,beforeTotal:before.rows[0].total,afterTotal:after.rows[0].total})
      await client.query("UPDATE mednexus_system_settings SET maintenance_enabled=$1,maintenance_message=$2 WHERE id=1",[previousMaintenance.rows[0]?.maintenance_enabled??false,previousMaintenance.rows[0]?.maintenance_message??""])
      await client.query("COMMIT")
    }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
    return NextResponse.json({ok:true,...await payload()})
  }catch(error){console.error("[economy seasons POST]",error);return NextResponse.json({error:error instanceof Error?error.message:"Unable to update economy seasons."},{status:400})}
}
