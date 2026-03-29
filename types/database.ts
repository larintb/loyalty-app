// Tipos manuales — reemplazar con `npx supabase gen types typescript` al conectar Supabase
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ─── Tipos de dominio ────────────────────────────────────────────────────────

export type PointsConfig = {
  earn_rate: number
  earn_per_amount: number
  redeem_rate: number
  redeem_value: number
  min_redeem_points: number
  expiry_days: number
  welcome_bonus: number
}

export type TransactionItem = {
  name: string
  category?: string
  price: number
  quantity: number
  unit?: string
}

export type PlanStatus = 'trialing' | 'active' | 'past_due' | 'cancelled'
export type UserRole = 'owner' | 'admin' | 'cashier'
export type TransactionType = 'sale' | 'refund' | 'exchange'
export type PointsLedgerType = 'earn' | 'redeem' | 'expire' | 'adjust' | 'welcome' | 'redeem_product'
export type FinanceType = 'income' | 'expense'
export type FinancePeriodType = 'week' | 'month'
export type FinancePeriodStatus = 'open' | 'closed'
export type FinanceResetMode = 'carry_over' | 'zero_base'
export type ChurnRisk = 'high' | 'medium' | 'low'

// ─── Rows (lo que devuelve Supabase) ─────────────────────────────────────────

export type SubscriptionPlanRow = {
  id: string
  name: string
  slug: string
  price_mxn: number
  max_customers: number | null
  features: Json
  is_active: boolean
  created_at: string
}

export type BusinessRow = {
  id: string
  owner_id: string
  name: string
  phone: string | null
  email: string | null
  logo_url: string | null
  address: string | null
  points_config: PointsConfig
  plan_id: string | null
  plan_status: PlanStatus
  trial_ends_at: string
  current_period_end: string | null
  mp_subscription_id: string | null
  mp_customer_id: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export type StaffMemberRow = {
  id: string
  business_id: string
  user_id: string
  role: UserRole
  name: string
  email: string
  is_active: boolean
  invited_at: string
  created_at: string
}

export type CustomerRow = {
  id: string
  business_id: string
  phone: string
  name: string
  email: string | null
  birthday: string | null
  notes: string | null
  total_points: number
  lifetime_spend: number
  visit_count: number
  last_visit_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type TransactionRow = {
  id: string
  business_id: string
  customer_id: string | null
  staff_id: string | null
  type: TransactionType
  subtotal: number
  discount: number
  points_redeemed: number
  discount_by_points: number
  total: number
  items: TransactionItem[]
  ticket_number: string | null
  ticket_sent_via: string[] | null
  ticket_url: string | null
  notes: string | null
  created_at: string
}

export type PointsLedgerRow = {
  id: string
  business_id: string
  customer_id: string
  transaction_id: string | null
  type: PointsLedgerType
  points_delta: number
  balance_after: number
  note: string | null
  created_at: string
}

export type FinanceEntryRow = {
  id: string
  business_id: string
  staff_id: string | null
  transaction_id: string | null
  period_id: string | null
  type: FinanceType
  category: string
  amount: number
  description: string | null
  date: string
  locked: boolean
  receipt_url: string | null
  created_at: string
}

export type FinancePeriodRow = {
  id: string
  business_id: string
  period_type: FinancePeriodType
  period_start: string
  period_end: string
  status: FinancePeriodStatus
  opening_balance: number
  total_income: number
  total_expense: number
  closing_balance: number
  reset_mode: FinanceResetMode
  closed_by: string | null
  closed_at: string | null
  created_at: string
}

export type RedeemableProductRow = {
  id: string
  business_id: string
  name: string
  description: string | null
  points_cost: number
  color: string
  icon_name: string
  emoji: string | null
  is_active: boolean
  has_stock: boolean
  stock_quantity: number | null
  max_redeems_per_day: number | null
  max_redeems_per_customer: number | null
  created_by: string
  created_at: string
  updated_at: string
}

export type RedemptionRow = {
  id: string
  business_id: string
  customer_id: string
  redeemable_product_id: string
  product_name: string
  points_deducted: number
  redeemed_by_user_id: string | null
  notes: string | null
  created_at: string
}

// ─── Inserts ──────────────────────────────────────────────────────────────────

export type BusinessInsert = {
  owner_id: string
  name: string
  phone?: string | null
  email?: string | null
  logo_url?: string | null
  address?: string | null
  points_config?: PointsConfig
  plan_id?: string | null
  plan_status?: PlanStatus
}

export type StaffMemberInsert = {
  business_id: string
  user_id: string
  role?: UserRole
  name: string
  email: string
  is_active?: boolean
}

export type CustomerInsert = {
  business_id: string
  phone: string
  name: string
  email?: string | null
  birthday?: string | null
  notes?: string | null
}

export type TransactionInsert = {
  business_id: string
  customer_id?: string | null
  staff_id?: string | null
  type: TransactionType
  subtotal: number
  discount?: number
  points_redeemed?: number
  discount_by_points?: number
  total: number
  items?: TransactionItem[]
  ticket_number?: string | null
  ticket_sent_via?: string[] | null
  ticket_url?: string | null
  notes?: string | null
}

export type PointsLedgerInsert = {
  business_id: string
  customer_id: string
  transaction_id?: string | null
  type: PointsLedgerType
  points_delta: number
  balance_after: number
  note?: string | null
}

export type FinanceEntryInsert = {
  business_id: string
  staff_id?: string | null
  transaction_id?: string | null
  period_id?: string | null
  type: FinanceType
  category: string
  amount: number
  description?: string | null
  date?: string
  locked?: boolean
  receipt_url?: string | null
}

export type FinancePeriodInsert = {
  business_id: string
  period_type: FinancePeriodType
  period_start: string
  period_end: string
  status?: FinancePeriodStatus
  opening_balance?: number
  total_income?: number
  total_expense?: number
  closing_balance?: number
  reset_mode?: FinanceResetMode
  closed_by?: string | null
  closed_at?: string | null
}

export type RedeemableProductInsert = {
  business_id: string
  name: string
  description?: string | null
  points_cost: number
  color?: string
  icon_name?: string
  emoji?: string | null
  is_active?: boolean
  has_stock?: boolean
  stock_quantity?: number | null
  max_redeems_per_day?: number | null
  max_redeems_per_customer?: number | null
  created_by: string
}

export type RedemptionInsert = {
  business_id: string
  customer_id: string
  redeemable_product_id: string
  product_name: string
  points_deducted: number
  redeemed_by_user_id?: string | null
  notes?: string | null
}

// ─── View Rows ────────────────────────────────────────────────────────────────

export type CustomerCLV = {
  id: string
  business_id: string
  name: string
  phone: string
  email: string | null
  total_points: number
  lifetime_spend: number
  visit_count: number
  last_visit_at: string | null
  created_at: string
  avg_ticket: number
  days_as_customer: number
  projected_clv_12m: number
}

export type ChurnRiskRow = {
  id: string
  business_id: string
  name: string
  phone: string
  email: string | null
  last_visit_at: string
  total_points: number
  visit_count: number
  days_inactive: number
  churn_risk: ChurnRisk
}

export type TopProductRow = {
  business_id: string
  product_name: string
  category: string | null
  total_units: number
  total_revenue: number
  transaction_count: number
  avg_price: number
}

export type FinanceSummaryRow = {
  business_id: string
  month: string
  total_income: number
  total_expense: number
  net_profit: number
}

export type DailySalesRow = {
  business_id: string
  sale_date: string
  transaction_count: number
  total_revenue: number
  unique_customers: number
}

// ─── Database schema (para Supabase client tipado) ───────────────────────────

export type Database = {
  public: {
    Tables: {
      subscription_plans: {
        Row: SubscriptionPlanRow
        Insert: Omit<SubscriptionPlanRow, 'id' | 'created_at'>
        Update: Partial<Omit<SubscriptionPlanRow, 'id' | 'created_at'>>
        Relationships: []
      }
      businesses: {
        Row: BusinessRow
        Insert: BusinessInsert
        Update: Partial<BusinessInsert>
        Relationships: []
      }
      staff_members: {
        Row: StaffMemberRow
        Insert: StaffMemberInsert
        Update: Partial<StaffMemberInsert>
        Relationships: []
      }
      customers: {
        Row: CustomerRow
        Insert: CustomerInsert
        Update: Partial<CustomerInsert> & { total_points?: number; lifetime_spend?: number; visit_count?: number; last_visit_at?: string | null; is_active?: boolean }
        Relationships: []
      }
      transactions: {
        Row: TransactionRow
        Insert: TransactionInsert
        Update: Partial<TransactionInsert>
        Relationships: []
      }
      points_ledger: {
        Row: PointsLedgerRow
        Insert: PointsLedgerInsert
        Update: never
        Relationships: []
      }
      finance_entries: {
        Row: FinanceEntryRow
        Insert: FinanceEntryInsert
        Update: Partial<FinanceEntryInsert>
        Relationships: []
      }
      finance_periods: {
        Row: FinancePeriodRow
        Insert: FinancePeriodInsert
        Update: Partial<FinancePeriodInsert>
        Relationships: []
      }
    }
    Views: {
      v_customer_clv: { Row: CustomerCLV; Relationships: [] }
      v_churn_risk: { Row: ChurnRiskRow; Relationships: [] }
      v_top_products: { Row: TopProductRow; Relationships: [] }
      v_finance_summary: { Row: FinanceSummaryRow; Relationships: [] }
      v_daily_sales: { Row: DailySalesRow; Relationships: [] }
    }
    Functions: {
      get_user_business_id: { Args: Record<string, never>; Returns: string }
      get_user_role: { Args: Record<string, never>; Returns: UserRole }
    }
  }
}

// Aliases convenientes
export type Business = BusinessRow
export type Customer = CustomerRow
export type Transaction = TransactionRow
export type PointsLedger = PointsLedgerRow
export type FinanceEntry = FinanceEntryRow
export type FinancePeriod = FinancePeriodRow
export type StaffMember = StaffMemberRow
export type SubscriptionPlan = SubscriptionPlanRow
