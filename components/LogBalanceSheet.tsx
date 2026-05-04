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
} from '@/constants/tokens';
import type { AccountSummary } from '@/types/database';

const T = themeDark;

interface Props {
  account: AccountSummary;
  visible: boolean;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

export function LogBalanceSheet({ account, visible, onClose }: Props) {
  const [balance, setBalance]         = useState('');
  const [apr, setApr]                 = useState('');
  const [apy, setApy]                 = useState('');
  const [minPayment, setMinPayment]   = useState('');
  const [dueDate, setDueDate]         = useState('');
  const [notes, setNotes]             = useState('');

  const logBalance = useLogBalance();

  useEffect(() => {
    if (visible) {
      setBalance('');
      setApr('');
      setApy('');
      setMinPayment('');
      setDueDate('');
      setNotes('');
    }
  }, [visible]);

  async function handleSubmit() {
    const raw = balance.trim().replace(/[^0-9.]/g, '');
    const parsed = parseFloat(raw);
    if (!raw || isNaN(parsed) || parsed < 0) {
      await infoDialog('Invalid balance', 'Please enter a valid balance amount.');
      return;
    }

    const aprVal       = apr.trim()        ? parseFloat(apr.trim())        : null;
    const apyVal       = apy.trim()        ? parseFloat(apy.trim())        : null;
    const minPayVal    = minPayment.trim()  ? parseFloat(minPayment.trim()) : null;
    const dueDateVal   = dueDate.trim()    || null;

    try {
      await logBalance.mutateAsync({
        account_id:       account.id,
        snapshot_date:    today(),
        balance:          parsed,
        apr:              aprVal,
        apy:              apyVal,
        min_payment:      minPayVal,
        payment_due_date: dueDateVal,
        notes:            notes.trim() || null,
      });
      onClose();
    } catch (e) {
      await infoDialog('Error', (e as Error).message);
    }
  }

  const color = categoryColor[account.category];

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
              <View style={styles.titleRow}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {account.nickname ?? account.name}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
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

                {account.category === 'debt' && (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>APR %</Text>
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
                      <Text style={styles.label}>Minimum Payment</Text>
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
                      <Text style={styles.label}>Due Date</Text>
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

                {account.category === 'cash' && (
                  <View style={styles.field}>
                    <Text style={styles.label}>APY %</Text>
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

                <View style={styles.field}>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.notesInput]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Optional note…"
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
                  { backgroundColor: color },
                  (pressed || logBalance.isPending) && styles.pressed,
                ]}
                onPress={handleSubmit}
                disabled={logBalance.isPending}
              >
                {logBalance.isPending
                  ? <ActivityIndicator color={T.primaryFg} />
                  : <Text style={styles.submitBtnText}>Save Balance</Text>
                }
              </Pressable>
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
  kvContainer: { justifyContent: 'flex-end' },
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
    paddingBottom: space['6'],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  sheetTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
    maxWidth: 240,
  },
  closeBtn: { padding: space['4'] },
  closeBtnText: { fontSize: fontSize.md, color: T.textMuted },
  body: {
    paddingHorizontal: space['8'],
    paddingBottom: space['4'],
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
  notesInput: {
    height: 80,
    paddingTop: space['6'],
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
