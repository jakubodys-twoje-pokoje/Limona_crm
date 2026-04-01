-- =============================================
-- TASK COMMENTS + NOTIFICATIONS + MENTIONS
-- =============================================

-- Task comments
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_task_comments_created ON task_comments(created_at DESC);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view comments" ON task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert comments" ON task_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "User can update own comments" ON task_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User or admin can delete comments" ON task_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE task_comments;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- recipient
  from_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,      -- who triggered
  type TEXT NOT NULL CHECK (type IN ('mention_wall', 'mention_task', 'task_assigned', 'comment_added')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                    -- e.g. /wall, /zadania, /nieruchomosci/[id]
  reference_id UUID,            -- wall_message_id or task_id
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own notifications" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "User can update own notifications" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User can delete own notifications" ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Wall message read tracking
CREATE TABLE IF NOT EXISTS wall_reads (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES wall_messages(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX idx_wall_reads_user ON wall_reads(user_id);

ALTER TABLE wall_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can view own reads" ON wall_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "User can insert own reads" ON wall_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Cleanup old read notifications (> 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications
  WHERE read = true AND created_at < now() - INTERVAL '30 days';
END;
$$;
