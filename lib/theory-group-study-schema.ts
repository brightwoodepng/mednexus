/** Additive, idempotent extension of the existing room tables. */
export const THEORY_GROUP_STUDY_SCHEMA = `
  ALTER TABLE mednexus_group_study_rooms
    ADD COLUMN IF NOT EXISTS study_type TEXT NOT NULL DEFAULT 'mcq' CHECK (study_type IN ('mcq','theory'));
  ALTER TABLE mednexus_group_study_room_questions
    ADD COLUMN IF NOT EXISTS revealed_at TIMESTAMPTZ;
  ALTER TABLE mednexus_group_study_rooms DROP CONSTRAINT IF EXISTS mednexus_group_study_rooms_timer_seconds_check;
  ALTER TABLE mednexus_group_study_rooms ADD CONSTRAINT mednexus_group_study_rooms_timer_seconds_check
    CHECK (timer_seconds IS NULL OR (study_type='mcq' AND timer_seconds IN (30,45,60,90))
      OR (study_type='theory' AND timer_seconds BETWEEN 30 AND 3600));
`
