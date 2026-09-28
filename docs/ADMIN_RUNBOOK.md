# FluidControl ETMS — Admin Runbook & Operations Manual

This runbook is intended for DevOps, System Administrators, and Lead Engineers maintaining the **FluidControl Employee Training Management System**.

---

## 1. System Architecture Overview

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui.
- **Backend**: Supabase (PostgreSQL 15+, Supabase Auth, Storage, Edge Functions, pg_cron).
- **Client Libraries**: `@supabase/supabase-js`, `jspdf`, `jspdf-autotable`, `xlsx`, `lucide-react`, `date-fns`.

---

## 2. Environment Variables & Secret Configuration

Create a `.env.local` or set hosting provider environment variables:

```env
# Public Supabase Connection (Safe to ship to browser)
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> [!WARNING]
> NEVER include `SUPABASE_SERVICE_ROLE_KEY` in `VITE_` prefixed environment variables or in any frontend code. The service role key is reserved strictly for backend Edge Functions or administrative scripts.

---

## 3. Database Administration & Backup / Restore

### 3.1 Point-in-Time Recovery (PITR) & Backups
1. Supabase Pro/Enterprise projects have automated daily backups and continuous WAL archiving for Point-In-Time Recovery.
2. **Manual Snapshot via CLI**:
   ```bash
   # Export schema and data
   supabase db dump --data-only -f backup_data_$(date +%Y%m%d).sql
   supabase db dump --schema-only -f backup_schema_$(date +%Y%m%d).sql
   ```
3. **Database Restore Drill**:
   ```bash
   psql -h db.<your-project-ref>.supabase.co -U postgres -d postgres -f backup_schema_20260928.sql
   psql -h db.<your-project-ref>.supabase.co -U postgres -d postgres -f backup_data_20260928.sql
   ```

---

## 4. Maintenance & Routine Operations

### 4.1 Resetting the HR Administrator Password
1. Navigate to the **Supabase Dashboard** > **Authentication** > **Users**.
2. Locate the HR user account by email.
3. Click **Send Password Reset Email** or manually generate a recovery link.
4. Alternatively, use the Supabase CLI or SQL:
   ```sql
   UPDATE auth.users 
   SET encrypted_password = crypt('NewSecurePassword123!', gen_salt('bf'))
   WHERE email = 'hr@fluidcontrols.com';
   ```

### 4.2 Handling Email Notification Failures
1. Check Edge Function logs: **Supabase Dashboard** > **Edge Functions** > `send-training-reminders` > **Logs**.
2. Verify Resend / SendGrid / SMTP credentials in Edge Function environment variables.
3. Resend failed notification queue:
   ```sql
   UPDATE notifications
   SET status = 'pending', retry_count = retry_count + 1
   WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '2 days';
   ```

### 4.3 Database Optimization & Index Rebuilds
Run the maintenance query monthly to vacuum and reindex high-velocity tables:
```sql
VACUUM ANALYZE employee_training_history;
VACUUM ANALYZE attendance;
VACUUM ANALYZE audit_logs;
REINDEX TABLE employee_training_history;
```

---

## 5. Emergency Incident Response

| Incident | Root Cause Checklist | Resolution Action |
|---|---|---|
| **App shows blank screen on load** | 1. Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`<br>2. Check Supabase project status (paused on free tier)<br>3. Inspect browser console for CORS or network errors | Restore Supabase project if paused, verify domain allowlist in Supabase Auth > URL Configuration. |
| **Attendance save fails** | 1. Database connection pool exhausted<br>2. Unique constraint violation on `attendance` table | Check Supavisor connection limits. Ensure transaction RPC `mark_attendance_atomic` has execute grants. |
| **PDF export fails for large dataset** | 1. Memory limit on low-end mobile device with $>10,000$ rows | Use date and department filters to constrain the dataset or export as CSV. |
