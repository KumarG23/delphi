import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAnimatedReaction, useSharedValue, runOnJS } from 'react-native-reanimated';
import { CartesianChart, Area, Line, useChartPressState } from 'victory-native';

import { infoDialog } from '@/lib/dialog';

import {
  categoryColor,
  components,
  fontSize,
  fontWeight,
  letterSpacing,
  palette,
  radius,
  space,
  themeDark,
  tint,
} from '@/constants/tokens';
import { useNetWorthHistory } from '@/lib/dashboard';
import { useAccounts, ACCOUNT_TYPE_LABELS, CATEGORY_LABELS } from '@/lib/accounts';
import { useProfile } from '@/lib/settings';
import { AddAccountSheet } from '@/components/AddAccountSheet';
import { BulkLogSheet } from '@/components/BulkLogSheet';
import DelphiAvatar from '@/components/DelphiAvatar';
import type { AccountCategory, AccountSummary } from '@/types/database';

// ─── Types ──────────────────────────────────────────────────────────────────

type Mode = 'wealth' | 'debt';
type Range = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

const RANGE_DAYS: Record<Range, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  'ALL': Infinity,
};

const RANGES: Range[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];
const BUCKETS: AccountCategory[] = ['debt', 'cash', 'investment'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const T = themeDark;

function fmtCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function fmtCurrencyFull(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

// ─── Account Row ─────────────────────────────────────────────────────────────

interface AccountRowProps {
  account: AccountSummary;
  isHighestAprDebt: boolean;
  isLast: boolean;
}

function DashboardAccountRow({ account, isHighestAprDebt, isLast }: AccountRowProps) {
  const color = categoryColor[account.category];
  const displayName = account.nickname ?? account.name;

  let subLine: string;
  if (account.category === 'debt' && account.apr != null) {
    subLine = `${account.apr}% APR`;
  } else if (account.category === 'cash' && account.apy != null) {
    subLine = `${account.apy}% APY`;
  } else {
    subLine = ACCOUNT_TYPE_LABELS[account.type];
  }

  return (
    <View
      style={[
        styles.accountRow,
        isHighestAprDebt && styles.accountRowHighlighted,
        !isLast && styles.accountRowDivider,
      ]}
    >
      <View style={[styles.accountDot, { backgroundColor: color }]} />
      <View style={styles.accountInfo}>
        <Text style={styles.accountName} numberOfLines={1}>
          {isHighestAprDebt ? '🔥 ' : ''}{displayName}
        </Text>
        <Text style={styles.accountSub}>{subLine}</Text>
      </View>
      <Text style={[styles.accountBalance, { color }]}>
        {account.latest_balance != null ? fmtCurrency(account.latest_balance) : '—'}
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  // State
  const [mode, setMode] = useState<Mode>('wealth');
  const [range, setRange] = useState<Range>('1M');
  const [activeBucket, setActiveBucket] = useState<AccountCategory>('debt');
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [heroDisplayValue, setHeroDisplayValue] = useState(0);

  // Data
  const { data: netWorthHistory } = useNetWorthHistory();
  const { data: accounts } = useAccounts();
  const { data: profile } = useProfile();

  // Greeting: time-of-day + display name
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const period =
      hour >= 5 && hour < 12 ? 'Good morning'
      : hour >= 12 && hour < 18 ? 'Good afternoon'
      : 'Good evening';
    const name = profile?.display_name?.trim();
    return name ? `${period}, ${name}` : 'Hello';
  }, [profile?.display_name]);

  // Chart press state
  const { state: chartState, isActive: chartIsActive } = useChartPressState({
    x: 0,
    y: { value: 0 },
  });
  const latestValueShared = useSharedValue(0);

  // Filtered chart data
  const chartData = useMemo(() => {
    if (!netWorthHistory?.length) return [];
    const now = Date.now();
    const days = RANGE_DAYS[range];
    const cutoff = now - days * 86400000;
    return netWorthHistory
      .filter(p =>
        days === Infinity || new Date(p.snapshot_date).getTime() >= cutoff
      )
      .map((p, i) => ({
        x: i,
        value: mode === 'wealth' ? p.net_worth : p.total_debt,
        date: p.snapshot_date,
      }));
  }, [netWorthHistory, range, mode]);

  // Keep hero value and shared value in sync with chart data
  useEffect(() => {
    const last = chartData[chartData.length - 1]?.value ?? 0;
    latestValueShared.value = last;
    setHeroDisplayValue(last);
  }, [chartData]);

  // Scrub interaction: update hero while pressing, restore on release
  useAnimatedReaction(
    () => ({ active: chartIsActive.value, val: chartState.y.value.value }),
    ({ active, val }) => {
      runOnJS(setHeroDisplayValue)(active ? val : latestValueShared.value);
    }
  );

  // Change calculation (first to last of filtered data)
  const changeInfo = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    const delta = last - first;
    const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;
    return { delta, pct };
  }, [chartData]);

  // Mode color
  const modeColor = mode === 'wealth' ? T.primary : T.danger;

  // Bucket totals
  const bucketTotals = useMemo(() => {
    if (!accounts) return { debt: 0, cash: 0, investment: 0 };
    return accounts.reduce<Record<AccountCategory, number>>(
      (acc, a) => {
        acc[a.category] = (acc[a.category] ?? 0) + (a.latest_balance ?? 0);
        return acc;
      },
      { debt: 0, cash: 0, investment: 0 }
    );
  }, [accounts]);

  // Accounts for active bucket
  const bucketAccounts = useMemo(
    () => accounts?.filter(a => a.category === activeBucket) ?? [],
    [accounts, activeBucket]
  );

  // Highest-APR debt account
  const highestAprDebtId = useMemo(() => {
    if (!accounts) return null;
    const debtWithApr = accounts.filter(
      a => a.category === 'debt' && a.apr != null
    );
    if (!debtWithApr.length) return null;
    return debtWithApr.reduce((best, a) =>
      (a.apr ?? 0) > (best.apr ?? 0) ? a : best
    ).id;
  }, [accounts]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>

          {/* ── 1. Header ───────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarTile}>
                <DelphiAvatar size={28} />
              </View>
              <View>
                <Text style={styles.wordmark}>Delphi</Text>
                <Text style={styles.greeting} numberOfLines={1}>
                  {greeting}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setBulkOpen(true)}
              style={styles.headerIcon}
              hitSlop={8}
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color={T.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* ── 2. Hero Section ─────────────────────────────────────────── */}
          <View style={styles.heroSection}>
            {/* Mode toggle pills */}
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[
                  styles.modePill,
                  mode === 'wealth' && { backgroundColor: T.primary },
                ]}
                onPress={() => setMode('wealth')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.modePillText,
                    mode === 'wealth'
                      ? { color: T.primaryFg }
                      : { color: T.textDim },
                  ]}
                >
                  Wealth
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modePill,
                  mode === 'debt' && { backgroundColor: T.danger },
                ]}
                onPress={() => setMode('debt')}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.modePillText,
                    mode === 'debt'
                      ? { color: T.text }
                      : { color: T.textDim },
                  ]}
                >
                  Debt
                </Text>
              </TouchableOpacity>
            </View>

            {/* Hero number */}
            <Text style={[styles.heroValue, { color: modeColor }]}>
              {chartData.length > 0 ? fmtCurrencyFull(heroDisplayValue) : '—'}
            </Text>

            {/* Change line */}
            {changeInfo && !chartIsActive.value && (
              <View style={styles.changeRow}>
                <Text
                  style={[
                    styles.changeText,
                    { color: changeInfo.delta >= 0 ? T.primary : T.danger },
                  ]}
                >
                  {changeInfo.delta >= 0 ? '▲' : '▼'}{' '}
                  {fmtCurrency(Math.abs(changeInfo.delta))}{' '}
                  ({Math.abs(changeInfo.pct).toFixed(1)}%)
                </Text>
              </View>
            )}
          </View>

          {/* ── 3. Chart Section ────────────────────────────────────────── */}
          <View style={styles.chartContainer}>
            {chartData.length > 1 ? (
              <CartesianChart
                data={chartData}
                xKey="x"
                yKeys={['value']}
                chartPressState={chartState}
                domainPadding={{ top: 30, left: 8, right: 8, bottom: 0 }}
                axisOptions={{
                  labelColor: 'transparent',
                  lineColor: 'transparent',
                  tickCount: { x: 0, y: 0 },
                }}
              >
                {({ points, chartBounds }) => (
                  <>
                    <Area
                      points={points.value}
                      y0={chartBounds.bottom}
                      color={modeColor}
                      opacity={0.15}
                      animate={{ type: 'spring', duration: 400 }}
                    />
                    <Line
                      points={points.value}
                      color={modeColor}
                      strokeWidth={2.5}
                      animate={{ type: 'spring', duration: 400 }}
                    />
                  </>
                )}
              </CartesianChart>
            ) : (
              <View style={styles.chartPlaceholder}>
                <Text style={styles.chartPlaceholderText}>
                  Log account balances to see your trend
                </Text>
              </View>
            )}
          </View>

          {/* Range pills */}
          <View style={styles.rangeRow}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.rangePill,
                  range === r && styles.rangePillActive,
                ]}
                onPress={() => setRange(r)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.rangePillText,
                    { color: range === r ? T.text : T.textMuted },
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── 4. Bucket Strip ─────────────────────────────────────────── */}
          <View style={styles.bucketStrip}>
            {BUCKETS.map(cat => {
              const isActive = activeBucket === cat;
              const color = categoryColor[cat];
              const label =
                cat === 'debt'
                  ? 'DEBT'
                  : cat === 'cash'
                  ? 'CASH'
                  : 'INVESTMENTS';
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.bucketCol,
                    isActive && {
                      borderBottomWidth: 2,
                      borderBottomColor: color,
                    },
                  ]}
                  onPress={() => setActiveBucket(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bucketLabel, { color }]}>{label}</Text>
                  <Text style={[styles.bucketTotal, { color }]}>
                    {fmtCurrency(bucketTotals[cat])}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── 5. Account List ─────────────────────────────────────────── */}
          <View style={styles.accountCard}>
            {bucketAccounts.length > 0 ? (
              bucketAccounts.map((account, idx) => (
                <DashboardAccountRow
                  key={account.id}
                  account={account}
                  isHighestAprDebt={account.id === highestAprDebtId}
                  isLast={idx === bucketAccounts.length - 1}
                />
              ))
            ) : (
              <View style={styles.emptyBucket}>
                <Text style={styles.emptyBucketText}>
                  No {CATEGORY_LABELS[activeBucket]} accounts yet
                </Text>
                <TouchableOpacity
                  onPress={() => setAddOpen(true)}
                  hitSlop={8}
                >
                  <Text style={styles.emptyBucketAdd}>+  Add account</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── 6. Reminder Banner ──────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.reminderCard}
            onPress={() => setBulkOpen(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.reminderText}>
              📅  Next check-in: log balances when ready
            </Text>
            <Ionicons name="chevron-forward" size={16} color={T.textDim} />
          </TouchableOpacity>

          {/* ── 7. Ask Delphi CTA ───────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.delphiCard}
            onPress={() => {
              infoDialog('Coming soon', 'Ask Delphi is coming in Phase 2.');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.delphiLeft}>
              <Text style={styles.delphiSparkle}>✨</Text>
              <View>
                <Text style={styles.delphiTitle}>Ask Delphi</Text>
                <Text style={styles.delphiSub}>Coming in Phase 2</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={palette.gold} />
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Sheets */}
      <AddAccountSheet visible={addOpen} onClose={() => setAddOpen(false)} />
      <BulkLogSheet visible={bulkOpen} onClose={() => setBulkOpen(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: T.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: space['16'] + 60,
  },
  inner: {
    maxWidth: components.dashboardMaxWidth,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: space['10'],
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space['10'],
    paddingBottom: space['8'],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['5'],
  },
  avatarTile: {
    width: components.avatar.md,
    height: components.avatar.md,
    borderRadius: radius.lg,
    backgroundColor: T.cardSoft,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  greeting: {
    fontSize: fontSize.micro,
    color: T.textMuted,
    marginTop: -space['1'],
  },
  headerIcon: {
    width: components.hitTarget,
    height: components.hitTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroSection: {
    paddingTop: space['6'],
    paddingBottom: space['8'],
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: space['4'],
    marginBottom: space['10'],
  },
  modePill: {
    paddingHorizontal: space['10'],
    paddingVertical: space['4'],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: T.border,
  },
  modePillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wide,
  },
  heroValue: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.extrabold,
    letterSpacing: letterSpacing.tightest,
    lineHeight: 46,
  },
  changeRow: {
    marginTop: space['4'],
  },
  changeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },

  // ── Chart ─────────────────────────────────────────────────────────────────
  chartContainer: {
    height: 220,
    marginBottom: space['6'],
  },
  chartPlaceholder: {
    flex: 1,
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['12'],
  },
  chartPlaceholderText: {
    fontSize: fontSize.sm,
    color: T.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space['12'],
  },
  rangePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space['4'],
    borderRadius: radius.md,
  },
  rangePillActive: {
    backgroundColor: T.cardSoft,
  },
  rangePillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wide,
  },

  // ── Bucket Strip ──────────────────────────────────────────────────────────
  bucketStrip: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: T.border,
    marginBottom: space['4'],
  },
  bucketCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space['10'],
    paddingBottom: space['8'],
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  bucketLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.widest,
    marginBottom: space['3'],
  },
  bucketTotal: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },

  // ── Account List ──────────────────────────────────────────────────────────
  accountCard: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: space['10'],
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space['10'],
    paddingHorizontal: space['10'],
    gap: space['8'],
  },
  accountRowHighlighted: {
    borderLeftWidth: 3,
    borderLeftColor: palette.gold,
  },
  accountRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  accountInfo: {
    flex: 1,
    gap: space['1'],
  },
  accountName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  accountSub: {
    fontSize: fontSize.sm,
    color: T.textMuted,
    fontWeight: fontWeight.regular,
  },
  accountBalance: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.tight,
  },
  emptyBucket: {
    paddingVertical: space['16'],
    paddingHorizontal: space['12'],
    alignItems: 'center',
    gap: space['6'],
  },
  emptyBucketText: {
    fontSize: fontSize.sm,
    color: T.textDim,
  },
  emptyBucketAdd: {
    fontSize: fontSize.sm,
    color: T.primary,
    fontWeight: fontWeight.semibold,
  },

  // ── Reminder Banner ───────────────────────────────────────────────────────
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T.cardSoft,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: radius.xl,
    paddingVertical: space['10'],
    paddingHorizontal: space['12'],
    marginBottom: space['10'],
  },
  reminderText: {
    fontSize: fontSize.sm,
    color: T.textMuted,
    fontWeight: fontWeight.medium,
    flex: 1,
  },

  // ── Ask Delphi ────────────────────────────────────────────────────────────
  delphiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tint(palette.gold, 0.06),
    borderWidth: 1,
    borderColor: tint(palette.gold, 0.3),
    borderRadius: radius.xl,
    paddingVertical: space['12'],
    paddingHorizontal: space['12'],
    marginBottom: space['8'],
  },
  delphiLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['10'],
  },
  delphiSparkle: {
    fontSize: fontSize['2xl'],
  },
  delphiTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: palette.gold,
    letterSpacing: letterSpacing.tight,
  },
  delphiSub: {
    fontSize: fontSize.sm,
    color: tint(palette.gold, 0.6),
    marginTop: space['1'],
  },
});
