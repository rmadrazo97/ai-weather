// ---------------------------------------------------------------------------
// Local-first notification scheduling (thin wrapper over expo-notifications).
//
// Side-effecting counterpart to derive.ts: takes the pure DerivedEvent list and
// registers DATE-trigger notifications with the OS. We always cancel the prior
// batch first so each successful load fully re-states the schedule (no drift,
// no duplicates) — ids in derive.ts are stable so re-stating is idempotent.
//
// Every export is best-effort and swallows its own errors: notifications are a
// nicety, never a reason to crash the weather app or block a load.
// ---------------------------------------------------------------------------

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DerivedEvent } from './derive';

/** Hard cap on how many notifications we keep live at once (soonest win). */
const MAX_SCHEDULED = 8;
const ANDROID_CHANNEL_ID = 'weather-alerts';

// Foreground presentation: show the banner + list entry, but stay quiet (these
// are gentle, ambient nudges — no sound, no badge).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Ensure we have OS permission to post local notifications, prompting once if
 * we still can. On Android also (idempotently) create the alerts channel.
 * Returns whether notifications are allowed. Never throws.
 */
export async function ensurePermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Weather alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let granted =
      current.granted ||
      current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!granted && current.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted =
        requested.granted ||
        requested.ios?.status ===
          Notifications.IosAuthorizationStatus.PROVISIONAL;
    }

    return granted;
  } catch {
    return false;
  }
}

/**
 * Replace the live schedule with `events`: cancel everything, then register the
 * soonest ~8 future events via DATE triggers. Safe to call on every load.
 */
export async function schedule(events: DerivedEvent[]): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = Date.now();
    const upcoming = events
      .filter((e) => e.triggerDate.getTime() > now)
      .sort((a, b) => a.triggerDate.getTime() - b.triggerDate.getTime())
      .slice(0, MAX_SCHEDULED);

    for (const e of upcoming) {
      await Notifications.scheduleNotificationAsync({
        identifier: e.id,
        content: { title: e.title, body: e.body },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: e.triggerDate,
          ...(Platform.OS === 'android'
            ? { channelId: ANDROID_CHANNEL_ID }
            : {}),
        },
      });
    }
  } catch {
    // Best-effort: a scheduling failure must never surface to the user.
  }
}
