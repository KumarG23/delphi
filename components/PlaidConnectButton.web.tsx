import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fontSize, fontWeight, radius, space, themeDark } from '@/constants/tokens';
import { infoDialog } from '@/lib/dialog';
import {
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  usePlaidRefresh,
} from '@/lib/plaid';

const T = themeDark;
const PLAID_SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

type PlaidInstitution = {
  institution_id: string;
  name: string;
};

type PlaidSuccessMetadata = {
  institution?: PlaidInstitution | null;
};

type PlaidExitMetadata = {
  error?: {
    display_message?: string | null;
    error_message?: string | null;
  } | null;
};

type PlaidHandler = {
  open: () => void;
  destroy: () => void;
};

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string;
        onSuccess: (publicToken: string, metadata: PlaidSuccessMetadata) => void;
        onExit: (error: unknown, metadata: PlaidExitMetadata) => void;
      }) => PlaidHandler;
    };
  }
}

let plaidScriptPromise: Promise<void> | null = null;

function loadPlaidScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Plaid Link requires a browser.'));
  if (window.Plaid) return Promise.resolve();
  if (plaidScriptPromise) return plaidScriptPromise;

  plaidScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PLAID_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Plaid Link.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = PLAID_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Plaid Link.'));
    document.head.appendChild(script);
  });

  return plaidScriptPromise;
}

interface Props {
  onConnected?: (accountCount: number) => void;
}

export function PlaidConnectButton({ onConnected }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const refreshFinancialData = usePlaidRefresh();

  async function handleConnect() {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const [linkToken] = await Promise.all([
        createPlaidLinkToken(),
        loadPlaidScript(),
      ]);

      const plaid = window.Plaid;
      if (!plaid) throw new Error('Plaid Link did not initialize.');

      let handler: PlaidHandler;
      handler = plaid.create({
        token: linkToken,
        onSuccess: async (publicToken, metadata) => {
          try {
            const result = await exchangePlaidPublicToken({
              publicToken,
              institutionId: metadata.institution?.institution_id,
              institutionName: metadata.institution?.name,
            });
            await refreshFinancialData();
            onConnected?.(result.accounts.length);
          } catch (error) {
            await infoDialog('Could not connect bank', (error as Error).message);
          } finally {
            handler.destroy();
            setIsLoading(false);
          }
        },
        onExit: async (error, metadata) => {
          handler.destroy();
          setIsLoading(false);
          if (error) {
            const message = metadata.error?.display_message
              || metadata.error?.error_message
              || 'Plaid Link closed before the bank connection finished.';
            await infoDialog('Plaid Link', message);
          }
        },
      });

      handler.open();
    } catch (error) {
      setIsLoading(false);
      await infoDialog('Could not start Plaid', (error as Error).message);
    }
  }

  return (
    <Pressable
      onPress={handleConnect}
      disabled={isLoading}
      style={({ pressed }) => [styles.button, (pressed || isLoading) && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🏦</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Connect a bank</Text>
        <Text style={styles.subtitle}>Securely sync accounts with Plaid</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator color={T.primary} />
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
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
