export type PlaidTransactionLike = {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string | null;
  pending?: boolean;
  pending_transaction_id?: string | null;
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
  } | null;
};

export type DelphiTransactionKind = 'expense' | 'income' | 'transfer';

export type NormalizedPlaidTransaction = {
  externalId: string;
  plaidAccountId: string;
  amount: number;
  kind: DelphiTransactionKind;
  transactionDate: string;
  merchant: string | null;
  description: string;
  categoryName: string | null;
  notes: string;
};

function upper(value: string | null | undefined): string {
  return (value ?? '').toUpperCase();
}

function expenseCategory(primary: string, detailed: string): string {
  if (detailed.includes('GROCER')) return 'Groceries';
  if (primary === 'FOOD_AND_DRINK') return 'Dining';
  if (primary === 'TRANSPORTATION') return 'Transportation';
  if (primary === 'TRAVEL') return 'Travel';
  if (primary === 'MEDICAL') return 'Healthcare';
  if (primary === 'PERSONAL_CARE') return 'Personal Care';
  if (primary === 'ENTERTAINMENT') return 'Entertainment';
  if (primary === 'GENERAL_MERCHANDISE') return 'Shopping';
  if (primary === 'RENT_AND_UTILITIES') {
    return detailed.includes('RENT') ? 'Rent / Mortgage' : 'Utilities';
  }
  return 'Other Expense';
}

function incomeCategory(detailed: string, looksLikeRefund: boolean): string {
  if (looksLikeRefund) return 'Refund';
  if (detailed.includes('WAGE') || detailed.includes('SALARY')) return 'Salary';
  if (detailed.includes('DIVIDEND') || detailed.includes('INTEREST_EARNED')) {
    return 'Investment Income';
  }
  return 'Other Income';
}

export function normalizePlaidTransaction(
  transaction: PlaidTransactionLike,
): NormalizedPlaidTransaction {
  const primary = upper(transaction.personal_finance_category?.primary);
  const detailed = upper(transaction.personal_finance_category?.detailed);

  // Transfers and debt/card payments move money between accounts rather than
  // representing new spending. Delphi excludes `transfer` rows from cash-flow
  // totals, preventing a card purchase and the later card payment from both
  // being counted as expenses when both accounts are connected.
  const isTransfer = ['TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS'].includes(primary);
  const isIncome = !isTransfer && transaction.amount < 0;
  const kind: DelphiTransactionKind = isTransfer
    ? 'transfer'
    : isIncome
      ? 'income'
      : 'expense';

  const looksLikeRefund = !['', 'INCOME', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS'].includes(primary);
  const categoryName = kind === 'transfer'
    ? null
    : kind === 'income'
      ? incomeCategory(detailed, looksLikeRefund)
      : expenseCategory(primary, detailed);

  return {
    externalId: transaction.transaction_id,
    plaidAccountId: transaction.account_id,
    amount: Math.abs(transaction.amount),
    kind,
    transactionDate: transaction.date,
    merchant: transaction.merchant_name?.trim() || null,
    description: transaction.name,
    categoryName,
    notes: transaction.pending ? 'Pending — synced from Plaid' : 'Synced from Plaid',
  };
}
