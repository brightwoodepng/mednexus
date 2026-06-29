module.exports = [
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
"[externals]/pg [external] (pg, esm_import, [project]/node_modules/.pnpm/pg@8.22.0/node_modules/pg)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

const mod = await __turbopack_context__.y("pg-4c0d8067d674414d");

__turbopack_context__.n(mod);
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, true);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0blzg-0._.js.map