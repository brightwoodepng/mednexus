import { Pool } from "pg"

// Allow callers to supply the connection string via POSTGRES_URL (user-managed
// secret) when Replit's runtime-managed DATABASE_URL is not present.
if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL
}

// REPL_ID is only present inside Replit's runtime.
// On Vercel / Netlify / external hosts, SSL is required (Neon, Supabase, etc.)
const isReplit = Boolean(process.env.REPL_ID)

// Detect whether the connection string explicitly requests SSL (e.g. Neon).
// When sslmode=require is in the URL we must enable SSL even on Replit.
const connectionString = process.env.DATABASE_URL ?? ""
const requiresSsl = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech")

// In serverless environments (Vercel), keep the pool small to avoid
// exhausting Neon's connection limit across concurrent function invocations.
const pool = new Pool({
  connectionString,
  ssl: (!isReplit || requiresSsl) ? { rejectUnauthorized: false } : false,
  max: isReplit ? 10 : 3,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 20000,
})

let initialized = false
let groupStudyInitialized = false
// Keep this marker in step with every deployed DDL change. The previous
// assessment-grading marker predated the admin platform/settings and economy
// season tables, which let existing databases skip those additions entirely.
export const CURRENT_SCHEMA_VERSION = "2026-08-16-group-study-question-rotation-v1"

/**
 * Repairs only the small Group Study schema at request time. The full release
 * migration can contain unrelated legacy DDL that should never block this
 * feature on an existing production database.
 */
export async function ensureGroupStudySchema() {
  if (groupStudyInitialized) return
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus:group-study-schema'))")
    await client.query(`
      CREATE TABLE IF NOT EXISTS mednexus_group_study_rooms (
        id TEXT PRIMARY KEY,
        pin TEXT NOT NULL UNIQUE CHECK (pin ~ '^[0-9]{6}$'),
        host_user_id TEXT NOT NULL REFERENCES mednexus_registered_users(uid),
        module_id TEXT NOT NULL,
        discipline TEXT,
        difficulty TEXT NOT NULL DEFAULT 'mixed' CHECK (difficulty IN ('mixed','easy','medium','hard')),
        question_count INTEGER NOT NULL CHECK (question_count > 0),
        timer_seconds INTEGER CHECK (timer_seconds IS NULL OR timer_seconds IN (30,45,60,90)),
        status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','active','completed','ended','expired')),
        current_question_index INTEGER NOT NULL DEFAULT 0 CHECK (current_question_index >= 0),
        current_phase TEXT NOT NULL DEFAULT 'lobby' CHECK (current_phase IN ('lobby','question_open','answer_closed','reveal','discussion','completed','ended','expired')),
        question_opened_at TIMESTAMPTZ,
        answer_closes_at TIMESTAMPTZ,
        answer_closed_at TIMESTAMPTZ,
        host_disconnected_at TIMESTAMPTZ,
        version BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '4 hours',
        completed_at TIMESTAMPTZ
      );
      ALTER TABLE mednexus_group_study_rooms ADD COLUMN IF NOT EXISTS discipline TEXT;
      CREATE INDEX IF NOT EXISTS mednexus_group_study_rooms_expiry_idx
        ON mednexus_group_study_rooms (expires_at) WHERE status NOT IN ('completed','ended','expired');

      CREATE TABLE IF NOT EXISTS mednexus_group_study_room_questions (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL REFERENCES mednexus_group_study_rooms(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL,
        position INTEGER NOT NULL CHECK (position >= 0),
        question_snapshot JSONB NOT NULL,
        opened_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        UNIQUE (room_id, position),
        UNIQUE (room_id, question_id)
      );

      CREATE TABLE IF NOT EXISTS mednexus_group_study_question_history (
        user_id TEXT NOT NULL REFERENCES mednexus_registered_users(uid) ON DELETE CASCADE,
        module_id TEXT NOT NULL,
        discipline_scope TEXT NOT NULL DEFAULT '',
        question_id TEXT NOT NULL,
        last_selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        selection_count INTEGER NOT NULL DEFAULT 1 CHECK (selection_count > 0),
        PRIMARY KEY (user_id, module_id, discipline_scope, question_id)
      );
      CREATE INDEX IF NOT EXISTS mednexus_group_study_question_history_rotation_idx
        ON mednexus_group_study_question_history (user_id, module_id, discipline_scope, last_selected_at);

      CREATE TABLE IF NOT EXISTS mednexus_group_study_memberships (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL REFERENCES mednexus_group_study_rooms(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES mednexus_registered_users(uid),
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('host','member')),
        ready BOOLEAN NOT NULL DEFAULT FALSE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        left_at TIMESTAMPTZ,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        connection_status TEXT NOT NULL DEFAULT 'online' CHECK (connection_status IN ('online','disconnected','left')),
        first_eligible_question INTEGER CHECK (first_eligible_question IS NULL OR first_eligible_question >= 0),
        questions_attempted INTEGER NOT NULL DEFAULT 0,
        correct_answers INTEGER NOT NULL DEFAULT 0,
        incorrect_answers INTEGER NOT NULL DEFAULT 0,
        eligible_unanswered INTEGER NOT NULL DEFAULT 0,
        current_streak INTEGER NOT NULL DEFAULT 0,
        highest_streak INTEGER NOT NULL DEFAULT 0,
        room_score INTEGER NOT NULL DEFAULT 0,
        session_np_earned INTEGER NOT NULL DEFAULT 0,
        UNIQUE (room_id, user_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS mednexus_group_study_single_host_idx
        ON mednexus_group_study_memberships (room_id) WHERE role = 'host';
      CREATE INDEX IF NOT EXISTS mednexus_group_study_members_room_idx
        ON mednexus_group_study_memberships (room_id, joined_at);

      CREATE TABLE IF NOT EXISTS mednexus_group_study_answers (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL REFERENCES mednexus_group_study_rooms(id) ON DELETE CASCADE,
        room_question_id TEXT NOT NULL REFERENCES mednexus_group_study_room_questions(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES mednexus_registered_users(uid),
        selected_answer JSONB NOT NULL,
        is_correct BOOLEAN NOT NULL,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        score_processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (score_processing_status IN ('pending','processed','failed')),
        progress_processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (progress_processing_status IN ('pending','processed','failed')),
        np_processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (np_processing_status IN ('pending','processed','failed')),
        np_earned INTEGER NOT NULL DEFAULT 0,
        UNIQUE (room_question_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS mednexus_group_study_answers_room_idx
        ON mednexus_group_study_answers (room_id, room_question_id);

      CREATE TABLE IF NOT EXISTS mednexus_group_study_reward_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES mednexus_registered_users(uid),
        room_id TEXT NOT NULL REFERENCES mednexus_group_study_rooms(id) ON DELETE CASCADE,
        room_question_id TEXT REFERENCES mednexus_group_study_room_questions(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL CHECK (event_type IN ('participation','correct_answer','completion','streak','achievement')),
        transaction_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS mednexus_group_study_reward_idempotency_idx
        ON mednexus_group_study_reward_events
        (user_id, room_id, COALESCE(room_question_id, '__room__'), event_type);
    `)
    await client.query("COMMIT")
    groupStudyInitialized = true
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function ensureSchema() {
  if (initialized) return

  const client = await pool.connect()
  try {
    // Serverless cold starts used to execute the complete 1,000+ line
    // idempotent schema program. A deployed schema needs only this tiny marker
    // lookup; explicit release migrations install the marker after succeeding.
    try {
      const current = await client.query(
        `SELECT EXISTS (
           SELECT 1 FROM mednexus_schema_migrations WHERE version=$1
         ) AS current`,
        [CURRENT_SCHEMA_VERSION],
      )
      if (current.rows[0]?.current === true) {
        initialized = true
        return
      }
    } catch (error) {
      // A genuinely fresh database has no migration table yet and must run the
      // bootstrap below. Connectivity/permission errors must still surface.
      if ((error as { code?: string }).code !== "42P01") throw error
    }

    await client.query("BEGIN")
    // Serialize deploys/cold starts without leaving a session-level lock behind.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus-schema-migrations'))")

  // ── Step 1: Enums ─────────────────────────────────────────────────────────
  // PostgreSQL does not support CREATE TYPE IF NOT EXISTS, so we guard with a
  // DO block that silently skips if the type already exists.
  // Note: $$ dollar-quoting is required — single $ is not valid syntax.
  await client.query(`
    CREATE TABLE IF NOT EXISTS mednexus_schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    DO $$ BEGIN
      CREATE TYPE question_context_type AS ENUM ('TEXT', 'TABLE', 'IMAGE', 'MIXED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE question_type AS ENUM ('STANDARD_MCQ', 'ASSERTION_REASON', 'MATCHING');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // ── Step 2: Create all tables ──────────────────────────────────────────────
  // CREATE TABLE IF NOT EXISTS is idempotent — safe to re-run on every cold start.
  // New columns (role, class_level, etc.) are included here so fresh databases
  // get the full schema in one shot.
  await client.query(`
    -- ── Context (parent) table ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS mednexus_question_contexts (
      id          TEXT                  PRIMARY KEY,
      type        question_context_type NOT NULL DEFAULT 'TEXT',
      content     TEXT                  NOT NULL,
      created_at  TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ           NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mednexus_users (
      uid        TEXT PRIMARY KEY,
      name       TEXT NOT NULL DEFAULT 'Clinician',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_progress (
      uid        TEXT PRIMARY KEY,
      data       JSONB NOT NULL DEFAULT '{}',
      version    BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE mednexus_progress ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
    -- Append-only, independently addressable activity prevents a growing JSON
    -- document from being rewritten on every answer or exam submission.
    CREATE TABLE IF NOT EXISTS mednexus_progress_history (
      uid TEXT NOT NULL, event_id TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL,
      mode TEXT NOT NULL, question_id TEXT NOT NULL, payload JSONB NOT NULL,
      PRIMARY KEY (uid, event_id)
    );
    CREATE INDEX IF NOT EXISTS mednexus_progress_history_user_date_idx
      ON mednexus_progress_history (uid, occurred_at DESC);
    CREATE TABLE IF NOT EXISTS mednexus_progress_exam_scores (
      uid TEXT NOT NULL, event_id TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL,
      payload JSONB NOT NULL, PRIMARY KEY (uid, event_id)
    );
    CREATE INDEX IF NOT EXISTS mednexus_progress_exam_scores_user_date_idx
      ON mednexus_progress_exam_scores (uid, occurred_at DESC);
    -- One-time-compatible backfill from the legacy JSON arrays. Stable event
    -- ids make this safe to execute again during concurrent cold starts.
    INSERT INTO mednexus_progress_history (uid, event_id, occurred_at, mode, question_id, payload)
    SELECT p.uid, md5(p.uid || ':history:' || item.ordinality || ':' || item.value::text),
      to_timestamp(COALESCE((item.value->>'timestamp')::double precision, EXTRACT(EPOCH FROM NOW()) * 1000) / 1000),
      COALESCE(item.value->>'mode', 'trial'), COALESCE(item.value->>'questionId', ''), item.value
    FROM mednexus_progress p
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.data->'history') = 'array' THEN p.data->'history' ELSE '[]'::jsonb END)
      WITH ORDINALITY AS item(value, ordinality)
    ON CONFLICT DO NOTHING;
    INSERT INTO mednexus_progress_exam_scores (uid, event_id, occurred_at, payload)
    SELECT p.uid, COALESCE(NULLIF(item.value->>'id', ''), md5(p.uid || ':exam:' || item.ordinality || ':' || item.value::text)),
      COALESCE(NULLIF(item.value->>'date', '')::timestamptz, NOW()), item.value
    FROM mednexus_progress p
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.data->'examScores') = 'array' THEN p.data->'examScores' ELSE '[]'::jsonb END)
      WITH ORDINALITY AS item(value, ordinality)
    ON CONFLICT DO NOTHING;
    UPDATE mednexus_progress SET data = data - 'history' - 'examScores'
      WHERE data ? 'history' OR data ? 'examScores';
    CREATE TABLE IF NOT EXISTS mednexus_user_onboarding (
      user_id TEXT NOT NULL,
      tutorial_id TEXT NOT NULL CHECK (tutorial_id IN ('mcq_qbank_intro', 'theory_vault_intro')),
      tutorial_version INTEGER NOT NULL CHECK (tutorial_version > 0),
      status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'dismissed')),
      current_step INTEGER NOT NULL DEFAULT 0 CHECK (current_step >= 0),
      current_step_id TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      dismissed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, tutorial_id, tutorial_version)
    );
    CREATE INDEX IF NOT EXISTS mednexus_user_onboarding_status_idx
      ON mednexus_user_onboarding (tutorial_id, tutorial_version, status);
    CREATE TABLE IF NOT EXISTS mednexus_onboarding_events (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      tutorial_id TEXT NOT NULL,
      tutorial_version INTEGER NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('tutorial_started','step_viewed','tutorial_completed','tutorial_dismissed','resumed_from_step','replayed_from_help')),
      step INTEGER,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_questions (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_mcq_media_assets (
      id TEXT PRIMARY KEY,
      question_id TEXT,
      object_key TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL CHECK (byte_size > 0),
      checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
      width INTEGER NOT NULL CHECK (width > 0),
      height INTEGER NOT NULL CHECK (height > 0),
      caption TEXT NOT NULL DEFAULT '',
      alt_text TEXT NOT NULL DEFAULT 'Clinical question image',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS mednexus_mcq_media_question_idx ON mednexus_mcq_media_assets(question_id);

    CREATE TABLE IF NOT EXISTS mednexus_question_bank_audit_log (
      id BIGSERIAL PRIMARY KEY,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      source TEXT NOT NULL,
      affected_count INTEGER NOT NULL,
      backup JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mednexus_system_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      guest_access_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      registration_approval_mode TEXT NOT NULL DEFAULT 'verified_index'
        CHECK (registration_approval_mode IN ('verified_index','manual')),
      maintenance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      maintenance_message TEXT NOT NULL DEFAULT 'MedNexus study workspaces are temporarily unavailable while scheduled maintenance is completed.',
      assessment_default_question_count INTEGER NOT NULL DEFAULT 10 CHECK (assessment_default_question_count BETWEEN 1 AND 200),
      assessment_default_time_limit_mins INTEGER NOT NULL DEFAULT 30 CHECK (assessment_default_time_limit_mins BETWEEN 1 AND 360),
      assessment_default_tries_allowed INTEGER NOT NULL DEFAULT 1 CHECK (assessment_default_tries_allowed BETWEEN 1 AND 20),
      assessment_default_pass_mark INTEGER NOT NULL DEFAULT 50 CHECK (assessment_default_pass_mark BETWEEN 1 AND 100),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    );
    INSERT INTO mednexus_system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS mednexus_admin_audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS mednexus_admin_audit_recent_idx
      ON mednexus_admin_audit_log (created_at DESC);

    CREATE TABLE IF NOT EXISTS mednexus_content_import_jobs (
      id TEXT PRIMARY KEY,
      bank TEXT NOT NULL CHECK (bank IN ('mcq','theory')),
      source_name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'review'
        CHECK (status IN ('review','partial','committed','failed')),
      total_count INTEGER NOT NULL DEFAULT 0,
      valid_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      committed_count INTEGER NOT NULL DEFAULT 0,
      validation_errors JSONB NOT NULL DEFAULT '[]',
      draft_payload JSONB NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      committed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS mednexus_content_import_jobs_recent_idx
      ON mednexus_content_import_jobs (created_at DESC);

    -- ── Theory Vault ───────────────────────────────────────────────────────
    -- Theory has its own normalized content model. Do not add these fields to
    -- mednexus_questions: that table is the MCQ-only bank used by the editor.
    CREATE TABLE IF NOT EXISTS mednexus_theory_collections (
      id         TEXT PRIMARY KEY,
      slug       TEXT NOT NULL UNIQUE,
      title      TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_disciplines (
      id            TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL REFERENCES mednexus_theory_collections(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      UNIQUE (id, collection_id),
      UNIQUE (collection_id, name)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_sets (
      id            TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL,
      discipline_id TEXT NOT NULL,
      name          TEXT NOT NULL,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      UNIQUE (id, collection_id, discipline_id),
      UNIQUE (discipline_id, name),
      FOREIGN KEY (discipline_id, collection_id)
        REFERENCES mednexus_theory_disciplines(id, collection_id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_questions (
      id                      TEXT PRIMARY KEY,
      collection_id           TEXT NOT NULL,
      discipline_id           TEXT NOT NULL,
      set_id                  TEXT,
      prompt                  TEXT NOT NULL,
      model_answer            TEXT NOT NULL DEFAULT '',
      key_marking_points      JSONB NOT NULL DEFAULT '[]',
      tags                    JSONB NOT NULL DEFAULT '[]',
      source_metadata         JSONB NOT NULL DEFAULT '{}',
      difficulty              SMALLINT NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
      estimated_study_minutes INTEGER NOT NULL DEFAULT 5 CHECK (estimated_study_minutes > 0),
      status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
      sort_order              INTEGER NOT NULL DEFAULT 0,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (discipline_id, collection_id)
        REFERENCES mednexus_theory_disciplines(id, collection_id),
      FOREIGN KEY (set_id, collection_id, discipline_id)
        REFERENCES mednexus_theory_sets(id, collection_id, discipline_id),
      CHECK ((set_id IS NULL) OR (set_id <> ''))
    );
    CREATE INDEX IF NOT EXISTS mednexus_theory_questions_placement_idx
      ON mednexus_theory_questions (collection_id, discipline_id, set_id, sort_order);

    -- Learner state is deliberately per-user and separate from content records.
    CREATE TABLE IF NOT EXISTS mednexus_theory_reading_progress (
      user_id TEXT NOT NULL, question_id TEXT NOT NULL REFERENCES mednexus_theory_questions(id) ON DELETE CASCADE,
      progress_percent SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
      completed_at TIMESTAMPTZ, last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_model_answer_reviews (
      user_id TEXT NOT NULL, question_id TEXT NOT NULL REFERENCES mednexus_theory_questions(id) ON DELETE CASCADE,
      reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), review_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_bookmarks (
      user_id TEXT NOT NULL, question_id TEXT NOT NULL REFERENCES mednexus_theory_questions(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_notes (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, question_id TEXT NOT NULL REFERENCES mednexus_theory_questions(id) ON DELETE CASCADE,
      body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_revision_schedules (
      user_id TEXT NOT NULL, question_id TEXT NOT NULL REFERENCES mednexus_theory_questions(id) ON DELETE CASCADE,
      due_at TIMESTAMPTZ NOT NULL, interval_days INTEGER NOT NULL DEFAULT 1 CHECK (interval_days > 0),
      repetitions INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_recent_activity (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, question_id TEXT REFERENCES mednexus_theory_questions(id) ON DELETE SET NULL,
      activity_type TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), metadata JSONB NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS mednexus_theory_recent_activity_user_idx ON mednexus_theory_recent_activity (user_id, occurred_at DESC);

    -- ── OSCE Hub (reserved for future delivery) ────────────────────────────
    -- OSCE content is intentionally isolated from MCQ and Theory authoring.
    -- Tables define the future station and assessment boundary only; no OSCE
    -- route or workspace is registered until the hub is ready to ship.
    CREATE TABLE IF NOT EXISTS mednexus_osce_stations (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, candidate_instructions TEXT NOT NULL DEFAULT '',
      examiner_instructions TEXT NOT NULL DEFAULT '', timing_phases JSONB NOT NULL DEFAULT '[]',
      checklist JSONB NOT NULL DEFAULT '[]', scoring_rubric JSONB NOT NULL DEFAULT '[]',
      media JSONB NOT NULL DEFAULT '[]', specialty TEXT NOT NULL DEFAULT '', tags JSONB NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_osce_station_competencies (
      station_id TEXT NOT NULL REFERENCES mednexus_osce_stations(id) ON DELETE CASCADE,
      competency TEXT NOT NULL, PRIMARY KEY (station_id, competency)
    );
    CREATE TABLE IF NOT EXISTS mednexus_osce_station_attempts (
      id TEXT PRIMARY KEY, station_id TEXT NOT NULL REFERENCES mednexus_osce_stations(id) ON DELETE RESTRICT,
      user_id TEXT NOT NULL, checklist_responses JSONB NOT NULL DEFAULT '{}', rubric_scores JSONB NOT NULL DEFAULT '{}',
      self_assessment TEXT NOT NULL DEFAULT '', examiner_feedback TEXT NOT NULL DEFAULT '', total_score NUMERIC,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS mednexus_osce_station_attempts_user_idx
      ON mednexus_osce_station_attempts (user_id, started_at DESC);
    CREATE TABLE IF NOT EXISTS mednexus_osce_learner_competency_history (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      attempt_id TEXT REFERENCES mednexus_osce_station_attempts(id) ON DELETE SET NULL,
      station_id TEXT REFERENCES mednexus_osce_stations(id) ON DELETE SET NULL,
      competency TEXT NOT NULL, score NUMERIC, feedback TEXT NOT NULL DEFAULT '', assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS mednexus_osce_competency_history_user_idx
      ON mednexus_osce_learner_competency_history (user_id, competency, assessed_at DESC);

    CREATE TABLE IF NOT EXISTS mednexus_notifications (
      id         TEXT    PRIMARY KEY,
      title      TEXT    NOT NULL,
      body       TEXT    NOT NULL,
      type       TEXT    NOT NULL DEFAULT 'info',
      admin_only BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    -- Read state for broadcasts belongs to the recipient, never the broadcast.
    -- A single broadcast can therefore be read by one learner while remaining
    -- unread for every other learner.
    CREATE TABLE IF NOT EXISTS mednexus_notification_states (
      notification_id TEXT    NOT NULL REFERENCES mednexus_notifications(id) ON DELETE CASCADE,
      user_id         TEXT    NOT NULL,
      is_read         BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (notification_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS mednexus_notification_states_user_idx
      ON mednexus_notification_states (user_id, notification_id);
    CREATE INDEX IF NOT EXISTS mednexus_notification_states_user_read_idx
      ON mednexus_notification_states (user_id, is_read, notification_id);
    CREATE TABLE IF NOT EXISTS mednexus_assessments (
      id              TEXT    PRIMARY KEY,
      title           TEXT    NOT NULL,
      module_name     TEXT    NOT NULL,
      question_ids    JSONB   NOT NULL DEFAULT '[]',
      question_snapshot JSONB NOT NULL DEFAULT '[]',
      question_count  INTEGER NOT NULL DEFAULT 10,
      time_limit_mins INTEGER NOT NULL DEFAULT 30,
      tries_allowed   INTEGER NOT NULL DEFAULT 1,
      pass_mark       INTEGER NOT NULL DEFAULT 50,
      grading_mode    TEXT    NOT NULL DEFAULT 'standard',
      status          TEXT    NOT NULL DEFAULT 'offline',
      share_token     TEXT    NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_assessment_attempts (
      id            TEXT    PRIMARY KEY,
      assessment_id TEXT    NOT NULL,
      user_id       TEXT    NOT NULL,
      user_name     TEXT    NOT NULL,
      is_guest      BOOLEAN NOT NULL DEFAULT false,
      answers       JSONB   NOT NULL DEFAULT '{}',
      score         INTEGER NOT NULL DEFAULT 0,
      total         INTEGER NOT NULL DEFAULT 0,
      started_at    TIMESTAMPTZ DEFAULT NOW(),
      submitted_at  TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS mednexus_assessment_attempts_owner_idx
      ON mednexus_assessment_attempts (assessment_id, user_id)
      WHERE submitted_at IS NOT NULL;

    -- ── Registered users ────────────────────────────────────────────────────
    -- Includes role + class_level so fresh databases are fully provisioned.
    -- Existing databases are handled by ALTER TABLE below (Step 3).
    CREATE TABLE IF NOT EXISTS mednexus_registered_users (
      uid                  TEXT    PRIMARY KEY,
      name                 TEXT    NOT NULL,
      level                TEXT    NOT NULL DEFAULT '',
      class_level          TEXT    NOT NULL DEFAULT '',
      role                 TEXT    NOT NULL DEFAULT 'REGISTERED',
      index_number         TEXT    NOT NULL UNIQUE,
      password_hash        TEXT    NOT NULL,
      status               TEXT    NOT NULL DEFAULT 'pending',
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      otp_hash             TEXT,
      is_private           BOOLEAN NOT NULL DEFAULT FALSE,
      last_login_date      TIMESTAMPTZ,
      longest_streak       INTEGER NOT NULL DEFAULT 0,
      login_streak         INTEGER NOT NULL DEFAULT 0,
      created_at           TIMESTAMPTZ DEFAULT NOW()
    );

    -- Only a protected deployment migration may promote existing accounts. New accounts are always STUDENT.
    CREATE TABLE IF NOT EXISTS mednexus_user_permissions (
      user_id TEXT NOT NULL REFERENCES mednexus_registered_users(uid) ON DELETE CASCADE,
      permission TEXT NOT NULL,
      granted BOOLEAN NOT NULL DEFAULT TRUE,
      PRIMARY KEY (user_id, permission)
    );

    -- Security-sensitive changes are immutable and originate only on the server.
    CREATE TABLE IF NOT EXISTS mednexus_role_audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_uid TEXT REFERENCES mednexus_registered_users(uid) ON DELETE SET NULL,
      -- Keep the target identifier after account deletion so the audit trail is durable.
      target_uid TEXT NOT NULL,
      change_type TEXT NOT NULL,
      old_value JSONB,
      new_value JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ── Guest users ─────────────────────────────────────────────────────────
    -- Lightweight table for password-free temporary sessions (7-day TTL).
    -- Identified solely by a signed session token — no password stored.
    CREATE TABLE IF NOT EXISTS mednexus_guest_users (
      uid         TEXT        PRIMARY KEY,
      name        TEXT        NOT NULL,
      class_level TEXT        NOT NULL DEFAULT '',
      role        TEXT        NOT NULL DEFAULT 'GUEST',
      token_hash  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
    );

    CREATE TABLE IF NOT EXISTS mednexus_game_rooms (
      pin           TEXT    PRIMARY KEY,
      mode          TEXT    NOT NULL,
      host_id       TEXT    NOT NULL,
      host_name     TEXT    NOT NULL,
      question_pool JSONB   NOT NULL DEFAULT '[]',
      current_qi    INTEGER NOT NULL DEFAULT 0,
      phase         TEXT    NOT NULL DEFAULT 'lobby',
      players       JSONB   NOT NULL DEFAULT '[]',
      version       INTEGER NOT NULL DEFAULT 0,
      -- tracks which player UIDs have already received their match payout (dedup guard)
      scored_uids   JSONB   NOT NULL DEFAULT '[]',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '4 hours'
    );

    -- Group Study uses normalized, server-authoritative state. Unlike the
    -- legacy game-room JSON document, these constraints make membership,
    -- answers, eligibility and reward processing safe under concurrent calls.
    CREATE TABLE IF NOT EXISTS mednexus_group_study_rooms (
      id                       TEXT        PRIMARY KEY,
      pin                      TEXT        NOT NULL UNIQUE CHECK (pin ~ '^[0-9]{6}$'),
      host_user_id             TEXT        NOT NULL REFERENCES mednexus_registered_users(uid),
      module_id                TEXT        NOT NULL,
      discipline               TEXT,
      difficulty               TEXT        NOT NULL DEFAULT 'mixed'
        CHECK (difficulty IN ('mixed','easy','medium','hard')),
      question_count           INTEGER     NOT NULL CHECK (question_count > 0),
      timer_seconds            INTEGER     CHECK (timer_seconds IS NULL OR timer_seconds IN (30,45,60,90)),
      status                   TEXT        NOT NULL DEFAULT 'lobby'
        CHECK (status IN ('lobby','active','completed','ended','expired')),
      current_question_index   INTEGER     NOT NULL DEFAULT 0 CHECK (current_question_index >= 0),
      current_phase            TEXT        NOT NULL DEFAULT 'lobby'
        CHECK (current_phase IN ('lobby','question_open','answer_closed','reveal','discussion','completed','ended','expired')),
      question_opened_at       TIMESTAMPTZ,
      answer_closes_at         TIMESTAMPTZ,
      answer_closed_at         TIMESTAMPTZ,
      host_disconnected_at     TIMESTAMPTZ,
      version                  BIGINT      NOT NULL DEFAULT 0,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at               TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '4 hours',
      completed_at             TIMESTAMPTZ
    );
    ALTER TABLE mednexus_group_study_rooms ADD COLUMN IF NOT EXISTS discipline TEXT;
    CREATE INDEX IF NOT EXISTS mednexus_group_study_rooms_expiry_idx
      ON mednexus_group_study_rooms (expires_at) WHERE status NOT IN ('completed','ended','expired');

    CREATE TABLE IF NOT EXISTS mednexus_group_study_room_questions (
      id                TEXT        PRIMARY KEY,
      room_id           TEXT        NOT NULL REFERENCES mednexus_group_study_rooms(id) ON DELETE CASCADE,
      question_id       TEXT        NOT NULL,
      position          INTEGER     NOT NULL CHECK (position >= 0),
      question_snapshot JSONB       NOT NULL,
      opened_at         TIMESTAMPTZ,
      closed_at         TIMESTAMPTZ,
      UNIQUE (room_id, position),
      UNIQUE (room_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS mednexus_group_study_question_history (
      user_id          TEXT        NOT NULL REFERENCES mednexus_registered_users(uid) ON DELETE CASCADE,
      module_id        TEXT        NOT NULL,
      discipline_scope TEXT        NOT NULL DEFAULT '',
      question_id      TEXT        NOT NULL,
      last_selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      selection_count  INTEGER     NOT NULL DEFAULT 1 CHECK (selection_count > 0),
      PRIMARY KEY (user_id, module_id, discipline_scope, question_id)
    );
    CREATE INDEX IF NOT EXISTS mednexus_group_study_question_history_rotation_idx
      ON mednexus_group_study_question_history (user_id, module_id, discipline_scope, last_selected_at);

    CREATE TABLE IF NOT EXISTS mednexus_group_study_memberships (
      id                        TEXT        PRIMARY KEY,
      room_id                   TEXT        NOT NULL REFERENCES mednexus_group_study_rooms(id) ON DELETE CASCADE,
      user_id                   TEXT        NOT NULL REFERENCES mednexus_registered_users(uid),
      role                      TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('host','member')),
      ready                     BOOLEAN     NOT NULL DEFAULT FALSE,
      joined_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      left_at                   TIMESTAMPTZ,
      last_seen_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      connection_status         TEXT        NOT NULL DEFAULT 'online' CHECK (connection_status IN ('online','disconnected','left')),
      first_eligible_question   INTEGER     CHECK (first_eligible_question IS NULL OR first_eligible_question >= 0),
      questions_attempted       INTEGER     NOT NULL DEFAULT 0,
      correct_answers           INTEGER     NOT NULL DEFAULT 0,
      incorrect_answers         INTEGER     NOT NULL DEFAULT 0,
      eligible_unanswered       INTEGER     NOT NULL DEFAULT 0,
      current_streak            INTEGER     NOT NULL DEFAULT 0,
      highest_streak            INTEGER     NOT NULL DEFAULT 0,
      room_score                INTEGER     NOT NULL DEFAULT 0,
      session_np_earned         INTEGER     NOT NULL DEFAULT 0,
      UNIQUE (room_id, user_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS mednexus_group_study_single_host_idx
      ON mednexus_group_study_memberships (room_id) WHERE role = 'host';
    CREATE INDEX IF NOT EXISTS mednexus_group_study_members_room_idx
      ON mednexus_group_study_memberships (room_id, joined_at);

    CREATE TABLE IF NOT EXISTS mednexus_group_study_answers (
      id                         TEXT        PRIMARY KEY,
      room_id                    TEXT        NOT NULL REFERENCES mednexus_group_study_rooms(id) ON DELETE CASCADE,
      room_question_id           TEXT        NOT NULL REFERENCES mednexus_group_study_room_questions(id) ON DELETE CASCADE,
      user_id                    TEXT        NOT NULL REFERENCES mednexus_registered_users(uid),
      selected_answer            JSONB       NOT NULL,
      is_correct                 BOOLEAN     NOT NULL,
      submitted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      score_processing_status    TEXT        NOT NULL DEFAULT 'pending' CHECK (score_processing_status IN ('pending','processed','failed')),
      progress_processing_status TEXT        NOT NULL DEFAULT 'pending' CHECK (progress_processing_status IN ('pending','processed','failed')),
      np_processing_status       TEXT        NOT NULL DEFAULT 'pending' CHECK (np_processing_status IN ('pending','processed','failed')),
      np_earned                  INTEGER     NOT NULL DEFAULT 0,
      UNIQUE (room_question_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS mednexus_group_study_answers_room_idx
      ON mednexus_group_study_answers (room_id, room_question_id);

    CREATE TABLE IF NOT EXISTS mednexus_group_study_reward_events (
      id               TEXT        PRIMARY KEY,
      user_id          TEXT        NOT NULL REFERENCES mednexus_registered_users(uid),
      room_id          TEXT        NOT NULL REFERENCES mednexus_group_study_rooms(id) ON DELETE CASCADE,
      room_question_id TEXT        REFERENCES mednexus_group_study_room_questions(id) ON DELETE CASCADE,
      event_type       TEXT        NOT NULL CHECK (event_type IN ('participation','correct_answer','completion','streak','achievement')),
      transaction_id   TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS mednexus_group_study_reward_idempotency_idx
      ON mednexus_group_study_reward_events
      (user_id, room_id, COALESCE(room_question_id, '__room__'), event_type);
    CREATE TABLE IF NOT EXISTS mednexus_wallet (
      uid              TEXT    PRIMARY KEY,
      balance          INTEGER NOT NULL DEFAULT 0,
      rank_points      INTEGER NOT NULL DEFAULT 0,
      lifetime_earned  INTEGER NOT NULL DEFAULT 0,
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_np_transactions (
      id         TEXT        PRIMARY KEY,
      user_id    TEXT        NOT NULL,
      source     TEXT        NOT NULL,
      source_id  TEXT        NOT NULL,
      amount     INTEGER     NOT NULL,
      metadata   JSONB       NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, source, source_id)
    );
    CREATE INDEX IF NOT EXISTS mednexus_np_transactions_user_date_idx
      ON mednexus_np_transactions (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS mednexus_np_transactions_date_idx
      ON mednexus_np_transactions (created_at DESC);
    CREATE TABLE IF NOT EXISTS mednexus_game_personal_bests (
      user_id    TEXT        NOT NULL,
      mode       TEXT        NOT NULL,
      best_score INTEGER     NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, mode)
    );
    CREATE TABLE IF NOT EXISTS mednexus_multiplayer_payouts (
      room_pin   TEXT        NOT NULL,
      user_id    TEXT        NOT NULL,
      payout     JSONB       NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_pin, user_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_bounty_progress (
      uid         TEXT    NOT NULL,
      bounty_id   TEXT    NOT NULL,
      bounty_date TEXT    NOT NULL,
      progress    INTEGER NOT NULL DEFAULT 0,
      claimed     BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (uid, bounty_id, bounty_date)
    );
    CREATE TABLE IF NOT EXISTS mednexus_weekly_goal_progress (
      uid                 TEXT        NOT NULL,
      week_id             TEXT        NOT NULL,
      eligible_answered   INTEGER     NOT NULL DEFAULT 0,
      eligible_correct    INTEGER     NOT NULL DEFAULT 0,
      qualifying_exams    INTEGER     NOT NULL DEFAULT 0,
      distinct_exam_dates JSONB       NOT NULL DEFAULT '[]',
      credited_goal_ids   JSONB       NOT NULL DEFAULT '[]',
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (uid, week_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_user_inventory (
      uid      TEXT    NOT NULL,
      item_id  TEXT    NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (uid, item_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_user_cosmetics (
      uid               TEXT    PRIMARY KEY,
      equipped_title    TEXT,
      equipped_frame    TEXT,
      equipped_highlight TEXT,
      equipped_avatar   TEXT,
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    );

    -- ── Per-user question progress (anti-farming 3-repeat cap) ──────────────
    -- Tracks how many times a user has answered a specific question correctly.
    -- correct_count >= 3 → that question earns 0 NP on future correct answers.
    CREATE TABLE IF NOT EXISTS mednexus_user_question_progress (
      user_id       TEXT    NOT NULL,
      question_id   TEXT    NOT NULL,
      correct_count INTEGER NOT NULL DEFAULT 0,
      discipline    TEXT    NOT NULL DEFAULT '',
      PRIMARY KEY (user_id, question_id)
    );

    -- ── Per-discipline NP log (anti-farming discipline fatigue) ──────────────
    -- Accumulates NP earned per user per discipline per calendar day.
    -- discipline_fatigue: if 7-day sum >= 1000 NP → further questions in that
    -- discipline earn 0 NP until the rolling window resets.
    CREATE TABLE IF NOT EXISTS mednexus_discipline_np_log (
      user_id     TEXT    NOT NULL,
      discipline  TEXT    NOT NULL,
      earned_date TEXT    NOT NULL,   -- YYYY-MM-DD
      np_earned   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, discipline, earned_date)
    );

    -- ── Exam sessions (abandonment penalty) ──────────────────────────────────
    -- Created when a user starts an exam-mode session, closed on proper submit.
    -- Sessions still 'active' after the time limit + grace period are marked
    -- 'abandoned'; all unanswered questions are recorded as incorrect.
    CREATE TABLE IF NOT EXISTS mednexus_exam_sessions (
      id           TEXT    PRIMARY KEY,
      user_id      TEXT    NOT NULL,
      mode         TEXT    NOT NULL,
      question_ids JSONB   NOT NULL DEFAULT '[]',
      answered_ids JSONB   NOT NULL DEFAULT '[]',
      answer_key JSONB NOT NULL DEFAULT '[]',
      accepted_answers JSONB NOT NULL DEFAULT '{}',
      answer_order JSONB NOT NULL DEFAULT '[]',
      result_meta JSONB NOT NULL DEFAULT '{}',
      payout JSONB,
      status       TEXT    NOT NULL DEFAULT 'active',  -- active | completed | abandoned
      started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMPTZ
    );

    -- Server-owned audit trail for consumables used during scored sessions.
    CREATE TABLE IF NOT EXISTS mednexus_session_consumable_events (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      usage_id    TEXT NOT NULL,
      session_id  TEXT NOT NULL REFERENCES mednexus_exam_sessions(id) ON DELETE CASCADE,
      item_id     TEXT NOT NULL,
      question_id TEXT NOT NULL,
      limit_one_per_question BOOLEAN NOT NULL DEFAULT FALSE,
      usage_status TEXT NOT NULL DEFAULT 'pending',
      remaining_quantity INTEGER,
      used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE mednexus_session_consumable_events
      ADD COLUMN IF NOT EXISTS usage_id TEXT,
      ADD COLUMN IF NOT EXISTS limit_one_per_question BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS usage_status TEXT NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS remaining_quantity INTEGER;
    CREATE UNIQUE INDEX IF NOT EXISTS mednexus_consumable_events_usage_idx
      ON mednexus_session_consumable_events (user_id, usage_id);
    CREATE UNIQUE INDEX IF NOT EXISTS mednexus_consumable_events_question_limit_idx
      ON mednexus_session_consumable_events (user_id, session_id, question_id, item_id)
      WHERE limit_one_per_question;
    CREATE INDEX IF NOT EXISTS mednexus_consumable_events_session_idx
      ON mednexus_session_consumable_events (user_id, session_id, item_id, used_at);

    -- ── Per-user notification inbox ───────────────────────────────────────────
    -- Individual notifications for a specific user (or global when user_id IS NULL).
    -- Distinct from mednexus_notifications which is the admin broadcast table.
    CREATE TABLE IF NOT EXISTS mednexus_user_notifications (
      id         TEXT    PRIMARY KEY,
      user_id    TEXT,                             -- NULL = global
      type       TEXT    NOT NULL DEFAULT 'economy', -- streak | leaderboard | economy | store
      message    TEXT    NOT NULL,
      is_read    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS mednexus_user_notifications_user_read_created_idx
      ON mednexus_user_notifications (user_id, is_read, created_at DESC);

    -- ── Daily activity log (leaderboard + weekly stats) ──────────────────────
    -- One row per user per calendar day. Accumulates questions answered and
    -- correct answers from every payout call so the leaderboard can compute
    -- weekly accuracy and question volume without scanning the JSONB history.
    CREATE TABLE IF NOT EXISTS mednexus_daily_activity (
      user_id           TEXT    NOT NULL,
      activity_date     TEXT    NOT NULL,   -- YYYY-MM-DD
      questions_answered INTEGER NOT NULL DEFAULT 0,
      correct_answers   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, activity_date)
    );

    -- Durable import quotas. Created by deployment migration, never lazily in a request.
    CREATE TABLE IF NOT EXISTS mednexus_import_rate_limits (
      user_id TEXT NOT NULL, endpoint TEXT NOT NULL, window_start TIMESTAMPTZ NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, endpoint)
    );

    -- ── Guest analytics ──────────────────────────────────────────────────────
    -- Stores a single score submission per guest attempt.
    -- Intentionally has NO foreign-key relationship to any user profile table.
    -- type is always 'guest'. Used only for admin reporting.
    CREATE TABLE IF NOT EXISTS mednexus_guest_analytics (
      id               TEXT        PRIMARY KEY,
      assessment_id    TEXT        NOT NULL,
      assessment_title TEXT        NOT NULL DEFAULT '',
      guest_name       TEXT        NOT NULL,
      type             TEXT        NOT NULL DEFAULT 'guest',
      score            INTEGER     NOT NULL DEFAULT 0,
      total            INTEGER     NOT NULL DEFAULT 0,
      percentage       INTEGER     NOT NULL DEFAULT 0,
      passed           BOOLEAN     NOT NULL DEFAULT false,
      time_taken_secs  INTEGER,
      submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  // ── Step 3: Idempotent migrations for existing databases ───────────────────
  // ALTER TABLE … ADD COLUMN IF NOT EXISTS is safe to re-run; it no-ops when
  // the column already exists (e.g. when the CREATE TABLE above already added it).
  await client.query(`
    -- Keep legacy data nullable until the explicit storage backfill verifies
    -- every object. That deployment migration is responsible for dropping it.
    ALTER TABLE mednexus_mcq_media_assets ADD COLUMN IF NOT EXISTS object_key TEXT;
    ALTER TABLE mednexus_mcq_media_assets ADD COLUMN IF NOT EXISTS byte_size INTEGER;
    ALTER TABLE mednexus_mcq_media_assets ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT;
    ALTER TABLE mednexus_mcq_media_assets ADD COLUMN IF NOT EXISTS width INTEGER;
    ALTER TABLE mednexus_mcq_media_assets ADD COLUMN IF NOT EXISTS height INTEGER;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mednexus_mcq_media_assets' AND column_name='data') THEN
        ALTER TABLE mednexus_mcq_media_assets ALTER COLUMN data DROP NOT NULL;
      END IF;
    END $$;

    ALTER TABLE mednexus_user_onboarding ADD COLUMN IF NOT EXISTS current_step_id TEXT;
    -- CREATE TABLE IF NOT EXISTS cannot repair constraints from an older
    -- onboarding release. Replace the checks explicitly and idempotently.
    DO $$ DECLARE c record; BEGIN
      FOR c IN SELECT conname FROM pg_constraint
        WHERE conrelid='mednexus_user_onboarding'::regclass AND contype='c'
      LOOP EXECUTE format('ALTER TABLE mednexus_user_onboarding DROP CONSTRAINT %I', c.conname); END LOOP;
    END $$;
    ALTER TABLE mednexus_user_onboarding
      ADD CONSTRAINT mednexus_user_onboarding_tutorial_id_check CHECK (tutorial_id IN ('mcq_qbank_intro','theory_vault_intro')),
      ADD CONSTRAINT mednexus_user_onboarding_version_check CHECK (tutorial_version > 0),
      ADD CONSTRAINT mednexus_user_onboarding_status_check CHECK (status IN ('not_started','in_progress','completed','dismissed')),
      ADD CONSTRAINT mednexus_user_onboarding_step_check CHECK (current_step >= 0);
    DO $$ DECLARE c record; BEGIN
      FOR c IN SELECT conname FROM pg_constraint
        WHERE conrelid='mednexus_onboarding_events'::regclass AND contype='c'
      LOOP EXECUTE format('ALTER TABLE mednexus_onboarding_events DROP CONSTRAINT %I', c.conname); END LOOP;
    END $$;
    ALTER TABLE mednexus_onboarding_events
      ADD CONSTRAINT mednexus_onboarding_events_tutorial_id_check CHECK (tutorial_id IN ('mcq_qbank_intro','theory_vault_intro')),
      ADD CONSTRAINT mednexus_onboarding_events_version_check CHECK (tutorial_version > 0),
      ADD CONSTRAINT mednexus_onboarding_events_event_type_check CHECK (event_type IN ('tutorial_started','step_viewed','tutorial_completed','tutorial_dismissed','resumed_from_step','replayed_from_help')),
      ADD CONSTRAINT mednexus_onboarding_events_step_check CHECK (step IS NULL OR step >= 0);

    CREATE TABLE IF NOT EXISTS mednexus_economy_seasons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      economy_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('planned','active','closed')),
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activated_by TEXT,
      activated_at TIMESTAMPTZ,
      activation_migration_id TEXT UNIQUE,
      opening_grant INTEGER NOT NULL DEFAULT 500
    );
    CREATE UNIQUE INDEX IF NOT EXISTS mednexus_one_active_economy_season
      ON mednexus_economy_seasons ((status)) WHERE status = 'active';
    INSERT INTO mednexus_economy_seasons
      (id, name, economy_version, status, starts_at, ends_at, activation_migration_id, opening_grant)
    VALUES ('legacy', 'Legacy Economy', 'legacy', 'closed', '-infinity', NOW(), 'bootstrap-legacy-v1', 0)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO mednexus_economy_seasons
      (id, name, economy_version, status, starts_at, activated_at, activation_migration_id, opening_grant)
    SELECT 'season-1', 'Season 1', '2.0', 'active', NOW(), NOW(), 'economy-season-1-cutover-v1', 500
    WHERE NOT EXISTS (SELECT 1 FROM mednexus_economy_seasons WHERE status='active')
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS mednexus_season_wallets (
      season_id TEXT NOT NULL REFERENCES mednexus_economy_seasons(id),
      user_id TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
      lifetime_earned INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
      rank_points INTEGER NOT NULL DEFAULT 0 CHECK (rank_points >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (season_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_economy_season_archives (
      season_id TEXT NOT NULL REFERENCES mednexus_economy_seasons(id), user_id TEXT NOT NULL,
      closing_balance INTEGER NOT NULL, lifetime_np INTEGER NOT NULL, rank_points INTEGER NOT NULL,
      login_streak INTEGER NOT NULL, longest_streak INTEGER NOT NULL, mcq_activity JSONB NOT NULL DEFAULT '{}',
      game_personal_bests JSONB NOT NULL DEFAULT '[]', bounty_progress JSONB NOT NULL DEFAULT '[]',
      weekly_goal_progress JSONB NOT NULL DEFAULT '[]', inventory_value INTEGER NOT NULL DEFAULT 0,
      closing_leaderboard_position INTEGER, archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      migration_id TEXT NOT NULL, PRIMARY KEY (season_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_wallet_adjustments (
      id TEXT PRIMARY KEY, season_id TEXT NOT NULL REFERENCES mednexus_economy_seasons(id),
      target_user_id TEXT NOT NULL, acting_administrator TEXT NOT NULL, reason TEXT NOT NULL CHECK (length(trim(reason)) >= 8),
      amount INTEGER NOT NULL CHECK (amount <> 0), before_balance INTEGER NOT NULL, after_balance INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_economy_cutovers (
      migration_id TEXT PRIMARY KEY, from_season_id TEXT NOT NULL, to_season_id TEXT NOT NULL,
      affected_users INTEGER NOT NULL, before_total BIGINT NOT NULL, after_total BIGINT NOT NULL,
      executed_by TEXT NOT NULL, executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE mednexus_np_transactions ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES mednexus_economy_seasons(id);
    ALTER TABLE mednexus_daily_activity ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES mednexus_economy_seasons(id);
    ALTER TABLE mednexus_bounty_progress ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES mednexus_economy_seasons(id);
    ALTER TABLE mednexus_weekly_goal_progress ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES mednexus_economy_seasons(id);
    ALTER TABLE mednexus_game_personal_bests ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES mednexus_economy_seasons(id);
    ALTER TABLE mednexus_multiplayer_payouts ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES mednexus_economy_seasons(id);
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES mednexus_economy_seasons(id);
    ALTER TABLE mednexus_user_question_progress ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES mednexus_economy_seasons(id);
    ALTER TABLE mednexus_discipline_np_log ADD COLUMN IF NOT EXISTS season_id TEXT REFERENCES mednexus_economy_seasons(id);
    ALTER TABLE mednexus_user_inventory ADD COLUMN IF NOT EXISTS acquired_season_id TEXT REFERENCES mednexus_economy_seasons(id);
    UPDATE mednexus_np_transactions SET season_id = 'legacy' WHERE season_id IS NULL;
    UPDATE mednexus_daily_activity SET season_id = 'legacy' WHERE season_id IS NULL;
    UPDATE mednexus_bounty_progress SET season_id = 'legacy' WHERE season_id IS NULL;
    UPDATE mednexus_weekly_goal_progress SET season_id = 'legacy' WHERE season_id IS NULL;
    UPDATE mednexus_game_personal_bests SET season_id = 'legacy' WHERE season_id IS NULL;
    UPDATE mednexus_multiplayer_payouts SET season_id = 'legacy' WHERE season_id IS NULL;
    -- Sessions opened after the active season began belong to that season. A
    -- previous client omitted season_id and earlier schema runs could then mark
    -- those rows as legacy, so recover both states before enforcing the invariant.
    UPDATE mednexus_exam_sessions session
       SET season_id = active.id
      FROM mednexus_economy_seasons active
     WHERE (session.season_id IS NULL OR session.season_id = 'legacy')
       AND active.status = 'active'
       AND session.started_at >= active.starts_at;
    UPDATE mednexus_exam_sessions SET season_id = 'legacy' WHERE season_id IS NULL;
    UPDATE mednexus_user_question_progress SET season_id = 'legacy' WHERE season_id IS NULL;
    UPDATE mednexus_discipline_np_log SET season_id = 'legacy' WHERE season_id IS NULL;
    ALTER TABLE mednexus_np_transactions ALTER COLUMN season_id SET NOT NULL;
    ALTER TABLE mednexus_daily_activity ALTER COLUMN season_id SET NOT NULL;
    ALTER TABLE mednexus_bounty_progress ALTER COLUMN season_id SET NOT NULL;
    ALTER TABLE mednexus_weekly_goal_progress ALTER COLUMN season_id SET NOT NULL;
    ALTER TABLE mednexus_game_personal_bests ALTER COLUMN season_id SET NOT NULL;
    ALTER TABLE mednexus_multiplayer_payouts ALTER COLUMN season_id SET NOT NULL;
    ALTER TABLE mednexus_exam_sessions ALTER COLUMN season_id SET NOT NULL;
    ALTER TABLE mednexus_user_question_progress ALTER COLUMN season_id SET NOT NULL;
    ALTER TABLE mednexus_discipline_np_log ALTER COLUMN season_id SET NOT NULL;
    INSERT INTO mednexus_schema_migrations(version)
      VALUES ('2026-07-28-economy-seasons-v1') ON CONFLICT (version) DO NOTHING;
    ALTER TABLE mednexus_daily_activity DROP CONSTRAINT IF EXISTS mednexus_daily_activity_pkey;
    ALTER TABLE mednexus_daily_activity ADD CONSTRAINT mednexus_daily_activity_pkey PRIMARY KEY (season_id,user_id,activity_date);
    ALTER TABLE mednexus_bounty_progress DROP CONSTRAINT IF EXISTS mednexus_bounty_progress_pkey;
    ALTER TABLE mednexus_bounty_progress ADD CONSTRAINT mednexus_bounty_progress_pkey PRIMARY KEY (season_id,uid,bounty_id,bounty_date);
    ALTER TABLE mednexus_weekly_goal_progress DROP CONSTRAINT IF EXISTS mednexus_weekly_goal_progress_pkey;
    ALTER TABLE mednexus_weekly_goal_progress ADD CONSTRAINT mednexus_weekly_goal_progress_pkey PRIMARY KEY (season_id,uid,week_id);
    ALTER TABLE mednexus_game_personal_bests DROP CONSTRAINT IF EXISTS mednexus_game_personal_bests_pkey;
    ALTER TABLE mednexus_game_personal_bests ADD CONSTRAINT mednexus_game_personal_bests_pkey PRIMARY KEY (season_id,user_id,mode);
    ALTER TABLE mednexus_multiplayer_payouts DROP CONSTRAINT IF EXISTS mednexus_multiplayer_payouts_pkey;
    ALTER TABLE mednexus_multiplayer_payouts ADD CONSTRAINT mednexus_multiplayer_payouts_pkey PRIMARY KEY (season_id,room_pin,user_id);
    ALTER TABLE mednexus_user_question_progress DROP CONSTRAINT IF EXISTS mednexus_user_question_progress_pkey;
    ALTER TABLE mednexus_user_question_progress ADD CONSTRAINT mednexus_user_question_progress_pkey PRIMARY KEY (season_id,user_id,question_id);
    ALTER TABLE mednexus_discipline_np_log DROP CONSTRAINT IF EXISTS mednexus_discipline_np_log_pkey;
    ALTER TABLE mednexus_discipline_np_log ADD CONSTRAINT mednexus_discipline_np_log_pkey PRIMARY KEY (season_id,user_id,discipline,earned_date);

    -- Backfill new columns for databases that existed before this migration.
    ALTER TABLE mednexus_notifications
      ADD COLUMN IF NOT EXISTS admin_only BOOLEAN NOT NULL DEFAULT FALSE;
    -- Kept for compatibility with pre-state-table deployments. New code must
    -- never read from or write to this broadcast-level column.
    ALTER TABLE mednexus_notifications
      ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE mednexus_user_cosmetics
      ADD COLUMN IF NOT EXISTS equipped_avatar TEXT;

    ALTER TABLE mednexus_registered_users
      ADD COLUMN IF NOT EXISTS class_level TEXT NOT NULL DEFAULT '';
    ALTER TABLE mednexus_registered_users
      ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'REGISTERED';

    -- Older deployments created guest sessions before class levels became
    -- mandatory. Keep the guest preview flow compatible with those databases.
    ALTER TABLE mednexus_guest_users
      ADD COLUMN IF NOT EXISTS class_level TEXT NOT NULL DEFAULT '';
    ALTER TABLE mednexus_guest_users
      ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'GUEST';
    ALTER TABLE mednexus_guest_users
      ADD COLUMN IF NOT EXISTS token_hash TEXT;
    ALTER TABLE mednexus_guest_users
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE mednexus_guest_users
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days';

    -- Permission rows are explicit overrides: TRUE grants and FALSE removes an
    -- ADMIN baseline capability. Existing rows retain their original grant.
    ALTER TABLE mednexus_user_permissions
      ADD COLUMN IF NOT EXISTS granted BOOLEAN NOT NULL DEFAULT TRUE;

    -- Copy legacy level → class_level for rows that predate this migration.
    UPDATE mednexus_registered_users
       SET class_level = level
     WHERE class_level = '' AND level <> '';

    ALTER TABLE mednexus_game_rooms
      ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

    -- scored_uids: JSONB array of player UIDs who have received their match payout.
    -- Prevents double-submission of the secure score RPC.
    ALTER TABLE mednexus_game_rooms
      ADD COLUMN IF NOT EXISTS scored_uids JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_game_rooms
      ADD COLUMN IF NOT EXISTS answer_history JSONB NOT NULL DEFAULT '{}';

    -- phase_started_at: timestamp of the most recent phase transition.
    -- Used to self-drive match advancement (question timeout, reveal→next)
    -- purely from polling reads — no host click or external realtime engine required.
    ALTER TABLE mednexus_game_rooms
      ADD COLUMN IF NOT EXISTS phase_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    -- knockout_winner_id: set when a wager/djmulti match ends early because
    -- all but one player went bankrupt before the final question was reached.
    ALTER TABLE mednexus_game_rooms
      ADD COLUMN IF NOT EXISTS knockout_winner_id TEXT;

    -- rank_points: cumulative Clinical Ladder progression points. Grows with
    -- every NP payout; tier-up bonuses are awarded when crossing thresholds.
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS answer_key JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS accepted_answers JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS answer_order JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS result_meta JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS payout JSONB;

    ALTER TABLE mednexus_wallet
      ADD COLUMN IF NOT EXISTS rank_points INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE mednexus_wallet
      ADD COLUMN IF NOT EXISTS lifetime_earned INTEGER NOT NULL DEFAULT 0;

    -- last_multiplayer_win_at: tracks when the user last achieved rank-1 in a
    -- multiplayer match, used for the First Win of the Day (+250 NP) bonus.
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS answer_key JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS accepted_answers JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS payout JSONB;

    ALTER TABLE mednexus_wallet
      ADD COLUMN IF NOT EXISTS last_multiplayer_win_at TIMESTAMPTZ;

    -- Preserve the currently visible total as the minimum lifetime value.
    UPDATE mednexus_wallet
       SET rank_points = GREATEST(rank_points, balance),
           lifetime_earned = GREATEST(lifetime_earned, rank_points, balance);

    -- Seed dated question earnings for Weekly and Monthly continuity.
    INSERT INTO mednexus_np_transactions
      (id, user_id, season_id, source, source_id, amount, metadata, created_at)
    SELECT
      'np-legacy-' || md5(user_id || ':' || discipline || ':' || earned_date),
      user_id,
      'legacy',
      'legacy_discipline',
      discipline || ':' || earned_date,
      np_earned,
      jsonb_build_object('discipline', discipline, 'economyVersion', 'legacy'),
      (earned_date::date + TIME '12:00:00') AT TIME ZONE 'UTC'
    FROM mednexus_discipline_np_log
    WHERE np_earned > 0
    ON CONFLICT (user_id, source, source_id) DO NOTHING;

    -- is_private: user opts out of leaderboard visibility.
    ALTER TABLE mednexus_registered_users
      ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

    -- last_login_date: updated on every successful login; used for streak logic.
    ALTER TABLE mednexus_registered_users
      ADD COLUMN IF NOT EXISTS last_login_date TIMESTAMPTZ;

    -- longest_streak: all-time best consecutive-day login streak.
    ALTER TABLE mednexus_registered_users
      ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0;

    -- login_streak: current consecutive-day login streak (resets on miss).
    ALTER TABLE mednexus_registered_users
      ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0;

    -- OSCE contract evolution for databases created before the station model.
    ALTER TABLE mednexus_osce_stations
      ADD COLUMN IF NOT EXISTS timing_phases JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_osce_stations
      ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_osce_stations
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_osce_stations
      ALTER COLUMN scoring_rubric SET DEFAULT '[]';
    ALTER TABLE mednexus_osce_learner_competency_history
      ADD COLUMN IF NOT EXISTS attempt_id TEXT REFERENCES mednexus_osce_station_attempts(id) ON DELETE SET NULL;
    ALTER TABLE mednexus_assessments
      ADD COLUMN IF NOT EXISTS question_snapshot JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_assessments
      ADD COLUMN IF NOT EXISTS grading_mode TEXT NOT NULL DEFAULT 'standard';

    -- Sweep expired rows on every cold start (cheap on a small table).
    DELETE FROM mednexus_game_rooms   WHERE expires_at < NOW();
    DELETE FROM mednexus_guest_users  WHERE expires_at < NOW();
  `)

  // Existing assessment scores remain intact. This snapshot only preserves
  // the question metadata needed for reliable future result reporting.
  await client.query(`
    UPDATE mednexus_assessments assessment
    SET question_snapshot = COALESCE((
      SELECT jsonb_agg(question.value ORDER BY requested.ordinality)
      FROM jsonb_array_elements_text(assessment.question_ids)
        WITH ORDINALITY AS requested(question_id, ordinality)
      JOIN LATERAL (
        SELECT item AS value
        FROM mednexus_questions bank,
          jsonb_array_elements(bank.data) item
        WHERE bank.id=1 AND item->>'id'=requested.question_id
        LIMIT 1
      ) question ON TRUE
    ), '[]'::jsonb)
    WHERE assessment.question_snapshot='[]'::jsonb
      AND jsonb_array_length(assessment.question_ids)>0
  `)

  // ── Step 3.5: Complete Theory Vault study model ──────────────────────────
  // Additive migration: preserve existing Theory content and learner records.
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    ALTER TABLE mednexus_theory_collections
      ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'end_of_year'
        CHECK (kind IN ('end_of_module', 'end_of_year'));
    UPDATE mednexus_theory_collections
      SET kind = CASE WHEN slug IN ('end-of-module', 'end-of-rotation') THEN 'end_of_module' ELSE 'end_of_year' END;
    UPDATE mednexus_theory_collections
      SET slug = 'end-of-module', title = 'End of Module'
      WHERE slug = 'end-of-rotation'
        AND NOT EXISTS (SELECT 1 FROM mednexus_theory_collections WHERE slug = 'end-of-module');

    CREATE TABLE IF NOT EXISTS mednexus_theory_modules (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL REFERENCES mednexus_theory_collections(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (collection_id, name)
    );

    CREATE TABLE IF NOT EXISTS mednexus_theory_module_disciplines (
      module_id TEXT NOT NULL REFERENCES mednexus_theory_modules(id) ON DELETE CASCADE,
      discipline_id TEXT NOT NULL REFERENCES mednexus_theory_disciplines(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (module_id, discipline_id)
    );

    ALTER TABLE mednexus_theory_sets ALTER COLUMN discipline_id DROP NOT NULL;
    ALTER TABLE mednexus_theory_sets
      ADD COLUMN IF NOT EXISTS module_id TEXT REFERENCES mednexus_theory_modules(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
        CHECK (status IN ('draft', 'review', 'published', 'archived')),
      ADD COLUMN IF NOT EXISTS question_limit INTEGER NOT NULL DEFAULT 20
        CHECK (question_limit BETWEEN 1 AND 100),
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    ALTER TABLE mednexus_theory_questions ALTER COLUMN discipline_id DROP NOT NULL;
    ALTER TABLE mednexus_theory_questions
      ADD COLUMN IF NOT EXISTS module_id TEXT REFERENCES mednexus_theory_modules(id) ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS marks INTEGER CHECK (marks IS NULL OR marks >= 0),
      ADD COLUMN IF NOT EXISTS references_md TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]';

    UPDATE mednexus_theory_questions
    SET title = LEFT(TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(prompt, '^[[:space:]]*(#{1,6}[[:space:]]*)?(question([[:space:]]+[0-9]+)?[:.)-]?[[:space:]]*)', '', 'i'),
      '[[:space:]]+', ' ', 'g'
    )), 96)
    WHERE TRIM(title) = '';

    UPDATE mednexus_theory_questions
    SET marks = CASE
      WHEN jsonb_typeof(key_marking_points) = 'array' THEN jsonb_array_length(key_marking_points) * 2
      ELSE 0
    END;

    UPDATE mednexus_theory_questions
    SET status = 'review', updated_at = NOW()
    WHERE status = 'published'
      AND (
        set_id IS NULL
        OR TRIM(model_answer) = ''
        OR CASE
          WHEN jsonb_typeof(key_marking_points) = 'array' THEN jsonb_array_length(key_marking_points) = 0
          ELSE TRUE
        END
      );

    DO $$ BEGIN
      ALTER TABLE mednexus_theory_questions
        ADD CONSTRAINT mednexus_theory_questions_set_fk
        FOREIGN KEY (set_id) REFERENCES mednexus_theory_sets(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    INSERT INTO mednexus_theory_modules (id, collection_id, name, sort_order)
    SELECT 'theory-module-' || md5(d.collection_id || ':' || d.name), d.collection_id, d.name, d.sort_order
    FROM mednexus_theory_disciplines d
    JOIN mednexus_theory_collections c ON c.id = d.collection_id
    WHERE c.kind = 'end_of_module'
    ON CONFLICT (collection_id, name) DO NOTHING;

    UPDATE mednexus_theory_sets s SET module_id = m.id
    FROM mednexus_theory_modules m
    WHERE s.module_id IS NULL AND s.collection_id = m.collection_id
      AND EXISTS (SELECT 1 FROM mednexus_theory_disciplines d WHERE d.id = s.discipline_id AND d.name = m.name);
    UPDATE mednexus_theory_questions q SET module_id = m.id
    FROM mednexus_theory_modules m
    WHERE q.module_id IS NULL AND q.collection_id = m.collection_id
      AND EXISTS (SELECT 1 FROM mednexus_theory_disciplines d WHERE d.id = q.discipline_id AND d.name = m.name);

    ALTER TABLE mednexus_theory_reading_progress
      ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS confidence TEXT
        CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low')),
      ADD COLUMN IF NOT EXISTS last_mode TEXT
        CHECK (last_mode IS NULL OR last_mode IN ('review', 'practice')),
      ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS mednexus_theory_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question_id TEXT NOT NULL REFERENCES mednexus_theory_questions(id) ON DELETE CASCADE,
      answer_md TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
      model_answer_revealed_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ,
      self_rating TEXT CHECK (self_rating IS NULL OR self_rating IN ('excellent', 'partial', 'needs_revision')),
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS mednexus_theory_attempts_active_draft_idx
      ON mednexus_theory_attempts (user_id, question_id) WHERE status = 'draft';
    CREATE INDEX IF NOT EXISTS mednexus_theory_attempts_user_idx
      ON mednexus_theory_attempts (user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS mednexus_theory_revision_queue (
      user_id TEXT NOT NULL,
      question_id TEXT NOT NULL REFERENCES mednexus_theory_questions(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'self_rating')),
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_reviewed_at TIMESTAMPTZ,
      review_count INTEGER NOT NULL DEFAULT 0,
      confidence TEXT CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low')),
      priority SMALLINT NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      removed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, question_id)
    );
    CREATE INDEX IF NOT EXISTS mednexus_theory_revision_queue_active_idx
      ON mednexus_theory_revision_queue (user_id, priority DESC, added_at DESC)
      WHERE active = TRUE;

    CREATE TABLE IF NOT EXISTS mednexus_theory_study_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('set', 'revision')),
      set_id TEXT REFERENCES mednexus_theory_sets(id) ON DELETE SET NULL,
      question_ids JSONB NOT NULL DEFAULT '[]',
      current_index INTEGER NOT NULL DEFAULT 0,
      timer_seconds INTEGER,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS mednexus_theory_study_sessions_user_idx
      ON mednexus_theory_study_sessions (user_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS mednexus_theory_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      default_set_size INTEGER NOT NULL DEFAULT 20 CHECK (default_set_size BETWEEN 15 AND 20),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO mednexus_theory_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS mednexus_theory_audit_log (
      id BIGSERIAL PRIMARY KEY,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mednexus_theory_ai_consents (
      user_id TEXT PRIMARY KEY,
      consent_version TEXT NOT NULL,
      consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mednexus_theory_ai_rate_limits (
      user_id TEXT NOT NULL,
      usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
      refinement_count INTEGER NOT NULL DEFAULT 0 CHECK (refinement_count BETWEEN 0 AND 50),
      transcription_count INTEGER NOT NULL DEFAULT 0 CHECK (transcription_count BETWEEN 0 AND 50),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, usage_date)
    );
    CREATE INDEX IF NOT EXISTS mednexus_theory_ai_rate_limits_user_idx
      ON mednexus_theory_ai_rate_limits (user_id, usage_date DESC);

    CREATE TABLE IF NOT EXISTS mednexus_theory_ai_audit_log (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('refine_note', 'transcribe_note', 'transcribe_answer')),
      outcome TEXT NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
      quota_used INTEGER NOT NULL DEFAULT 0 CHECK (quota_used >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS mednexus_theory_ai_audit_log_user_idx
      ON mednexus_theory_ai_audit_log (user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS mednexus_theory_questions_search_idx
      ON mednexus_theory_questions USING GIN (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(prompt, '') || ' ' || coalesce(model_answer, ''))
      );
    CREATE INDEX IF NOT EXISTS mednexus_theory_questions_prompt_trgm_idx
      ON mednexus_theory_questions USING GIN (prompt gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS mednexus_theory_notes_body_trgm_idx
      ON mednexus_theory_notes USING GIN (body gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS mednexus_theory_sets_name_trgm_idx
      ON mednexus_theory_sets USING GIN (name gin_trgm_ops);

    WITH ranked AS (
      SELECT q.id, q.collection_id, q.discipline_id, q.module_id,
        CEIL(ROW_NUMBER() OVER (
          PARTITION BY q.collection_id, q.discipline_id, q.module_id
          ORDER BY q.sort_order, q.created_at, q.id
        ) / 20.0)::int AS set_number
      FROM mednexus_theory_questions q
      WHERE q.set_id IS NULL
    ), created_sets AS (
      INSERT INTO mednexus_theory_sets (
        id, collection_id, discipline_id, module_id, name, sort_order, question_limit
      )
      SELECT DISTINCT
        'theory-set-' || md5(collection_id || ':' || coalesce(discipline_id, '') || ':' || coalesce(module_id, '') || ':' || set_number),
        collection_id, discipline_id, module_id, 'Set ' || set_number, set_number * 10, 20
      FROM ranked
      ON CONFLICT DO NOTHING
      RETURNING id
    )
    UPDATE mednexus_theory_questions q
    SET set_id = 'theory-set-' || md5(r.collection_id || ':' || coalesce(r.discipline_id, '') || ':' || coalesce(r.module_id, '') || ':' || r.set_number)
    FROM ranked r
    WHERE q.id = r.id AND q.set_id IS NULL;
  `)

  // ── Step 4: Host-migration trigger ────────────────────────────────────────
  // When a player whose id matches host_id has their status set to
  // 'disconnected', the trigger instantly promotes the oldest remaining active
  // player (first non-disconnected, non-spectator entry in the players array)
  // to be the new host — updating host_id, host_name, isHost flags, and
  // bumping version so pollers notice the change immediately.
  await client.query(`
    CREATE OR REPLACE FUNCTION mednexus_migrate_host()
    RETURNS TRIGGER AS $func$
    DECLARE
      host_player JSONB;
      new_host    JSONB;
    BEGIN
      -- Find the current host's player record in the updated array
      SELECT elem INTO host_player
      FROM jsonb_array_elements(NEW.players) AS elem
      WHERE (elem->>'id') = NEW.host_id
      LIMIT 1;

      -- Only act if the host is now disconnected
      IF host_player IS NOT NULL AND (host_player->>'status') = 'disconnected' THEN

        -- Oldest active player = first entry in the array that is not
        -- disconnected, not a spectator, and not the departing host.
        SELECT elem INTO new_host
        FROM jsonb_array_elements(NEW.players) AS elem
        WHERE (elem->>'id')         != NEW.host_id
          AND COALESCE(elem->>'status', 'active') != 'disconnected'
          AND COALESCE((elem->>'isSpectator')::boolean, false) = false
        LIMIT 1;

        IF new_host IS NOT NULL THEN
          -- Promote the new host
          NEW.host_id   := new_host->>'id';
          NEW.host_name := new_host->>'name';

          -- Rewrite isHost flags across the whole players array
          NEW.players := (
            SELECT jsonb_agg(
              CASE
                WHEN (elem->>'id') = NEW.host_id
                  THEN elem || '{"isHost": true}'::jsonb
                ELSE
                  elem || '{"isHost": false}'::jsonb
              END
            )
            FROM jsonb_array_elements(NEW.players) AS elem
          );

          -- Bump version so pollers detect the host change in the next tick
          NEW.version := COALESCE(NEW.version, 0) + 1;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS mednexus_host_migration ON mednexus_game_rooms;
    CREATE TRIGGER mednexus_host_migration
      BEFORE UPDATE ON mednexus_game_rooms
      FOR EACH ROW
      EXECUTE FUNCTION mednexus_migrate_host();
  `)

    await client.query(
      `INSERT INTO mednexus_schema_migrations(version)
       VALUES ($1) ON CONFLICT (version) DO NOTHING`,
      [CURRENT_SCHEMA_VERSION],
    )

    await client.query("COMMIT")
    initialized = true
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export default pool
