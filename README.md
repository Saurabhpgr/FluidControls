# FluidControl ETMS — Employee Training Management System

A high-performance, enterprise-grade Employee Training Management System built with **React 18 + Vite + TypeScript + Tailwind CSS** and **Supabase (PostgreSQL, Auth, Storage, Edge Functions, pg_cron)**.

---

## 🌟 Key Features

- **Training Master**: Full catalog management with custom frequencies (Annual, Quarterly, Bi-Annual, One-time) and arbitrary courses.
- **Audience-Targeted Scheduling**: Schedule sessions for **All Employees**, specific **Departments**, or **Selected Employees**.
- **Interactive Calendar**: Month, quarter, and year calendar with color-coded status badges and instant schedule popups.
- **Attendance & Tracking**: Atomic attendance updates, batch "Mark All Present/Absent" actions, and automatic training history recording.
- **Professional PDF Engine**:
  - Printable **Attendance Sign-off Sheets** with metadata headers and trainee signature boxes.
  - **Compliance & Audit Reports** with company branding, totals, and percentages.
  - Individual **Employee Training Record Certificates**.
- **Hardened Excel & CSV Exports**: Protected with CSV/DDE formula injection sanitization.
- **Responsive Mobile & Desktop UI**: Zero horizontal overflow on 360px–2560px viewports with touch targets $\ge 44\text{px}$.
- **Profile & Live Webcam Capture**: User profile management with live mirror selfie webcam capture, file picker, and photo deletion.
- **Notifications & Overdue Alerts**: Persistent notification center with permanent clear-read storage.
- **Print Optimization**: Dedicated `@media print` styles for clean physical printouts (Ctrl+P).

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase Project (PostgreSQL 15+)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Saurabhpgr/FluidControls.git
cd FluidControls

# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory:
```env
VITE_SUPABASE_URL=https://<your-supabase-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Database Setup
Run the SQL migration script located in [`database_setup.sql`](file:///e:/FluidControls/database_setup.sql) inside your Supabase SQL Editor.

### 5. Running the Application
```bash
# Start Vite development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📚 Documentation

Detailed documentation is available in the [`/docs`](file:///e:/FluidControls/docs) directory:

- [**HR User Guide**](file:///e:/FluidControls/docs/USER_GUIDE.md): Step-by-step instructions for HR managers.
- [**Admin Runbook**](file:///e:/FluidControls/docs/ADMIN_RUNBOOK.md): Backup, restore, key rotation, and maintenance procedures.
- [**Architecture & Data Flow**](file:///e:/FluidControls/docs/ARCHITECTURE.md): System architecture and sequence diagrams.
- [**Security & Threat Model**](file:///e:/FluidControls/docs/SECURITY.md): Row Level Security (RLS), injection defenses, and compliance.
- [**Limits & Scaling Guide**](file:///e:/FluidControls/docs/LIMITS_AND_SCALING.md): Benchmarks, tier sizing, and index recommendations.
- [**QA Test Report**](file:///e:/FluidControls/docs/qa/TEST_REPORT.md): Executive summary and test results.
- [**QA Defect Log**](file:///e:/FluidControls/docs/qa/FINDINGS.md): Full audit finding register.
- [**Release Gate Checklist**](file:///e:/FluidControls/docs/qa/RELEASE_CHECKLIST.md): Production readiness verification.

---

## 🛡️ Security & Quality Standards

- **OWASP Top 10 Aligned**: Protected against XSS, SQLi, CSRF, and Formula Injection.
- **Row Level Security (RLS)**: Enforced across 100% of database tables.
- **Accessibility**: WCAG 2.1 AA compliant typography and contrast.
- **Responsive Design**: Validated on mobile (360px–414px), tablet (768px–1024px), and desktop (1080p–4K).

---

## 📄 License
Internal proprietary software for FluidControl Private Limited.
