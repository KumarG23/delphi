import { useState } from 'react';
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

import {
  ACCOUNT_TYPE_LABELS,
  CATEGORY_LABELS,
  TYPES_BY_CATEGORY,
  useAddAccount,
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
  tint,
} from '@/constants/tokens';
import type { AccountCategory, AccountType } from '@/types/database';

const T = themeDark;

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CATEGORIES: { key: AccountCategory; emoji: string; description: string }[] = [
  { key: 'debt',       emoji: '💳', description: 'Credit cards, loans, mortgage' },
  { key: 'cash',       emoji: '🏦', description: 'Checking, savings, HYSA' },
  { key: 'investment', emoji: '📈', description: '401(k), IRA, brokerage, crypto' },
];

export function AddAccountSheet({ visible, onClose }: Props) {
  const [step, setStep]             = useState<1 | 2 | 3>(1);
  const [category, setCategory]     = useState<AccountCategory | null>(null);
  const [type, setType]             = useState<AccountType | null>(null);
  const [name, setName]             = useState('');
  const [institution, setInstitution] = useState('');
  const [balanceStr, setBalanceStr] = useState('');

  const addAccount = useAddAccount();

  function reset() {
    setStep(1);
    setCategory(null);
    setType(null);
    setName('');
    setInstitution('');
    setBalanceStr('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function goBack() {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }

  function pickCategory(cat: AccountCategory) {
    setCategory(cat);
    setStep(2);
  }

  function pickType(t: AccountType) {
    setType(t);
    setStep(3);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a name for this account.');
      return;
    }
    if (!category || !type) return;

    let openingBalance: number | null = null;
    const raw = balanceStr.trim();
    if (raw) {
      const parsed = parseFloat(raw.replace(/[^0-9.]/g, ''));
      if (isNaN(parsed)) {
        Alert.alert('Invalid balance', 'Please enter a valid number for the opening balance.');
        return;
      }
      openingBalance = parsed;
    }

    try {
      await addAccount.mutateAsync({ name, category, type, institution, openingBalance });
      handleClose();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  const stepTitle = step === 1 ? 'Add Account'
    : step === 2 ? CATEGORY_LABELS[category!]
    : 'Account Details';

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
              <View style={styles.titleRow}>
                {step > 1 && (
                  <Pressable onPress={goBack} style={styles.backBtn} hitSlop={12}>
                    <Text style={styles.backBtnText}>←</Text>
                  </Pressable>
                )}
                <Text style={styles.sheetTitle}>{stepTitle}</Text>
              </View>
              <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Step 1 — Category */}
            {step === 1 && (
              <View style={styles.stepBody}>
                <Text style={styles.prompt}>What kind of account?</Text>
                <View style={styles.categoryList}>
                  {CATEGORIES.map(({ key, emoji, description }) => {
                    const color = categoryColor[key];
                    return (
                      <Pressable
                        key={key}
                        style={({ pressed }) => [
                          styles.categoryBtn,
                          { borderColor: tint(color, 0.35) },
                          pressed && styles.pressed,
                        ]}
                        onPress={() => pickCategory(key)}
                      >
                        <Text style={styles.categoryEmoji}>{emoji}</Text>
                        <View style={styles.categoryBtnBody}>
                          <Text style={[styles.categoryBtnLabel, { color }]}>
                            {CATEGORY_LABELS[key]}
                          </Text>
                          <Text style={styles.categoryBtnDesc}>{description}</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Step 2 — Account Type */}
            {step === 2 && category && (
              <ScrollView
                contentContainerStyle={styles.stepBody}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.prompt}>Select account type</Text>
                <View style={styles.typeList}>
                  {TYPES_BY_CATEGORY[category].map((t, i, arr) => (
                    <Pressable
                      key={t}
                      style={({ pressed }) => [
                        styles.typeRow,
                        i < arr.length - 1 && styles.typeRowDivider,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => pickType(t)}
                    >
                      <Text style={styles.typeLabel}>{ACCOUNT_TYPE_LABELS[t]}</Text>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Step 3 — Details */}
            {step === 3 && category && type && (
              <ScrollView
                contentContainerStyle={styles.stepBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.prompt}>{ACCOUNT_TYPE_LABELS[type]}</Text>

                <View style={styles.form}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Account Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Chase Sapphire"
                      placeholderTextColor={T.textDim}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Institution</Text>
                    <TextInput
                      style={styles.input}
                      value={institution}
                      onChangeText={setInstitution}
                      placeholder="e.g. Chase, Ally, Fidelity"
                      placeholderTextColor={T.textDim}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>
                      {category === 'debt' ? 'Current Amount Owed' : 'Current Balance'}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={balanceStr}
                      onChangeText={setBalanceStr}
                      placeholder="0.00"
                      placeholderTextColor={T.textDim}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                    />
                    <Text style={styles.hint}>Optional — you can log balances later too</Text>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.submitBtn,
                    { backgroundColor: categoryColor[category] },
                    (pressed || addAccount.isPending) && styles.pressed,
                  ]}
                  onPress={handleSubmit}
                  disabled={addAccount.isPending}
                >
                  {addAccount.isPending
                    ? <ActivityIndicator color={T.primaryFg} />
                    : <Text style={styles.submitBtnText}>Add Account</Text>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
  },
  sheetTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  backBtn: { paddingVertical: space['2'] },
  backBtnText: {
    fontSize: fontSize['2xl'],
    color: T.textMuted,
    lineHeight: 28,
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
    marginBottom: space['8'],
  },
  categoryList: {
    gap: space['4'],
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.cardSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: space['8'],
    gap: space['6'],
  },
  pressed: { opacity: 0.7 },
  categoryEmoji: { fontSize: 26 },
  categoryBtnBody: { flex: 1 },
  categoryBtnLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: space['1'],
  },
  categoryBtnDesc: {
    fontSize: fontSize.xs,
    color: T.textMuted,
  },
  chevron: {
    fontSize: fontSize['2xl'],
    color: T.textMuted,
    lineHeight: 26,
  },
  typeList: {
    backgroundColor: T.cardSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['8'],
    paddingVertical: space['6'],
  },
  typeRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  typeLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: T.text,
  },
  form: { gap: space['6'], marginBottom: space['8'] },
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
  hint: {
    fontSize: fontSize.xs,
    color: T.textDim,
  },
  submitBtn: {
    height: 48,
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
