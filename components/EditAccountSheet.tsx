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

import { useArchiveAccount, useUpdateAccount } from '@/lib/accounts';
import { confirmDialog, infoDialog } from '@/lib/dialog';
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

export function EditAccountSheet({ account, visible, onClose }: Props) {
  const [name, setName]             = useState(account.name);
  const [nickname, setNickname]     = useState(account.nickname ?? '');
  const [institution, setInstitution] = useState(account.institution ?? '');

  useEffect(() => {
    if (visible) {
      setName(account.name);
      setNickname(account.nickname ?? '');
      setInstitution(account.institution ?? '');
    }
  }, [account, visible]);

  const updateAccount  = useUpdateAccount();
  const archiveAccount = useArchiveAccount();
  const isBusy = updateAccount.isPending || archiveAccount.isPending;

  async function handleSave() {
    if (!name.trim()) {
      await infoDialog('Name required', 'Please enter an account name.');
      return;
    }
    try {
      await updateAccount.mutateAsync({ id: account.id, name, nickname, institution });
      onClose();
    } catch (e) {
      await infoDialog('Error', (e as Error).message);
    }
  }

  async function handleArchive() {
    const confirmed = await confirmDialog(
      'Archive Account',
      `Archive "${account.nickname ?? account.name}"? It will be hidden from your dashboard but your history is preserved.`,
      { confirmLabel: 'Archive', destructive: true },
    );
    if (!confirmed) return;
    try {
      await archiveAccount.mutateAsync(account.id);
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

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View>
                <View style={styles.titleRow}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {account.nickname ?? account.name}
                  </Text>
                </View>
                {account.institution ? (
                  <Text style={styles.sheetSub}>{account.institution}</Text>
                ) : null}
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
                  <Text style={styles.label}>Account Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Account name"
                    placeholderTextColor={T.textDim}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Nickname</Text>
                  <TextInput
                    style={styles.input}
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder="Short display name (optional)"
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
                    returnKeyType="done"
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: color },
                  (pressed || isBusy) && styles.pressed,
                ]}
                onPress={handleSave}
                disabled={isBusy}
              >
                {updateAccount.isPending
                  ? <ActivityIndicator color={T.primaryFg} />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>
                }
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.archiveBtn, pressed && styles.pressed]}
                onPress={handleArchive}
                disabled={isBusy}
              >
                {archiveAccount.isPending
                  ? <ActivityIndicator color={T.danger} />
                  : <Text style={styles.archiveBtnText}>Archive Account</Text>
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
    maxHeight: '80%',
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
    alignItems: 'flex-start',
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
  sheetSub: {
    fontSize: fontSize.sm,
    color: T.textMuted,
    marginTop: space['1'],
    marginLeft: 10 + space['4'],
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
  pressed: { opacity: 0.75 },
  saveBtn: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space['4'],
  },
  saveBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: T.primaryFg,
    letterSpacing: letterSpacing.wide,
  },
  archiveBtn: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.danger,
  },
});
