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
  client_id: string | null
  notes: string | null
  tags: string[]
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

export type GoalCategory = 'emergency_fund' | 'savings' | 'debt_payoff' | 'giving' | 'travel' | 'home' | 'education' | 'business' | 'other'

export interface ApiGoal {
  id: string
  name: string
  category: GoalCategory
  target_amount: number
  current_amount: number
  remaining_amount: number
  progress: number
  target_date: string | null
  notes: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
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

// ─── Clients / People ────────────────────────────────────────────────────────

/**
 * How a cost carried for a client comes back. `none` is the workspace's own
 * overhead; `bundled` is covered by a retainer and so expects no separate
 * recovery. See `lib/rebill.ts`.
 */
export type RebillMode = 'none' | 'at_cost' | 'fixed' | 'bundled'

export interface ApiClient {
  id: string
  name: string
  contact_email: string | null
  notes: string | null
  is_active: boolean
  /** Active recurring costs carried for this client. */
  service_count: number
  /** What those cost per month at the current schedule. */
  monthly_fronted: number
  /** Everything ever paid out on their behalf. */
  fronted: number
  /** Everything ever received from them. */
  received: number
  /** What the fronted costs were supposed to bring back. */
  expected_recovery: number
  /** The shortfall, floored at zero. Cumulative, so timing differences wash out. */
  not_yet_recovered: number
  /** Received minus fronted. Negative means they are costing you money. */
  margin: number
  created_at: string | null
  updated_at: string | null
}

export interface ApiClientService {
  id: string
  name: string
  amount: number
  day_of_month: number
  frequency: OutgoingFrequency
  category: string | null
  vendor: string | null
  rebill_mode: RebillMode
  rebill_amount: number | null
  /** What one cycle is expected to bring back; null when nothing is. */
  expected_per_cycle: number | null
  is_pass_through: boolean
  is_active: boolean
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
  vendor: string | null
  client_id: string | null
  client_name: string | null
  rebill_mode: RebillMode
  rebill_amount: number | null
  notes: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
  payment_status: {
    paid: boolean
    payment_id?: string
    amount_paid?: number
    paid_at?: string
  }
}

export interface ApiOutgoingPaymentLog {
  id: string
  outgoing_id: string
  amount: number
  paid_at: string
  period_month: string
  notes: string | null
  created_at: string | null
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
  /** APR as advertised, on an EAR basis. */
  interest_rate: number | null
  minimum_payment: number | null
  min_payment_percent: number | null
  min_payment_floor: number | null
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
  notes: string | null
  logged_at: string
  created_at: string | null
}

export interface ApiDebtPayment {
  id: string
  debt_id: string
  amount: number
  paid_at: string
  notes: string | null
  created_at: string | null
}

/** Rate implied by a statement's interest charge. Null when it cannot be derived. */
export interface ApiDerivedRate {
  period_rate_percent: number
  annualised_percent: number
  basis: number
  /** True when the basis is an opening/closing midpoint, not a printed figure. */
  estimated: boolean
  period_days: number
}

export type InterestBucketType =
  | 'purchases'
  | 'balance_transfer'
  | 'cash_advance'
  | 'promotional'
  | 'other'

/** One APR line of a statement's interest breakdown, with the rate it implies. */
export interface ApiInterestBucket {
  type: InterestBucketType
  label: string | null
  balance_subject_to_interest: number
  interest_charged: number
  apr: number | null
  rate: ApiDerivedRate | null
  rate_variance: number | null
}

export interface ApiDebtStatement {
  id: string
  debt_id: string
  period_start: string
  period_end: string
  statement_date: string
  due_date: string | null
  opening_balance: number
  closing_balance: number
  interest_charged: number
  fees_charged: number
  new_spending: number | null
  minimum_payment: number | null
  balance_subject_to_interest: number | null
  principal_paid: number | null
  interest_paid: number | null
  notes: string | null
  payments_in_period: number
  residual: number
  residual_significant: boolean
  advertised_apr: number | null
  rate: ApiDerivedRate | null
  /** Per-APR split; when present, interest_charged/balance_subject_to_interest are its sums. */
  interest_breakdown: ApiInterestBucket[] | null
  created_at: string | null
}

export interface ApiStatementDraft {
  period_start: string | null
  opening_balance: number
  suggested_minimum: number | null
  has_previous: boolean
}

/** Next expected payment for a debt, for the dashboard due-date panels. */
export interface ApiUpcomingDebtPayment {
  id: string
  name: string
  debt_type: DebtType
  current_balance: number
  due_date: string | null
  payment_day_of_month: number | null
  amount: number | null
  /** True when `amount` came from a statement rather than a forecast. */
  amount_is_actual: boolean
  /** Paid since the last statement closed, or this month when there is none. */
  paid_towards_next: number
  /** Nothing further owed right now; the due-date panels drop it. */
  settled: boolean
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
