import { redirect } from "next/navigation"
import { Download, LockKeyhole, ShieldCheck } from "lucide-react"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import pool, { ensureSchema } from "@/lib/db"

export default async function EconomySeasonsPage() {
  if (!await getVerifiedAdminFromCookie("manage_system")) redirect("/admin")
  await ensureSchema()
  const result = await pool.query(`SELECT s.id,s.name,s.economy_version,s.status,s.starts_at,s.ends_at,s.opening_grant,
    COUNT(w.user_id)::int member_count,COALESCE(SUM(w.lifetime_earned),0)::bigint currency_created,
    c.executed_at cutover_completed_at
    FROM mednexus_economy_seasons s LEFT JOIN mednexus_season_wallets w ON w.season_id=s.id
    LEFT JOIN mednexus_economy_cutovers c ON c.to_season_id=s.id
    GROUP BY s.id,c.executed_at ORDER BY s.starts_at DESC`)

  return <main className="mx-auto w-full max-w-6xl space-y-7 p-5 sm:p-8">
    <header className="grid gap-5 border-b border-border pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
      <div><p className="mb-2 font-mono text-xs font-bold uppercase tracking-[.22em] text-primary">Economy control ledger</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Season management</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Inspect immutable archives and deployment cutovers. Activation remains a confirmed, backed-up deployment operation—not a browser button.</p></div>
      <a href="/api/admin/economy-seasons?download=1" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Download size={16}/>Download dry-run report</a>
    </header>
    <section className="grid gap-4 md:grid-cols-3">
      {result.rows.map(season => <article key={season.id} className={`relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm ${season.status === "active" ? "border-primary/50" : "border-border"}`}>
        <div className={`absolute inset-y-0 left-0 w-1 ${season.status === "active" ? "bg-primary" : season.status === "closed" ? "bg-slate-400" : "bg-amber-400"}`}/>
        <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{season.economy_version}</p><h2 className="mt-1 text-xl font-extrabold">{season.name}</h2></div><span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">{season.status}</span></div>
        <dl className="mt-6 grid grid-cols-2 gap-x-3 gap-y-4 text-sm"><div><dt className="text-xs text-muted-foreground">Opening grant</dt><dd className="mt-1 font-bold">{season.opening_grant} NP</dd></div><div><dt className="text-xs text-muted-foreground">Members</dt><dd className="mt-1 font-bold">{season.member_count}</dd></div><div><dt className="text-xs text-muted-foreground">Currency created</dt><dd className="mt-1 font-bold">{Number(season.currency_created).toLocaleString()} NP</dd></div><div><dt className="text-xs text-muted-foreground">Started</dt><dd className="mt-1 font-bold">{new Date(season.starts_at).toLocaleDateString()}</dd></div></dl>
        <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">{season.cutover_completed_at ? <><ShieldCheck size={15} className="text-emerald-500"/>Cutover verified</> : <><LockKeyhole size={15}/>Awaiting deployment cutover</>}</div>
      </article>)}
    </section>
    <aside className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"><div className="flex gap-3"><LockKeyhole className="mt-0.5 shrink-0 text-amber-600" size={20}/><div><h2 className="font-bold">Protected activation</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Run <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">npm run economy:cutover -- --dry-run</code> against a database copy first. A backup reference and the explicit confirmation phrase are required before commit.</p></div></div></aside>
  </main>
}
