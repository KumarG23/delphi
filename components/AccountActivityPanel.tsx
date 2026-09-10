import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fontSize, fontWeight, letterSpacing, radius, space, themeDark, tint } from '@/constants/tokens';
import { infoDialog } from '@/lib/dialog';
import { fmtCurrencyFull, fmtTooltipDate } from '@/lib/format';
import {
  syncPlaidAccount,
  usePlaidAccountStatus,
  usePlaidRefresh,
} from '@/lib/plaid';
import { useCategories, useRecentAccountTransactions } from '@/lib/transactions';
import type { Transaction } from '@/types/database';

const T = themeDark;

function syncAge(value: string | null | undefined): string {
  if (!value) return 'Connected — sync to refresh activity';

  const elapsedMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 'Synced recently';

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Synced ${hours} hr${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `Synced ${days} day${days === 1 ? '' : 's'} ago`;
}

function transactionColor(transaction: Transaction): string {
  if (transaction.kind === 'income') return T.primary;
  if (transaction.kind === 'expense') return T.danger;
  return T.textMuted;
}

function transactionAmount(transaction: Transaction): string {
  if (transaction.kind === 'income') return `+${fmtCurrencyFull(transaction.amount)}`;
  if (transaction.kind === 'expense') return `-${fmtCurrencyFull(transaction.amount)}`;
  return fmtCurrencyFull(transaction.amount);
}

export function AccountActivityPanel({ accountId }: { accountId: string }) {
  const { data: plaidStatus, isLoading: plaidStatusLoading } = usePlaidAccountStatus(accountId);
  const { data: transactions = [], isLoading: transactionsLoading } = useRecentAccountTransactions(accountId, 8);
  const { data: categories = [] } = useCategories();
  const refreshFinancialData = usePlaidRefresh();
  const [isSyncing, setIsSyncing] = useState(false);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  async function handleSync() {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const result = await syncPlaidAccount(accountId);
      await refreshFinancialData();

      if (result.failed_items > 0) {
        const detail = result.results.find((item) => !item.success)?.error;
        throw new Error(detail || 'This bank connection needs another try.');
      }

      const changes = result.added + result.modified + result.removed;
      await infoDialog(
        'Account synced',
        changes === 0
          ? 'Everything is up to date.'
          : `${result.added} new, ${result.modified} updated, and ${result.removed} removed transactions processed.`,
      );
    } catch (error) {
      await infoDialog('Could not sync account', (error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <>
      {plaidStatusLoading ? null : plaidStatus?.linked ? (
        <View style={styles.plaidCard}>
          <View style={styles.plaidCopy}>
            <View style={styles.plaidTitleRow}>
              <View style={styles.statusDot} />
              <Text style={styles.plaidTitle}>Synced with Plaid</Text>
              {plaidStatus.mask ? (
                <Text style={styles.mask}>•••• {plaidStatus.mask}</Text>
              ) : null}
            </View>
            <Text style={styles.plaidMeta}>
              {syncAge(plaidStatus.last_synced_at)}
              {plaidStatus.institution_name ? ` · ${plaidStatus.institution_name}` : ''}
            </Text>
          </View>
          <Pressable
            onPress={handleSync}
            disabled={isSyncing}
            style={({ pressed }) => [
              styles.syncButton,
              (pressed || isSyncing) && styles.pressed,
            ]}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={T.primaryFg} />
            ) : (
              <Text style={styles.syncButtonText}>↻ Sync account</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Recent activity</Text>
      <View style={styles.activityCard}>
        {transactionsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={T.primary} />
          </View>
        ) : transactions.length === 0 ? (
          <Text style={styles.emptyText}>No transactions for this account yet.</Text>
        ) : (
          transactions.map((transaction, index) => {
            const category = transaction.category_id
              ? categoryNames.get(transaction.category_id)
              : null;
            const title = transaction.merchant || transaction.description || 'Transaction';
            const meta = [
              fmtTooltipDate(transaction.transaction_date),
              category || (transaction.kind === 'transfer' ? 'Transfer' : null),
              transaction.source === 'plaid' ? 'Plaid' : null,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <View
                key={transaction.id}
                style={[
                  styles.transactionRow,
                  index < transactions.length - 1 && styles.divider,
                ]}
              >
                <View style={styles.transactionCopy}>
                  <Text style={styles.transactionTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={styles.transactionMeta} numberOfLines={1}>
                    {meta}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    { color: transactionColor(transaction) },
                  ]}
                >
                  {transactionAmount(transaction)}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  plaidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
    padding: space['4'],
    marginTop: space['2'],
    marginBottom: space['2'],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: tint(T.primary, 0.35),
    backgroundColor: T.card,
  },
  plaidCopy: { flex: 1, minWidth: 0 },
  plaidTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: T.primary,
  },
  plaidTitle: {
    color: T.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  mask: {
    color: T.textDim,
    fontSize: fontSize.xs,
  },
  plaidMeta: {
    color: T.textMuted,
    fontSize: fontSize.xs,
    marginTop: space['1'],
  },
  syncButton: {
    minWidth: 118,
    height: 38,
    paddingHorizontal: space['4'],
    borderRadius: radius.md,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: {
    color: T.primaryFg,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: T.textMuted,
    letterSpacing: letterSpacing.widest,
    marginTop: space['6'],
    marginBottom: space['3'],
  },
  activityCard: {
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    marginBottom: space['2'],
  },
  transactionRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
  },
  transactionCopy: { flex: 1, minWidth: 0 },
  transactionTitle: {
    color: T.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  transactionMeta: {
    color: T.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textAlign: 'right',
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  loadingRow: {
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    padding: space['6'],
    color: T.textDim,
    fontSize: fontSize.sm,
  },
  pressed: { opacity: 0.75 },
});
