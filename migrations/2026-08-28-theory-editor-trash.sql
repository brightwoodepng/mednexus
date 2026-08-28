ALTER TABLE mednexus_content_import_jobs
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT,
  ADD COLUMN IF NOT EXISTS previous_status TEXT;

ALTER TABLE mednexus_theory_modules
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT,
  ADD COLUMN IF NOT EXISTS previous_status TEXT;
ALTER TABLE mednexus_theory_disciplines
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT,
  ADD COLUMN IF NOT EXISTS previous_status TEXT;
ALTER TABLE mednexus_theory_sets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT,
  ADD COLUMN IF NOT EXISTS previous_status TEXT;
ALTER TABLE mednexus_theory_questions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT,
  ADD COLUMN IF NOT EXISTS previous_status TEXT;

CREATE INDEX IF NOT EXISTS mednexus_theory_questions_active_hierarchy_idx
  ON mednexus_theory_questions (collection_id, module_id, discipline_id, set_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS mednexus_theory_questions_trash_idx
  ON mednexus_theory_questions (deleted_at DESC) WHERE deleted_at IS NOT NULL;
