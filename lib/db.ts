import { Pool } from "pg"

// On Replit the internal Postgres doesn't need SSL.
// On external hosts (Neon, Supabase, etc.) SSL is required.
// REPL_ID is only present inside Replit's runtime.
const isReplit = Boolean(process.env.REPL_ID)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isReplit ? false : { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
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
  `)
  initialized = true
}

export default pool
