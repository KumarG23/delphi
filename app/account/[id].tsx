import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  ACCOUNT_TYPE_LABELS,
  CATEGORY_LABELS,
  useAccounts,
} from '@/lib/accounts';
import { useAccountSnapshots, useDeleteSnapshot } from '@/lib/snapshots';
import { confirmDialog, infoDialog } from '@/lib/dialog';
import { fmtCurrencyFull, fmtTooltipDate } from '@/lib/format';
import { LogBalanceSheet } from '@/components/LogBalanceSheet';
import { EditAccountSheet } from '@/components/EditAccountSheet';
import { TrendChart } from '@/components/TrendChart';
import {
  categoryColor,
  components,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  themeDark,
  tint,
} from '@/constants/tokens';
import type { BalanceSnapshot } from '@/types/database';

const T = themeDark;

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const { data: accounts } = useAccounts();
  const account = (accounts ?? []).find((a) => a.id === id) ?? null;

  const { data: snapshots = [] } = useAccountSnapshots(id ?? '');
  const deleteSnapshot = useDeleteSnapshot();

  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Hooks are called unconditionally; conditional UI below.
  if (!account) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={T.textMuted} />
          </Pressable>
          <Text style={styles.headerTitle}>Account</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>Account not found.</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const color = categoryColor[account.category];
  const chartColor = account.category === 'debt' ? T.danger : T.primary;

  // Chart data: oldest → newest for the AreaChart trend.
  const chartData = [...snapshots]
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .map((s) => ({ value: s.balance, date: s.snapshot_date }));

  // Stats: total change since first (oldest) snapshot.
  let changeText: string | null = null;
  if (snapshots.length >= 2) {
    const newest = snapshots[0];
    const oldest = snapshots[snapshots.length - 1];
    const delta = (newest.balance ?? 0) - (oldest.balance ?? 0);
    const pct =
      (oldest.balance ?? 0) !== 0
        ? (delta / Math.abs(oldest.balance ?? 0)) * 100
        : 0;
    const sign = delta >= 0 ? '+' : '';
    changeText = `${sign}${fmtCurrencyFull(delta)} (${sign}${pct.toFixed(1)}%)`;
  }

  const showApr = account.category === 'debt' && account.apr != null;
  const showApy =
    (account.category === 'cash' || account.category === 'investment') &&
    account.apy != null;
  const showMinPayment = account.category === 'debt' && account.min_payment != null;
  const showDueDate = account.category === 'debt' && account.payment_due_date;

  async function handleDelete(snap: BalanceSnapshot) {
    if (!account) return;
    const confirmed = await confirmDialog(
      'Delete snapshot',
      `Delete the ${fmtTooltipDate(snap.snapshot_date)} balance entry? This cannot be undone.`,
      { confirmLabel: 'Delete', destructive: true },
    );
    if (!confirmed) return;

    try {
      await deleteSnapshot.mutateAsync({ id: snap.id, accountId: account.id });
    } catch (e) {
      await infoDialog('Error', (e as Error).message);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Custom header (no native header per spec) */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={T.textMuted} />
        </Pressable>
        <View style={styles.headerMain}>
          <Text style={styles.accountName} numberOfLines={1}>
            {account.nickname ?? account.name}
          </Text>
          {account.institution ? (
            <Text style={styles.institution} numberOfLines={1}>
              {account.institution}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.categoryPill,
            { backgroundColor: tint(color, 0.12), borderColor: tint(color, 0.35) },
          ]}
        >
          <Text style={[styles.categoryText, { color }]}>
            {CATEGORY_LABELS[account.category]}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current balance */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          <Text style={[styles.balanceValue, { color }]}>
            {account.latest_balance != null
              ? fmtCurrencyFull(account.latest_balance)
              : '—'}
          </Text>
          <Text style={styles.typeLabel}>
            {ACCOUNT_TYPE_LABELS[account.type]}
          </Text>
        </View>

        {/* Balance history + chart */}
        <Text style={styles.sectionLabel}>Balance history</Text>
        {chartData.length >= 2 ? (
          <View style={styles.chartContainer}>
            <TrendChart data={chartData} color={chartColor} />
          </View>
        ) : (
          <View style={styles.chartPlaceholder}>
            <Text style={styles.placeholderText}>
              {chartData.length === 0
                ? 'Log account balances to see your trend'
                : 'Log one more balance to start tracking your trend.'}
            </Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsCard}>
          {changeText && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Change</Text>
              <Text style={styles.statValue}>{changeText}</Text>
            </View>
          )}
          {showApr && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>APR</Text>
              <Text style={styles.statValue}>{account.apr}%</Text>
            </View>
          )}
          {showApy && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>APY</Text>
              <Text style={styles.statValue}>{account.apy}%</Text>
            </View>
          )}
          {showMinPayment && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Min payment</Text>
              <Text style={styles.statValue}>
                {fmtCurrencyFull(account.min_payment!)}
              </Text>
            </View>
          )}
          {showDueDate && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Due date</Text>
              <Text style={styles.statValue}>{account.payment_due_date}</Text>
            </View>
          )}
          {!changeText &&
            !showApr &&
            !showApy &&
            !showMinPayment &&
            !showDueDate && (
              <Text style={styles.statEmpty}>No additional stats</Text>
            )}
        </View>

        {/* Snapshots list (newest first) */}
        <Text style={styles.sectionLabel}>Snapshots</Text>
        <View style={styles.listCard}>
          {snapshots.length === 0 ? (
            <Text style={styles.emptyList}>No snapshots logged yet.</Text>
          ) : (
            snapshots.map((snap, idx) => {
              const isLast = idx === snapshots.length - 1;
              return (
                <View
                  key={snap.id}
                  style={[styles.snapshotRow, !isLast && styles.snapshotDivider]}
                >
                  <Text style={styles.snapshotDate}>
                    {fmtTooltipDate(snap.snapshot_date)}
                  </Text>
                  <Text style={[styles.snapshotBalance, { color }]}>
                    {fmtCurrencyFull(snap.balance)}
                  </Text>
                  <Pressable
                    onPress={() => handleDelete(snap)}
                    hitSlop={10}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color={T.danger} />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryAction,
              { backgroundColor: color },
              pressed && styles.pressed,
            ]}
            onPress={() => setLogOpen(true)}
          >
            <Text style={styles.primaryActionText}>Log balance</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && styles.pressed,
            ]}
            onPress={() => setEditOpen(true)}
          >
            <Text style={styles.secondaryActionText}>Edit</Text>
          </Pressable>
        </View>

        <View style={{ height: space['16'] }} />
      </ScrollView>

      {/* Reused sheets (no new tables) */}
      <LogBalanceSheet
        account={account}
        visible={logOpen}
        onClose={() => setLogOpen(false)}
      />
      <EditAccountSheet
        account={account}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
    gap: space['3'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  backBtn: {
    padding: space['2'],
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: T.text,
  },
  accountName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  institution: {
    fontSize: fontSize.sm,
    color: T.textMuted,
    marginTop: 1,
  },
  categoryPill: {
    paddingHorizontal: space['3'],
    paddingVertical: space['1'],
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase',
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: space['6'],
    paddingBottom: space['12'],
  },

  balanceSection: {
    paddingTop: space['6'],
    paddingBottom: space['4'],
  },
  balanceLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: T.textMuted,
    letterSpacing: letterSpacing.widest,
  },
  balanceValue: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.extrabold,
    letterSpacing: letterSpacing.tightest,
    lineHeight: 46,
  },
  typeLabel: {
    fontSize: fontSize.sm,
    color: T.textMuted,
    marginTop: space['1'],
  },

  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: T.textMuted,
    letterSpacing: letterSpacing.widest,
    marginTop: space['6'],
    marginBottom: space['3'],
  },

  chartContainer: {
    height: 220,
    marginBottom: space['4'],
  },
  chartPlaceholder: {
    height: 160,
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['8'],
    marginBottom: space['4'],
  },
  placeholderText: {
    fontSize: fontSize.sm,
    color: T.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },

  statsCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['4'],
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    padding: space['4'],
    marginBottom: space['6'],
  },
  statItem: {
    minWidth: 110,
  },
  statLabel: {
    fontSize: fontSize.micro,
    color: T.textMuted,
    letterSpacing: letterSpacing.wide,
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.text,
    marginTop: space['1'],
  },
  statEmpty: {
    fontSize: fontSize.sm,
    color: T.textDim,
    fontStyle: 'italic',
  },

  listCard: {
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    marginBottom: space['6'],
  },
  emptyList: {
    padding: space['6'],
    color: T.textDim,
    fontSize: fontSize.sm,
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
    gap: space['3'],
  },
  snapshotDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  snapshotDate: {
    flex: 1,
    fontSize: fontSize.md,
    color: T.text,
  },
  snapshotBalance: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    minWidth: 90,
    textAlign: 'right',
  },
  deleteBtn: {
    padding: space['2'],
    marginLeft: space['2'],
  },

  actions: {
    flexDirection: 'row',
    gap: space['3'],
    marginTop: space['4'],
  },
  primaryAction: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: T.primaryFg,
    letterSpacing: letterSpacing.wide,
  },
  secondaryAction: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.text,
    letterSpacing: letterSpacing.wide,
  },
  pressed: { opacity: 0.7 },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space['8'],
    gap: space['4'],
  },
  notFoundText: {
    fontSize: fontSize.lg,
    color: T.textMuted,
  },
  backLink: {
    fontSize: fontSize.md,
    color: T.primary,
    fontWeight: fontWeight.semibold,
  },
});
