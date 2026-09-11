import type { AccountSummary, MonthlyCashflow, NetWorthPoint } from '@/types/database';
import type { FinancialIntelligence } from '@/lib/askDelphi/intelligence';
import type { Goal, GoalProgress } from '@/lib/goals';

export interface FinancialContextInput {
  accounts?: AccountSummary[] | null;
  netWorthHistory?: NetWorthPoint[] | null;
  cashflow?: MonthlyCashflow | null;
  intelligence?: FinancialIntelligence | null;
  goals?: { goal: Goal; progress: GoalProgress }[];
}

function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function dateNDaysAgo(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - days);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build a compact, token-light text block summarizing the user's financial
 * situation. Deterministic metrics are calculated before the LLM sees them so
 * Delphi explains the numbers instead of being responsible for financial math.
 */
export function buildFinancialContext(input: FinancialContextInput): string {
  const { accounts, netWorthHistory, cashflow, intelligence } = input;
  const lines: string[] = [];

  const today = intelligence?.asOfDate ?? new Date().toISOString().split('T')[0];
  lines.push(`Today's date: ${today}`);

  // Net worth (latest) + 30-day change from history.
  if (netWorthHistory && netWorthHistory.length > 0) {
    const latest = netWorthHistory[netWorthHistory.length - 1];
    lines.push(`Net worth: ${fmtUSD(latest.net_worth)}`);

    if (netWorthHistory.length >= 2) {
      const latestDate = latest.snapshot_date;
      const thirtyAgo = dateNDaysAgo(latestDate, 30);
      let prev = netWorthHistory[0];
      for (const p of netWorthHistory) {
        if (p.snapshot_date <= thirtyAgo) prev = p;
        else break;
      }

      if (prev.snapshot_date !== latestDate) {
        const delta = latest.net_worth - prev.net_worth;
        const pct = prev.net_worth !== 0 ? (delta / Math.abs(prev.net_worth)) * 100 : 0;
        const sign = delta >= 0 ? '+' : '';
        lines.push(`30-day net-worth change: ${sign}${fmtUSD(delta)} (${fmtPct(pct)})`);
      }
    }
  }

  let cashTotalForCoverage: number | null = null;

  // Account buckets + useful debt details.
  if (accounts && accounts.length > 0) {
    let debtTotal = 0;
    let cashTotal = 0;
    let investmentTotal = 0;
    let debtCount = 0;
    let cashCount = 0;
    let investmentCount = 0;
    let largestDebt: AccountSummary | null = null;
    let highestAprDebt: AccountSummary | null = null;

    for (const a of accounts) {
      const bal = a.latest_balance ?? 0;
      if (a.category === 'debt') {
        debtTotal += bal;
        debtCount += 1;
        if (bal > 0 && (!largestDebt || bal > (largestDebt.latest_balance ?? 0))) {
          largestDebt = a;
        }
        if (
          a.apr != null
          && bal > 0
          && (!highestAprDebt || a.apr > (highestAprDebt.apr ?? -Infinity))
        ) {
          highestAprDebt = a;
        }
      } else if (a.category === 'cash') {
        cashTotal += bal;
        cashCount += 1;
      } else if (a.category === 'investment') {
        investmentTotal += bal;
        investmentCount += 1;
      }
    }

    cashTotalForCoverage = cashTotal;
    lines.push(`Debt total: ${fmtUSD(debtTotal)} (${debtCount} accounts)`);
    lines.push(`Cash total: ${fmtUSD(cashTotal)} (${cashCount} accounts)`);
    lines.push(`Investments total: ${fmtUSD(investmentTotal)} (${investmentCount} accounts)`);

    if (largestDebt?.latest_balance != null) {
      const name = largestDebt.nickname?.trim() || largestDebt.name;
      let detail = `Largest debt: ${name} ${fmtUSD(largestDebt.latest_balance)}`;
      if (largestDebt.apr != null) detail += ` @ ${largestDebt.apr}% APR`;
      lines.push(detail);
    }

    if (highestAprDebt?.apr != null && highestAprDebt.latest_balance != null) {
      const name = highestAprDebt.nickname?.trim() || highestAprDebt.name;
      lines.push(
        `Highest-APR debt: ${name} ${fmtUSD(highestAprDebt.latest_balance)} @ ${highestAprDebt.apr}% APR`,
      );
    }
  }

  // Rich transaction intelligence, when available.
  if (intelligence) {
    lines.push(
      `Month-to-date cashflow (${intelligence.currentPeriodStart} through ${intelligence.asOfDate}): `
      + `income ${fmtUSD(intelligence.currentMtdIncome)}, expenses ${fmtUSD(intelligence.currentMtdExpense)}, `
      + `net ${fmtUSD(intelligence.currentMtdNet)}`,
    );

    if (intelligence.currentSavingsRatePct != null) {
      lines.push(`Month-to-date savings rate: ${fmtPct(intelligence.currentSavingsRatePct)}`);
    }

    lines.push(
      `Same-point-last-month comparison (${intelligence.previousComparableStart} through ${intelligence.previousComparableEnd}): `
      + `income ${fmtUSD(intelligence.previousComparableIncome)}, expenses ${fmtUSD(intelligence.previousComparableExpense)}, `
      + `net ${fmtUSD(intelligence.previousComparableNet)}`,
    );

    if (intelligence.expenseChangePct != null) {
      lines.push(`Expense change vs same point last month: ${fmtPct(intelligence.expenseChangePct)}`);
    }
    if (intelligence.incomeChangePct != null) {
      lines.push(`Income change vs same point last month: ${fmtPct(intelligence.incomeChangePct)}`);
    }

    if (intelligence.topSpendingCategories.length > 0) {
      const categories = intelligence.topSpendingCategories
        .map((category) => (
          `${category.name} ${fmtUSD(category.total)} (${category.sharePct.toFixed(0)}% of MTD expenses)`
        ))
        .join('; ');
      lines.push(`Top spending categories MTD: ${categories}`);
    }

    if (intelligence.largestRecentExpenses.length > 0) {
      const expenses = intelligence.largestRecentExpenses
        .map((expense) => (
          `${expense.date} ${expense.merchant} ${fmtUSD(expense.amount)}`
          + (expense.category ? ` [${expense.category}]` : '')
        ))
        .join('; ');
      lines.push(`Largest expenses in the last 30 days: ${expenses}`);
    }

    if (
      intelligence.completedMonthsUsed > 0
      && intelligence.averageMonthlyExpense != null
      && intelligence.averageMonthlyIncome != null
      && intelligence.averageMonthlyNet != null
    ) {
      lines.push(
        `Average over last ${intelligence.completedMonthsUsed} completed month${intelligence.completedMonthsUsed === 1 ? '' : 's'}: `
        + `income ${fmtUSD(intelligence.averageMonthlyIncome)}, expenses ${fmtUSD(intelligence.averageMonthlyExpense)}, `
        + `net ${fmtUSD(intelligence.averageMonthlyNet)}`,
      );

      if (cashTotalForCoverage != null && intelligence.averageMonthlyExpense > 0) {
        const coverage = cashTotalForCoverage / intelligence.averageMonthlyExpense;
        lines.push(`Cash coverage vs average monthly spending: ${coverage.toFixed(1)} months`);
      }
    }
  } else if (cashflow) {
    // Fallback for older/partial data paths.
    lines.push(
      `This month's cashflow: income ${fmtUSD(cashflow.total_income)}, `
      + `expense ${fmtUSD(cashflow.total_expense)}, net ${fmtUSD(cashflow.net_cashflow)}`,
    );
  }

  // Active goals, capped to keep prompt size predictable.
  const goals = input.goals ?? [];
  if (goals.length > 0) {
    lines.push('Goals:');
    goals.slice(0, 5).forEach(({ goal, progress }) => {
      const pct = Math.round(progress.pct);
      const due = goal.target_date ? ` (due ${goal.target_date})` : '';
      lines.push(
        `- ${goal.name}: ${fmtUSD(goal.start_value)} → ${fmtUSD(goal.target_value)}, `
        + `${pct}% there, ${progress.verdict}${due}`,
      );
    });
  }

  if (lines.length === 1) {
    lines.push(
      'NO FINANCIAL DATA YET: the user has not added any accounts or logged any '
      + 'balances. You have ZERO real figures for them. Do NOT state, invent, '
      + 'estimate, or assume ANY dollar amounts, incomes, budgets, or balances. '
      + 'Warmly encourage them to add an account and log a balance so you can help '
      + 'with real numbers.',
    );
  }

  return lines.join('\n');
}
