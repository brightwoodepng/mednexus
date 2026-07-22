import { Pool } from "pg"

// Allow callers to supply the connection string via POSTGRES_URL (user-managed
// secret) when Replit's runtime-managed DATABASE_URL is not present.
if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL
}

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

  // ── Step 1: Enums ─────────────────────────────────────────────────────────
  // PostgreSQL does not support CREATE TYPE IF NOT EXISTS, so we guard with a
  // DO block that silently skips if the type already exists.
  // Note: $$ dollar-quoting is required — single $ is not valid syntax.
  await pool.query(`
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
  await pool.query(`
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
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_questions (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- ── Theory Vault (normalized hierarchy) ─────────────────────────────────
    -- A question belongs to a discipline and optionally a set.  Collection,
    -- discipline and set ids are also carried on questions and learner records
    -- so reporting never needs to infer a parent from JSONB data.
    CREATE TABLE IF NOT EXISTS mednexus_theory_collections (
      id          TEXT PRIMARY KEY CHECK (id IN ('end_of_rotation', 'end_of_year')),
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_disciplines (
      id            TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL REFERENCES mednexus_theory_collections(id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      sort_order    INTEGER NOT NULL DEFAULT 0,
      is_published  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (id, collection_id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_sets (
      id            TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL,
      discipline_id TEXT NOT NULL,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      sort_order    INTEGER NOT NULL DEFAULT 0,
      is_published  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (id, collection_id, discipline_id),
      FOREIGN KEY (discipline_id, collection_id)
        REFERENCES mednexus_theory_disciplines(id, collection_id) ON DELETE CASCADE
    );
    -- category, module, set_number, and data are retained temporarily
    -- for API compatibility and for the explicit legacy backfill below.
    CREATE TABLE IF NOT EXISTS mednexus_theory_questions (
      id                      TEXT PRIMARY KEY,
      collection_id           TEXT NOT NULL DEFAULT 'end_of_rotation',
      discipline_id           TEXT NOT NULL DEFAULT 'legacy-general',
      set_id                  TEXT,
      category                TEXT NOT NULL DEFAULT '',
      module                  TEXT NOT NULL DEFAULT '',
      set_number              INTEGER NOT NULL DEFAULT 1,
      prompt                  TEXT NOT NULL DEFAULT '',
      model_answer            TEXT NOT NULL DEFAULT '',
      marking_points          JSONB NOT NULL DEFAULT '[]',
      tags                    TEXT[] NOT NULL DEFAULT '{}',
      source_metadata         JSONB NOT NULL DEFAULT '{}',
      past_paper_metadata     JSONB NOT NULL DEFAULT '[]',
      difficulty              TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
      estimated_study_minutes INTEGER NOT NULL DEFAULT 0 CHECK (estimated_study_minutes >= 0),
      sort_order              INTEGER NOT NULL DEFAULT 0,
      publication_status      TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published', 'unpublished')),
      is_archived             BOOLEAN NOT NULL DEFAULT FALSE,
      data                    JSONB NOT NULL DEFAULT '{}',
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (collection_id) REFERENCES mednexus_theory_collections(id),
      FOREIGN KEY (discipline_id, collection_id)
        REFERENCES mednexus_theory_disciplines(id, collection_id),
      FOREIGN KEY (set_id, collection_id, discipline_id)
        REFERENCES mednexus_theory_sets(id, collection_id, discipline_id)
    );

    -- User ids deliberately are not foreign keys: both registered and guest
    -- identities can own learning data. All rows retain the full hierarchy.
    CREATE TABLE IF NOT EXISTS mednexus_theory_reading_progress (
      user_id TEXT NOT NULL, collection_id TEXT NOT NULL, discipline_id TEXT NOT NULL,
      set_id TEXT, question_id TEXT NOT NULL, first_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), read_seconds INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, question_id),
      FOREIGN KEY (question_id) REFERENCES mednexus_theory_questions(id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_completion_progress (
      user_id TEXT NOT NULL, collection_id TEXT NOT NULL, discipline_id TEXT NOT NULL,
      set_id TEXT, question_id TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, question_id),
      FOREIGN KEY (question_id) REFERENCES mednexus_theory_questions(id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_bookmarks (
      user_id TEXT NOT NULL, collection_id TEXT NOT NULL, discipline_id TEXT NOT NULL,
      set_id TEXT, question_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, question_id),
      FOREIGN KEY (question_id) REFERENCES mednexus_theory_questions(id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_notes (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, collection_id TEXT NOT NULL, discipline_id TEXT NOT NULL,
      set_id TEXT, question_id TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, question_id),
      FOREIGN KEY (question_id) REFERENCES mednexus_theory_questions(id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_revision_entries (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, collection_id TEXT NOT NULL, discipline_id TEXT NOT NULL,
      set_id TEXT, question_id TEXT NOT NULL, due_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ,
      interval_days INTEGER NOT NULL DEFAULT 0, ease_factor NUMERIC(4,2), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (question_id) REFERENCES mednexus_theory_questions(id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_recent_activity (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, collection_id TEXT NOT NULL, discipline_id TEXT NOT NULL,
      set_id TEXT, question_id TEXT NOT NULL, activity_type TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), metadata JSONB NOT NULL DEFAULT '{}',
      FOREIGN KEY (question_id) REFERENCES mednexus_theory_questions(id)
    );
    CREATE TABLE IF NOT EXISTS mednexus_theory_import_batches (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, collection_id TEXT, discipline_id TEXT, set_id TEXT, question_id TEXT,
      source_name TEXT NOT NULL DEFAULT '', source_metadata JSONB NOT NULL DEFAULT '{}', imported_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0, audit_log JSONB NOT NULL DEFAULT '[]', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ,
      FOREIGN KEY (collection_id) REFERENCES mednexus_theory_collections(id),
      FOREIGN KEY (discipline_id, collection_id) REFERENCES mednexus_theory_disciplines(id, collection_id),
      FOREIGN KEY (set_id, collection_id, discipline_id) REFERENCES mednexus_theory_sets(id, collection_id, discipline_id),
      FOREIGN KEY (question_id) REFERENCES mednexus_theory_questions(id)
    );
    -- ── OSCE Stations (placeholder) ───────────────────────────────────────────
    -- Reserved for the OSCE study mode. Schema will be expanded when that feature
    -- is built. Creating the table now keeps the StudyMode = "OSCE" path routable
    -- without a future migration blocking cold-start.
    CREATE TABLE IF NOT EXISTS mednexus_osce_stations (
      id          TEXT        PRIMARY KEY,
      title       TEXT        NOT NULL DEFAULT '',
      module      TEXT        NOT NULL DEFAULT '',
      data        JSONB       NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mednexus_notifications (
      id         TEXT    PRIMARY KEY,
      title      TEXT    NOT NULL,
      body       TEXT    NOT NULL,
      type       TEXT    NOT NULL DEFAULT 'info',
      admin_only BOOLEAN NOT NULL DEFAULT FALSE,
      is_read    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_assessments (
      id              TEXT    PRIMARY KEY,
      title           TEXT    NOT NULL,
      module_name     TEXT    NOT NULL,
      question_ids    JSONB   NOT NULL DEFAULT '[]',
      question_count  INTEGER NOT NULL DEFAULT 10,
      time_limit_mins INTEGER NOT NULL DEFAULT 30,
      tries_allowed   INTEGER NOT NULL DEFAULT 1,
      pass_mark       INTEGER NOT NULL DEFAULT 50,
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
    CREATE TABLE IF NOT EXISTS mednexus_wallet (
      uid        TEXT    PRIMARY KEY,
      balance    INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS mednexus_bounty_progress (
      uid         TEXT    NOT NULL,
      bounty_id   TEXT    NOT NULL,
      bounty_date TEXT    NOT NULL,
      progress    INTEGER NOT NULL DEFAULT 0,
      claimed     BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (uid, bounty_id, bounty_date)
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
      status       TEXT    NOT NULL DEFAULT 'active',  -- active | completed | abandoned
      started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMPTZ
    );

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
  await pool.query(`
    -- Backfill new columns for databases that existed before this migration.
    ALTER TABLE mednexus_notifications
      ADD COLUMN IF NOT EXISTS admin_only BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE mednexus_notifications
      ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE mednexus_user_cosmetics
      ADD COLUMN IF NOT EXISTS equipped_avatar TEXT;

    ALTER TABLE mednexus_registered_users
      ADD COLUMN IF NOT EXISTS class_level TEXT NOT NULL DEFAULT '';
    ALTER TABLE mednexus_registered_users
      ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'REGISTERED';

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
    ALTER TABLE mednexus_wallet
      ADD COLUMN IF NOT EXISTS rank_points INTEGER NOT NULL DEFAULT 0;

    -- last_multiplayer_win_at: tracks when the user last achieved rank-1 in a
    -- multiplayer match, used for the First Win of the Day (+250 NP) bonus.
    ALTER TABLE mednexus_wallet
      ADD COLUMN IF NOT EXISTS last_multiplayer_win_at TIMESTAMPTZ;

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

    -- Theory Vault v2: add normalized columns to installations that previously
    -- stored only category/module/set_number plus a JSONB document.
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS collection_id TEXT;
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS discipline_id TEXT;
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS set_id TEXT;
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '';
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS model_answer TEXT NOT NULL DEFAULT '';
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS marking_points JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS past_paper_metadata JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'medium';
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS estimated_study_minutes INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft';
    ALTER TABLE mednexus_theory_questions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

    INSERT INTO mednexus_theory_collections (id, title, sort_order) VALUES
      ('end_of_rotation', 'End of Rotation', 1), ('end_of_year', 'End of Year', 2)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO mednexus_theory_disciplines (id, collection_id, title, sort_order)
      VALUES ('legacy-general', 'end_of_rotation', 'General', 0)
    ON CONFLICT (id) DO NOTHING;
    -- Preserve existing rows by creating deterministic legacy parents from their
    -- former category/module/set fields, then copy JSONB values into columns.
    INSERT INTO mednexus_theory_disciplines (id, collection_id, title, sort_order)
    SELECT 'legacy-discipline-' || md5(COALESCE(category, '') || '|' || COALESCE(module, '')),
           'end_of_rotation', COALESCE(NULLIF(category, ''), NULLIF(module, ''), 'General'), 0
    FROM mednexus_theory_questions GROUP BY category, module
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO mednexus_theory_sets (id, collection_id, discipline_id, title, sort_order)
    SELECT 'legacy-set-' || md5(COALESCE(category, '') || '|' || COALESCE(module, '') || '|' || set_number::text),
           'end_of_rotation', 'legacy-discipline-' || md5(COALESCE(category, '') || '|' || COALESCE(module, '')),
           'Set ' || set_number, set_number
    FROM mednexus_theory_questions GROUP BY category, module, set_number
    ON CONFLICT (id) DO NOTHING;
    UPDATE mednexus_theory_questions
       SET collection_id = COALESCE(collection_id, 'end_of_rotation'),
           discipline_id = COALESCE(discipline_id, 'legacy-discipline-' || md5(COALESCE(category, '') || '|' || COALESCE(module, ''))),
           set_id = COALESCE(set_id, 'legacy-set-' || md5(COALESCE(category, '') || '|' || COALESCE(module, '') || '|' || set_number::text)),
           prompt = CASE WHEN prompt = '' THEN COALESCE(data->>'prompt', '') ELSE prompt END,
           model_answer = CASE WHEN model_answer = '' THEN COALESCE(data->>'modelAnswer', '') ELSE model_answer END,
           marking_points = CASE WHEN marking_points = '[]'::jsonb THEN COALESCE(data->'markingPoints', data->'criticalFlags', '[]'::jsonb) ELSE marking_points END,
           tags = CASE WHEN cardinality(tags) = 0 THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(data->'tags', '[]'::jsonb))) ELSE tags END,
           past_paper_metadata = CASE WHEN past_paper_metadata = '[]'::jsonb THEN COALESCE(data->'pastPaperMetadata', data->'pastPapers', '[]'::jsonb) ELSE past_paper_metadata END,
           publication_status = CASE WHEN publication_status = 'draft' THEN COALESCE(data->>'publicationStatus', 'published') ELSE publication_status END,
           is_archived = is_archived OR COALESCE((data->>'isArchived')::boolean, FALSE);
    ALTER TABLE mednexus_theory_questions ALTER COLUMN collection_id SET NOT NULL;
    ALTER TABLE mednexus_theory_questions ALTER COLUMN discipline_id SET NOT NULL;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'theory_questions_collection_fk') THEN
        ALTER TABLE mednexus_theory_questions ADD CONSTRAINT theory_questions_collection_fk
          FOREIGN KEY (collection_id) REFERENCES mednexus_theory_collections(id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'theory_questions_discipline_fk') THEN
        ALTER TABLE mednexus_theory_questions ADD CONSTRAINT theory_questions_discipline_fk
          FOREIGN KEY (discipline_id, collection_id) REFERENCES mednexus_theory_disciplines(id, collection_id);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'theory_questions_set_fk') THEN
        ALTER TABLE mednexus_theory_questions ADD CONSTRAINT theory_questions_set_fk
          FOREIGN KEY (set_id, collection_id, discipline_id) REFERENCES mednexus_theory_sets(id, collection_id, discipline_id);
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_theory_questions_id_context ON mednexus_theory_questions (id, collection_id, discipline_id);
    CREATE INDEX IF NOT EXISTS idx_theory_browse_published ON mednexus_theory_questions (collection_id, discipline_id, set_id, sort_order) WHERE publication_status = 'published' AND NOT is_archived;
    CREATE INDEX IF NOT EXISTS idx_theory_disciplines_order ON mednexus_theory_disciplines (collection_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_theory_sets_order ON mednexus_theory_sets (collection_id, discipline_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_theory_question_lookup ON mednexus_theory_questions (collection_id, discipline_id, set_id, id);
    CREATE INDEX IF NOT EXISTS idx_theory_reading_user ON mednexus_theory_reading_progress (user_id, last_read_at DESC);
    CREATE INDEX IF NOT EXISTS idx_theory_completion_user ON mednexus_theory_completion_progress (user_id, completed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_theory_revision_due ON mednexus_theory_revision_entries (user_id, due_at) WHERE completed_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_theory_bookmarks_user ON mednexus_theory_bookmarks (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_theory_notes_user ON mednexus_theory_notes (user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_theory_search ON mednexus_theory_questions USING GIN (to_tsvector('simple', coalesce(prompt, '') || ' ' || coalesce(model_answer, '') || ' ' || array_to_string(tags, ' ')));

    -- Sweep expired rows on every cold start (cheap on a small table).
    DELETE FROM mednexus_game_rooms   WHERE expires_at < NOW();
    DELETE FROM mednexus_guest_users  WHERE expires_at < NOW();
  `)

  // ── Step 4: Host-migration trigger ────────────────────────────────────────
  // When a player whose id matches host_id has their status set to
  // 'disconnected', the trigger instantly promotes the oldest remaining active
  // player (first non-disconnected, non-spectator entry in the players array)
  // to be the new host — updating host_id, host_name, isHost flags, and
  // bumping version so pollers notice the change immediately.
  await pool.query(`
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

  initialized = true
}

export default pool
