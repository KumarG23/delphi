import type { AccountSummary, MonthlyCashflow, NetWorthPoint } from '@/types/database';
import type { Goal, GoalProgress } from '@/lib/goals';

export interface FinancialContextInput {
  accounts?: AccountSummary[] | null;
  netWorthHistory?: NetWorthPoint[] | null;
  cashflow?: MonthlyCashflow | null;
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

function dateNDaysAgo(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Build a compact, token-light text block summarizing the user's financial
 * situation. This becomes a 'system' message sent with each chat turn.
 * Persona lives in the Modelfile; we only send this runtime context.
 */
export function buildFinancialContext(input: FinancialContextInput): string {
  const { accounts, netWorthHistory, cashflow } = input;
  const lines: string[] = [];

  // Today's date (helps the model reason about "this month", freshness, etc.)
  const today = new Date().toISOString().split('T')[0];
  lines.push(`Today's date: ${today}`);

  // Net worth (latest) + 30-day change from history
  if (netWorthHistory && netWorthHistory.length > 0) {
    const latest = netWorthHistory[netWorthHistory.length - 1];
    lines.push(`Net worth: ${fmtUSD(latest.net_worth)}`);

    if (netWorthHistory.length >= 2) {
      const latestDate = latest.snapshot_date;
      const thirtyAgo = dateNDaysAgo(latestDate, 30);

      // Find the most recent history point on or before 30 days ago (or fall back to first)
      let prev = netWorthHistory[0];
      for (const p of netWorthHistory) {
        if (p.snapshot_date <= thirtyAgo) {
          prev = p;
        } else {
          break;
        }
      }

      if (prev.snapshot_date !== latestDate) {
        const delta = latest.net_worth - prev.net_worth;
        const pct = prev.net_worth !== 0 ? (delta / Math.abs(prev.net_worth)) * 100 : 0;
        const sign = delta >= 0 ? '+' : '';
        lines.push(`30-day change: ${sign}${fmtUSD(delta)} (${sign}${pct.toFixed(1)}%)`);
      }
    }
  }

  // Bucket totals + counts, plus largest debt detail (with APR if present)
  if (accounts && accounts.length > 0) {
    let debtTotal = 0;
    let cashTotal = 0;
    let investmentTotal = 0;
    let debtCount = 0;
    let cashCount = 0;
    let investmentCount = 0;

    let largestDebt: AccountSummary | null = null;

    for (const a of accounts) {
      const bal = a.latest_balance ?? 0;
      if (a.category === 'debt') {
        debtTotal += bal;
        debtCount += 1;
        if (bal > 0 && (!largestDebt || bal > (largestDebt.latest_balance ?? 0))) {
          largestDebt = a;
        }
      } else if (a.category === 'cash') {
        cashTotal += bal;
        cashCount += 1;
      } else if (a.category === 'investment') {
        investmentTotal += bal;
        investmentCount += 1;
      }
    }

    lines.push(`Debt total: ${fmtUSD(debtTotal)} (${debtCount} accounts)`);
    lines.push(`Cash total: ${fmtUSD(cashTotal)} (${cashCount} accounts)`);
    lines.push(`Investments total: ${fmtUSD(investmentTotal)} (${investmentCount} accounts)`);

    if (largestDebt && largestDebt.latest_balance != null) {
      const name = largestDebt.nickname?.trim() || largestDebt.name;
      let s = `Largest debt: ${name} ${fmtUSD(largestDebt.latest_balance)}`;
      if (largestDebt.apr != null) {
        s += ` @ ${largestDebt.apr}% APR`;
      }
      lines.push(s);
    }
  }

  // Current month's cashflow (if the view has a row for this month)
  if (cashflow) {
    lines.push(
      `This month's cashflow: income ${fmtUSD(cashflow.total_income)}, ` +
      `expense ${fmtUSD(cashflow.total_expense)}, net ${fmtUSD(cashflow.net_cashflow)}`
    );
  }

  // Active goals (token-light summary; cap ~5). Net-worth uses accumulate + account_id=null.
  const goals = input.goals ?? [];
  if (goals.length > 0) {
    lines.push('Goals:');
    goals.slice(0, 5).forEach(({ goal, progress }) => {
      const pct = Math.round(progress.pct);
      const due = goal.target_date ? ` (due ${goal.target_date})` : '';
      lines.push(
        `- ${goal.name}: ${fmtUSD(goal.start_value)} → ${fmtUSD(goal.target_value)}, ` +
        `${pct}% there, ${progress.verdict}${due}`
      );
    });
  }

  return lines.join('\n');
}
