import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccounts } from '@/lib/accounts';
import {
  computeGoalProgress,
  Goal,
  useGoals,
  useMarkAchieved,
} from '@/lib/goals';
import { useNetWorthHistory } from '@/lib/dashboard';
import { GoalSheet } from '@/components/GoalSheet';
import {
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  themeDark,
  tint,
} from '@/constants/tokens';
import { fmtCurrencyFull } from '@/lib/format';

const T = themeDark;

function getKindLabel(goal: Goal): string {
  if (goal.kind === 'payoff') return 'Debt payoff';
  if (goal.account_id) return 'Savings';
  return 'Net worth';
}


export default function GoalsScreen() {
  const { data: goals = [], isLoading } = useGoals();
  const { data: accounts } = useAccounts();
  const { data: netWorthHistory } = useNetWorthHistory();
  const markAchieved = useMarkAchieved();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined);

  // Optional auto-achieve (idempotent; best-effort)
  useEffect(() => {
    if (!goals.length || !accounts) return;
    goals.forEach((g) => {
      if (g.status !== 'active') return;
      const prog = computeGoalProgress(g, { accounts, netWorthHistory });
      if (prog.achieved) {
        markAchieved.mutate(g.id);
      }
    });
  }, [goals, accounts, netWorthHistory, markAchieved]);

  const enriched = goals.map((goal) => ({
    goal,
    progress: computeGoalProgress(goal, { accounts, netWorthHistory }),
  }));

  function openNew() {
    setEditingGoal(undefined);
    setSheetVisible(true);
  }

  function openEdit(g: Goal) {
    setEditingGoal(g);
    setSheetVisible(true);
  }

  function handleSheetClose() {
    setSheetVisible(false);
    setEditingGoal(undefined);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Custom header */}
      <View style={styles.header}>
        <Text style={styles.title}>Goals</Text>
        <Pressable
          onPress={openNew}
          style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Text style={styles.newBtnText}>+ New goal</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading goals…</Text>
        </View>
      ) : enriched.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={styles.emptyTitle}>Set your first goal</Text>
          <Text style={styles.emptyBody}>
            Track debt payoffs, savings targets, or overall net worth growth.
          </Text>
          <Pressable
            onPress={openNew}
            style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
          >
            <Text style={styles.emptyCtaText}>Create a goal</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {enriched.map(({ goal, progress }) => {
            const kindLabel = getKindLabel(goal);
            const linkedAccount = goal.account_id
              ? accounts?.find((a) => a.id === goal.account_id)
              : null;
            const accountLabel = linkedAccount
              ? (linkedAccount.nickname ?? linkedAccount.name)
              : goal.kind === 'accumulate' && !goal.account_id
              ? 'Overall net worth'
              : null;

            const barColor =
              progress.verdict === 'achieved'
                ? T.success
                : progress.verdict === 'behind'
                ? T.danger
                : T.primary;

            const showVerdict = progress.verdict !== 'no_deadline';

            return (
              <Pressable
                key={goal.id}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                onPress={() => openEdit(goal)}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.goalName} numberOfLines={1}>
                      {goal.name}
                    </Text>
                    <View style={styles.metaRow}>
                      <View style={[styles.kindChip, { borderColor: tint(barColor, 0.4) }]}>
                        <Text style={[styles.kindText, { color: barColor }]}>{kindLabel}</Text>
                      </View>
                      {accountLabel && (
                        <Text style={styles.accountLabel} numberOfLines={1}>
                          {accountLabel}
                        </Text>
                      )}
                    </View>
                  </View>
                  {goal.target_date && (
                    <Text style={styles.due}>due {goal.target_date}</Text>
                  )}
                </View>

                {/* Progress bar */}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(0, Math.min(100, progress.pct))}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>

                <View style={styles.valuesRow}>
                  <Text style={styles.values}>
                    {fmtCurrencyFull(progress.current)} → {fmtCurrencyFull(goal.target_value)}
                  </Text>
                  <Text style={styles.remaining}>
                    {progress.remaining > 0 ? `${fmtCurrencyFull(progress.remaining)} to go` : 'Done'}
                  </Text>
                </View>

                <View style={styles.footerRow}>
                  <Text style={styles.pct}>{Math.round(progress.pct)}% complete</Text>
                  {showVerdict && (
                    <View style={[styles.verdict, { backgroundColor: tint(barColor, 0.15) }]}>
                      <Text style={[styles.verdictText, { color: barColor }]}>
                        {progress.verdict === 'achieved' && '✅ Achieved'}
                        {progress.verdict === 'on_track' && 'On track'}
                        {progress.verdict === 'behind' && 'Behind'}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}

          <View style={{ height: space['12'] }} />
        </ScrollView>
      )}

      <GoalSheet visible={sheetVisible} onClose={handleSheetClose} goal={editingGoal} />
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
    justifyContent: 'space-between',
    paddingHorizontal: space['6'],
    paddingTop: space['4'],
    paddingBottom: space['3'],
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.extrabold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  newBtn: {
    paddingHorizontal: space['3'],
    paddingVertical: space['1'],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: T.border,
  },
  newBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: T.primary,
  },
  pressed: { opacity: 0.7 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    color: T.textMuted,
    fontSize: fontSize.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['8'],
  },
  emptyEmoji: { fontSize: 48, marginBottom: space['3'] },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: T.text,
  },
  emptyBody: {
    fontSize: fontSize.md,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: space['2'],
    marginBottom: space['6'],
    maxWidth: 260,
  },
  emptyCta: {
    paddingHorizontal: space['5'],
    paddingVertical: space['3'],
    backgroundColor: T.primary,
    borderRadius: radius.md,
  },
  emptyCtaText: {
    color: T.primaryFg,
    fontWeight: fontWeight.extrabold,
    fontSize: fontSize.md,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: space['5'],
    paddingTop: space['2'],
    gap: space['4'],
  },
  card: {
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    padding: space['4'],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space['3'],
  },
  goalName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: T.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    marginTop: space['1'],
  },
  kindChip: {
    paddingHorizontal: space['2'],
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  kindText: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wide,
  },
  accountLabel: {
    fontSize: fontSize.xs,
    color: T.textMuted,
    maxWidth: 140,
  },
  due: {
    fontSize: fontSize.xs,
    color: T.textDim,
  },
  barTrack: {
    height: 8,
    backgroundColor: T.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: space['2'],
  },
  barFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  valuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  values: {
    fontSize: fontSize.sm,
    color: T.text,
  },
  remaining: {
    fontSize: fontSize.xs,
    color: T.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space['2'],
  },
  pct: {
    fontSize: fontSize.xs,
    color: T.textMuted,
  },
  verdict: {
    paddingHorizontal: space['2'],
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  verdictText: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.bold,
  },
});
