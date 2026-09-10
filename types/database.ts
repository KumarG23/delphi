import type { Database as GeneratedDatabase, Json } from './database.generated';

export type Database = GeneratedDatabase;
export type { Json };

export type AccountCategory = Database['public']['Enums']['account_category'];
export type AccountType = Database['public']['Enums']['account_type'];
export type GoalKind = Database['public']['Enums']['goal_kind'];
export type GoalStatus = Database['public']['Enums']['goal_status'];
export type ReminderCadence = Database['public']['Enums']['reminder_cadence'];
export type TransactionKind = Database['public']['Enums']['transaction_kind'];
export type TransactionSource = Database['public']['Enums']['transaction_source'];
export type CategoryType = Database['public']['Enums']['category_type'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Account = Database['public']['Tables']['accounts']['Row'];
export type BalanceSnapshot = Database['public']['Tables']['balance_snapshots']['Row'];
export type Budget = Database['public']['Tables']['budgets']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Goal = Database['public']['Tables']['goals']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];

// Supabase correctly generates nullable columns for SQL views because Postgres
// does not preserve NOT NULL metadata through views. These aliases narrow only
// fields whose view definitions guarantee a value from NOT NULL base columns or
// COALESCE/aggregates. Keeping the narrowing here avoids scattering unsafe `!`
// assertions throughout the UI while the generated file remains authoritative.
type GeneratedAccountSummary = Database['public']['Views']['v_account_summary']['Row'];
export type AccountSummary = GeneratedAccountSummary & {
  id: string;
  user_id: string;
  name: string;
  category: AccountCategory;
  type: AccountType;
  is_active: boolean;
};

type GeneratedNetWorthPoint = Database['public']['Views']['v_net_worth_history']['Row'];
export type NetWorthPoint = GeneratedNetWorthPoint & {
  user_id: string;
  snapshot_date: string;
  total_cash: number;
  total_investment: number;
  total_debt: number;
  net_worth: number;
};

type GeneratedMonthlySpending = Database['public']['Views']['v_monthly_spending_by_category']['Row'];
export type MonthlySpending = GeneratedMonthlySpending & {
  user_id: string;
  month: string;
  transaction_count: number;
  total: number;
};

type GeneratedMonthlyCashflow = Database['public']['Views']['v_monthly_cashflow']['Row'];
export type MonthlyCashflow = GeneratedMonthlyCashflow & {
  user_id: string;
  month: string;
  total_income: number;
  total_expense: number;
  net_cashflow: number;
};

type GeneratedComputedBalance = Database['public']['Views']['v_account_computed_balance']['Row'];
export type ComputedBalance = GeneratedComputedBalance & {
  account_id: string;
  user_id: string;
  name: string;
  category: AccountCategory;
  net_change_since_last: number;
};
