-- Boards
CREATE TABLE IF NOT EXISTS "boards" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"        TEXT        NOT NULL,
  "color"       TEXT        NOT NULL DEFAULT '#84cc16',
  "description" TEXT,
  "created_by"  UUID        REFERENCES "profiles"("id") ON DELETE SET NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "boards_created_at_idx" ON "boards"("created_at" DESC);

-- Board lists (columns)
CREATE TABLE IF NOT EXISTS "board_lists" (
  "id"       UUID NOT NULL DEFAULT gen_random_uuid(),
  "board_id" UUID NOT NULL REFERENCES "boards"("id") ON DELETE CASCADE,
  "name"     TEXT NOT NULL,
  "position" INT  NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "board_lists_board_pos_idx" ON "board_lists"("board_id", "position");

-- Extend tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "board_id"  UUID REFERENCES "boards"("id")      ON DELETE SET NULL;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "list_id"   UUID REFERENCES "board_lists"("id") ON DELETE SET NULL;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "position"  INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "tasks_board_list_idx" ON "tasks"("board_id", "list_id");
