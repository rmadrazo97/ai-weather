// ---------------------------------------------------------------------------
// Local-first notification derivation (PURE, no side effects, no native deps).
//
// Turns the already-fetched WeatherScenario into a small set of useful, local
// notifications. Nothing here touches the network or expo-notifications — it is
// a deterministic function of (weather, now) so it is trivially testable and
// safe to call on every successful load. The scheduler (schedule.ts) decides
// how many of these to actually register with the OS.
//
// All temperatures in WeatherScenario are °C integers; we render a bare degree
// (e.g. "12°") and let the OS notification carry no unit, matching the app's
// minimal voice. Trigger times are built in the DEVICE-LOCAL wall clock from
// the city's local hour index — exact for the common case (viewing your own
// city) and close enough for remote cities.
// ---------------------------------------------------------------------------

import type { Condition, WeatherScenario } from '../data/weatherData';

/** A single derivable notification with a concrete future fire time. */
export interface DerivedEvent {
  /** Stable id (dedupes across re-derivations within the same day). */
  id: string;
  title: string;
  body: string;
  /** Local Date the OS should fire at. Always in the future (see deriveEvents). */
  triggerDate: Date;
}

// Tunables ------------------------------------------------------------------
const RAIN_POP = 50; // pop% that counts as "rain likely"
const EVENING_START = 18; // first evening hour (inclusive)
const EVENING_END = 23; // last evening hour (inclusive)
const COLD_DROP = 5; // °C below the day's high that counts as "notably cold"
const MILD_HI_MIN = 18; // comfortable-day high band (°C)
const MILD_HI_MAX = 30;
const MILD_LO_MIN = 8; // comfortable overnight low (°C)
const MILD_POP_MAX = 40; // a "nice day" shouldn't be wet
const BRIEFING_HOUR = 7; // morning briefing fires at ~7am local
const HEADSUP_HOUR = 19; // "tomorrow looks nice" evening heads-up (7pm)
const COLD_LEAD_MS = 90 * 60 * 1000; // fire the layer reminder ~90m before the dip

// Helpers -------------------------------------------------------------------

/** Build a device-local Date at `hour:00` on the day `dayOffset` from `nowMs`. */
function atHour(nowMs: number, hour: number, dayOffset = 0): Date {
  const d = new Date(nowMs);
  d.setHours(hour, 0, 0, 0);
  if (dayOffset) d.setDate(d.getDate() + dayOffset);
  return d;
}

/** Stable yyyy-mm-dd token for ids (device-local). */
function ymd(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Friendly lowercase phrase for a condition, for body copy. */
function condWord(cond: Condition): string {
  switch (cond) {
    case 'clear':
      return 'clear skies';
    case 'partly':
      return 'partly cloudy';
    case 'cloud':
      return 'cloudy';
    case 'rain':
      return 'rain';
    case 'snow':
      return 'snow';
    case 'fog':
      return 'fog';
    case 'storm':
      return 'storms';
    case 'night':
      return 'clear';
    default:
      return 'mixed';
  }
}

// ---------------------------------------------------------------------------
// deriveEvents
// ---------------------------------------------------------------------------

/**
 * Derive up to ~4 useful local notifications from the current weather.
 * Returns only events with a FUTURE triggerDate, sorted soonest-first. Pure and
 * non-throwing — bad/empty data simply yields fewer (or zero) events.
 */
export function deriveEvents(
  wx: WeatherScenario,
  nowEpochMs: number
): DerivedEvent[] {
  const events: DerivedEvent[] = [];
  const daySeries = wx?.daySeries ?? [];
  const days = wx?.days ?? [];

  // (1) Rain likely ~Xpm — first UPCOMING hour today at/over the pop threshold.
  for (const e of daySeries) {
    if (e.pop < RAIN_POP) continue;
    const t = atHour(nowEpochMs, e.hour);
    if (t.getTime() <= nowEpochMs) continue; // past hour → skip
    events.push({
      id: `rain-${ymd(t)}-${e.hour}`,
      title: `Rain likely around ${e.label}`,
      body: `${e.pop}% chance of rain around ${e.label}. Grab an umbrella before you head out.`,
      triggerDate: t,
    });
    break;
  }

  // (2) Cold tonight (Y°), grab a layer — coldest UPCOMING evening/night hour
  //     that sits notably below today's high.
  let coldHour = -1;
  let coldTemp = Infinity;
  let coldLabel = '';
  for (const e of daySeries) {
    if (e.hour < EVENING_START || e.hour > EVENING_END) continue;
    const t = atHour(nowEpochMs, e.hour);
    if (t.getTime() <= nowEpochMs) continue;
    if (e.temp < coldTemp) {
      coldTemp = e.temp;
      coldHour = e.hour;
      coldLabel = e.label;
    }
  }
  if (coldHour >= 0 && wx.hi - coldTemp >= COLD_DROP) {
    const coldDate = atHour(nowEpochMs, coldHour);
    let trig = new Date(coldDate.getTime() - COLD_LEAD_MS);
    if (trig.getTime() <= nowEpochMs) trig = coldDate; // no room for lead → fire at the dip
    if (trig.getTime() > nowEpochMs) {
      events.push({
        id: `cold-${ymd(coldDate)}-${coldHour}`,
        title: `Cold tonight (${coldTemp}°)`,
        body: `Dropping to ${coldTemp}° by ${coldLabel} tonight. Grab a layer before you head out.`,
        triggerDate: trig,
      });
    }
  }

  // (3) Clear & mild tomorrow — evening heads-up when day[1] looks great.
  const tomorrow = days[1];
  if (tomorrow) {
    const [tLabel, tCond, tLo, tHi, tPop] = tomorrow;
    const nice =
      (tCond === 'clear' || tCond === 'partly') &&
      tHi >= MILD_HI_MIN &&
      tHi <= MILD_HI_MAX &&
      tLo >= MILD_LO_MIN &&
      tPop < MILD_POP_MAX;
    if (nice) {
      const trig = atHour(nowEpochMs, HEADSUP_HOUR);
      if (trig.getTime() > nowEpochMs) {
        events.push({
          id: `mild-${ymd(trig)}`,
          title: 'Clear & mild tomorrow',
          body: `${tLabel} looks ${condWord(tCond)} with a high of ${tHi}°. Make the most of it.`,
          triggerDate: trig,
        });
      }
    }
  }

  // (4) Morning briefing at ~7am local with a tomorrow-ish summary. Fires today
  //     if it's still before 7am, otherwise the next morning.
  const nowHour = new Date(nowEpochMs).getHours();
  const briefingOffset = nowHour < BRIEFING_HOUR ? 0 : 1;
  const briefingDate = atHour(nowEpochMs, BRIEFING_HOUR, briefingOffset);
  // The day the briefing lands on: today (days[0]) if firing this morning,
  // tomorrow (days[1]) if firing the next morning.
  const summaryDay = days[briefingOffset] ?? days[0];
  if (summaryDay && briefingDate.getTime() > nowEpochMs) {
    const [sLabel, sCond, sLo, sHi, sPop] = summaryDay;
    const popPart = sPop >= RAIN_POP ? ` ${sPop}% chance of rain.` : '';
    events.push({
      id: `briefing-${ymd(briefingDate)}`,
      title: 'Your morning briefing',
      body: `${sLabel}: ${condWord(sCond)}, ${sLo}°–${sHi}°.${popPart}`,
      triggerDate: briefingDate,
    });
  }

  return events
    .filter((e) => e.triggerDate.getTime() > nowEpochMs)
    .sort((a, b) => a.triggerDate.getTime() - b.triggerDate.getTime());
}
