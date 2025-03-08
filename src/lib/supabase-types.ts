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
      tasks: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          due_date: string | null
          priority: string
          status: string
          completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          due_date?: string | null
          priority?: string
          status?: string
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          due_date?: string | null
          priority?: string
          status?: string
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          user_id: string
          name: string
          website: string | null
          notes: string | null
          status: string
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_role: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          website?: string | null
          notes?: string | null
          status?: string
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          website?: string | null
          notes?: string | null
          status?: string
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      applications: {
        Row: {
          id: string
          user_id: string
          company_id: string
          position: string
          status: string
          applied_date: string | null
          notes: string | null
          next_follow_up: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id: string
          position: string
          status?: string
          applied_date?: string | null
          notes?: string | null
          next_follow_up?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string
          position?: string
          status?: string
          applied_date?: string | null
          notes?: string | null
          next_follow_up?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      calendar_events: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          event_date: string
          event_type: string
          application_id: string | null
          completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          event_date: string
          event_type: string
          application_id?: string | null
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          event_date?: string
          event_type?: string
          application_id?: string | null
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      pomodoro_sessions: {
        Row: {
          id: string
          user_id: string
          start_time: string
          duration: number
          task: string | null
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          start_time?: string
          duration: number
          task?: string | null
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          start_time?: string
          duration?: number
          task?: string | null
          completed?: boolean
          created_at?: string
        }
      }
      ai_analyses: {
        Row: {
          id: string
          user_id: string
          type: string
          input: string
          result: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          input: string
          result: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          input?: string
          result?: string
          created_at?: string
        }
      }
    }
  }
}