// Hand-written from delphi_schema.sql — matches the Supabase generated format
// so createClient<Database>() gives full type safety on every query.

export type AccountCategory = 'debt' | 'cash' | 'investment';

export type AccountType =
  | 'credit_card' | 'personal_loan' | 'mortgage' | 'auto_loan' | 'student_loan' | 'other_debt'
  | 'checking' | 'savings' | 'hysa' | 'money_market' | 'cash_other'
  | '401k' | 'traditional_ira' | 'roth_ira' | 'brokerage' | 'crypto' | 'investment_other';

export type GoalKind = 'payoff' | 'accumulate' | 'category_target';
export type GoalStatus = 'active' | 'achieved' | 'missed' | 'abandoned';
export type ReminderCadence = 'monthly' | 'biweekly' | 'weekly' | 'off';
export type TransactionKind = 'expense' | 'income' | 'transfer';
export type TransactionSource = 'manual' | 'csv_import' | 'plaid';
export type CategoryType = 'expense' | 'income';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          reminder_cadence: ReminderCadence;
          reminder_day_of_month: number | null;
          reminder_hour_local: number;
          timezone: string;
          default_currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          reminder_cadence?: ReminderCadence;
          reminder_day_of_month?: number | null;
          reminder_hour_local?: number;
          timezone?: string;
          default_currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          reminder_cadence?: ReminderCadence;
          reminder_day_of_month?: number | null;
          reminder_hour_local?: number;
          timezone?: string;
          default_currency?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          nickname: string | null;
          category: AccountCategory;
          type: AccountType;
          institution: string | null;
          currency: string;
          display_color: string | null;
          is_active: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          nickname?: string | null;
          category: AccountCategory;
          type: AccountType;
          institution?: string | null;
          currency?: string;
          display_color?: string | null;
          is_active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          nickname?: string | null;
          category?: AccountCategory;
          type?: AccountType;
          institution?: string | null;
          currency?: string;
          display_color?: string | null;
          is_active?: boolean;
          archived_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      balance_snapshots: {
        Row: {
          id: string;
          account_id: string;
          user_id: string;
          snapshot_date: string;
          balance: number;
          apr: number | null;
          apy: number | null;
          min_payment: number | null;
          payment_due_date: string | null;
          notes: string | null;
          entered_at: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          user_id: string;
          snapshot_date: string;
          balance: number;
          apr?: number | null;
          apy?: number | null;
          min_payment?: number | null;
          payment_due_date?: string | null;
          notes?: string | null;
          entered_at?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          user_id?: string;
          snapshot_date?: string;
          balance?: number;
          apr?: number | null;
          apy?: number | null;
          min_payment?: number | null;
          payment_due_date?: string | null;
          notes?: string | null;
          entered_at?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: CategoryType;
          parent_id: string | null;
          icon: string | null;
          color: string | null;
          is_system: boolean;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: CategoryType;
          parent_id?: string | null;
          icon?: string | null;
          color?: string | null;
          is_system?: boolean;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: CategoryType;
          parent_id?: string | null;
          icon?: string | null;
          color?: string | null;
          is_system?: boolean;
          is_active?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string | null;
          category_id: string | null;
          transaction_date: string;
          amount: number;
          kind: TransactionKind;
          merchant: string | null;
          description: string | null;
          notes: string | null;
          source: TransactionSource;
          external_id: string | null;
          is_active: boolean;
          entered_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id?: string | null;
          category_id?: string | null;
          transaction_date: string;
          amount: number;
          kind: TransactionKind;
          merchant?: string | null;
          description?: string | null;
          notes?: string | null;
          source?: TransactionSource;
          external_id?: string | null;
          is_active?: boolean;
          entered_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string | null;
          category_id?: string | null;
          transaction_date?: string;
          amount?: number;
          kind?: TransactionKind;
          merchant?: string | null;
          description?: string | null;
          notes?: string | null;
          source?: TransactionSource;
          external_id?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          kind: GoalKind;
          account_id: string | null;
          category: AccountCategory | null;
          name: string;
          start_value: number;
          target_value: number;
          target_date: string | null;
          status: GoalStatus;
          achieved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: GoalKind;
          account_id?: string | null;
          category?: AccountCategory | null;
          name: string;
          start_value: number;
          target_value: number;
          target_date?: string | null;
          status?: GoalStatus;
          achieved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          kind?: GoalKind;
          account_id?: string | null;
          category?: AccountCategory | null;
          name?: string;
          start_value?: number;
          target_value?: number;
          target_date?: string | null;
          status?: GoalStatus;
          achieved_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          user_id: string;
          event_date: string;
          label: string;
          note: string | null;
          account_id: string | null;
          category: AccountCategory | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_date: string;
          label: string;
          note?: string | null;
          account_id?: string | null;
          category?: AccountCategory | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_date?: string;
          label?: string;
          note?: string | null;
          account_id?: string | null;
          category?: AccountCategory | null;
        };
        Relationships: [];
      };
    };
    Views: {
      v_latest_snapshot_per_account: {
        Row: {
          account_id: string;
          user_id: string;
          snapshot_date: string;
          balance: number;
          apr: number | null;
          apy: number | null;
          min_payment: number | null;
          payment_due_date: string | null;
          entered_at: string;
        };
        Relationships: [];
      };
      v_net_worth_history: {
        Row: {
          user_id: string;
          snapshot_date: string;
          total_cash: number;
          total_investment: number;
          total_debt: number;
          net_worth: number;
        };
        Relationships: [];
      };
      v_account_summary: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          nickname: string | null;
          category: AccountCategory;
          type: AccountType;
          institution: string | null;
          display_color: string | null;
          is_active: boolean;
          last_snapshot_date: string | null;
          latest_balance: number | null;
          apr: number | null;
          apy: number | null;
          min_payment: number | null;
          payment_due_date: string | null;
          days_since_last_entry: number | null;
        };
        Relationships: [];
      };
      v_monthly_spending_by_category: {
        Row: {
          user_id: string;
          month: string;
          category_id: string | null;
          category_name: string | null;
          category_type: CategoryType | null;
          category_color: string | null;
          category_icon: string | null;
          transaction_count: number;
          total: number;
        };
        Relationships: [];
      };
      v_monthly_cashflow: {
        Row: {
          user_id: string;
          month: string;
          total_income: number;
          total_expense: number;
          net_cashflow: number;
        };
        Relationships: [];
      };
      v_account_computed_balance: {
        Row: {
          account_id: string;
          user_id: string;
          name: string;
          category: AccountCategory;
          last_reported_balance: number | null;
          last_reported_date: string | null;
          net_change_since_last: number;
          computed_balance: number | null;
        };
        Relationships: [];
      };
    };
    Enums: {
      account_category: AccountCategory;
      account_type: AccountType;
      goal_kind: GoalKind;
      goal_status: GoalStatus;
      reminder_cadence: ReminderCadence;
      transaction_kind: TransactionKind;
      transaction_source: TransactionSource;
      category_type: CategoryType;
    };
    Functions: Record<string, never>;
  };
};

// Convenience row types — import these in components instead of drilling into Database
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Account = Database['public']['Tables']['accounts']['Row'];
export type BalanceSnapshot = Database['public']['Tables']['balance_snapshots']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Goal = Database['public']['Tables']['goals']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];

export type AccountSummary = Database['public']['Views']['v_account_summary']['Row'];
export type NetWorthPoint = Database['public']['Views']['v_net_worth_history']['Row'];
export type MonthlySpending = Database['public']['Views']['v_monthly_spending_by_category']['Row'];
export type MonthlyCashflow = Database['public']['Views']['v_monthly_cashflow']['Row'];
export type ComputedBalance = Database['public']['Views']['v_account_computed_balance']['Row'];
