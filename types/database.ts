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

export type AccountSummary = Database['public']['Views']['v_account_summary']['Row'];
export type NetWorthPoint = Database['public']['Views']['v_net_worth_history']['Row'];
export type MonthlySpending = Database['public']['Views']['v_monthly_spending_by_category']['Row'];
export type MonthlyCashflow = Database['public']['Views']['v_monthly_cashflow']['Row'];
export type ComputedBalance = Database['public']['Views']['v_account_computed_balance']['Row'];
