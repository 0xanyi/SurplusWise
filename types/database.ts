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
      transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          date: string
          type: 'expense' | 'giving'
          category: string
          notes: string | null
          receipt_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          date: string
          type: 'expense' | 'giving'
          category: string
          notes?: string | null
          receipt_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          date?: string
          type?: 'expense' | 'giving'
          category?: string
          notes?: string | null
          receipt_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'expense' | 'giving'
          color: string
          icon: string | null
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'expense' | 'giving'
          color?: string
          icon?: string | null
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'expense' | 'giving'
          color?: string
          icon?: string | null
          is_default?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      transaction_type: 'expense' | 'giving'
    }
  }
}
