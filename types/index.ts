import { Database } from './database'

export type Transaction = Database['public']['Tables']['transactions']['Row']
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update']

export type Category = Database['public']['Tables']['categories']['Row']
export type CategoryInsert = Database['public']['Tables']['categories']['Insert']
export type CategoryUpdate = Database['public']['Tables']['categories']['Update']

export type TransactionType = 'expense' | 'giving'

export interface ReceiptData {
  amount: number
  date: string
  vendor: string
  confidence: number
}

export interface DashboardStats {
  totalExpenses: number
  totalGivings: number
  netBalance: number
  expensesByCategory: Record<string, number>
  givingsByCategory: Record<string, number>
  transactionCount: number
}

export interface PeriodFilter {
  startDate: Date
  endDate: Date
  label: string
}
