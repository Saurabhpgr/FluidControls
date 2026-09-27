export type TrainingFrequency = 'one_time' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'as_required'
export type ScheduleStatus = 'planned' | 'ongoing' | 'completed' | 'cancelled'
export type GroupType = 'all' | 'department' | 'selected'
export type AttendanceStatus = 'present' | 'absent' | 'not_marked'
export type TrainingHistoryStatus = 'completed' | 'pending' | 'overdue'
export type ResourceType = 'pdf' | 'video' | 'link' | 'doc'
export type NotificationType = 'reminder' | 'overdue' | 'new_training_assigned'
export type NotificationStatus = 'pending' | 'sent' | 'failed'
export type QuizResultStatus = 'pass' | 'fail' | 'pending_review'

export interface Training {
  id: string
  name: string
  description: string | null
  frequency: TrainingFrequency
  is_active: boolean
  created_at: string
}

export interface Department {
  id: string
  name: string
}

export interface Employee {
  id: string
  employee_code: string
  name: string
  email: string
  department_id: string
  designation: string
  is_active: boolean
  departments?: Department
}

export interface TrainingSchedule {
  id: string
  training_id: string
  scheduled_date: string
  trainer_name: string
  group_type: GroupType
  department_id: string | null
  status: ScheduleStatus
  notes: string | null
  created_at: string
  trainings?: Training
  departments?: Department
}

export interface ScheduleEmployee {
  id: string
  schedule_id: string
  employee_id: string
  employees?: Employee
}

export interface Attendance {
  id: string
  schedule_id: string
  employee_id: string
  attendance_status: AttendanceStatus
  marked_at: string | null
  employees?: Employee
}

export interface EmployeeTrainingHistory {
  id: string
  employee_id: string
  training_id: string
  schedule_id: string
  status: TrainingHistoryStatus
  completed_on: string | null
  due_date: string | null
  employees?: Employee
  trainings?: Training
  training_schedules?: TrainingSchedule
}

export interface Quiz {
  id: string
  schedule_id: string
  title: string
  form_link: string
  pass_score: number | null
  training_schedules?: TrainingSchedule
}

export interface QuizResult {
  id: string
  quiz_id: string
  employee_id: string
  score: number
  result_status: QuizResultStatus
  submitted_at: string
  employees?: Employee
  quizzes?: Quiz
}

export interface TrainingMaterial {
  id: string
  training_id: string
  title: string
  file_url: string
  resource_type: ResourceType
  uploaded_at: string
  trainings?: Training
}

export interface Notification {
  id: string
  type: NotificationType
  schedule_id: string | null
  employee_id: string | null
  message: string
  sent_at: string | null
  status: NotificationStatus
}

export interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  performed_by: string
  details: Record<string, unknown> | null
  created_at: string
}

// Dashboard stats
export interface DashboardStats {
  totalTrainings: number
  scheduledThisQuarter: number
  completionRate: number
  overdueCount: number
  upcomingCount: number
  totalEmployees: number
}

// Report filters
export interface ReportFilters {
  training_id?: string
  department_id?: string
  employee_id?: string
  status?: string
  date_from?: string
  date_to?: string
}

// Attendance entry for bulk marking
export interface AttendanceEntry {
  employee_id: string
  employee_name: string
  employee_code: string
  attendance_status: AttendanceStatus
}
