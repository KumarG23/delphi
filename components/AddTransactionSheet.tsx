import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useLogBalance } from '@/lib/snapshots';
import {
  useAddTransaction,
  useCategories,
  useComputedBalance,
} from '@/lib/transactions';
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
import type { Category, TransactionKind } from '@/types/database';

const T = themeDark;

interface Props {
  visible: boolean;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

export function AddTransactionSheet({ visible, onClose }: Props) {
  const [amountStr, setAmountStr]           = useState('');
  const [kind, setKind]                     = useState<TransactionKind>('expense');
  const [date, setDate]                     = useState(today());
  const [categoryId, setCategoryId]         = useState<string | null>(null);
  const [accountId, setAccountId]           = useState<string | null>(null);
  const [merchant, setMerchant]             = useState('');
  const [notes, setNotes]                   = useState('');
  const [pendingNudgeAccountId, setPendingNudgeAccountId] = useState<string | null>(null);
  const [nudgeBalance, setNudgeBalance]     = useState<number | null>(null);
  const [nudgeAccountName, setNudgeAccountName] = useState<string | null>(null);
  const [showNudge, setShowNudge]           = useState(false);

  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const addTransaction = useAddTransaction();
  const logBalance = useLogBalance();
  const computedBalanceQuery = useComputedBalance(pendingNudgeAccountId);

  useEffect(() => {
    if (!visible) {
      setAmountStr('');
      setKind('expense');
      setDate(today());
      setCategoryId(null);
      setAccountId(null);
      setMerchant('');
      setNotes('');
      setPendingNudgeAccountId(null);
      setNudgeBalance(null);
      setNudgeAccountName(null);
      setShowNudge(false);
    }
  }, [visible]);

  useEffect(() => {
    if (addTransaction.isSuccess && accountId) {
      setPendingNudgeAccountId(accountId);
    } else if (addTransaction.isSuccess && !accountId) {
      onClose();
    }
  }, [addTransaction.isSuccess]);

  useEffect(() => {
    if (
      pendingNudgeAccountId &&
      computedBalanceQuery.data &&
      computedBalanceQuery.data.computed_balance !== null
    ) {
      const acct = accounts?.find(a => a.id === pendingNudgeAccountId);
      setNudgeBalance(computedBalanceQuery.data.computed_balance);
      setNudgeAccountName(acct?.nickname ?? acct?.name ?? null);
      setShowNudge(true);
    }
  }, [computedBalanceQuery.data, pendingNudgeAccountId]);

  async function handleSubmit() {
    const raw = amountStr.trim().replace(/[^0-9.]/g, '');
    const parsed = parseFloat(raw);
    if (!raw || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    try {
      await addTransaction.mutateAsync({
        transaction_date: date.trim() || today(),
        amount:           parsed,
        kind,
        merchant:         merchant.trim() || null,
        category_id:      categoryId,
        account_id:       accountId,
        notes:            notes.trim() || null,
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handleNudgeUpdate() {
    if (!pendingNudgeAccountId || nudgeBalance === null) {
      onClose();
      return;
    }
    try {
      await logBalance.mutateAsync({
        account_id:    pendingNudgeAccountId,
        snapshot_date: today(),
        balance:       nudgeBalance,
      });
    } catch {
    } finally {
      onClose();
    }
  }

  const filteredCategories: Category[] = (categories ?? []).filter(
    c => kind === 'income' ? c.type === 'income' : c.type === 'expense',
  );

  const kindColor = kind === 'income' ? palette.green : palette.red;

  const formatBalance = (val: number) =>
    val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kvContainer}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add Transaction</Text>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {showNudge ? (
              <View style={styles.nudgeBody}>
                <View style={styles.nudgeBanner}>
                  <Text style={styles.nudgeIcon}>📊</Text>
                  <Text style={styles.nudgeText}>
                    Based on this transaction,{' '}
                    <Text style={styles.nudgeAccent}>{nudgeAccountName}</Text>
                    {' '}is ~${formatBalance(nudgeBalance!)}. Update balance now?
                  </Text>
                </View>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={({ pressed }) => [styles.skipBtn, pressed && styles.pressed]}
                    onPress={onClose}
                    disabled={logBalance.isPending}
                  >
                    <Text style={styles.skipBtnText}>Skip</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.nudgeUpdateBtn,
                      (pressed || logBalance.isPending) && styles.pressed,
                    ]}
                    onPress={handleNudgeUpdate}
                    disabled={logBalance.isPending}
                  >
                    {logBalance.isPending
                      ? <ActivityIndicator color={T.primaryFg} />
                      : <Text style={styles.submitBtnText}>Update</Text>
                    }
                  </Pressable>
                </View>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.amountRow}>
                  <Text style={styles.currencyPrefix}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amountStr}
                    onChangeText={setAmountStr}
                    placeholder="0.00"
                    placeholderTextColor={T.textDim}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    autoFocus
                  />
                </View>

                <View style={styles.kindToggleRow}>
                  {(['expense', 'income'] as TransactionKind[]).map(k => {
                    const active = kind === k;
                    const kColor = k === 'income' ? palette.green : palette.red;
                    return (
                      <Pressable
                        key={k}
                        style={[
                          styles.kindPill,
                          active
                            ? { backgroundColor: tint(kColor, 0.18), borderColor: kColor }
                            : { borderColor: T.border },
                        ]}
                        onPress={() => { setKind(k); setCategoryId(null); }}
                      >
                        <Text
                          style={[
                            styles.kindPillText,
                            { color: active ? kColor : T.textMuted },
                          ]}
                        >
                          {k === 'expense' ? 'Expense' : 'Income'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.form}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Date</Text>
                    <TextInput
                      style={styles.input}
                      value={date}
                      onChangeText={setDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={T.textDim}
                      keyboardType="numbers-and-punctuation"
                      returnKeyType="next"
                    />
                  </View>

                  {filteredCategories.length > 0 && (
                    <View style={styles.field}>
                      <Text style={styles.label}>Category</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.pillScroll}
                      >
                        {filteredCategories.map(cat => {
                          const active = categoryId === cat.id;
                          const catColor = cat.color ?? kindColor;
                          return (
                            <Pressable
                              key={cat.id}
                              style={[
                                styles.pill,
                                active
                                  ? { backgroundColor: tint(catColor, 0.18), borderColor: catColor }
                                  : { borderColor: T.border },
                              ]}
                              onPress={() => setCategoryId(active ? null : cat.id)}
                            >
                              {cat.icon ? (
                                <Text style={styles.pillIcon}>{cat.icon}</Text>
                              ) : null}
                              <Text
                                style={[
                                  styles.pillText,
                                  { color: active ? catColor : T.textMuted },
                                ]}
                              >
                                {cat.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {accounts && accounts.length > 0 && (
                    <View style={styles.field}>
                      <Text style={styles.label}>Account</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.pillScroll}
                      >
                        <Pressable
                          style={[
                            styles.pill,
                            accountId === null
                              ? { backgroundColor: tint(T.textMuted, 0.12), borderColor: T.textMuted }
                              : { borderColor: T.border },
                          ]}
                          onPress={() => setAccountId(null)}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              { color: accountId === null ? T.textMuted : T.textDim },
                            ]}
                          >
                            None
                          </Text>
                        </Pressable>
                        {accounts.map(acct => {
                          const active = accountId === acct.id;
                          const acctColor = categoryColor[acct.category];
                          return (
                            <Pressable
                              key={acct.id}
                              style={[
                                styles.pill,
                                active
                                  ? { backgroundColor: tint(acctColor, 0.18), borderColor: acctColor }
                                  : { borderColor: T.border },
                              ]}
                              onPress={() => setAccountId(active ? null : acct.id)}
                            >
                              <View style={[styles.pillDot, { backgroundColor: acctColor }]} />
                              <Text
                                style={[
                                  styles.pillText,
                                  { color: active ? acctColor : T.textMuted },
                                ]}
                              >
                                {acct.nickname ?? acct.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  <View style={styles.field}>
                    <Text style={styles.label}>Merchant</Text>
                    <TextInput
                      style={styles.input}
                      value={merchant}
                      onChangeText={setMerchant}
                      placeholder="e.g. Whole Foods, Netflix…"
                      placeholderTextColor={T.textDim}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Notes</Text>
                    <TextInput
                      style={[styles.input, styles.notesInput]}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Optional…"
                      placeholderTextColor={T.textDim}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      returnKeyType="done"
                    />
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    { backgroundColor: kindColor },
                    (pressed || addTransaction.isPending) && styles.pressed,
                  ]}
                  onPress={handleSubmit}
                  disabled={addTransaction.isPending}
                >
                  {addTransaction.isPending
                    ? <ActivityIndicator color={T.primaryFg} />
                    : <Text style={styles.submitBtnText}>Add Transaction</Text>
                  }
                </Pressable>
              </ScrollView>
            )}
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
  kvContainer: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingBottom: space['12'],
    maxHeight: '92%',
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
  closeBtnText: { fontSize: fontSize.md, color: T.textMuted },
  body: {
    paddingHorizontal: space['8'],
    paddingBottom: space['4'],
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space['8'],
    gap: space['2'],
  },
  currencyPrefix: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: T.textMuted,
    lineHeight: 48,
  },
  amountInput: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
    minWidth: 120,
    textAlign: 'center',
  },
  kindToggleRow: {
    flexDirection: 'row',
    gap: space['4'],
    marginBottom: space['8'],
    justifyContent: 'center',
  },
  kindPill: {
    paddingHorizontal: space['8'],
    paddingVertical: space['4'],
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  kindPillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wide,
  },
  form: {
    gap: space['6'],
    marginBottom: space['8'],
  },
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
    paddingHorizontal: space['8'],
    fontSize: fontSize.md,
    color: T.text,
  },
  notesInput: {
    height: 80,
    paddingTop: space['6'],
  },
  pillScroll: {
    gap: space['4'],
    paddingVertical: space['1'],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space['6'],
    paddingVertical: space['4'],
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: space['2'],
  },
  pillIcon: {
    fontSize: fontSize.sm,
  },
  pillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.75 },
  submitBtn: {
    height: components.inputHeight,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: T.primaryFg,
    letterSpacing: letterSpacing.wide,
  },
  nudgeBody: {
    paddingHorizontal: space['8'],
    paddingBottom: space['4'],
    gap: space['8'],
  },
  nudgeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: T.cardSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    padding: space['8'],
    gap: space['6'],
  },
  nudgeIcon: { fontSize: fontSize['2xl'] },
  nudgeText: {
    flex: 1,
    fontSize: fontSize.md,
    color: T.textMuted,
    lineHeight: 22,
  },
  nudgeAccent: {
    color: T.text,
    fontWeight: fontWeight.semibold,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: space['4'],
  },
  skipBtn: {
    flex: 1,
    height: components.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.textMuted,
  },
  nudgeUpdateBtn: {
    flex: 2,
    height: components.inputHeight,
    borderRadius: radius.md,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
