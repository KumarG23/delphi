import * as Notifications from 'expo-notifications';

import type { ReminderCadence } from '@/types/database';

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export interface ScheduleOptions {
  cadence: ReminderCadence;
  dayOfMonth: number;
  hourLocal: number;
  timezone: string;
}

export async function scheduleReminder(opts: ScheduleOptions): Promise<void> {
  await cancelAllReminders();

  if (opts.cadence === 'off') return;

  const cadenceSeconds: Record<Exclude<ReminderCadence, 'off'>, number> = {
    monthly: 30 * 24 * 3600,
    biweekly: 14 * 24 * 3600,
    weekly: 7 * 24 * 3600,
  };

  const seconds = cadenceSeconds[opts.cadence as Exclude<ReminderCadence, 'off'>];

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time for your check-in 📊',
      body: 'Log your balances and keep your money picture up to date.',
      data: { deepLink: 'bulk-log' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: true,
    },
  });
}
