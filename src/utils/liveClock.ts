// ---------------------------------------------------------------------------
// Live local clock for the active city.
//
// Open-Meteo's `current.time` is frozen at fetch time AND rounded to the
// nearest 15 minutes, so the header showed a stale "4:45 PM" that never moved.
// Instead we derive the city's wall-clock time live from its UTC offset
// (utc_offset_seconds), ticking every minute, so it always matches reality.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';

/**
 * Format the current wall-clock time for a city given its UTC offset (seconds),
 * as "H:MM AM/PM". Shifts "now" by the offset and reads UTC fields so the
 * result is independent of the device's own timezone.
 */
export function formatLocalTime(
  utcOffsetSeconds: number | undefined,
  now: number = Date.now(),
): string {
  const offsetMs = (utcOffsetSeconds ?? 0) * 1000;
  const d = new Date(now + offsetMs);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Live-updating local time string for a city. Re-renders every minute.
 *
 * When `utcOffsetSeconds` is undefined (e.g. a scenario restored from an older
 * cache that predates this field), falls back to the provided static string so
 * we never show a wrong (device-timezone) clock.
 */
export function useLiveClock(
  utcOffsetSeconds: number | undefined,
  fallback?: string,
): string {
  const hasOffset = typeof utcOffsetSeconds === 'number';
  const [time, setTime] = useState(() =>
    hasOffset ? formatLocalTime(utcOffsetSeconds) : fallback ?? '',
  );

  useEffect(() => {
    if (!hasOffset) {
      setTime(fallback ?? '');
      return;
    }
    const tick = () => setTime(formatLocalTime(utcOffsetSeconds));
    tick();
    // Align the first tick to the next minute boundary, then update each minute.
    const msToNextMinute = 60000 - (Date.now() % 60000);
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [utcOffsetSeconds, hasOffset, fallback]);

  return time;
}
