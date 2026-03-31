-- =============================================
-- WALL (Team Channel) + TEAM VISIBILITY
-- =============================================

-- Wall messages — team channel (90-day retention)
CREATE TABLE IF NOT EXISTS wall_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wall_created ON wall_messages(created_at DESC);
CREATE INDEX idx_wall_pinned ON wall_messages(pinned) WHERE pinned = true;

ALTER TABLE wall_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view wall" ON wall_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can post wall" ON wall_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "User can delete own or admin" ON wall_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can update wall" ON wall_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE wall_messages;

-- Auto-cleanup: delete messages older than 90 days
-- Run this as a Supabase cron job (pg_cron) or call manually
CREATE OR REPLACE FUNCTION cleanup_old_wall_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM wall_messages
  WHERE created_at < now() - INTERVAL '90 days'
    AND pinned = false;
END;
$$;

-- If pg_cron is available (Supabase pro), schedule daily cleanup:
-- SELECT cron.schedule('cleanup-wall', '0 3 * * *', 'SELECT cleanup_old_wall_messages()');
-- On free plan: call cleanup_old_wall_messages() from an edge function or manually.

-- =============================================
-- TEAM VISIBILITY — who sees whose tasks
-- =============================================

-- manager_id can see all tasks of member_id
CREATE TABLE IF NOT EXISTS team_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(manager_id, member_id)
);

CREATE INDEX idx_team_vis_manager ON team_visibility(manager_id);
CREATE INDEX idx_team_vis_member ON team_visibility(member_id);

ALTER TABLE team_visibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view team_visibility" ON team_visibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage team_visibility" ON team_visibility FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can update team_visibility" ON team_visibility FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admin can delete team_visibility" ON team_visibility FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
