-- Property: new physical fields
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "uklad"             TEXT,
  ADD COLUMN IF NOT EXISTS "pietro"            INTEGER,
  ADD COLUMN IF NOT EXISTS "rok_budowy"        INTEGER,
  ADD COLUMN IF NOT EXISTS "balkon_metraz"     NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS "strony_swiata"     TEXT,
  ADD COLUMN IF NOT EXISTS "operat_szacunkowy" NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS "co_assignees"      UUID[] NOT NULL DEFAULT '{}';

-- Task: stage tracking
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "property_stage" TEXT;

-- Document: stage visibility
ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "stage" TEXT;

CREATE INDEX IF NOT EXISTS "documents_property_id_idx" ON "documents"("property_id");
