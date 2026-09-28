# FluidControl ETMS — Security Architecture & Threat Model

This document outlines the security controls, Row Level Security (RLS) policies, injection mitigation measures, and data privacy safeguards implemented in the **FluidControl Employee Training Management System**.

---

## 1. Threat Model & Risk Mitigations

| Threat Vector | Risk Level | Mitigation Architecture | Verification Method |
|---|---|---|---|
| **Unauthorized Data Access / RLS Bypass** | High | PostgreSQL Row Level Security (RLS) enabled on all tables; anon access denied. Auth token required for PostgREST calls. | Automated anon-key query test returning empty rows. |
| **CSV / Excel Formula Injection (DDE)** | High | User inputs starting with `=`, `+`, `-`, `@`, `\t`, `\r` are sanitized by prepending a single quote `'` in `sanitizeCellValue()`. | Exporting records containing malicious formulas and opening in Excel. |
| **Stored & Reflected Cross-Site Scripting (XSS)** | Medium | React DOM automatic string escaping; no unsanitized `dangerouslySetInnerHTML`; URL protocol sanitization (`javascript:` URLs blocked). | XSS payload injection in training and employee fields. |
| **SQL Injection (SQLi)** | High | PostgREST client utilizes parameterized SQL; RPC functions declare fixed `search_path` and validate inputs. | PostgREST endpoint penetration testing with `' OR 1=1 --`. |
| **Service Role Secret Exposure** | Critical | Service role keys are completely excluded from frontend code and Vite bundle. Only public `VITE_SUPABASE_ANON_KEY` is shipped. | Bundle audit and git repository secret scanning (`gitleaks`). |
| **Audit Log Tampering** | Medium | `UPDATE` and `DELETE` operations on `audit_logs` are revoked at the database role level. | Database permission verification. |

---

## 2. Row Level Security (RLS) Policy Summary

```sql
-- Enforce RLS across core tables
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_training_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated HR users full CRUD access
CREATE POLICY "Allow authenticated HR read on trainings"
  ON trainings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated HR write on trainings"
  ON trainings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Block public anon role from reading all sensitive tables
-- (No public policy exists, default deny enforced)
```

---

## 3. Storage Bucket Security

- **Bucket**: `training-materials`
- **Visibility**: Private
- **Access Policy**:
  - `SELECT`: Only authenticated users can generate signed URLs with a short TTL (15 minutes).
  - `INSERT`: Restricted to authenticated HR users; maximum file size limited to 50MB.
  - `DELETE`: Restricted to authenticated HR users; deleting a database material record cascades to remove the object from storage.

---

## 4. Security Best Practices Checklist for Production

- [x] HTTPS enforced across all client and backend endpoints.
- [x] Security headers configured (HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
- [x] Strong password policy enforced for HR accounts via Supabase Auth settings.
- [x] Formula injection sanitization active on all spreadsheet and CSV exports.
- [x] Camera access explicitly requests user consent with immediate stream cleanup on modal close.
