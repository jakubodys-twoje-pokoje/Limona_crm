-- Research queries table
CREATE TABLE IF NOT EXISTS research_queries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID        REFERENCES properties(id) ON DELETE SET NULL,
  person_name TEXT        NOT NULL,
  kw_number   TEXT,
  notes       TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending',
  results     JSONB,
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_queries_person_name_idx ON research_queries (person_name);
CREATE INDEX IF NOT EXISTS research_queries_created_at_idx  ON research_queries (created_at DESC);

-- Auto-update updated_at
CREATE TRIGGER set_research_queries_updated_at
  BEFORE UPDATE ON research_queries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
