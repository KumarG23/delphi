export type StatementTransactionKind = 'expense' | 'income' | 'transfer';

export interface StatementTransaction {
  transactionDate: string;
  amount: number;
  kind: StatementTransactionKind;
  merchant: string;
  description: string;
  externalId: string;
  currency: 'USD';
}

export interface StatementParseResult {
  provider: 'paypal';
  transactionCount: number;
  dateRange: { start: string; end: string };
  transactions: StatementTransaction[];
  snapshot: StatementSnapshot | null;
  warnings: string[];
}

export interface StatementSnapshot {
  snapshotDate: string;
  balance: number;
  minPayment: number | null;
  paymentDueDate: string | null;
}

export interface StatementCategory {
  id: string;
  name: string;
  type: 'expense' | 'income';
}

export interface StatementDraftTransaction extends StatementTransaction {
  duplicate: boolean;
  selected: boolean;
  categoryId: string | null;
}

export interface StatementInsertRow {
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  transaction_date: string;
  amount: number;
  kind: StatementTransactionKind;
  merchant: string;
  description: string;
  notes: null;
  source: 'csv_import';
  external_id: string;
}

export interface StatementImportPayload {
  transactions: Array<{
    category_id: string | null;
    transaction_date: string;
    amount: number;
    kind: StatementTransactionKind;
    merchant: string;
    description: string;
    external_id: string;
  }>;
  snapshot: StatementSnapshot | null;
}

const EXPENSE_RULES: { category: string[]; merchant: RegExp }[] = [
  {
    category: ['dining', 'restaurants', 'food & dining'],
    merchant: /\b(doordash|uber\s*eats|grubhub|mcdonald|chipotle|restaurant|pizza|starbucks)\b/i,
  },
  {
    category: ['entertainment', 'games'],
    merchant: /\b(steam|playstation|nintendo|xbox|epic games|spotify|netflix|hulu|disney)\b/i,
  },
  {
    category: ['groceries', 'grocery'],
    merchant: /\b(kroger|whole foods|trader joe|aldi|costco|grocery)\b/i,
  },
  {
    category: ['transportation', 'transport'],
    merchant: /\b(shell|exxon|chevron|bp|gas station|uber|lyft|ezpass)\b/i,
  },
  {
    category: ['subscriptions', 'subscription'],
    merchant: /\b(icloud|dropbox|adobe|microsoft|google one)\b/i,
  },
  {
    category: ['shopping'],
    merchant: /\b(amazon|etsy|ebay|target|walmart)\b/i,
  },
];

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findCategoryByNames(
  categories: StatementCategory[],
  type: StatementTransactionKind,
  names: string[],
): string | null {
  const wanted = new Set(names.map(normalizeName));
  return categories.find(
    category => category.type === type && wanted.has(normalizeName(category.name)),
  )?.id ?? null;
}

export function suggestCategoryId(
  transaction: StatementTransaction,
  categories: StatementCategory[],
): string | null {
  if (transaction.kind === 'transfer') return null;
  if (transaction.kind === 'income') {
    return findCategoryByNames(categories, 'income', ['income', 'salary', 'other income']);
  }
  const haystack = `${transaction.merchant} ${transaction.description}`;
  for (const rule of EXPENSE_RULES) {
    if (rule.merchant.test(haystack)) {
      return findCategoryByNames(categories, 'expense', rule.category);
    }
  }
  return null;
}

export function createStatementDraft(
  transactions: StatementTransaction[],
  existingExternalIds: ReadonlySet<string>,
  categories: StatementCategory[],
): StatementDraftTransaction[] {
  return transactions.map(transaction => {
    const duplicate = existingExternalIds.has(transaction.externalId);
    return {
      ...transaction,
      duplicate,
      selected: !duplicate,
      categoryId: suggestCategoryId(transaction, categories),
    };
  });
}

export function buildStatementInsertRows(
  draft: StatementDraftTransaction[],
  userId: string,
  accountId: string | null,
): StatementInsertRow[] {
  return draft
    .filter(transaction => transaction.selected && !transaction.duplicate)
    .map(transaction => ({
      user_id: userId,
      account_id: accountId,
      category_id: transaction.categoryId,
      transaction_date: transaction.transactionDate,
      amount: transaction.amount,
      kind: transaction.kind,
      merchant: transaction.merchant,
      description: transaction.description,
      notes: null,
      source: 'csv_import',
      external_id: transaction.externalId,
    }));
}

export function buildStatementImportPayload(
  draft: StatementDraftTransaction[],
  userId: string,
  accountId: string,
  snapshot: StatementSnapshot | null,
): StatementImportPayload {
  const transactions = buildStatementInsertRows(draft, userId, accountId).map(row => ({
    category_id: row.category_id,
    transaction_date: row.transaction_date,
    amount: row.amount,
    kind: row.kind,
    merchant: row.merchant,
    description: row.description,
    external_id: row.external_id,
  }));
  return { transactions, snapshot };
}
