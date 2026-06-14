-- Direct messages (1:1 chat)
CREATE TABLE IF NOT EXISTS "direct_messages" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "from_id"    UUID        NOT NULL,
  "to_id"      UUID        NOT NULL,
  "content"    TEXT        NOT NULL,
  "read"       BOOLEAN     NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("from_id") REFERENCES "profiles"("id") ON DELETE CASCADE,
  FOREIGN KEY ("to_id")   REFERENCES "profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "direct_messages_pair_idx"    ON "direct_messages"("from_id", "to_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "direct_messages_to_read_idx" ON "direct_messages"("to_id", "read");

-- Group messages (group_id = manager profile id)
CREATE TABLE IF NOT EXISTS "group_messages" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "group_id"   UUID        NOT NULL,
  "user_id"    UUID        NOT NULL,
  "content"    TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "group_messages_group_idx" ON "group_messages"("group_id", "created_at" DESC);
