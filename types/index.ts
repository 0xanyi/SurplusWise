export type TransactionType = 'expense' | 'giving' | 'income'

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

export interface ApiTransaction {
  id: string
  amount: number
  date: string
  type: TransactionType
  category: string
  notes: string | null
  receipt_url: string | null
  created_at: string | null
}

export interface ApiBudget {
  id: string
  category: string
  amount: number
  period: "monthly" | "quarterly" | "yearly"
  start_date: string
  end_date: string
  type: TransactionType
  is_active: boolean
  spent: number
  remaining: number
  percentage: number
  status: "ok" | "warning" | "exceeded"
}

export interface DashboardStats {
  totalExpenses: number
  totalGivings: number
  totalIncome: number
  netBalance: number
  expensesByCategory: Record<string, number>
  givingsByCategory: Record<string, number>
  incomeByCategory: Record<string, number>
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

// ─── Recurring Outgoings ─────────────────────────────────────────────────────

export type OutgoingFrequency = 'monthly' | 'quarterly' | 'yearly'

export interface ApiRecurringOutgoing {
  id: string
  name: string
  amount: number
  day_of_month: number
  frequency: OutgoingFrequency
  category: string | null
  notes: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

// ─── Debts & Credits ─────────────────────────────────────────────────────────

export type DebtType = 'credit_card' | 'loan' | 'mortgage' | 'overdraft' | 'other'

export interface ApiDebtCredit {
  id: string
  name: string
  debt_type: DebtType
  lender: string | null
  current_balance: number
  credit_limit: number | null
  interest_rate: number | null
  minimum_payment: number | null
  payment_day_of_month: number | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface ApiBalanceLog {
  id: string
  debt_id: string
  balance: number
  payment_made: number | null
  notes: string | null
  logged_at: string
  created_at: string | null
}

// ─── Loans Given ─────────────────────────────────────────────────────────────

export type LoanStatus = 'active' | 'partially_repaid' | 'fully_repaid' | 'defaulted'

export interface ApiLoanGiven {
  id: string
  borrower_name: string
  amount: number
  outstanding_balance: number
  loan_date: string
  expected_payback_date: string | null
  status: LoanStatus
  interest_rate: number | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ApiLoanRepayment {
  id: string
  loan_id: string
  amount: number
  repayment_date: string
  notes: string | null
  created_at: string | null
}

// ─── Investments & Assets ────────────────────────────────────────────────────

export type InvestmentType = 'stock' | 'crypto' | 'forex' | 'property' | 'business' | 'savings' | 'other'

export type InvestmentEventType = 'return' | 'dividend' | 'sale' | 'partial_sale' | 'loss' | 'fee'

export interface ApiInvestment {
  id: string
  name: string
  investment_type: InvestmentType
  platform: string | null
  cost_basis: number
  current_value: number
  quantity: number | null
  purchase_date: string
  gain_loss: number
  gain_loss_pct: number
  notes: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface ApiInvestmentEvent {
  id: string
  investment_id: string
  event_type: InvestmentEventType
  amount: number
  event_date: string
  notes: string | null
  created_at: string | null
}
