-- =============================================
-- LIMONA CRM — Database Schema
-- =============================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Properties (main CRM table)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location TEXT NOT NULL,
  trello_link TEXT,
  phone TEXT,
  contact_type TEXT CHECK (contact_type IN ('posrednik', 'prywatne')),
  property_type TEXT CHECK (property_type IN ('mieszkanie', 'dom', 'grunt', 'hala', 'inne')),
  area_sqm NUMERIC(10,2),
  value_per_sqm NUMERIC(14,2),
  rw NUMERIC(14,2) GENERATED ALWAYS AS (value_per_sqm * 0.9) STORED,
  total_debt NUMERIC(14,2) DEFAULT 0,
  debt_type TEXT CHECK (debt_type IN ('below_value', 'above_value')),
  creditor1_amount NUMERIC(14,2) DEFAULT 0,
  creditor2_amount NUMERIC(14,2) DEFAULT 0,
  creditor3_amount NUMERIC(14,2) DEFAULT 0,
  owner_coefficient NUMERIC(6,4) DEFAULT 0.025,
  commission_pct NUMERIC(6,4) DEFAULT 0,
  notary_fee NUMERIC(10,2) DEFAULT 1000,
  manual_offer NUMERIC(14,2),
  status TEXT DEFAULT 'new' CHECK (status IN (
    'new', 'analysis', 'offer_sent', 'negotiation',
    'contract', 'legal_cleanup', 'sale', 'completed', 'rejected'
  )),
  decision TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- RLS Policies — all authenticated users see everything
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Authenticated users can insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all properties" ON properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert properties" ON properties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update properties" ON properties FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete properties" ON properties FOR DELETE TO authenticated USING (true);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all tasks" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks" ON tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete tasks" ON tasks FOR DELETE TO authenticated USING (true);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all activity" ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activity" ON activity_log FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all documents" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert documents" ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete documents" ON documents FOR DELETE TO authenticated USING (true);

-- =============================================
-- Functions & Triggers
-- =============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- Realtime
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE properties;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_assigned ON properties(assigned_to);
CREATE INDEX idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX idx_tasks_property ON tasks(property_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_activity_property ON activity_log(property_id);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);
