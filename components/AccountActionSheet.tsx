import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  categoryColor,
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
  onLogBalance: () => void;
  onEdit: () => void;
}

export function AccountActionSheet({
  account,
  visible,
  onClose,
  onLogBalance,
  onEdit,
}: Props) {
  const color = categoryColor[account.category];
  const hasNickname =
    !!account.nickname && account.nickname !== account.name;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerText}>
              <View style={styles.titleRow}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {account.nickname ?? account.name}
                </Text>
              </View>
              {hasNickname && (
                <Text style={styles.sheetSub} numberOfLines={1}>
                  {account.name}
                </Text>
              )}
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Actions */}
          <View style={styles.body}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.pressed,
              ]}
              onPress={onLogBalance}
            >
              <Text style={styles.primaryBtnText}>Log Balance</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.pressed,
              ]}
              onPress={onEdit}
            >
              <Text style={styles.secondaryBtnText}>Edit Account</Text>
            </Pressable>
          </View>
        </View>
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
  sheet: {
    backgroundColor: T.card,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingBottom: space['12'],
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
  headerText: { flex: 1 },
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
    flexShrink: 1,
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
    gap: space['4'],
  },
  pressed: { opacity: 0.75 },
  primaryBtn: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: T.primaryFg,
    letterSpacing: letterSpacing.wide,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: T.text,
    letterSpacing: letterSpacing.wide,
  },
});
