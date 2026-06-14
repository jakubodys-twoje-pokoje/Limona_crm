-- Extend Property with deal workflow fields
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "deal_type"         TEXT,
  ADD COLUMN IF NOT EXISTS "owner_name"        TEXT,
  ADD COLUMN IF NOT EXISTS "kw_number"         TEXT,
  ADD COLUMN IF NOT EXISTS "kw_opis"           TEXT,
  ADD COLUMN IF NOT EXISTS "source"            TEXT,
  ADD COLUMN IF NOT EXISTS "czynsz_miesieczny" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "pokazywania_count" INTEGER NOT NULL DEFAULT 0;

-- Add company_name to research queries
ALTER TABLE "research_queries"
  ADD COLUMN IF NOT EXISTS "company_name" TEXT;
