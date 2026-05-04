import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountActionSheet } from '@/components/AccountActionSheet';
import { AddAccountSheet } from '@/components/AddAccountSheet';
import { EditAccountSheet } from '@/components/EditAccountSheet';
import { LogBalanceSheet } from '@/components/LogBalanceSheet';
import {
  ACCOUNT_TYPE_LABELS,
  CATEGORY_LABELS,
  useAccounts,
} from '@/lib/accounts';
import {
  categoryColor,
  components,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  themeDark,
} from '@/constants/tokens';
import type { AccountCategory, AccountSummary } from '@/types/database';

const T = themeDark;
const CATEGORY_ORDER: AccountCategory[] = ['debt', 'cash', 'investment'];

function fmtBalance(amount: number | null): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function AccountRow({
  account,
  onPress,
}: {
  account: AccountSummary;
  onPress: () => void;
}) {
  const color = categoryColor[account.category];
  const stale =
    account.days_since_last_entry !== null && account.days_since_last_entry > 30;

  const subtitle = [
    ACCOUNT_TYPE_LABELS[account.type],
    account.institution,
    account.category === 'debt' && account.apr ? `${account.apr}% APR` : null,
    account.category === 'cash' && account.apy ? `${account.apy}% APY` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.accountRow, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.rowMeta}>
        <Text style={styles.accountName} numberOfLines={1}>
          {account.nickname ?? account.name}
        </Text>
        <Text style={styles.accountSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.balance, { color }]}>{fmtBalance(account.latest_balance)}</Text>
        {stale && <Text style={styles.staleLabel}>Update needed</Text>}
      </View>
    </Pressable>
  );
}

function SectionHeader({
  category,
  accounts,
}: {
  category: AccountCategory;
  accounts: AccountSummary[];
}) {
  const color = categoryColor[category];
  const total = accounts.reduce((sum, a) => sum + (a.latest_balance ?? 0), 0);
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color }]}>
        {CATEGORY_LABELS[category].toUpperCase()}
      </Text>
      <Text style={[styles.sectionTotal, { color }]}>{fmtBalance(total)}</Text>
    </View>
  );
}

export default function AccountsScreen() {
  const { data: accounts, isLoading, error } = useAccounts();
  const [addOpen, setAddOpen]             = useState(false);
  const [actionAccount, setActionAccount] = useState<AccountSummary | null>(null);
  const [editAccount, setEditAccount]     = useState<AccountSummary | null>(null);
  const [logAccount, setLogAccount]       = useState<AccountSummary | null>(null);

  const grouped = useMemo(() => {
    const result: Record<AccountCategory, AccountSummary[]> = {
      debt: [],
      cash: [],
      investment: [],
    };
    if (accounts) {
      for (const a of accounts) result[a.category].push(a);
    }
    return result;
  }, [accounts]);

  const hasAccounts = accounts && accounts.length > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Screen header */}
      <View style={styles.header}>
        <Text style={styles.title}>Accounts</Text>
        {accounts && (
          <Text style={styles.subtitle}>
            {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color={T.primary} size="large" />
        </View>
      )}

      {!isLoading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{(error as Error).message}</Text>
        </View>
      )}

      {!isLoading && !error && (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: components.fabSize + space['16'] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {!hasAccounts && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💳</Text>
              <Text style={styles.emptyTitle}>No accounts yet</Text>
              <Text style={styles.emptyBody}>
                Tap + to add your first account — debt, cash, or investments.
              </Text>
            </View>
          )}

          {hasAccounts &&
            CATEGORY_ORDER.map((cat) => {
              const catAccounts = grouped[cat];
              if (!catAccounts.length) return null;
              return (
                <View key={cat} style={styles.section}>
                  <SectionHeader category={cat} accounts={catAccounts} />
                  <View style={styles.card}>
                    {catAccounts.map((a, i) => (
                      <View key={a.id}>
                        <AccountRow
                          account={a}
                          onPress={() => setActionAccount(a)}
                        />
                        {i < catAccounts.length - 1 && (
                          <View style={styles.divider} />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setAddOpen(true)}
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>

      <AddAccountSheet visible={addOpen} onClose={() => setAddOpen(false)} />

      {actionAccount && (
        <AccountActionSheet
          account={actionAccount}
          visible
          onClose={() => setActionAccount(null)}
          onLogBalance={() => {
            const acc = actionAccount;
            setActionAccount(null);
            setLogAccount(acc);
          }}
          onEdit={() => {
            const acc = actionAccount;
            setActionAccount(null);
            setEditAccount(acc);
          }}
        />
      )}

      {editAccount && (
        <EditAccountSheet
          account={editAccount}
          visible
          onClose={() => setEditAccount(null)}
        />
      )}

      {logAccount && (
        <LogBalanceSheet
          account={logAccount}
          visible={!!logAccount}
          onClose={() => setLogAccount(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space['4'],
    paddingHorizontal: space['8'],
    paddingTop: space['6'],
    paddingBottom: space['4'],
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.extrabold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: T.textMuted,
    fontWeight: fontWeight.medium,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: fontSize.md,
    color: T.danger,
    textAlign: 'center',
    paddingHorizontal: space['8'],
  },
  scroll: {
    paddingHorizontal: space['8'],
    gap: space['4'],
  },
  section: { gap: space['3'] },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space['4'],
    paddingHorizontal: space['2'],
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.widest,
  },
  sectionTotal: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space['8'],
    paddingVertical: space['6'],
    gap: space['6'],
  },
  pressed: { opacity: 0.7 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  rowMeta: { flex: 1, gap: space['1'] },
  accountName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.text,
  },
  accountSub: {
    fontSize: fontSize.xs,
    color: T.textMuted,
  },
  rowRight: { alignItems: 'flex-end', gap: space['1'] },
  balance: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  staleLabel: {
    fontSize: fontSize.micro,
    color: T.warning,
    fontWeight: fontWeight.medium,
  },
  divider: {
    height: 1,
    backgroundColor: T.border,
    marginLeft: space['8'] + 8 + space['6'],
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: space['32'],
    gap: space['4'],
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: T.text,
    marginTop: space['4'],
  },
  emptyBody: {
    fontSize: fontSize.md,
    color: T.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: space['8'],
    right: space['8'],
    width: components.fabSize,
    height: components.fabSize,
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
