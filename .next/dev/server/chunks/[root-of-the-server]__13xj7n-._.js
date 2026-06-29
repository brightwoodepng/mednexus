module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "ensureSchema",
    ()=>ensureSchema
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$pg$40$8$2e$22$2e$0$2f$node_modules$2f$pg$29$__ = __turbopack_context__.i("[externals]/pg [external] (pg, esm_import, [project]/node_modules/.pnpm/pg@8.22.0/node_modules/pg)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$pg$40$8$2e$22$2e$0$2f$node_modules$2f$pg$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$pg$40$8$2e$22$2e$0$2f$node_modules$2f$pg$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
// REPL_ID is only present inside Replit's runtime.
// On Vercel / Netlify / external hosts, SSL is required (Neon, Supabase, etc.)
const isReplit = Boolean(process.env.REPL_ID);
// In serverless environments (Vercel), keep the pool small to avoid
// exhausting Neon's connection limit across concurrent function invocations.
const pool = new __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$pg$40$8$2e$22$2e$0$2f$node_modules$2f$pg$29$__["Pool"]({
    connectionString: process.env.DATABASE_URL,
    ssl: isReplit ? false : {
        rejectUnauthorized: false
    },
    max: isReplit ? 10 : 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 20000
});
let initialized = false;
async function ensureSchema() {
    if (initialized) return;
    await pool.query(`
    CREATE TABLE IF NOT EXISTS mednexus_users (
      uid TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Clinician',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_progress (
      uid TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_questions (
      id INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      admin_only BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE mednexus_notifications ADD COLUMN IF NOT EXISTS admin_only BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS mednexus_assessments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      module_name TEXT NOT NULL,
      question_ids JSONB NOT NULL DEFAULT '[]',
      question_count INTEGER NOT NULL DEFAULT 10,
      time_limit_mins INTEGER NOT NULL DEFAULT 30,
      tries_allowed INTEGER NOT NULL DEFAULT 1,
      pass_mark INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'offline',
      share_token TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_assessment_attempts (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      is_guest BOOLEAN NOT NULL DEFAULT false,
      answers JSONB NOT NULL DEFAULT '{}',
      score INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      submitted_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS mednexus_registered_users (
      uid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT '',
      index_number TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      otp_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_game_rooms (
      pin TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      host_id TEXT NOT NULL,
      host_name TEXT NOT NULL,
      question_pool JSONB NOT NULL DEFAULT '[]',
      current_qi INTEGER NOT NULL DEFAULT 0,
      phase TEXT NOT NULL DEFAULT 'lobby',
      players JSONB NOT NULL DEFAULT '[]',
      version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '4 hours'
    );
    ALTER TABLE mednexus_game_rooms ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
    DELETE FROM mednexus_game_rooms WHERE expires_at < NOW();
  `);
    initialized = true;
}
const __TURBOPACK__default__export__ = pool;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/app/api/game-rooms/[pin]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET,
    "PATCH",
    ()=>PATCH
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.2.9_@babel+core@7.29.7_@opentelemetry+api@1.9.1_react-dom@19.2.7_react@19.2.7__react@19.2.7/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/db.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
function buildResponse(row, myId) {
    // Never expose correctAnswer while players are still answering
    const isRevealedPhase = row.phase === "reveal" || row.phase === "done";
    const safePool = row.question_pool.map((q)=>({
            ...q,
            correctAnswer: isRevealedPhase ? q.correctAnswer : undefined
        }));
    const sorted = [
        ...row.players
    ].sort((a, b)=>b.score - a.score);
    const leaderboard = sorted.slice(0, 5);
    const ranks = {};
    sorted.forEach((p, i)=>{
        ranks[p.id] = i + 1;
    });
    return {
        pin: row.pin,
        mode: row.mode,
        hostId: row.host_id,
        hostName: row.host_name,
        questionPool: safePool,
        currentQi: row.current_qi,
        phase: row.phase,
        players: row.players,
        version: row.version ?? 0,
        createdAt: row.created_at?.toISOString?.() ?? "",
        leaderboard,
        ranks,
        myRank: myId ? ranks[myId] ?? null : null
    };
}
async function GET(req, { params }) {
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ensureSchema"])();
        const { pin } = await params;
        const myId = new URL(req.url).searchParams.get("playerId") ?? undefined;
        const res = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query("SELECT * FROM mednexus_game_rooms WHERE pin = $1", [
            pin
        ]);
        if (res.rows.length === 0) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Room not found"
        }, {
            status: 404
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(buildResponse(res.rows[0], myId));
    } catch (err) {
        console.error("[game-rooms GET]", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Server error"
        }, {
            status: 500
        });
    }
}
async function PATCH(req, { params }) {
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ensureSchema"])();
        const { pin } = await params;
        const body = await req.json();
        await client.query("BEGIN");
        const res = await client.query("SELECT * FROM mednexus_game_rooms WHERE pin = $1 FOR UPDATE", [
            pin
        ]);
        if (res.rows.length === 0) {
            await client.query("ROLLBACK");
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Room not found"
            }, {
                status: 404
            });
        }
        const row = res.rows[0];
        let players = [
            ...row.players
        ];
        // ── Host-only action guard ────────────────────────────────────────────────
        const HOST_ACTIONS = [
            "start",
            "advance",
            "finish"
        ];
        if (HOST_ACTIONS.includes(body.action)) {
            if (!body.requesterId || body.requesterId !== row.host_id) {
                await client.query("ROLLBACK");
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: "Forbidden: host-only action"
                }, {
                    status: 403
                });
            }
        }
        switch(body.action){
            case "join":
                {
                    if (!body.playerId || !body.playerName) {
                        await client.query("ROLLBACK");
                        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                            error: "Missing playerId or playerName"
                        }, {
                            status: 400
                        });
                    }
                    // Idempotent rejoin
                    if (players.find((p)=>p.id === body.playerId)) break;
                    if (row.phase !== "lobby") {
                        // Allow late join in cohort only
                        if (row.mode !== "cohort") {
                            await client.query("ROLLBACK");
                            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                                error: "Game already started"
                            }, {
                                status: 409
                            });
                        }
                    }
                    // Clash: max 5 players
                    if (row.mode === "clash" && players.length >= 5) {
                        await client.query("ROLLBACK");
                        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                            error: "Room is full (max 5 players)"
                        }, {
                            status: 409
                        });
                    }
                    players.push({
                        id: body.playerId,
                        name: body.playerName,
                        score: 0,
                        streak: 0,
                        answer: null,
                        answeredAt: null,
                        isHost: false
                    });
                    await client.query("UPDATE mednexus_game_rooms SET players = $1, version = COALESCE(version, 0) + 1 WHERE pin = $2", [
                        JSON.stringify(players),
                        pin
                    ]);
                    break;
                }
            case "start":
                {
                    if (row.phase !== "lobby") {
                        await client.query("ROLLBACK");
                        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                            error: "Already started"
                        }, {
                            status: 409
                        });
                    }
                    players = players.map((p)=>({
                            ...p,
                            answer: null,
                            answeredAt: null
                        }));
                    await client.query("UPDATE mednexus_game_rooms SET phase = 'question', current_qi = 0, players = $1, version = COALESCE(version, 0) + 1 WHERE pin = $2", [
                        JSON.stringify(players),
                        pin
                    ]);
                    break;
                }
            case "answer":
                {
                    if (!body.playerId || !body.answer) {
                        await client.query("ROLLBACK");
                        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                            error: "Missing playerId or answer"
                        }, {
                            status: 400
                        });
                    }
                    // Verify caller is the player they claim to be
                    if (body.requesterId && body.requesterId !== body.playerId) {
                        await client.query("ROLLBACK");
                        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                            error: "Forbidden"
                        }, {
                            status: 403
                        });
                    }
                    if (row.phase !== "question") break;
                    const q = row.question_pool[row.current_qi];
                    if (!q) break;
                    const correct = body.answer === q.correctAnswer;
                    const now = Date.now();
                    players = players.map((p)=>{
                        if (p.id !== body.playerId) return p;
                        if (p.answer !== null) return p // already answered
                        ;
                        const newStreak = correct ? p.streak + 1 : 0;
                        const newScore = correct ? p.score + 100 + Math.max(0, p.streak * 10) : p.score;
                        return {
                            ...p,
                            answer: body.answer,
                            answeredAt: now,
                            score: newScore,
                            streak: newStreak
                        };
                    });
                    await client.query("UPDATE mednexus_game_rooms SET players = $1, version = COALESCE(version, 0) + 1 WHERE pin = $2", [
                        JSON.stringify(players),
                        pin
                    ]);
                    break;
                }
            case "advance":
                {
                    if (row.phase === "question") {
                        await client.query("UPDATE mednexus_game_rooms SET phase = 'reveal', version = COALESCE(version, 0) + 1 WHERE pin = $1", [
                            pin
                        ]);
                    } else if (row.phase === "reveal") {
                        const nextQi = row.current_qi + 1;
                        if (nextQi >= row.question_pool.length) {
                            await client.query("UPDATE mednexus_game_rooms SET phase = 'done', version = COALESCE(version, 0) + 1 WHERE pin = $1", [
                                pin
                            ]);
                        } else {
                            players = players.map((p)=>({
                                    ...p,
                                    answer: null,
                                    answeredAt: null
                                }));
                            await client.query("UPDATE mednexus_game_rooms SET phase = 'question', current_qi = $1, players = $2, version = COALESCE(version, 0) + 1 WHERE pin = $3", [
                                nextQi,
                                JSON.stringify(players),
                                pin
                            ]);
                        }
                    }
                    break;
                }
            case "finish":
                {
                    await client.query("UPDATE mednexus_game_rooms SET phase = 'done', version = COALESCE(version, 0) + 1 WHERE pin = $1", [
                        pin
                    ]);
                    break;
                }
            default:
                await client.query("ROLLBACK");
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: "Unknown action"
                }, {
                    status: 400
                });
        }
        await client.query("COMMIT");
        // Return updated state (pass requesterId as myId for personalized response)
        const updated = await client.query("SELECT * FROM mednexus_game_rooms WHERE pin = $1", [
            pin
        ]);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(buildResponse(updated.rows[0], body.playerId ?? body.requesterId));
    } catch (err) {
        await client.query("ROLLBACK").catch(()=>{});
        console.error("[game-rooms PATCH]", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Server error"
        }, {
            status: 500
        });
    } finally{
        client.release();
    }
}
async function DELETE(req, { params }) {
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ensureSchema"])();
        const { pin } = await params;
        const requesterId = new URL(req.url).searchParams.get("requesterId");
        if (!requesterId) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Missing requesterId"
        }, {
            status: 400
        });
        const check = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query("SELECT host_id FROM mednexus_game_rooms WHERE pin = $1", [
            pin
        ]);
        if (check.rows.length === 0) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true
        }) // already gone
        ;
        if (check.rows[0].host_id !== requesterId) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Forbidden"
            }, {
                status: 403
            });
        }
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query("DELETE FROM mednexus_game_rooms WHERE pin = $1", [
            pin
        ]);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true
        });
    } catch (err) {
        console.error("[game-rooms DELETE]", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$9_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_react$2d$dom$40$19$2e$2$2e$7_react$40$19$2e$2$2e$7_$5f$react$40$19$2e$2$2e$7$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Server error"
        }, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__13xj7n-._.js.map