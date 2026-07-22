import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"
import { calculatePayout, getTodaysBounties, computeBountyProgress, computeRankUpBonus, RANK_UP_BONUS_NP, TODAY_DATE, type GameResult } from "@/lib/economy"
import { calculateSessionNP, type SessionQuestionInput } from "@/lib/anti-farming"
import { authenticateRequest, authError, identityMismatch } from "@/lib/request-auth"

type Key = { id: string; discipline: string; correctAnswer: string | string[] | null }
const correct = (answer: unknown, expected: Key["correctAnswer"]) => Array.isArray(answer) && Array.isArray(expected)
  ? answer.length === expected.length && [...answer].sort().every((v, i) => v === [...expected].sort()[i]) : answer === expected

/** Credits a completed, server-recorded activity exactly once. Client scores are never accepted. */
export async function POST(req: NextRequest) {
 try {
  const auth = authenticateRequest(req.headers); if (!auth) return authError()
  await ensureSchema()
  const { sessionId, uid } = await req.json()
  if (identityMismatch(uid, auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  const client = await pool.connect()
  try {
   await client.query("BEGIN")
   const { rows } = await client.query(`SELECT * FROM mednexus_exam_sessions WHERE id=$1 AND user_id=$2 FOR UPDATE`, [sessionId, auth.uid])
   const session = rows[0]
   if (!session) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Session not found" }, { status: 404 }) }
   if (session.payout) { await client.query("COMMIT"); return NextResponse.json(session.payout) }
   if (session.status !== "completed") { await client.query("ROLLBACK"); return NextResponse.json({ error: "Activity is not completed" }, { status: 409 }) }
   const keys = session.answer_key as Key[]; const answers = session.accepted_answers as Record<string, unknown>
   const sessionData: SessionQuestionInput[] = keys.map((q) => ({ questionId: q.id, discipline: q.discipline, isCorrect: correct(answers[q.id], q.correctAnswer) }))
   const total = keys.length, correctCount = sessionData.filter(q => q.isCorrect).length, accuracy = total ? Math.round(correctCount * 100 / total) : 0
   const result: GameResult = { mode: session.mode, score: accuracy, correct: correctCount, total, bestStreak: 0, isNewHigh: false, accuracy, lifelineUsed: false }
   const anti = auth.isGuest ? null : await calculateSessionNP(auth.uid, session.mode, sessionData, client, session.mode === "exam" ? { accuracy, correct: correctCount, total, primaryDiscipline: keys[0]?.discipline } : undefined)
   const gross = calculatePayout(result); const earned = anti ? anti.totalNP : gross.total; const breakdown = anti ? anti.breakdown : gross.breakdown
   const { rows: wallet } = await client.query(`INSERT INTO mednexus_wallet (uid,balance,rank_points,updated_at) VALUES ($1,$2,$2,NOW()) ON CONFLICT (uid) DO UPDATE SET balance=mednexus_wallet.balance+$2, rank_points=mednexus_wallet.rank_points+$2, updated_at=NOW() RETURNING balance, rank_points, rank_points-$2 AS old_rank_points`, [auth.uid, earned])
   let newBalance = Number(wallet[0].balance); const rank = computeRankUpBonus(Number(wallet[0].old_rank_points), Number(wallet[0].rank_points)); const rankBreakdown = rank.newTierNames.map(name => ({ label: `🎓 Rank-Up: ${name}!`, amount: RANK_UP_BONUS_NP }))
   if (rank.bonusNP) { await client.query("UPDATE mednexus_wallet SET balance=balance+$1 WHERE uid=$2", [rank.bonusNP, auth.uid]); newBalance += rank.bonusNP }
   const bountyUpdates: { id:string; progress:number; target:number; claimed:boolean; newlyComplete:boolean }[] = []
   for (const bounty of getTodaysBounties()) { const delta = computeBountyProgress(bounty, result); if (!delta) continue; const old = await client.query("SELECT progress,claimed FROM mednexus_bounty_progress WHERE uid=$1 AND bounty_id=$2 AND bounty_date=$3 FOR UPDATE", [auth.uid,bounty.id,TODAY_DATE()]); if (old.rows[0]?.claimed) continue; const progress=Math.min((old.rows[0]?.progress ?? 0)+delta,bounty.target); await client.query(`INSERT INTO mednexus_bounty_progress(uid,bounty_id,bounty_date,progress,claimed) VALUES($1,$2,$3,$4,FALSE) ON CONFLICT(uid,bounty_id,bounty_date) DO UPDATE SET progress=EXCLUDED.progress`,[auth.uid,bounty.id,TODAY_DATE(),progress]); bountyUpdates.push({id:bounty.id,progress,target:bounty.target,claimed:false,newlyComplete:progress===bounty.target && (old.rows[0]?.progress??0)<bounty.target}) }
   const payload={ earned, newBalance, breakdown:[...breakdown,...rankBreakdown], bountyUpdates, score:accuracy, correct:correctCount, total }
   await client.query("UPDATE mednexus_exam_sessions SET payout=$2::jsonb WHERE id=$1", [sessionId, JSON.stringify(payload)])
   await client.query("COMMIT"); return NextResponse.json(payload)
  } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
 } catch (error) { console.error("economy payout", error); return NextResponse.json({ error:"Server error" },{status:500}) }
}
