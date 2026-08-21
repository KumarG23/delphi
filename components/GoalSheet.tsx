import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAccounts } from '@/lib/accounts';
import {
  CreateGoalInput,
  Goal,
  useAbandonGoal,
  useCreateGoal,
  useUpdateGoal,
} from '@/lib/goals';
import { useNetWorthHistory } from '@/lib/dashboard';
import { confirmDialog, infoDialog } from '@/lib/dialog';
import { fmtCurrencyFull } from '@/lib/format';
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
import type { AccountSummary } from '@/types/database';

const T = themeDark;

interface Props {
  visible: boolean;
  onClose: () => void;
  goal?: Goal; // present = edit mode
}

type GoalType = 'payoff' | 'savings' | 'networth';

const GOAL_TYPE_OPTIONS: { key: GoalType; label: string; emoji: string; description: string }[] = [
  { key: 'payoff',   label: 'Debt payoff', emoji: '💳', description: 'Pay down a debt account (usually to $0)' },
  { key: 'savings',  label: 'Savings',     emoji: '🏦', description: 'Grow a cash or investment account' },
  { key: 'networth', label: 'Net worth',   emoji: '📈', description: 'Grow your overall net worth' },
];

export function GoalSheet({ visible, onClose, goal }: Props) {
  const isEditing = !!goal;

  const [goalType, setGoalType] = useState<GoalType>('payoff');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  const { data: accounts = [] } = useAccounts();
  const { data: netWorthHistory } = useNetWorthHistory();

  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const abandonGoal = useAbandonGoal();
  const isBusy = createGoal.isPending || updateGoal.isPending || abandonGoal.isPending;

  // Filtered accounts for picker (based on current type)
  const filteredAccounts: AccountSummary[] = accounts.filter((a) => {
    if (goalType === 'payoff') return a.category === 'debt';
    if (goalType === 'savings') return a.category === 'cash' || a.category === 'investment';
    return false;
  });

  const reset = useCallback(() => {
    if (isEditing && goal) {
      // Prefill for edit (type/account derived, not changeable here)
      const derivedType: GoalType = goal.kind === 'payoff' ? 'payoff' : (goal.account_id ? 'savings' : 'networth');
      setGoalType(derivedType);
      setSelectedAccountId(goal.account_id);
      setName(goal.name);
      setTargetStr(String(goal.target_value));
      setDateStr(goal.target_date || '');
    } else {
      setGoalType('payoff');
      setSelectedAccountId(null);
      setName('');
      setTargetStr('0'); // sensible default for payoff
      setDateStr('');
    }
  }, [goal, isEditing]);

  useEffect(() => {
    if (visible) {
      reset();
    }
  }, [visible, reset]);

  function handleClose() {
    reset();
    onClose();
  }

  function pickType(t: GoalType) {
    if (isEditing) return; // locked in edit
    setGoalType(t);
    setSelectedAccountId(null);
    if (t === 'payoff') {
      setTargetStr('0');
    } else if (targetStr === '0') {
      setTargetStr('');
    }
  }

  function pickAccount(id: string) {
    if (isEditing) return;
    setSelectedAccountId(id === selectedAccountId ? null : id);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      await infoDialog('Name required', 'Please enter a name for this goal.');
      return;
    }

    const rawTarget = targetStr.trim().replace(/[^0-9.]/g, '');
    const targetValue = parseFloat(rawTarget);
    if (isNaN(targetValue)) {
      await infoDialog('Invalid target', 'Please enter a valid target amount.');
      return;
    }

    const targetDate = dateStr.trim() || null;

    if (isEditing && goal) {
      try {
        await updateGoal.mutateAsync({
          id: goal.id,
          name: name.trim(),
          target_value: targetValue,
          target_date: targetDate,
        });
        handleClose();
      } catch (e) {
        await infoDialog('Error', (e as Error).message);
      }
      return;
    }

    // Create
    if (goalType !== 'networth' && !selectedAccountId) {
      await infoDialog('Account required', 'Please select an account for this goal.');
      return;
    }

    // Capture start_value at creation time
    let startValue = 0;
    if (goalType === 'networth') {
      startValue = netWorthHistory && netWorthHistory.length > 0
        ? netWorthHistory[netWorthHistory.length - 1].net_worth
        : 0;
    } else if (selectedAccountId) {
      const acc = accounts.find((a) => a.id === selectedAccountId);
      startValue = acc?.latest_balance ?? 0;
    }

    const kind: 'payoff' | 'accumulate' = goalType === 'payoff' ? 'payoff' : 'accumulate';
    const accountId = goalType === 'networth' ? null : selectedAccountId;

    const input: CreateGoalInput = {
      kind,
      account_id: accountId,
      name: name.trim(),
      start_value: startValue,
      target_value: targetValue,
      target_date: targetDate,
    };

    try {
      await createGoal.mutateAsync(input);
      handleClose();
    } catch (e) {
      await infoDialog('Error', (e as Error).message);
    }
  }

  async function handleAbandon() {
    if (!goal) return;
    const confirmed = await confirmDialog(
      'Abandon goal',
      `Abandon "${goal.name}"? Progress will be preserved but the goal will be hidden.`,
      { confirmLabel: 'Abandon', destructive: true },
    );
    if (!confirmed) return;
    try {
      await abandonGoal.mutateAsync(goal.id);
      handleClose();
    } catch (e) {
      await infoDialog('Error', (e as Error).message);
    }
  }

  const needsAccount = goalType !== 'networth';
  const selectedAccount = selectedAccountId ? accounts.find((a) => a.id === selectedAccountId) : null;
  const currentStart = isEditing && goal ? goal.start_value : (
    goalType === 'networth'
      ? (netWorthHistory && netWorthHistory.length > 0 ? netWorthHistory[netWorthHistory.length-1].net_worth : 0)
      : (selectedAccount ? (selectedAccount.latest_balance ?? 0) : 0)
  );

  const title = isEditing ? 'Edit Goal' : 'New Goal';
  const submitLabel = isEditing ? 'Save Changes' : 'Create Goal';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kvContainer}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.stepBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Goal type selector (pills) */}
              <Text style={styles.prompt}>What kind of goal?</Text>
              <View style={styles.typeList}>
                {GOAL_TYPE_OPTIONS.map((opt) => {
                  const isActive = goalType === opt.key;
                  const disabled = isEditing;
                  return (
                    <Pressable
                      key={opt.key}
                      style={({ pressed }) => [
                        styles.typeBtn,
                        isActive && styles.typeBtnActive,
                        disabled && styles.typeBtnDisabled,
                        pressed && !disabled && styles.pressed,
                      ]}
                      onPress={() => pickType(opt.key)}
                      disabled={disabled}
                    >
                      <Text style={styles.typeEmoji}>{opt.emoji}</Text>
                      <View style={styles.typeBody}>
                        <Text style={[styles.typeLabel, isActive && styles.typeLabelActive]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.typeDesc}>{opt.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Account picker (only for payoff/savings, and only on create) */}
              {needsAccount && (
                <>
                  <Text style={styles.prompt}>Select account</Text>
                  {filteredAccounts.length === 0 ? (
                    <Text style={styles.hint}>No matching accounts yet. Add one first.</Text>
                  ) : (
                    <View style={styles.accountList}>
                      {filteredAccounts.map((acc, idx, arr) => {
                        const isSel = selectedAccountId === acc.id;
                        const col = categoryColor[acc.category];
                        return (
                          <Pressable
                            key={acc.id}
                            style={({ pressed }) => [
                              styles.accountRow,
                              isSel && styles.accountRowSelected,
                              idx < arr.length - 1 && styles.accountRowDivider,
                              pressed && styles.pressed,
                            ]}
                            onPress={() => pickAccount(acc.id)}
                          >
                            <View style={[styles.accountDot, { backgroundColor: col }]} />
                            <View style={styles.accountInfo}>
                              <Text style={styles.accountName} numberOfLines={1}>
                                {acc.nickname ?? acc.name}
                              </Text>
                              <Text style={styles.accountSub}>
                                {acc.institution || '—'}
                              </Text>
                            </View>
                            <Text style={[styles.accountBalance, { color: col }]}>
                              {acc.latest_balance != null ? fmtCurrencyFull(acc.latest_balance) : '—'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  {selectedAccount && (
                    <Text style={styles.hint}>
                      Starting balance will be captured as {fmtCurrencyFull(selectedAccount.latest_balance ?? 0)}
                    </Text>
                  )}
                </>
              )}

              {/* Name */}
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>Goal name *</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Pay off credit card"
                    placeholderTextColor={T.textDim}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                {/* Target */}
                <View style={styles.field}>
                  <Text style={styles.label}>
                    {goalType === 'payoff' ? 'Target amount (usually 0)' : 'Target amount'} *
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={targetStr}
                    onChangeText={setTargetStr}
                    placeholder="0.00"
                    placeholderTextColor={T.textDim}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                </View>

                {/* Optional target date */}
                <View style={styles.field}>
                  <Text style={styles.label}>Target date (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={dateStr}
                    onChangeText={setDateStr}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={T.textDim}
                    keyboardType="numbers-and-punctuation"
                    returnKeyType="done"
                  />
                  <Text style={styles.hint}>We will use this for “on track / behind” verdicts</Text>
                </View>

                {/* Start value info (captured or existing) */}
                <View style={styles.field}>
                  <Text style={styles.label}>Starting value (captured at creation)</Text>
                  <Text style={styles.startValue}>{fmtCurrencyFull(currentStart)}</Text>
                </View>
              </View>

              {/* Actions */}
              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  { backgroundColor: isEditing ? T.primary : categoryColor[goalType === 'payoff' ? 'debt' : 'cash'] },
                  (pressed || isBusy) && styles.pressed,
                ]}
                onPress={handleSubmit}
                disabled={isBusy}
              >
                {isBusy ? (
                  <ActivityIndicator color={T.primaryFg} />
                ) : (
                  <Text style={styles.submitBtnText}>{submitLabel}</Text>
                )}
              </Pressable>

              {isEditing && goal && (
                <Pressable
                  style={({ pressed }) => [styles.abandonBtn, pressed && styles.pressed]}
                  onPress={handleAbandon}
                  disabled={isBusy}
                >
                  {abandonGoal.isPending ? (
                    <ActivityIndicator color={T.danger} />
                  ) : (
                    <Text style={styles.abandonBtnText}>Abandon goal</Text>
                  )}
                </Pressable>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  kvContainer: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingBottom: space['12'],
    maxHeight: '88%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: T.border,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginTop: space['6'],
    marginBottom: space['4'],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['8'],
    paddingBottom: space['4'],
  },
  sheetTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  closeBtn: { padding: space['4'] },
  closeBtnText: {
    fontSize: fontSize.md,
    color: T.textMuted,
  },
  stepBody: {
    paddingHorizontal: space['8'],
    paddingBottom: space['4'],
  },
  prompt: {
    fontSize: fontSize.md,
    color: T.textMuted,
    marginBottom: space['6'],
    marginTop: space['4'],
  },
  typeList: {
    gap: space['3'],
    marginBottom: space['4'],
  },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.cardSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    padding: space['4'],
    gap: space['4'],
  },
  typeBtnActive: {
    borderColor: T.primary,
    backgroundColor: tint(T.primary, 0.08),
  },
  typeBtnDisabled: {
    opacity: 0.6,
  },
  pressed: { opacity: 0.7 },
  typeEmoji: { fontSize: 22 },
  typeBody: { flex: 1 },
  typeLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: T.text,
  },
  typeLabelActive: {
    color: T.primary,
  },
  typeDesc: {
    fontSize: fontSize.xs,
    color: T.textMuted,
  },
  accountList: {
    backgroundColor: T.cardSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
    marginBottom: space['4'],
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
    gap: space['3'],
  },
  accountRowSelected: {
    backgroundColor: tint(T.primary, 0.1),
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
  accountInfo: { flex: 1 },
  accountName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.text,
  },
  accountSub: {
    fontSize: fontSize.xs,
    color: T.textMuted,
  },
  accountBalance: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  hint: {
    fontSize: fontSize.xs,
    color: T.textDim,
    marginBottom: space['4'],
  },
  form: { gap: space['4'], marginBottom: space['6'] },
  field: { gap: space['2'] },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.widest,
  },
  input: {
    height: components.inputHeight,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: radius.md,
    paddingHorizontal: space['4'],
    fontSize: fontSize.md,
    color: T.text,
  },
  startValue: {
    fontSize: fontSize.md,
    color: T.text,
    fontWeight: fontWeight.semibold,
    paddingVertical: space['2'],
  },
  submitBtn: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space['3'],
  },
  submitBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: T.primaryFg,
    letterSpacing: letterSpacing.wide,
  },
  abandonBtn: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abandonBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.danger,
  },
});
