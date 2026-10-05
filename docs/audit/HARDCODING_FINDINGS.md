# Fluid Controls ETMS — Zero-Hardcoding Audit & Implementation Report

**Audit Status:** Complete & Verified  
**CI Guard:** Active (`scripts/check-hardcoding.js`)

---

## 1. Principles of Zero-Hardcoding

If any business data (labels, frequencies, company contact info, notification thresholds, email templates, passing scores) might need to change in the future, it **must live in the database and be editable by HR without code changes**.

---

## 2. Hardcoding Inventory & Remediation Matrix

| Category | Original Hardcoded Location | Moved To (Database / Setting Key) | HR-Editable Screen |
|---|---|---|---|
| **Company Legal Name & Tagline** | Hardcoded strings in `AppLayout.tsx`, `LoginPage.tsx`, `pdf.ts` | `system_settings` $\rightarrow$ `company_profile` | `/settings` (Company & Logo Tab) |
| **Official Corporate Logo** | Placeholder icon / SVG | `public/logo.png` + `system_settings` $\rightarrow$ `logo_url` | `/settings` (Company & Logo Tab) |
| **Training Frequency Options** | Static array in `TrainingsPage.tsx` | `system_settings` $\rightarrow$ `training_frequencies` | `/settings` (Frequencies Tab) |
| **Notification Lead Times** | Hardcoded 7-day windows in code | `system_settings` $\rightarrow$ `notification_rules.reminder_lead_days` | `/settings` (Notification Rules Tab) |
| **Overdue Escalation Frequency** | Hardcoded 3-day intervals | `system_settings` $\rightarrow$ `notification_rules.overdue_repeat_days` | `/settings` (Notification Rules Tab) |
| **Dashboard Upcoming Window** | Hardcoded 7-day interval in `DashboardPage.tsx` | `system_settings` $\rightarrow$ `notification_rules.upcoming_window_days` | `/settings` (Notification Rules Tab) |
| **Default Pass Score Threshold** | Static numbers in code | `system_settings` $\rightarrow$ `compliance_thresholds.default_pass_score` | `/settings` (Thresholds & Limits Tab) |
| **Max File Upload Limit** | Hardcoded 50MB | `system_settings` $\rightarrow$ `compliance_thresholds.max_file_size_mb` | `/settings` (Thresholds & Limits Tab) |
| **Default Table Page Size** | Hardcoded 25 records | `system_settings` $\rightarrow$ `compliance_thresholds.default_pagination_size` | `/settings` (Thresholds & Limits Tab) |
| **Reminder Email Copy** | Static email text in `NotificationsPage.tsx` | `system_settings` $\rightarrow$ `email_templates.reminder_subject/body` | `/settings` (Email Templates Tab) |
| **Overdue Warning Email Copy** | Static warning copy | `system_settings` $\rightarrow$ `email_templates.overdue_subject/body` | `/settings` (Email Templates Tab) |

---

## 3. Automated CI Guard Enforcement

The repository includes a dedicated CI script:
```bash
npm run check-hardcoding
```
This script scans all TypeScript and TSX files in `src/` to ensure no hardcoded branching on static entity names or mock placeholders regress into the codebase.
