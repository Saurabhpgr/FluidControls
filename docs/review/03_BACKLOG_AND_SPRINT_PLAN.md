# Trainova ETMS (FluidControl) — Backlog & Sprint Plan

**Document ID:** `docs/review/03_BACKLOG_AND_SPRINT_PLAN.md`  
**Review Execution Date:** October 13, 2026  
**Auditor:** Multi-Role Production-Readiness Review Board (Scrum Master / Delivery Lead)  
**Target Application:** Trainova Employee Training Management System (Fluid Controls Pvt. Ltd.)  

---

## 1. Executive Summary & Delivery Scope

With all P0 and P1 blocking defects resolved and verified in Phase 3, the Trainova ETMS codebase satisfies all criteria for initial HR production deployment. The remaining feature requests and non-blocking architectural enhancements are organized into a phased 3-sprint release schedule.

---

## 2. Prioritized Product Backlog

| Backlog ID | Feature / Enhancement Description | Category | Priority | Effort Estimate | Dependencies |
|---|---|---|---|---|---|
| **BL-01** | Edge Function Email Provider Webhook (SendGrid/Resend) | DevOps / Integration | P1 | **Medium (M)** | Notifications Table |
| **BL-02** | Automated Daily Overdue Escalation Cron Trigger | Backend Automation | P1 | **Medium (M)** | RPC `refresh_overdue` |
| **BL-03** | Failed Email Delivery Retry & Diagnostic View | Operations | P2 | **Small (S)** | BL-01 |
| **BL-04** | Individual Employee PDF Training Certificate Generator | Compliance / UX | P2 | **Medium (M)** | jsPDF vector engine |
| **BL-05** | Employee Self-Service Read-Only Roadmap Portal | Feature Expansion | P2 | **Large (L)** | Supabase Auth (Employee) |
| **BL-06** | Custom Report Column Selector & Filter Preset Vault | Reporting | P2 | **Medium (M)** | ReportsPage |
| **BL-07** | Automated Refresher Retraining & Expiration Engine | Compliance Engine | P3 | **Large (L)** | Training History Schema |
| **BL-08** | Shopfloor Vernacular Localization (Hindi & Marathi) | Accessibility / i18n | P3 | **Large (L)** | React-i18next |
| **BL-09** | Enforced Multi-Factor Authentication (MFA / TOTP) | Security | P2 | **Medium (M)** | Supabase Auth MFA |
| **BL-10** | Supabase Read-Replica Pooler for Heavy Reporting | SRE / Database | P3 | **Large (L)** | Supabase Pro Tier |

*Effort Scale: Small (S) = 1–2 days | Medium (M) = 3–5 days | Large (L) = 1–2 weeks.*

---

## 3. Proposed Sprint Implementation Plan

### Sprint 1: Operational Automation & Email Delivery (Weeks 1–2)
**Goal:** Transition the email notification system from in-database queue staging to live, automated background dispatch.
- **Story 1.1 (BL-01):** Deploy Supabase Edge Function `send-training-email` connecting to SMTP or transactional email provider (SendGrid / Resend) using encrypted Supabase Vault secrets.
- **Story 1.2 (BL-02):** Configure Supabase `pg_cron` schedule executing `refresh_overdue_training_statuses` at 00:00 UTC daily, automatically updating pending training records past due date.
- **Story 1.3 (BL-03):** Enhance `/emails` with a "Retry Failed Sends" action button and detailed delivery status telemetry.

### Sprint 2: Employee Empowerment & Certification (Weeks 3–4)
**Goal:** Enable self-service transparency and formal ISO compliance certification artifacts.
- **Story 2.1 (BL-04):** Implement a client-side vector PDF certificate generator allowing HR to download signed ISO-compliant training certificates with QR code verification.
- **Story 2.2 (BL-05):** Build an optional employee read-only view where workers can review upcoming scheduled trainings, download attached course materials, and access Google Form quiz links.
- **Story 2.3 (BL-06):** Add custom column selection toggles and saved report filters on `ReportsPage.tsx`.

### Sprint 3: Advanced Governance, i18n & Enterprise Scaling (Weeks 5–6)
**Goal:** Scale the platform for multi-plant manufacturing operations.
- **Story 3.1 (BL-07):** Add validity duration (e.g. 1 year) to training programs with automated recurring retraining reminders 30 days prior to expiration.
- **Story 3.2 (BL-08):** Add language toggle supporting Hindi and Marathi for shopfloor machine operators.
- **Story 3.3 (BL-09):** Enable mandatory Time-based One-Time Password (TOTP) MFA for the HR Super Admin account.

---

## 4. Risks & Blockers Register

| Risk ID | Risk Description | Severity | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|---|---|
| **RSK-01** | Free-Tier Supabase Project Auto-Pause | High | Medium | High | Upgrade Fluid Controls Supabase project to the Pro Plan ($25/mo) prior to official go-live. |
| **RSK-02** | External Email Provider Rate Limiting | Medium | Low | Medium | Implement batch chunking (50 emails/batch) with exponential backoff in Edge Functions. |
| **RSK-03** | Large Training Video Uploads Exceeding Bandwidth | Medium | Medium | Medium | Maintain the 50 MB client upload limit and enforce external hosting (YouTube / Vimeo / Google Drive links) for video assets > 50 MB. |
| **RSK-04** | HR Account Credential Compromise | High | Low | Critical | HR Allow-list gatekeeper is live; enforce strict 12+ character password policy and schedule TOTP MFA deployment in Sprint 3. |
| **RSK-05** | Browser Print Engine Vector Rendering Variance | Low | Low | Low | All PDF reports use jsPDF canvas vector positioning rather than standard browser `window.print()`. |

---

## 5. Delivery Sign-Off Verdict

The current codebase represents a **fully viable, robust, and complete Minimum Shippable Product (MSP)** for Fluid Controls HR personnel. Core operations (Course Master, Workforce Roster, Scheduling, Dual Calendar/List View, Batch Attendance Sync, Google Forms Quizzes, Materials Vault, Audit Log, and Excel/PDF Reporting) are 100% complete and verified.

**Delivery Verdict:** **APPROVED FOR GO-LIVE — PROCEED WITH PHASED SPRINT ROADMAP.**
