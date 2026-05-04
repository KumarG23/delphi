import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useProfile, useUpdateProfile } from '@/lib/settings';
import {
  scheduleReminder,
  requestNotificationPermissions,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { confirmDialog, infoDialog } from '@/lib/dialog';
import { useAuthStore } from '@/store/auth';
import {
  components,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  space,
  themeDark,
} from '@/constants/tokens';
import type { ReminderCadence } from '@/types/database';

const T = themeDark;

const CADENCES: { value: ReminderCadence; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'off', label: 'Off' },
];

function CardLabel({ label }: { label: string }) {
  return <Text style={styles.cardLabel}>{label}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function SettingsScreen() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userEmail = useAuthStore((s) => s.session?.user?.email ?? null);

  // Profile state
  const [displayName, setDisplayName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Reminder state
  const [cadence, setCadence] = useState<ReminderCadence | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [hour, setHour] = useState('');

  // Sync local state from profile when loaded (only once)
  const [synced, setSynced] = useState(false);
  if (profile && !synced) {
    setDisplayName(profile.display_name ?? '');
    setCadence(profile.reminder_cadence ?? 'off');
    setDayOfMonth(String(profile.reminder_day_of_month ?? 1));
    setHour(String(profile.reminder_hour_local ?? 9));
    setSynced(true);
  }

  async function handleSaveName() {
    if (!displayName.trim()) {
      await infoDialog('Error', 'Display name cannot be empty.');
      return;
    }
    try {
      await updateProfile.mutateAsync({ display_name: displayName.trim() });
      setNameEdited(false);
      await infoDialog('Saved', 'Display name updated.');
    } catch (e: any) {
      await infoDialog('Error', e?.message ?? 'Could not save display name.');
    }
  }

  async function handleSaveReminders() {
    const activeCadence = cadence ?? 'off';
    const dayNum = parseInt(dayOfMonth, 10);
    const hourNum = parseInt(hour, 10);

    if (
      activeCadence !== 'off' &&
      (isNaN(hourNum) || hourNum < 0 || hourNum > 23)
    ) {
      await infoDialog('Error', 'Hour must be between 0 and 23.');
      return;
    }
    if (
      activeCadence === 'monthly' &&
      (isNaN(dayNum) || dayNum < 1 || dayNum > 31)
    ) {
      await infoDialog('Error', 'Day of month must be between 1 and 31.');
      return;
    }

    try {
      const granted = await requestNotificationPermissions();
      if (!granted && activeCadence !== 'off') {
        await infoDialog(
          'Notifications Blocked',
          'Please enable notifications in your device settings to receive reminders.',
        );
        return;
      }

      await updateProfile.mutateAsync({
        reminder_cadence: activeCadence,
        reminder_day_of_month: activeCadence === 'monthly' ? dayNum : null,
        reminder_hour_local: hourNum,
      });

      await scheduleReminder({
        cadence: activeCadence,
        dayOfMonth: dayNum,
        hourLocal: hourNum,
        timezone: profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      await infoDialog('Saved', activeCadence === 'off' ? 'Reminders turned off.' : 'Reminder scheduled.');
    } catch (e: any) {
      await infoDialog('Error', e?.message ?? 'Could not save reminder settings.');
    }
  }

  async function performSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      queryClient.clear();
      router.replace('/(auth)/sign-in');
    } catch (e: any) {
      setSigningOut(false);
      await infoDialog('Error', e?.message ?? 'Could not sign out.');
    }
  }

  async function handleSignOut() {
    const confirmed = await confirmDialog(
      'Sign out?',
      'You will be returned to the login screen.',
      { confirmLabel: 'Sign Out', destructive: true },
    );
    if (confirmed) await performSignOut();
  }

  const activeCadence = cadence ?? (profile?.reminder_cadence ?? 'off');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={T.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* ── Account card ── */}
          <View style={styles.card}>
            <CardLabel label="SIGNED IN AS" />
            <Text style={styles.emailText} numberOfLines={1}>
              {userEmail ?? '—'}
            </Text>
          </View>

          {/* ── Profile card ── */}
          <View style={styles.card}>
            <CardLabel label="DISPLAY NAME" />
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={(v) => { setDisplayName(v); setNameEdited(true); }}
                placeholder="Your name"
                placeholderTextColor={T.textDim}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                autoCorrect={false}
              />
              {nameEdited && (
                <Pressable
                  style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.75 }]}
                  onPress={handleSaveName}
                  disabled={updateProfile.isPending}
                >
                  <Text style={styles.saveBtnText}>
                    {updateProfile.isPending ? '…' : 'Save'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* ── Appearance card ── */}
          <View style={styles.card}>
            <CardLabel label="THEME" />
            <View style={styles.pillRow}>
              <View style={[styles.pill, styles.pillActive]}>
                <Text style={[styles.pillText, styles.pillTextActive]}>Dark</Text>
              </View>
              <View style={[styles.pill, styles.pillDisabled]}>
                <Text style={[styles.pillText, styles.pillTextDisabled]}>
                  Light{' '}
                  <Text style={styles.comingSoon}>(coming soon)</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* ── Notifications card ── */}
          <View style={styles.card}>
            <CardLabel label="REMINDERS" />

            <Text style={styles.fieldLabel}>Cadence</Text>
            <View style={styles.pillRow}>
              {CADENCES.map((c) => (
                <Pressable
                  key={c.value}
                  style={({ pressed }) => [
                    styles.pill,
                    activeCadence === c.value && styles.pillActive,
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => setCadence(c.value)}
                  hitSlop={4}
                >
                  <Text
                    style={[
                      styles.pillText,
                      activeCadence === c.value && styles.pillTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {activeCadence === 'monthly' && (
              <>
                <Divider />
                <Text style={styles.fieldLabel}>Day of month (1–31)</Text>
                <TextInput
                  style={styles.input}
                  value={dayOfMonth}
                  onChangeText={setDayOfMonth}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={T.textDim}
                  maxLength={2}
                />
              </>
            )}

            {activeCadence !== 'off' && (
              <>
                <Divider />
                <Text style={styles.fieldLabel}>Hour (24h, 0–23)</Text>
                <TextInput
                  style={styles.input}
                  value={hour}
                  onChangeText={setHour}
                  keyboardType="number-pad"
                  placeholder="9"
                  placeholderTextColor={T.textDim}
                  maxLength={2}
                />
              </>
            )}

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.8 }]}
              onPress={handleSaveReminders}
              disabled={updateProfile.isPending}
            >
              <Text style={styles.primaryBtnText}>
                {updateProfile.isPending ? 'Saving…' : 'Save Reminders'}
              </Text>
            </Pressable>
          </View>

          {/* ── Sign Out card ── */}
          <View style={styles.card}>
            <Pressable
              style={({ pressed }) => [
                styles.dangerBtn,
                pressed && { opacity: 0.8 },
                signingOut && { opacity: 0.6 },
              ]}
              onPress={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <ActivityIndicator color={T.danger} />
              ) : (
                <Text style={styles.dangerBtnText}>Sign Out</Text>
              )}
            </Pressable>
          </View>

          <View style={{ height: space['32'] }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  header: {
    paddingHorizontal: space['8'],
    paddingTop: space['6'],
    paddingBottom: space['4'],
  },
  title: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.extrabold,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: space['8'],
    gap: space['6'],
  },
  card: {
    backgroundColor: T.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: T.border,
    padding: space['8'],
    gap: space['6'],
  },
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.widest,
    color: T.textMuted,
  },
  emailText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: T.text,
    letterSpacing: letterSpacing.tight,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    color: T.textMuted,
    fontWeight: fontWeight.medium,
    marginBottom: -space['3'],
  },
  divider: {
    height: 1,
    backgroundColor: T.border,
    marginVertical: -space['2'],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
  },
  input: {
    flex: 1,
    height: components.inputHeight,
    backgroundColor: T.cardSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: space['6'],
    fontSize: fontSize.md,
    color: T.text,
    fontWeight: fontWeight.medium,
  },
  saveBtn: {
    paddingHorizontal: space['8'],
    paddingVertical: space['3'],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.primary,
  },
  saveBtnText: {
    fontSize: fontSize.sm,
    color: T.primary,
    fontWeight: fontWeight.semibold,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['3'],
  },
  pill: {
    paddingHorizontal: space['6'],
    paddingVertical: space['3'],
    borderRadius: radius.pill,
    backgroundColor: T.cardSoft,
    borderWidth: 1,
    borderColor: T.border,
  },
  pillActive: {
    backgroundColor: T.primary + '26',
    borderColor: T.primary,
  },
  pillDisabled: {
    opacity: 0.45,
  },
  pillText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: T.textMuted,
  },
  pillTextActive: {
    color: T.primary,
  },
  pillTextDisabled: {
    color: T.textDim,
  },
  comingSoon: {
    fontSize: fontSize.xs,
    color: T.textDim,
  },
  primaryBtn: {
    height: components.inputHeight,
    borderRadius: radius.md,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: T.primaryFg,
    letterSpacing: letterSpacing.wide,
  },
  dangerBtn: {
    height: components.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.danger + '14',
  },
  dangerBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: T.danger,
    letterSpacing: letterSpacing.wide,
  },
});
