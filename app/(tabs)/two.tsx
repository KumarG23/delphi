import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddTransactionSheet } from '@/components/AddTransactionSheet';
import { StatementImportSheet } from '@/components/StatementImportSheet';
import { useMonthlySpending, useCashflowHistory, useCurrentCashflow } from '@/lib/spending';
import { useTransactions } from '@/lib/transactions';
import {
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  themeDark,
  tint,
} from '@/constants/tokens';
import type { Transaction } from '@/types/database';

const T = themeDark;

// ─── helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym: string): string {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }).format(
    new Date(ym + '-15'),
  );
}

function shortMonth(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(isoDate));
}

function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(iso + 'T12:00:00'),
  );
}

type KindFilter = 'all' | 'expense' | 'income';

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function KindPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      hitSlop={6}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ─── screen ──────────────────────────────────────────────────────────────────

export default function SpendingScreen() {
  const [selectedMonth, setSelectedMonth] = useState<string>(today());
  const [addOpen, setAddOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [showAll, setShowAll] = useState(false);

  const lastMonth = useMemo(() => prevMonth(selectedMonth), [selectedMonth]);

  const { data: cashflow, isLoading: cfLoading } = useCurrentCashflow(selectedMonth);
  const { data: spending, isLoading: spendLoading } = useMonthlySpending(selectedMonth);
  const { data: lastSpending } = useMonthlySpending(lastMonth);
  const { data: history } = useCashflowHistory();
  const { data: transactions, isLoading: txLoading } = useTransactions({ month: selectedMonth });

  // Month navigation bounds — allow up to 12 months back from today
  const minMonth = useMemo(() => {
    const [y, m] = today().split('-').map(Number);
    const d = new Date(y, m - 13, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const maxMonth = today();

  const canGoPrev = selectedMonth > minMonth;
  const canGoNext = selectedMonth < maxMonth;

  // Expense categories only, sorted by total desc
  const expenseRows = useMemo(
    () => (spending ?? []).filter((r) => r.category_type === 'expense'),
    [spending],
  );
  const totalExpenses = useMemo(
    () => expenseRows.reduce((s, r) => s + r.total, 0),
    [expenseRows],
  );

  // Last-month lookup map
  const lastSpendMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of lastSpending ?? []) {
      if (r.category_id) m[r.category_id] = r.total;
    }
    return m;
  }, [lastSpending]);

  // Cash flow trend — last 6 months from history
  const trendData = useMemo(() => {
    const h = history ?? [];
    return h.slice(-6);
  }, [history]);
  const trendMax = useMemo(
    () =>
      Math.max(1, ...trendData.map((r) => Math.max(r.total_income, r.total_expense))),
    [trendData],
  );

  // Filtered & capped transactions
  const filteredTx = useMemo(() => {
    const all = transactions ?? [];
    if (kindFilter === 'expense') return all.filter((t) => t.kind === 'expense');
    if (kindFilter === 'income') return all.filter((t) => t.kind === 'income');
    return all;
  }, [transactions, kindFilter]);
  const displayedTx = showAll ? filteredTx : filteredTx.slice(0, 25);
  const hasMore = filteredTx.length > 25 && !showAll;

  const isLoading = cfLoading || spendLoading || txLoading;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Spending</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.75 }]}
            onPress={() => setStatementOpen(true)}
            hitSlop={8}
          >
            <Text style={styles.importBtnIcon}>⇩</Text>
            <Text style={styles.importBtnText}>Statement</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.headerFab, pressed && { opacity: 0.75 }]}
            onPress={() => setAddOpen(true)}
            hitSlop={8}
          >
            <Text style={styles.headerFabPlus}>+</Text>
          </Pressable>
        </View>
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color={T.primary} size="large" />
        </View>
      )}

      {!isLoading && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* ── Month selector ── */}
          <View style={styles.monthRow}>
            <Pressable
              style={({ pressed }) => [styles.arrowBtn, !canGoPrev && styles.arrowDisabled, pressed && { opacity: 0.6 }]}
              onPress={() => canGoPrev && setSelectedMonth(prevMonth(selectedMonth))}
              disabled={!canGoPrev}
              hitSlop={8}
            >
              <Text style={[styles.arrowText, !canGoPrev && { color: T.textDim }]}>{'←'}</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel(selectedMonth)}</Text>
            <Pressable
              style={({ pressed }) => [styles.arrowBtn, !canGoNext && styles.arrowDisabled, pressed && { opacity: 0.6 }]}
              onPress={() => canGoNext && setSelectedMonth(nextMonth(selectedMonth))}
              disabled={!canGoNext}
              hitSlop={8}
            >
              <Text style={[styles.arrowText, !canGoNext && { color: T.textDim }]}>{'→'}</Text>
            </Pressable>
          </View>

          {/* ── Cash Flow Hero ── */}
          <View style={styles.card}>
            {cashflow ? (
              <View style={styles.heroRow}>
                <View style={styles.heroCol}>
                  <Text style={styles.heroLabel}>INCOME</Text>
                  <Text style={[styles.heroValue, { color: T.primary }]}>
                    {fmtUSD(cashflow.total_income)}
                  </Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroCol}>
                  <Text style={styles.heroLabel}>EXPENSES</Text>
                  <Text style={[styles.heroValue, { color: T.danger }]}>
                    {fmtUSD(cashflow.total_expense)}
                  </Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroCol}>
                  <Text style={styles.heroLabel}>NET</Text>
                  <Text
                    style={[
                      styles.heroValue,
                      { color: cashflow.net_cashflow >= 0 ? T.primary : T.danger },
                    ]}
                  >
                    {cashflow.net_cashflow >= 0 ? '+' : ''}
                    {fmtUSD(cashflow.net_cashflow)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyNote}>No cashflow data for this month.</Text>
            )}
          </View>

          {/* ── Spending by Category ── */}
          <SectionLabel label="WHERE IT WENT" />
          <View style={styles.card}>
            {expenseRows.length === 0 ? (
              <Text style={styles.emptyNote}>No expense data for this month.</Text>
            ) : (
              expenseRows.map((row) => {
                const pct = totalExpenses > 0 ? (row.total / totalExpenses) * 100 : 0;
                const barColor = row.category_color ?? T.textMuted;
                return (
                  <View key={row.category_id ?? row.category_name} style={styles.catRow}>
                    <View style={styles.catRowTop}>
                      <Text style={styles.catName} numberOfLines={1}>
                        {row.category_name ?? 'Uncategorized'}
                      </Text>
                      <Text style={styles.catAmount}>{fmtUSD(row.total)}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { backgroundColor: barColor, width: `${pct}%` as any },
                        ]}
                      />
                    </View>
                    <Text style={styles.catPct}>{pct.toFixed(0)}%</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* ── Month-over-month ── */}
          {expenseRows.length > 0 && (
            <>
              <SectionLabel label={`VS ${monthLabel(lastMonth).toUpperCase()}`} />
              <View style={styles.card}>
                <View style={styles.momGrid}>
                  {expenseRows.map((row) => {
                    const prevAmt = row.category_id ? (lastSpendMap[row.category_id] ?? 0) : 0;
                    const delta = row.total - prevAmt;
                    const sign = delta >= 0 ? '+' : '';
                    const col = delta <= 0 ? T.primary : T.danger;
                    return (
                      <View key={row.category_id ?? row.category_name} style={styles.momRow}>
                        <Text style={styles.momCatName} numberOfLines={1}>
                          {row.category_name ?? 'Uncategorized'}
                        </Text>
                        <Text style={[styles.momDelta, { color: col }]}>
                          {sign}{fmtUSD(delta)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* ── Cash Flow Trend ── */}
          {trendData.length > 0 && (
            <>
              <SectionLabel label="CASH FLOW TREND" />
              <View style={styles.card}>
                <View style={styles.trendChart}>
                  {trendData.map((row) => {
                    const incomeH = (row.total_income / trendMax) * 80;
                    const expenseH = (row.total_expense / trendMax) * 80;
                    return (
                      <View key={row.month} style={styles.trendBar}>
                        <View style={styles.trendBars}>
                          <View
                            style={[
                              styles.trendBarIncome,
                              { height: Math.max(2, incomeH) },
                            ]}
                          />
                          <View
                            style={[
                              styles.trendBarExpense,
                              { height: Math.max(2, expenseH) },
                            ]}
                          />
                        </View>
                        <Text style={styles.trendMonth}>{shortMonth(row.month)}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.trendLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: T.primary }]} />
                    <Text style={styles.legendLabel}>Income</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: T.danger }]} />
                    <Text style={styles.legendLabel}>Expenses</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* ── Recent Transactions ── */}
          <View style={styles.txHeader}>
            <SectionLabel label={`TRANSACTIONS${transactions ? ` (${filteredTx.length})` : ''}`} />
          </View>
          <View style={styles.kindRow}>
            <KindPill label="All" active={kindFilter === 'all'} onPress={() => setKindFilter('all')} />
            <KindPill label="Expenses" active={kindFilter === 'expense'} onPress={() => setKindFilter('expense')} />
            <KindPill label="Income" active={kindFilter === 'income'} onPress={() => setKindFilter('income')} />
          </View>

          <View style={styles.card}>
            {displayedTx.length === 0 ? (
              <Text style={styles.emptyNote}>
                No transactions this month. Tap + to add one.
              </Text>
            ) : (
              displayedTx.map((tx: Transaction, i) => (
                <View key={tx.id}>
                  <View style={styles.txRow}>
                    <Text style={styles.txDate}>{fmtDate(tx.transaction_date)}</Text>
                    <Text style={styles.txMerchant} numberOfLines={1}>
                      {tx.merchant ?? tx.description ?? '—'}
                    </Text>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: tx.kind === 'income' ? T.primary : T.danger },
                      ]}
                    >
                      {tx.kind === 'income' ? '+' : '-'}{fmtUSD(tx.amount)}
                    </Text>
                  </View>
                  {i < displayedTx.length - 1 && <View style={styles.txDivider} />}
                </View>
              ))
            )}
            {hasMore && (
              <Pressable
                style={styles.showAllBtn}
                onPress={() => setShowAll(true)}
                hitSlop={8}
              >
                <Text style={styles.showAllText}>
                  Show all {filteredTx.length} transactions
                </Text>
              </Pressable>
            )}
          </View>

          <View style={{ height: 88 }} />
        </ScrollView>
      )}

      {/* ── FAB ── */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setAddOpen(true)}
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>

      <AddTransactionSheet visible={addOpen} onClose={() => setAddOpen(false)} />
      <StatementImportSheet visible={statementOpen} onClose={() => setStatementOpen(false)} />
    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['8'],
    paddingTop: space['6'],
    paddingBottom: space['4'],
  },
  screenTitle: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.extrabold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
  },
  importBtn: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space['3'],
    gap: space['2'],
  },
  importBtnIcon: {
    color: T.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  importBtnText: {
    color: T.text,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  headerFab: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerFabPlus: {
    fontSize: fontSize['2xl'],
    color: T.primaryFg,
    lineHeight: 28,
    marginTop: -1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: space['8'],
    gap: space['4'],
  },
  // Month selector
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['2'],
    marginBottom: space['2'],
  },
  arrowBtn: {
    padding: space['4'],
  },
  arrowDisabled: {
    opacity: 0.35,
  },
  arrowText: {
    fontSize: fontSize.xl,
    color: T.text,
    fontWeight: fontWeight.semibold,
  },
  monthLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  // Cards
  card: {
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    padding: space['8'],
    gap: space['4'],
  },
  // Hero row
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroCol: {
    flex: 1,
    alignItems: 'center',
    gap: space['2'],
  },
  heroDivider: {
    width: 1,
    backgroundColor: T.border,
    marginVertical: space['2'],
  },
  heroLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.widest,
    color: T.textMuted,
  },
  heroValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
  },
  // Section labels
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.widest,
    color: T.textMuted,
    paddingHorizontal: space['2'],
    marginBottom: -space['2'],
    marginTop: space['4'],
  },
  // Category rows
  catRow: {
    gap: space['2'],
  },
  catRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: T.text,
    flex: 1,
    marginRight: space['4'],
  },
  catAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.text,
  },
  barTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: T.bg,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: radius.pill,
  },
  catPct: {
    fontSize: fontSize.xs,
    color: T.textMuted,
  },
  // MoM
  momGrid: {
    gap: space['3'],
  },
  momRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  momCatName: {
    fontSize: fontSize.sm,
    color: T.textMuted,
    flex: 1,
    marginRight: space['4'],
  },
  momDelta: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  // Trend chart
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 100,
    gap: space['2'],
  },
  trendBar: {
    flex: 1,
    alignItems: 'center',
    gap: space['2'],
  },
  trendBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  trendBarIncome: {
    width: 8,
    backgroundColor: T.primary,
    borderRadius: radius.sm,
  },
  trendBarExpense: {
    width: 8,
    backgroundColor: T.danger,
    borderRadius: radius.sm,
  },
  trendMonth: {
    fontSize: fontSize.xs,
    color: T.textMuted,
    marginTop: space['1'],
  },
  trendLegend: {
    flexDirection: 'row',
    gap: space['8'],
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  legendLabel: {
    fontSize: fontSize.xs,
    color: T.textMuted,
  },
  // Transactions
  txHeader: {
    marginBottom: -space['2'],
  },
  kindRow: {
    flexDirection: 'row',
    gap: space['2'],
    paddingHorizontal: space['2'],
  },
  pill: {
    paddingHorizontal: space['6'],
    paddingVertical: space['2'],
    borderRadius: radius.pill,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
  },
  pillActive: {
    backgroundColor: tint(T.primary, 0.15),
    borderColor: T.primary,
  },
  pillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: T.textMuted,
  },
  pillTextActive: {
    color: T.primary,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
    paddingVertical: space['3'],
  },
  txDate: {
    fontSize: fontSize.xs,
    color: T.textMuted,
    width: 52,
    flexShrink: 0,
  },
  txMerchant: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.text,
  },
  txAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    flexShrink: 0,
  },
  txDivider: {
    height: 1,
    backgroundColor: T.border,
  },
  showAllBtn: {
    paddingTop: space['4'],
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  showAllText: {
    fontSize: fontSize.sm,
    color: T.primary,
    fontWeight: fontWeight.medium,
  },
  emptyNote: {
    fontSize: fontSize.sm,
    color: T.textMuted,
    textAlign: 'center',
    paddingVertical: space['4'],
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: space['8'],
    right: space['8'],
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: { opacity: 0.85 },
  fabPlus: {
    fontSize: 28,
    color: T.primaryFg,
    lineHeight: 32,
    marginTop: -2,
  },
});
