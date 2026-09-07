BEGIN;

CREATE TABLE IF NOT EXISTS mednexus_economy_config_revisions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  np_config JSONB NOT NULL,
  xp_config JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS mednexus_one_active_economy_config
  ON mednexus_economy_config_revisions ((is_active)) WHERE is_active;

CREATE TABLE IF NOT EXISTS mednexus_economy_reward_runs (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES mednexus_economy_seasons(id),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('monthly','seasonal')),
  period_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','reversed')),
  config_version TEXT NOT NULL,
  eligible_count INTEGER NOT NULL DEFAULT 0,
  excluded_count INTEGER NOT NULL DEFAULT 0,
  total_np BIGINT NOT NULL DEFAULT 0,
  executed_by TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (season_id, reward_type, period_key)
);

CREATE TABLE IF NOT EXISTS mednexus_economy_reward_recipients (
  run_id TEXT NOT NULL REFERENCES mednexus_economy_reward_runs(id),
  user_id TEXT NOT NULL,
  place INTEGER NOT NULL CHECK (place > 0),
  score BIGINT NOT NULL DEFAULT 0,
  np_amount INTEGER NOT NULL CHECK (np_amount >= 0),
  PRIMARY KEY (run_id, user_id)
);

CREATE TABLE IF NOT EXISTS mednexus_economy_gifts (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES mednexus_economy_seasons(id),
  user_id TEXT NOT NULL,
  index_number TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  kind TEXT NOT NULL DEFAULT 'gift' CHECK (kind IN ('gift','correction')),
  batch_id TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mednexus_economy_gifts_recent
  ON mednexus_economy_gifts (created_at DESC);

ALTER TABLE mednexus_np_transactions
  ADD COLUMN IF NOT EXISTS config_version TEXT;
ALTER TABLE mednexus_xp_transactions
  ADD COLUMN IF NOT EXISTS config_version TEXT;

INSERT INTO mednexus_schema_migrations(version)
VALUES ('2026-09-07-economy-control-plane')
ON CONFLICT (version) DO NOTHING;

COMMIT;
