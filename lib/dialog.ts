import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

// Alert.alert renders nothing on web (RNW no-op), so dialogs that gate
// destructive flows silently fail. Branch to window primitives on web.

export function confirmDialog(
  title: string,
  message: string,
  opts: ConfirmOptions = {},
): Promise<boolean> {
  const confirmLabel = opts.confirmLabel ?? 'OK';
  const cancelLabel = opts.cancelLabel ?? 'Cancel';

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(false);
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: opts.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function infoDialog(title: string, message: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [{ text: 'OK', onPress: () => resolve() }],
      { onDismiss: () => resolve() },
    );
  });
}
