import { useEffect, useState } from 'react';
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

import { useAccounts, ACCOUNT_TYPE_LABELS, CATEGORY_LABELS } from '@/lib/accounts';
import { useLogBalance } from '@/lib/snapshots';
import { infoDialog } from '@/lib/dialog';
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

const CATEGORY_ORDER: Record<string, number> = { debt: 0, cash: 1, investment: 2 };

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = 'intro' | 'logging' | 'done';

const today = () => new Date().toISOString().split('T')[0];

export function BulkLogSheet({ visible, onClose }: Props) {
  const [step, setStep]                 = useState<Step>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [balance, setBalance]           = useState('');
  const [apr, setApr]                   = useState('');
  const [apy, setApy]                   = useState('');
  const [minPayment, setMinPayment]     = useState('');
  const [dueDate, setDueDate]           = useState('');
  const [completedCount, setCompletedCount] = useState(0);

  const { data: rawAccounts, isLoading } = useAccounts();
  const logBalance = useLogBalance();

  const accounts: AccountSummary[] = rawAccounts
    ? [...rawAccounts].sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category])
    : [];

  useEffect(() => {
    if (visible) {
      setStep('intro');
      setCurrentIndex(0);
      setCompletedCount(0);
      resetFields();
    }
  }, [visible]);

  function resetFields() {
    setBalance('');
    setApr('');
    setApy('');
    setMinPayment('');
    setDueDate('');
  }

  function handleSkip() {
    const next = currentIndex + 1;
    if (next >= accounts.length) {
      setStep('done');
    } else {
      setCurrentIndex(next);
      resetFields();
    }
  }

  async function handleSaveNext() {
    const raw = balance.trim().replace(/[^0-9.]/g, '');
    const parsed = parseFloat(raw);
    if (!raw || isNaN(parsed) || parsed < 0) {
      await infoDialog('Invalid balance', 'Please enter a valid balance amount.');
      return;
    }

    const account = accounts[currentIndex];
    const aprVal     = apr.trim()       ? parseFloat(apr.trim())       : null;
    const apyVal     = apy.trim()       ? parseFloat(apy.trim())       : null;
    const minPayVal  = minPayment.trim() ? parseFloat(minPayment.trim()) : null;
    const dueDateVal = dueDate.trim()   || null;

    try {
      await logBalance.mutateAsync({
        account_id:       account.id,
        snapshot_date:    today(),
        balance:          parsed,
        apr:              aprVal,
        apy:              apyVal,
        min_payment:      minPayVal,
        payment_due_date: dueDateVal,
      });
      setCompletedCount(c => c + 1);
      const next = currentIndex + 1;
      if (next >= accounts.length) {
        setStep('done');
      } else {
        setCurrentIndex(next);
        resetFields();
      }
    } catch (e) {
      await infoDialog('Error', (e as Error).message);
    }
  }

  const current = accounts[currentIndex];
  const accentColor = current ? categoryColor[current.category] : T.primary;

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
              <Text style={styles.sheetTitle}>
                {step === 'intro'   ? 'Monthly Check-in 📊'
                : step === 'done'   ? 'All caught up! 🎉'
                : accounts[currentIndex]?.nickname ?? accounts[currentIndex]?.name ?? ''}
              </Text>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={T.primary} />
              </View>
            )}

            {!isLoading && step === 'intro' && (
              <View style={styles.body}>
                <Text style={styles.introSub}>
                  Log balances for all your accounts. Takes about 2 minutes.
                </Text>
                <View style={styles.accountCountBadge}>
                  <Text style={styles.accountCountText}>
                    {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.submitBtn, styles.startBtn, pressed && styles.pressed]}
                  onPress={() => setStep('logging')}
                >
                  <Text style={styles.submitBtnText}>Start</Text>
                </Pressable>
              </View>
            )}

            {!isLoading && step === 'logging' && current && (
              <ScrollView
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.progressRow}>
                  <Text style={[styles.progressLabel, { color: accentColor }]}>
                    {currentIndex + 1} of {accounts.length}
                  </Text>
                  <Text style={styles.accountTypeSub}>
                    {CATEGORY_LABELS[current.category]} · {ACCOUNT_TYPE_LABELS[current.type]}
                  </Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: accentColor,
                        width: `${((currentIndex + 1) / accounts.length) * 100}%` as any,
                      },
                    ]}
                  />
                </View>

                <View style={styles.form}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Balance</Text>
                    <TextInput
                      style={[styles.input, styles.balanceInput]}
                      value={balance}
                      onChangeText={setBalance}
                      placeholder="0.00"
                      placeholderTextColor={T.textDim}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      autoFocus
                    />
                  </View>

                  {current.category === 'debt' && (
                    <>
                      <View style={styles.field}>
                        <Text style={styles.label}>APR % (optional)</Text>
                        <TextInput
                          style={styles.input}
                          value={apr}
                          onChangeText={setApr}
                          placeholder="e.g. 24.99"
                          placeholderTextColor={T.textDim}
                          keyboardType="decimal-pad"
                          returnKeyType="next"
                        />
                      </View>

                      <View style={styles.field}>
                        <Text style={styles.label}>Minimum Payment (optional)</Text>
                        <TextInput
                          style={styles.input}
                          value={minPayment}
                          onChangeText={setMinPayment}
                          placeholder="0.00"
                          placeholderTextColor={T.textDim}
                          keyboardType="decimal-pad"
                          returnKeyType="next"
                        />
                      </View>

                      <View style={styles.field}>
                        <Text style={styles.label}>Due Date (optional)</Text>
                        <TextInput
                          style={styles.input}
                          value={dueDate}
                          onChangeText={setDueDate}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={T.textDim}
                          keyboardType="numbers-and-punctuation"
                          returnKeyType="next"
                        />
                      </View>
                    </>
                  )}

                  {current.category === 'cash' && (
                    <View style={styles.field}>
                      <Text style={styles.label}>APY % (optional)</Text>
                      <TextInput
                        style={styles.input}
                        value={apy}
                        onChangeText={setApy}
                        placeholder="e.g. 4.75"
                        placeholderTextColor={T.textDim}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                      />
                    </View>
                  )}
                </View>

                <View style={styles.buttonRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.skipBtn,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleSkip}
                    disabled={logBalance.isPending}
                  >
                    <Text style={styles.skipBtnText}>Skip</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.saveNextBtn,
                      { backgroundColor: accentColor },
                      (pressed || logBalance.isPending) && styles.pressed,
                    ]}
                    onPress={handleSaveNext}
                    disabled={logBalance.isPending}
                  >
                    {logBalance.isPending
                      ? <ActivityIndicator color={T.primaryFg} />
                      : <Text style={styles.submitBtnText}>Save & Next</Text>
                    }
                  </Pressable>
                </View>
              </ScrollView>
            )}

            {!isLoading && step === 'done' && (
              <View style={styles.body}>
                <Text style={styles.introSub}>
                  Balances logged for {completedCount} {completedCount === 1 ? 'account' : 'accounts'}.
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.submitBtn, styles.startBtn, pressed && styles.pressed]}
                  onPress={onClose}
                >
                  <Text style={styles.submitBtnText}>Done</Text>
                </Pressable>
              </View>
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
    maxHeight: '90%',
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
    paddingBottom: space['6'],
  },
  sheetTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
    flex: 1,
  },
  closeBtn: { padding: space['4'] },
  closeBtnText: { fontSize: fontSize.md, color: T.textMuted },
  loadingContainer: {
    paddingVertical: space['16'],
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: space['8'],
    paddingBottom: space['4'],
  },
  introSub: {
    fontSize: fontSize.md,
    color: T.textMuted,
    marginBottom: space['8'],
    lineHeight: 22,
  },
  accountCountBadge: {
    alignSelf: 'flex-start',
    backgroundColor: T.cardSoft,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: space['6'],
    paddingVertical: space['2'],
    marginBottom: space['12'],
  },
  accountCountText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: T.textMuted,
    letterSpacing: letterSpacing.wide,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space['4'],
  },
  progressLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.wide,
  },
  accountTypeSub: {
    fontSize: fontSize.xs,
    color: T.textMuted,
  },
  progressTrack: {
    height: 3,
    backgroundColor: T.border,
    borderRadius: radius.pill,
    marginBottom: space['8'],
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: radius.pill,
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
  balanceInput: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    height: 64,
    letterSpacing: letterSpacing.tight,
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
  saveNextBtn: {
    flex: 2,
    height: components.inputHeight,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    backgroundColor: T.primary,
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
});
