# Fluid Controls ETMS — Requirements Traceability Matrix (RTM)

**Audit Version:** Pre-Go-Live 1.0  
**Compliance Verification:** 100% Implemented & Verified

---

## 1. Functional Requirements (FR-01 to FR-06)

| Req ID | Requirement Description | Implementation (File / Component / Table) | Verification Method | Status |
|---|---|---|---|---|
| **FR-01** | **Training Program Management** (Course Master, Recurrence frequencies, descriptions, active/inactive toggle) | `src/pages/TrainingsPage.tsx`<br>`trainings` table in `database_setup.sql` | Manual CRUD verification & DB constraint checks | **PASS (100%)** |
| **FR-02** | **Workforce & Department Directory** (Employee codes, names, emails, department mapping, Excel/CSV bulk import/export) | `src/pages/EmployeesPage.tsx`<br>`src/lib/excel.ts`<br>`employees`, `departments` tables | CSV/Excel template download & round-trip import test | **PASS (100%)** |
| **FR-03** | **Training Scheduling & Audience Resolution** (Date picker, trainer name, All/Department/Selected employee resolution, Google Calendar + List view) | `src/pages/SchedulesPage.tsx`<br>`training_schedules`, `schedule_employees` tables | Cross-device calendar rendering & group resolution test | **PASS (100%)** |
| **FR-04** | **Transactional Batch Attendance Marking** (Present/Absent batch toggles, atomic history record update, schedule completion) | `src/pages/AttendancePage.tsx`<br>RPC `mark_attendance_and_update_history` in `database_setup.sql` | Atomic PostgreSQL transaction test & fallback verification | **PASS (100%)** |
| **FR-05** | **Assessments & Materials Library** (External quiz form links, SOP document/video uploads to Supabase Storage) | `src/pages/QuizzesPage.tsx`<br>`src/pages/MaterialsPage.tsx`<br>`quizzes`, `training_materials` tables | Storage bucket upload & signed URL retrieval test | **PASS (100%)** |
| **FR-06** | **Compliance Reports & Multi-Format Exports** (Status filter Completed/Pending/Overdue, employee code search, zero-margin vector printing, Excel/CSV/PDF exports) | `src/pages/ReportsPage.tsx`<br>`src/lib/pdf.ts`<br>`src/lib/excel.ts` | Multi-filter reconciliation, PDF download, and browser print test | **PASS (100%)** |

---

## 2. Non-Functional Requirements (NFR-01 to NFR-10)

| Req ID | Non-Functional Specification | Implementation Mechanism | Verification Result | Status |
|---|---|---|---|---|
| **NFR-01** | **Zero-Hardcoding Compliance** | `src/pages/SettingsPage.tsx`, `system_settings` table, `scripts/check-hardcoding.js` | `npm run check-hardcoding` passed with 0 violations | **PASS (100%)** |
| **NFR-02** | **Audit Trail Immutability (ISO 9001 / SOC2)** | Trigger `trg_protect_audit_log` & `prevent_audit_log_tampering()` in `database_setup.sql` | `UPDATE` and `DELETE` on `audit_log` raise PostgreSQL exceptions | **PASS (100%)** |
| **NFR-03** | **Formula Injection Prevention (DDE Escaping)** | `sanitizeFormulaInjection()` in `src/lib/excel.ts` | Prepends single quote `'` to `=`, `+`, `-`, `@` characters | **PASS (100%)** |
| **NFR-04** | **Data Reconciliation Across Modules** | `scripts/reconciliation-test.js` | 1:1 match between Attendance $\rightarrow$ History $\rightarrow$ Reports | **PASS (100%)** |
| **NFR-05** | **Automated Overdue Lifecycle** | RPC `refresh_overdue_training_statuses()` in `database_setup.sql` | Auto-transitions pending records past `due_date` to `overdue` | **PASS (100%)** |
| **NFR-06** | **Mobile Responsiveness (360px to 4K)** | Tailwind CSS flex/grid layouts with responsive calendar breakpoints | Full responsiveness verified on mobile and desktop viewports | **PASS (100%)** |
| **NFR-07** | **Zero Build Errors / Type Safety** | Strict TypeScript compilation (`tsc && vite build`) | Production bundle created with 0 TypeScript/Lint errors | **PASS (100%)** |
| **NFR-08** | **Corporate Identity & Branding** | Official Fluid Controls logo in Navbar, Login, Favicon, Settings, & PDFs | Visual alignment confirmed across all routes | **PASS (100%)** |
| **NFR-09** | **Dead Code & Template Elimination** | Removal of `counter.ts`, `main.ts`, `style.css`, unused imports | Depcheck/clean tree verified | **PASS (100%)** |
| **NFR-10** | **Secure Storage Bucket Isolation** | `storage.objects` RLS policies in `database_setup.sql` | Restricts upload MIME types and isolates storage buckets | **PASS (100%)** |
