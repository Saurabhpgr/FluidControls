export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      trainings: {
        Row: {
          id: string
          name: string
          description: string | null
          frequency: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          frequency: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          frequency?: string
          is_active?: boolean
          created_at?: string
        }
      }
      departments: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
      }
      employees: {
        Row: {
          id: string
          employee_code: string
          name: string
          email: string
          department_id: string
          designation: string
          is_active: boolean
        }
        Insert: {
          id?: string
          employee_code: string
          name: string
          email: string
          department_id: string
          designation: string
          is_active?: boolean
        }
        Update: {
          id?: string
          employee_code?: string
          name?: string
          email?: string
          department_id?: string
          designation?: string
          is_active?: boolean
        }
      }
      training_schedules: {
        Row: {
          id: string
          training_id: string
          scheduled_date: string
          trainer_name: string
          group_type: string
          department_id: string | null
          status: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          training_id: string
          scheduled_date: string
          trainer_name: string
          group_type: string
          department_id?: string | null
          status?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          training_id?: string
          scheduled_date?: string
          trainer_name?: string
          group_type?: string
          department_id?: string | null
          status?: string
          notes?: string | null
          created_at?: string
        }
      }
      schedule_employees: {
        Row: {
          id: string
          schedule_id: string
          employee_id: string
        }
        Insert: {
          id?: string
          schedule_id: string
          employee_id: string
        }
        Update: {
          id?: string
          schedule_id?: string
          employee_id?: string
        }
      }
      attendance: {
        Row: {
          id: string
          schedule_id: string
          employee_id: string
          attendance_status: string
          marked_at: string | null
        }
        Insert: {
          id?: string
          schedule_id: string
          employee_id: string
          attendance_status?: string
          marked_at?: string | null
        }
        Update: {
          id?: string
          schedule_id?: string
          employee_id?: string
          attendance_status?: string
          marked_at?: string | null
        }
      }
      employee_training_history: {
        Row: {
          id: string
          employee_id: string
          training_id: string
          schedule_id: string
          status: string
          completed_on: string | null
          due_date: string | null
        }
        Insert: {
          id?: string
          employee_id: string
          training_id: string
          schedule_id: string
          status?: string
          completed_on?: string | null
          due_date?: string | null
        }
        Update: {
          id?: string
          employee_id?: string
          training_id?: string
          schedule_id?: string
          status?: string
          completed_on?: string | null
          due_date?: string | null
        }
      }
      quizzes: {
        Row: {
          id: string
          schedule_id: string
          title: string
          form_link: string
          pass_score: number | null
        }
        Insert: {
          id?: string
          schedule_id: string
          title: string
          form_link: string
          pass_score?: number | null
        }
        Update: {
          id?: string
          schedule_id?: string
          title?: string
          form_link?: string
          pass_score?: number | null
        }
      }
      quiz_results: {
        Row: {
          id: string
          quiz_id: string
          employee_id: string
          score: number
          result_status: string
          submitted_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          employee_id: string
          score: number
          result_status?: string
          submitted_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          employee_id?: string
          score?: number
          result_status?: string
          submitted_at?: string
        }
      }
      training_materials: {
        Row: {
          id: string
          training_id: string
          title: string
          file_url: string
          resource_type: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          training_id: string
          title: string
          file_url: string
          resource_type: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          training_id?: string
          title?: string
          file_url?: string
          resource_type?: string
          uploaded_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          type: string
          schedule_id: string | null
          employee_id: string | null
          message: string
          sent_at: string | null
          status: string
        }
        Insert: {
          id?: string
          type: string
          schedule_id?: string | null
          employee_id?: string | null
          message: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          id?: string
          type?: string
          schedule_id?: string | null
          employee_id?: string | null
          message?: string
          sent_at?: string | null
          status?: string
        }
      }
      audit_log: {
        Row: {
          id: string
          action: string
          entity_type: string
          entity_id: string | null
          performed_by: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          action: string
          entity_type: string
          entity_id?: string | null
          performed_by: string
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          action?: string
          entity_type?: string
          entity_id?: string | null
          performed_by?: string
          details?: Json | null
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {
      mark_attendance_and_update_history: {
        Args: {
          p_schedule_id: string
          p_attendance_data: Json
        }
        Returns: void
      }
    }
    Enums: {}
  }
}
