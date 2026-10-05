# FluidControl ETMS — HR User Guide

Welcome to the **FluidControl Employee Training Management System (ETMS)**. This guide provides step-by-step instructions for HR administrators to manage trainings, employees, schedules, attendance, and compliance reports.

---

## 1. Navigating the System

- **Dashboard**: High-level overview of total employees, active trainings, upcoming schedules, overdue sessions, and department compliance charts.
- **Trainings**: Master catalog of training courses. Add, edit, or deactivate trainings.
- **Employees**: Directory of company staff categorized by department. Supports single additions and bulk Excel/CSV import.
- **Schedules**: Schedule training sessions for **All Employees**, a specific **Department**, or **Selected Employees**.
- **Attendance**: Mark attendance (**Present** / **Absent**) for scheduled sessions, generate printable attendance signature sheets, and finalize records.
- **Calendar**: Visual calendar view of planned, ongoing, and completed trainings.
- **Quizzes**: Manage Google Forms assessment links and import test scores.
- **Materials**: Upload and organize training slides, safety manuals, and video links.
- **Emails & Alerts**: Monitor automated training reminders, upcoming notifications, and overdue warnings.
- **Reports & Analytics**: Comprehensive compliance tables with filtering by status, department, and date, plus one-click Excel, CSV, and PDF export.

---

## 2. Core HR Workflows

### 2.1 Adding a New Training Course
1. Go to **Trainings** from the left navigation.
2. Click **Add Training** in the top right.
3. Enter the **Training Name** (e.g. `Cyber Security & Phishing Awareness`), description, validity/frequency (e.g., Annual, Quarterly, One-time), and passing score.
4. Click **Save Training**. The new course immediately becomes available for scheduling.

### 2.2 Scheduling a Training Session
1. Go to **Schedules** and click **Schedule Training**.
2. Select the **Training Course**, **Trainer Name**, and **Scheduled Date**.
3. Choose the target audience:
   - **All Employees**: Automatically assigns all active employees across the company.
   - **Department**: Assigns all employees belonging to a specific department (e.g., Production, Quality, Sales).
   - **Selected Employees**: Allows hand-picking specific individual employees.
4. Click **Create Schedule**. The session appears immediately in the Schedule list and Calendar.

### 2.3 Marking Attendance & Printing Sheets
1. Go to **Attendance** and click on the scheduled training card or row.
2. **To Print an Attendance Sheet**: Click the **Download PDF Sheet** button. A professionally formatted PDF will download with employee details and physical signature boxes for the trainer and trainees.
3. **To Mark Attendance**:
   - Use the **Present** or **Absent** toggle for each employee.
   - Or click **Mark All Present** / **Mark All Absent** for fast batch entry.
4. Click **Save Attendance**. The system updates the employee's history and marks their compliance record as Completed or Pending automatically.

### 2.4 Generating Compliance & Audit Reports
1. Go to **Reports & Analytics**.
2. Use the filter controls at the top to filter by:
   - **Status**: Completed, Pending, or Overdue.
   - **Training Course**: Select a specific course or view All.
   - **Department**: Narrow down by team.
   - **Date Range**: Set Start and End dates.
3. **Exporting Data**:
   - Click **Excel** (`.xlsx`) for a formatted spreadsheet with formula injection security.
   - Click **CSV** for a standard data file.
   - Click **PDF** for an executive, printable compliance audit report with statistics and summary charts.
   - Click **Print** (or press Ctrl+P) to print the view directly from your browser.
4. **Individual Employee Records**:
   - Click on any employee's name in the table to open their **Training Dossier**.
   - Click **PDF Record** to download their individual employee training record.

---

## 3. Managing Profile & Notifications

### 3.1 Updating Your Profile & Profile Picture
1. Click the **Profile Avatar** (top right corner of the header).
2. Click **Edit Profile & Photo**.
3. In the dialog:
   - **Take Photo**: Launches your webcam with a live mirror viewfinder. Click **Snap Photo** to capture.
   - **Choose from Library**: Select an image file (`.png`, `.jpg`, `.webp`) from your computer.
   - **Delete Photo**: Removes your photo and resets to your initial letter.
4. Update your Name or Title and click **Save Changes**.

### 3.2 Notification Center
1. Click the **Bell Icon** in the top header.
2. View pending reminders, overdue warnings, and system announcements.
3. Click **Mark all as read** to acknowledge notifications.
4. Click **Clear read** to permanently remove cleared alerts from your view.

---

## 4. System Settings & Customization

HR Administrators can customize business rules, branding, and email copy without contacting IT:
1. Navigate to **System Settings** in the left sidebar menu.
2. Select from the configuration tabs:
   - **Company & Logo**: Update legal company name, facility address, ISO standards, and contact email.
   - **Frequencies**: Modify training recurrence labels (e.g. Monthly, Quarterly, Annual).
   - **Notification Rules**: Adjust reminder lead time (days) and overdue repeat intervals.
   - **Email Templates**: Edit automated subject lines and body copy using dynamic placeholders (`{{employee_name}}`, `{{training_name}}`, `{{scheduled_date}}`).
   - **Thresholds & Limits**: Configure default passing score %, maximum material upload size, and audit retention windows.
3. Click **Save Changes** on any tab to immediately apply changes across the entire platform.

