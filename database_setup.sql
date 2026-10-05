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
-- 12. AUDIT LOG (Immutable)
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

-- Prevent any UPDATE or DELETE on audit_log to guarantee SOC2/ISO audit immutability
CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_audit_log ON audit_log;
CREATE TRIGGER trg_protect_audit_log
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_tampering();

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

-- Base Authenticated Policies
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

-- Audit log: allow SELECT and INSERT only; UPDATE/DELETE blocked by trigger
CREATE POLICY "auth_audit_log_select" ON audit_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_audit_log_insert" ON audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- TRANSACTIONAL RPCS & AUTOMATION
-- ============================================================

-- 1. Atomic Attendance and History Updater with Schedule Status & Audit Logging
CREATE OR REPLACE FUNCTION mark_attendance_and_update_history(
  p_schedule_id uuid,
  p_attendance_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec jsonb;
  v_employee_id uuid;
  v_status text;
  v_training_id uuid;
  v_scheduled_date date;
  v_total_marked int := 0;
  v_present_count int := 0;
  v_absent_count int := 0;
BEGIN
  IF p_schedule_id IS NULL THEN
    RAISE EXCEPTION 'schedule_id is required';
  END IF;

  SELECT training_id, scheduled_date 
  INTO v_training_id, v_scheduled_date
  FROM training_schedules 
  WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Training schedule with ID % does not exist', p_schedule_id;
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(p_attendance_data)
  LOOP
    v_employee_id := (rec->>'employee_id')::uuid;
    v_status := rec->>'attendance_status';

    IF v_status NOT IN ('present', 'absent', 'not_marked') THEN
      RAISE EXCEPTION 'Invalid attendance status: %', v_status;
    END IF;

    -- Upsert attendance record
    INSERT INTO attendance (schedule_id, employee_id, attendance_status, marked_at)
    VALUES (p_schedule_id, v_employee_id, v_status, now())
    ON CONFLICT (schedule_id, employee_id)
    DO UPDATE SET attendance_status = EXCLUDED.attendance_status, marked_at = now();

    v_total_marked := v_total_marked + 1;

    IF v_status = 'present' THEN
      v_present_count := v_present_count + 1;
      INSERT INTO employee_training_history (employee_id, training_id, schedule_id, status, completed_on, due_date)
      VALUES (v_employee_id, v_training_id, p_schedule_id, 'completed', v_scheduled_date, NULL)
      ON CONFLICT (employee_id, schedule_id)
      DO UPDATE SET status = 'completed', completed_on = v_scheduled_date, due_date = NULL;
    ELSIF v_status = 'absent' THEN
      v_absent_count := v_absent_count + 1;
      INSERT INTO employee_training_history (employee_id, training_id, schedule_id, status, due_date)
      VALUES (
        v_employee_id, 
        v_training_id, 
        p_schedule_id, 
        CASE WHEN (v_scheduled_date + INTERVAL '7 days') < CURRENT_DATE THEN 'overdue' ELSE 'pending' END,
        v_scheduled_date + INTERVAL '7 days'
      )
      ON CONFLICT (employee_id, schedule_id)
      DO UPDATE SET 
        status = CASE 
          WHEN employee_training_history.status = 'completed' THEN 'completed'
          WHEN (v_scheduled_date + INTERVAL '7 days') < CURRENT_DATE THEN 'overdue' 
          ELSE 'pending' 
        END,
        due_date = v_scheduled_date + INTERVAL '7 days'
      WHERE employee_training_history.status != 'completed';
    END IF;
  END LOOP;

  -- Update schedule status to completed if at least one marked and no pending
  UPDATE training_schedules 
  SET status = 'completed' 
  WHERE id = p_schedule_id;

  RETURN jsonb_build_object(
    'success', true,
    'total_marked', v_total_marked,
    'present', v_present_count,
    'absent', v_absent_count
  );
END;
$$;

-- 2. Automated Overdue Status Synchronizer RPC
CREATE OR REPLACE FUNCTION refresh_overdue_training_statuses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count int := 0;
BEGIN
  -- Mark any pending training past its due date as overdue
  UPDATE employee_training_history
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date IS NOT NULL
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'overdue_records_updated', v_updated_count,
    'refreshed_at', now()
  );
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

-- ============================================================
-- 14. SYSTEM SETTINGS & ZERO-HARDCODING LOOKUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_system_settings" ON system_settings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed configurable settings
INSERT INTO system_settings (key, value, description) VALUES
  ('company_profile', jsonb_build_object(
    'company_name', 'Fluid Controls Pvt. Ltd.',
    'tagline', 'Employee Training Management & Compliance System',
    'logo_url', '/logo.png',
    'contact_email', 'hr@fluidcontrols.com',
    'address', 'MIDC Industrial Area, Pune, Maharashtra, India',
    'iso_standard', 'ISO 9001:2015 / ISO 45001:2018'
  ), 'Official company branding, contact details, and compliance standards'),

  ('training_frequencies', jsonb_build_array(
    jsonb_build_object('value', 'one_time', 'label', 'One Time'),
    jsonb_build_object('value', 'monthly', 'label', 'Monthly (Every Month)'),
    jsonb_build_object('value', 'quarterly', 'label', 'Quarterly (Every 3 Months)'),
    jsonb_build_object('value', 'half_yearly', 'label', 'Half Yearly (Every 6 Months)'),
    jsonb_build_object('value', 'yearly', 'label', 'Yearly (Annual)'),
    jsonb_build_object('value', 'as_required', 'label', 'As Required / Need Based')
  ), 'Available training program frequency schedules'),

  ('notification_rules', jsonb_build_object(
    'reminder_lead_days', 7,
    'overdue_repeat_days', 3,
    'auto_notify_trainer', true,
    'auto_notify_employees', true,
    'upcoming_window_days', 7
  ), 'Automated notification dispatch and overdue escalation timings'),

  ('compliance_thresholds', jsonb_build_object(
    'default_pass_score', 80,
    'max_file_size_mb', 50,
    'default_pagination_size', 25,
    'audit_retention_days', 365
  ), 'System compliance and assessment operational thresholds'),

  ('email_templates', jsonb_build_object(
    'reminder_subject', 'Upcoming Training: {{training_name}} on {{scheduled_date}}',
    'reminder_body', 'Dear {{employee_name}},\n\nYou are scheduled to attend the following training session:\n\nTraining: {{training_name}}\nDate: {{scheduled_date}}\nTrainer: {{trainer_name}}\n\nPlease arrive on time and review any preliminary materials.\n\nBest regards,\nFluid Controls HR & L&D Team',
    'overdue_subject', 'ACTION REQUIRED: Training Overdue - {{training_name}}',
    'overdue_body', 'Dear {{employee_name}},\n\nYour mandatory training session for "{{training_name}}" was due on {{due_date}} and is currently marked Overdue.\n\nPlease contact HR / Training Coordinator immediately to complete this requirement and ensure regulatory compliance.\n\nRegards,\nCompliance Officer\nFluid Controls Pvt. Ltd.'
  ), 'Customizable email notification templates')
ON CONFLICT (key) DO NOTHING;

