export type TransactionType = 'expense' | 'giving'

export interface Transaction {
  _id: string
  userId: string
  amount: number
  date: string
  type: TransactionType
  category: string
  notes?: string
  receiptStorageId?: string
  createdAt: number
  updatedAt: number
}

export interface Category {
  _id: string
  userId: string
  name: string
  type: TransactionType
  color: string
  icon?: string
  isDefault: boolean
  createdAt: number
}

export interface Budget {
  _id: string
  userId: string
  category: string
  amount: number
  period: 'monthly' | 'quarterly' | 'yearly'
  startDate: string
  endDate: string
  type: TransactionType
  isActive: boolean
  createdAt: number
  updatedAt: number
}

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
