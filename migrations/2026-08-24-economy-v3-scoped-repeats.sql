BEGIN;

ALTER TABLE mednexus_user_question_progress
  ADD COLUMN IF NOT EXISTS reward_scope TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE mednexus_user_question_progress
  DROP CONSTRAINT IF EXISTS mednexus_user_question_progress_pkey;

ALTER TABLE mednexus_user_question_progress
  ADD CONSTRAINT mednexus_user_question_progress_pkey
  PRIMARY KEY (season_id, user_id, question_id, reward_scope);

COMMIT;
