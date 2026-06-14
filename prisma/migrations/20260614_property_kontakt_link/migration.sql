-- Add kontakt_id link to properties table
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "kontakt_id" UUID REFERENCES "kontakty"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "properties_kontakt_id_idx" ON "properties"("kontakt_id");
