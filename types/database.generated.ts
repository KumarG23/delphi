// This file mirrors the live Supabase public schema.
// Regenerate with: npm run db:types
// Do not hand-edit unless reconciling an intentional schema change.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: { id: string; user_id: string; name: string; nickname: string | null; category: Database['public']['Enums']['account_category']; type: Database['public']['Enums']['account_type']; institution: string | null; currency: string; display_color: string | null; is_active: boolean; archived_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name: string; nickname?: string | null; category: Database['public']['Enums']['account_category']; type: Database['public']['Enums']['account_type']; institution?: string | null; currency?: string; display_color?: string | null; is_active?: boolean; archived_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; name?: string; nickname?: string | null; category?: Database['public']['Enums']['account_category']; type?: Database['public']['Enums']['account_type']; institution?: string | null; currency?: string; display_color?: string | null; is_active?: boolean; archived_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      balance_snapshots: {
        Row: { id: string; account_id: string; user_id: string; snapshot_date: string; balance: number; apr: number | null; apy: number | null; min_payment: number | null; payment_due_date: string | null; notes: string | null; entered_at: string; is_active: boolean; created_at: string };
        Insert: { id?: string; account_id: string; user_id: string; snapshot_date: string; balance: number; apr?: number | null; apy?: number | null; min_payment?: number | null; payment_due_date?: string | null; notes?: string | null; entered_at?: string; is_active?: boolean; created_at?: string };
        Update: { id?: string; account_id?: string; user_id?: string; snapshot_date?: string; balance?: number; apr?: number | null; apy?: number | null; min_payment?: number | null; payment_due_date?: string | null; notes?: string | null; entered_at?: string; is_active?: boolean; created_at?: string };
        Relationships: [];
      };
      budgets: {
        Row: { id: string; user_id: string; category_id: string; monthly_limit: number; is_active: boolean; archived_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; category_id: string; monthly_limit: number; is_active?: boolean; archived_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; category_id?: string; monthly_limit?: number; is_active?: boolean; archived_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      categories: {
        Row: { id: string; user_id: string; name: string; type: Database['public']['Enums']['category_type']; parent_id: string | null; icon: string | null; color: string | null; is_system: boolean; is_active: boolean; sort_order: number; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; name: string; type: Database['public']['Enums']['category_type']; parent_id?: string | null; icon?: string | null; color?: string | null; is_system?: boolean; is_active?: boolean; sort_order?: number; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; name?: string; type?: Database['public']['Enums']['category_type']; parent_id?: string | null; icon?: string | null; color?: string | null; is_system?: boolean; is_active?: boolean; sort_order?: number; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      events: {
        Row: { id: string; user_id: string; event_date: string; label: string; note: string | null; account_id: string | null; category: Database['public']['Enums']['account_category'] | null; created_at: string };
        Insert: { id?: string; user_id: string; event_date: string; label: string; note?: string | null; account_id?: string | null; category?: Database['public']['Enums']['account_category'] | null; created_at?: string };
        Update: { id?: string; user_id?: string; event_date?: string; label?: string; note?: string | null; account_id?: string | null; category?: Database['public']['Enums']['account_category'] | null; created_at?: string };
        Relationships: [];
      };
      goals: {
        Row: { id: string; user_id: string; kind: Database['public']['Enums']['goal_kind']; account_id: string | null; category: Database['public']['Enums']['account_category'] | null; name: string; start_value: number; target_value: number; target_date: string | null; status: Database['public']['Enums']['goal_status']; achieved_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; kind: Database['public']['Enums']['goal_kind']; account_id?: string | null; category?: Database['public']['Enums']['account_category'] | null; name: string; start_value: number; target_value: number; target_date?: string | null; status?: Database['public']['Enums']['goal_status']; achieved_at?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; kind?: Database['public']['Enums']['goal_kind']; account_id?: string | null; category?: Database['public']['Enums']['account_category'] | null; name?: string; start_value?: number; target_value?: number; target_date?: string | null; status?: Database['public']['Enums']['goal_status']; achieved_at?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; display_name: string; reminder_cadence: Database['public']['Enums']['reminder_cadence']; reminder_day_of_month: number | null; reminder_hour_local: number; timezone: string; default_currency: string; created_at: string; updated_at: string };
        Insert: { id: string; display_name: string; reminder_cadence?: Database['public']['Enums']['reminder_cadence']; reminder_day_of_month?: number | null; reminder_hour_local?: number; timezone?: string; default_currency?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; display_name?: string; reminder_cadence?: Database['public']['Enums']['reminder_cadence']; reminder_day_of_month?: number | null; reminder_hour_local?: number; timezone?: string; default_currency?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      transactions: {
        Row: { id: string; user_id: string; account_id: string | null; category_id: string | null; transaction_date: string; amount: number; kind: Database['public']['Enums']['transaction_kind']; merchant: string | null; description: string | null; notes: string | null; source: Database['public']['Enums']['transaction_source']; external_id: string | null; is_active: boolean; entered_at: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; account_id?: string | null; category_id?: string | null; transaction_date: string; amount: number; kind: Database['public']['Enums']['transaction_kind']; merchant?: string | null; description?: string | null; notes?: string | null; source?: Database['public']['Enums']['transaction_source']; external_id?: string | null; is_active?: boolean; entered_at?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; account_id?: string | null; category_id?: string | null; transaction_date?: string; amount?: number; kind?: Database['public']['Enums']['transaction_kind']; merchant?: string | null; description?: string | null; notes?: string | null; source?: Database['public']['Enums']['transaction_source']; external_id?: string | null; is_active?: boolean; entered_at?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
    };
    Views: {
      v_account_computed_balance: { Row: { account_id: string | null; user_id: string | null; name: string | null; category: Database['public']['Enums']['account_category'] | null; last_reported_balance: number | null; last_reported_date: string | null; net_change_since_last: number | null; computed_balance: number | null }; Relationships: [] };
      v_account_summary: { Row: { id: string | null; user_id: string | null; name: string | null; nickname: string | null; category: Database['public']['Enums']['account_category'] | null; type: Database['public']['Enums']['account_type'] | null; institution: string | null; display_color: string | null; is_active: boolean | null; last_snapshot_date: string | null; latest_balance: number | null; apr: number | null; apy: number | null; min_payment: number | null; payment_due_date: string | null; days_since_last_entry: number | null }; Relationships: [] };
      v_latest_snapshot_per_account: { Row: { account_id: string | null; user_id: string | null; snapshot_date: string | null; balance: number | null; apr: number | null; apy: number | null; min_payment: number | null; payment_due_date: string | null; entered_at: string | null }; Relationships: [] };
      v_monthly_cashflow: { Row: { user_id: string | null; month: string | null; total_income: number | null; total_expense: number | null; net_cashflow: number | null }; Relationships: [] };
      v_monthly_spending_by_category: { Row: { user_id: string | null; month: string | null; category_id: string | null; category_name: string | null; category_type: Database['public']['Enums']['category_type'] | null; category_color: string | null; category_icon: string | null; transaction_count: number | null; total: number | null }; Relationships: [] };
      v_net_worth_history: { Row: { user_id: string | null; snapshot_date: string | null; total_cash: number | null; total_investment: number | null; total_debt: number | null; net_worth: number | null }; Relationships: [] };
    };
    Functions: {
      import_statement_batch: { Args: { p_account_id: string; p_snapshot?: Json; p_transactions?: Json }; Returns: Json };
      seed_default_categories: { Args: { target_user_id: string }; Returns: undefined };
    };
    Enums: {
      account_category: 'debt' | 'cash' | 'investment';
      account_type: 'credit_card' | 'personal_loan' | 'mortgage' | 'auto_loan' | 'student_loan' | 'other_debt' | 'checking' | 'savings' | 'hysa' | 'money_market' | 'cash_other' | '401k' | 'traditional_ira' | 'roth_ira' | 'brokerage' | 'crypto' | 'investment_other';
      category_type: 'expense' | 'income';
      goal_kind: 'payoff' | 'accumulate' | 'category_target';
      goal_status: 'active' | 'achieved' | 'missed' | 'abandoned';
      reminder_cadence: 'monthly' | 'biweekly' | 'weekly' | 'off';
      transaction_kind: 'expense' | 'income' | 'transfer';
      transaction_source: 'manual' | 'csv_import' | 'plaid';
    };
  };
};
