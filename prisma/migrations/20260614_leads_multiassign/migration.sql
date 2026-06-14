-- Multi-assign: co_assignees column on tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "co_assignees" TEXT[] NOT NULL DEFAULT '{}';

-- Lead flow table
CREATE TABLE IF NOT EXISTS "leads" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        TEXT        NOT NULL,
  "phone"       TEXT,
  "email"       TEXT,
  "location"    TEXT,
  "source"      TEXT,
  "notes"       TEXT,
  "status"      TEXT        NOT NULL DEFAULT 'new',
  "assigned_to" UUID        REFERENCES "profiles"("id") ON DELETE SET NULL,
  "property_id" UUID        REFERENCES "properties"("id") ON DELETE SET NULL,
  "created_by"  UUID        REFERENCES "profiles"("id") ON DELETE SET NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "leads_status_idx"      ON "leads"("status");
CREATE INDEX IF NOT EXISTS "leads_assigned_to_idx" ON "leads"("assigned_to");
CREATE INDEX IF NOT EXISTS "leads_created_at_idx"  ON "leads"("created_at" DESC);
