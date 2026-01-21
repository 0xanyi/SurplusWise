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

export interface ApiError {
  error: string
  code?: string
  status?: number
}

export interface ApiResponse<T> {
  data?: T
  error?: ApiError
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiError).error === 'string'
  )
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (isApiError(error)) {
    return error.error
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unexpected error occurred'
}
