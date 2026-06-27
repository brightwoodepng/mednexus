import { Pool } from "pg"

// REPL_ID is only present inside Replit's runtime.
// On Vercel / Netlify / external hosts, SSL is required (Neon, Supabase, etc.)
const isReplit = Boolean(process.env.REPL_ID)

// In serverless environments (Vercel), keep the pool small to avoid
// exhausting Neon's connection limit across concurrent function invocations.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isReplit ? false : { rejectUnauthorized: false },
  max: isReplit ? 10 : 3,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 20000,
})

let initialized = false

export async function ensureSchema() {
  if (initialized) return
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
  `)
  initialized = true
}

export default pool
