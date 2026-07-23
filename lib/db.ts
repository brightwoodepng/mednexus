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
      PRIMARY KEY (user_id, permission)
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
      answer_key JSONB NOT NULL DEFAULT '[]',
      accepted_answers JSONB NOT NULL DEFAULT '{}',
      payout JSONB,
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
  await pool.query(`
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
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS answer_key JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS accepted_answers JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS payout JSONB;

    ALTER TABLE mednexus_wallet
      ADD COLUMN IF NOT EXISTS rank_points INTEGER NOT NULL DEFAULT 0;

    -- last_multiplayer_win_at: tracks when the user last achieved rank-1 in a
    -- multiplayer match, used for the First Win of the Day (+250 NP) bonus.
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS answer_key JSONB NOT NULL DEFAULT '[]';
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS accepted_answers JSONB NOT NULL DEFAULT '{}';
    ALTER TABLE mednexus_exam_sessions ADD COLUMN IF NOT EXISTS payout JSONB;

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
