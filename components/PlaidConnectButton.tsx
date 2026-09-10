import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontSize, fontWeight, radius, space, themeDark } from '@/constants/tokens';
import { infoDialog } from '@/lib/dialog';

const T = themeDark;

interface Props {
  onConnected?: (accountCount: number) => void;
}

// TypeScript does not apply React Native's platform file resolution during
// `tsc --noEmit`, so this base component keeps the module resolvable in CI.
// Metro will prefer PlaidConnectButton.web.tsx on web and
// PlaidConnectButton.native.tsx on iOS/Android.
export function PlaidConnectButton(_props: Props) {
  async function handlePress() {
    await infoDialog(
      'Plaid Link unavailable',
      'Use the Delphi web app for Sandbox bank linking until native Plaid Link is included in a custom mobile build.',
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🏦</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Connect a bank</Text>
        <Text style={styles.subtitle}>Securely sync accounts with Plaid</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
    paddingHorizontal: space['6'],
    paddingVertical: space['4'],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.primary,
    backgroundColor: T.cardSoft,
  },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: T.bg,
  },
  icon: { fontSize: 22 },
  copy: { flex: 1 },
  title: {
    color: T.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    marginTop: 2,
    color: T.textMuted,
    fontSize: fontSize.xs,
  },
  chevron: {
    color: T.primary,
    fontSize: fontSize['2xl'],
    lineHeight: 26,
  },
});
