-- ============================================================
-- FluidControl ETMS — Supabase Database Setup
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE
);

-- ============================================================
-- 2. TRAININGS
-- ============================================================
CREATE TABLE IF NOT EXISTS trainings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  frequency text NOT NULL CHECK (frequency IN ('one_time','monthly','quarterly','half_yearly','yearly','as_required')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. EMPLOYEES
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  designation text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);

-- ============================================================
-- 4. TRAINING SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS training_schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_id uuid NOT NULL REFERENCES trainings(id) ON DELETE RESTRICT,
  scheduled_date date NOT NULL,
  trainer_name text NOT NULL,
  group_type text NOT NULL CHECK (group_type IN ('all','department','selected')),
  department_id uuid REFERENCES departments(id),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','ongoing','completed','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedules_training ON training_schedules(training_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON training_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON training_schedules(status);

-- ============================================================
-- 5. SCHEDULE EMPLOYEES (resolved group)
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_employees (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id uuid NOT NULL REFERENCES training_schedules(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE(schedule_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_sche_schedule ON schedule_employees(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sche_employee ON schedule_employees(employee_id);

-- ============================================================
-- 6. ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id uuid NOT NULL REFERENCES training_schedules(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_status text NOT NULL DEFAULT 'not_marked' CHECK (attendance_status IN ('present','absent','not_marked')),
  marked_at timestamptz,
  UNIQUE(schedule_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_att_schedule ON attendance(schedule_id);
CREATE INDEX IF NOT EXISTS idx_att_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_status ON attendance(attendance_status);

-- ============================================================
-- 7. EMPLOYEE TRAINING HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_training_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  training_id uuid NOT NULL REFERENCES trainings(id) ON DELETE RESTRICT,
  schedule_id uuid NOT NULL REFERENCES training_schedules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('completed','pending','overdue')),
  completed_on date,
  due_date date,
  UNIQUE(employee_id, schedule_id)
);

CREATE INDEX IF NOT EXISTS idx_history_employee ON employee_training_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_history_training ON employee_training_history(training_id);
CREATE INDEX IF NOT EXISTS idx_history_schedule ON employee_training_history(schedule_id);
CREATE INDEX IF NOT EXISTS idx_history_status ON employee_training_history(status);
CREATE INDEX IF NOT EXISTS idx_history_due ON employee_training_history(due_date);

-- ============================================================
-- 8. QUIZZES
-- ============================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id uuid NOT NULL REFERENCES training_schedules(id) ON DELETE CASCADE,
  title text NOT NULL,
  form_link text NOT NULL,
  pass_score numeric
);

-- ============================================================
-- 9. QUIZ RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  result_status text NOT NULL DEFAULT 'pending_review' CHECK (result_status IN ('pass','fail','pending_review')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_qr_quiz ON quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_qr_employee ON quiz_results(employee_id);

-- ============================================================
-- 10. TRAINING MATERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS training_materials (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_id uuid NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_url text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('pdf','video','link','doc')),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_training ON training_materials(training_id);

-- ============================================================
-- 11. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type IN ('reminder','overdue','new_training_assigned')),
  schedule_id uuid REFERENCES training_schedules(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  message text NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed'))
);

CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notif_schedule ON notifications(schedule_id);

-- ============================================================
-- 12. AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  performed_by text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_training_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_departments" ON departments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_trainings" ON trainings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_employees" ON employees FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_training_schedules" ON training_schedules FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_schedule_employees" ON schedule_employees FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_attendance" ON attendance FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_employee_training_history" ON employee_training_history FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_quizzes" ON quizzes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_quiz_results" ON quiz_results FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_training_materials" ON training_materials FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_notifications" ON notifications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_audit_log" ON audit_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- TRANSACTIONAL RPC
-- ============================================================
CREATE OR REPLACE FUNCTION mark_attendance_and_update_history(
  p_schedule_id uuid,
  p_attendance_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec jsonb;
  v_employee_id uuid;
  v_status text;
  v_training_id uuid;
  v_scheduled_date date;
BEGIN
  SELECT training_id, scheduled_date 
  INTO v_training_id, v_scheduled_date
  FROM training_schedules 
  WHERE id = p_schedule_id;

  FOR rec IN SELECT * FROM jsonb_array_elements(p_attendance_data)
  LOOP
    v_employee_id := (rec->>'employee_id')::uuid;
    v_status := rec->>'attendance_status';

    INSERT INTO attendance (schedule_id, employee_id, attendance_status, marked_at)
    VALUES (p_schedule_id, v_employee_id, v_status, now())
    ON CONFLICT (schedule_id, employee_id)
    DO UPDATE SET attendance_status = EXCLUDED.attendance_status, marked_at = now();

    IF v_status = 'present' THEN
      INSERT INTO employee_training_history (employee_id, training_id, schedule_id, status, completed_on)
      VALUES (v_employee_id, v_training_id, p_schedule_id, 'completed', v_scheduled_date)
      ON CONFLICT (employee_id, schedule_id)
      DO UPDATE SET status = 'completed', completed_on = v_scheduled_date;
    ELSE
      INSERT INTO employee_training_history (employee_id, training_id, schedule_id, status, due_date)
      VALUES (v_employee_id, v_training_id, p_schedule_id, 
        CASE WHEN (v_scheduled_date + INTERVAL '7 days') < now() THEN 'overdue' ELSE 'pending' END,
        v_scheduled_date + INTERVAL '7 days')
      ON CONFLICT (employee_id, schedule_id)
      DO UPDATE SET 
        status = CASE 
          WHEN employee_training_history.status = 'completed' THEN 'completed'
          WHEN (v_scheduled_date + INTERVAL '7 days') < now() THEN 'overdue' 
          ELSE 'pending' 
        END,
        due_date = v_scheduled_date + INTERVAL '7 days'
      WHERE employee_training_history.status != 'completed';
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO departments (name) VALUES 
  ('Operations'),
  ('Information Technology')
ON CONFLICT (name) DO NOTHING;

INSERT INTO trainings (name, description, frequency) VALUES
  ('Cyber Security Awareness', 'Annual cybersecurity training covering phishing, password safety, data protection and incident response protocols.', 'yearly'),
  ('Fire Safety & Emergency Response', 'Comprehensive fire safety training including evacuation procedures, fire extinguisher operation, and emergency response.', 'half_yearly'),
  ('ISO 9001:2015 Awareness', 'Quality management system awareness training covering ISO 9001:2015 requirements, documentation, and continuous improvement.', 'yearly')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  ops_id uuid;
  it_id uuid;
BEGIN
  SELECT id INTO ops_id FROM departments WHERE name = 'Operations';
  SELECT id INTO it_id FROM departments WHERE name = 'Information Technology';

  INSERT INTO employees (employee_code, name, email, department_id, designation) VALUES
    ('FC001', 'Rajesh Kumar', 'rajesh.kumar@fluidcontrol.com', ops_id, 'Plant Manager'),
    ('FC002', 'Priya Sharma', 'priya.sharma@fluidcontrol.com', ops_id, 'Safety Officer'),
    ('FC003', 'Amit Patel', 'amit.patel@fluidcontrol.com', it_id, 'IT Manager'),
    ('FC004', 'Sunita Verma', 'sunita.verma@fluidcontrol.com', ops_id, 'Quality Engineer'),
    ('FC005', 'Vikram Singh', 'vikram.singh@fluidcontrol.com', it_id, 'System Administrator'),
    ('FC006', 'Neha Gupta', 'neha.gupta@fluidcontrol.com', ops_id, 'Production Supervisor'),
    ('FC007', 'Arjun Mehta', 'arjun.mehta@fluidcontrol.com', it_id, 'Software Developer'),
    ('FC008', 'Kavita Nair', 'kavita.nair@fluidcontrol.com', ops_id, 'Maintenance Engineer'),
    ('FC009', 'Suresh Rao', 'suresh.rao@fluidcontrol.com', ops_id, 'Operator'),
    ('FC010', 'Anita Joshi', 'anita.joshi@fluidcontrol.com', it_id, 'Business Analyst')
  ON CONFLICT (employee_code) DO NOTHING;
END $$;

-- ============================================================
-- 13. SUPABASE STORAGE BUCKET: training-materials
-- ============================================================
-- Run this in Supabase SQL Editor to enable file uploads for training materials
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-materials',
  'training-materials',
  true,
  52428800, -- 50MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'video/mp4', 'video/quicktime', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = 52428800;

-- Storage policies for training-materials bucket
DROP POLICY IF EXISTS "Public read training-materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload training-materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update training-materials" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete training-materials" ON storage.objects;
DROP POLICY IF EXISTS "Anon fallback upload training-materials" ON storage.objects;

CREATE POLICY "Public read training-materials"
ON storage.objects FOR SELECT
USING (bucket_id = 'training-materials');

CREATE POLICY "Authenticated upload training-materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-materials');

CREATE POLICY "Authenticated update training-materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'training-materials');

CREATE POLICY "Authenticated delete training-materials"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'training-materials');

CREATE POLICY "Anon fallback upload training-materials"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'training-materials');

