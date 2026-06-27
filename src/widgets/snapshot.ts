// ---------------------------------------------------------------------------
// Widget snapshot — shared contract (TypeScript writer side)
//
// COUNTERPART: targets/widgets/Model/WidgetSnapshot.swift (Swift Codable reader).
// JSON key names here MUST match the Swift struct field names byte-for-byte.
// If you rename/add a field, change BOTH files. See PRD 01 (shared data bridge).
//
// The app holds a full WeatherScenario only for the ACTIVE city. This module
// builds a trimmed, versioned JSON snapshot and writes it to the App Group's
// shared UserDefaults so the SwiftUI widget can render it without the RN runtime.
// All temperatures are stored in °C integers; `unit` drives render-time conversion.
// ---------------------------------------------------------------------------

import {
  getItem,
  reloadAllTimelines,
  removeItem,
  setItem,
} from '../../modules/expo-shared-defaults';
import {
  MY_LOCATION_ID,
  type City,
  type Condition,
  type WeatherScenario,
} from '../data/weatherData';

// ---------------------------------------------------------------------------
// Shared key contract (keep byte-consistent with PRD 03 / PRD 06 + Swift side)
// ---------------------------------------------------------------------------

export const WIDGET_KEYS = {
  active: 'wxai.widget.active', // full active-city snapshot (JSON)
  activeId: 'wxai.widget.activeId', // bare cityId string
  index: 'wxai.widget.index', // JSON array of { id, name, lat, lon }
  unit: 'wxai.widget.unit', // bare 'C' | 'F'
  snapshotPrefix: 'wxai.widget.snapshot.', // per-id: snapshotPrefix + cityId (JSON)
} as const;

export const SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Schema (mirror of WidgetSnapshot.swift)
// ---------------------------------------------------------------------------

export interface WidgetCityRef {
  id: string; // cityId(lat,lon) or 'my-location'
  name: string;
  lat: number; // from City.lat (NOT parsed from id)
  lon: number; // from City.lon
  admin1?: string;
  country?: string;
  isCurrentLocation?: boolean;
}

export interface WidgetCurrent {
  temp: number; // °C, integer
  feels: number; // °C
  hi: number; // °C   (hi >= lo)
  lo: number; // °C
  cond: Condition;
  label: string; // e.g. 'Partly cloudy'
  isNight: boolean;
  humidity: number; // %
  wind: number; // km/h
  precipProb: number; // %  <- wx.precip (NOT precipMm)
  uv: number;
  aqi?: number;
  aqiWord?: string;
  // --- Richer metric fields (SCHEMA_VERSION 1, additive/optional) ------------
  // Added for the colorful tile redesign. Backward compatible: the Swift reader
  // decodes them as optionals, so older writers (without these keys) still work
  // and older readers ignore them. Keep these AFTER the original fields.
  dir?: string; // wind compass direction, e.g. 'NW' (wx.dir)
  uvWord?: string; // UV qualitative word, e.g. 'High' (wx.uvWord)
  dew?: number; // dew point °C, integer (wx.dew)
}

export interface WidgetHeadline {
  pre: string;
  em: string;
  post: string;
}

export interface WidgetSun {
  sunrise: string; // pre-formatted display string (verbatim)
  sunset: string; // pre-formatted display string (verbatim)
  srHour: number; // raw decimal hour for arc math
  ssHour: number; // raw decimal hour
  sunPct: number; // 0–1
  isNight: boolean;
}

export interface WidgetHourlyPoint {
  h: string; // display label 'Now'/'3PM' (not Date-parseable)
  ts: number; // epoch ms — machine-readable (PRD 03)
  cond: Condition;
  temp: number; // °C
  pop: number; // % (0–100)
}

export interface WidgetDayForecast {
  label: string; // d[0]
  cond: Condition; // d[1]
  lo: number; // d[2]
  hi: number; // d[3]  (hi >= lo)
  pop: number; // d[4], % (0–100)
}

export interface WidgetSnapshot {
  schemaVersion: 1;
  generatedAt: number; // epoch ms
  tzOffsetMinutes: number; // source-city UTC offset
  unit: 'C' | 'F';
  staleAt?: number; // epoch ms of source cache when data is a stale fallback
  city: WidgetCityRef;
  current: WidgetCurrent;
  headline: WidgetHeadline;
  summary: string; // 2-sentence, for large widget
  sun: WidgetSun;
  hourly: WidgetHourlyPoint[]; // next 6
  days: WidgetDayForecast[]; // next 5
}

export interface WidgetIndexEntry {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/**
 * Derive the source city's UTC offset in minutes.
 *
 * The WeatherScenario does not carry the raw Open-Meteo `utc_offset_seconds`,
 * but it does carry `nowHour` — the city-local hour-of-day (0–23) for the
 * current instant. By comparing that against the device's current UTC time we
 * recover the city's offset to the nearest minute (Open-Meteo offsets are
 * whole minutes), wrapped into the (-720, 840] half-open range.
 */
function deriveTzOffsetMinutes(nowHour: number, now: number): number {
  const d = new Date(now);
  const utcMinutesOfDay = d.getUTCHours() * 60 + d.getUTCMinutes();
  // City local minutes-of-day at the top of `nowHour` (we only know the hour).
  // Anchor on the city minute portion = device UTC minute portion (both real-clock minutes).
  const cityMinutesOfDay = nowHour * 60 + d.getUTCMinutes();
  let diff = cityMinutesOfDay - utcMinutesOfDay; // == (nowHour - utcHour) * 60
  // Normalize across the day wrap into (-720, 840].
  while (diff <= -720) diff += 1440;
  while (diff > 840) diff -= 1440;
  return diff;
}

/**
 * Compute the epoch-ms timestamp for the city-local hour `localHour`
 * (which may exceed 23 to roll into the next day) given the snapshot's
 * generation instant and the derived tz offset.
 */
function tsForLocalHour(
  localHour: number,
  tzOffsetMinutes: number,
  now: number
): number {
  const d = new Date(now);
  // Midnight (UTC instant) of the city's current local day.
  const cityDayStartUtc =
    Math.floor((now + tzOffsetMinutes * 60000) / 86400000) * 86400000 -
    tzOffsetMinutes * 60000;
  return cityDayStartUtc + localHour * 3600000;
}

// ---------------------------------------------------------------------------
// buildSnapshot — pure mapping WeatherScenario (+ City) → WidgetSnapshot
// ---------------------------------------------------------------------------

export function buildSnapshot(
  wx: WeatherScenario,
  city: City,
  unit: 'C' | 'F',
  staleAt?: number
): WidgetSnapshot {
  const generatedAt = Date.now();
  const tzOffsetMinutes = deriveTzOffsetMinutes(wx.nowHour, generatedAt);

  // hi/lo guard: source `wx.hi`/`wx.lo` should already satisfy hi >= lo, but
  // defend against an upstream swap so the widget never renders an inverted range.
  const curHi = Math.max(wx.hi, wx.lo);
  const curLo = Math.min(wx.hi, wx.lo);

  const hourly: WidgetHourlyPoint[] = wx.hourly.slice(0, 6).map((entry, i) => ({
    h: entry.h,
    // hourly[i] corresponds to city-local hour (nowHour + i).
    ts: tsForLocalHour(wx.nowHour + i, tzOffsetMinutes, generatedAt),
    cond: entry.cond,
    temp: entry.temp,
    pop: entry.pop,
  }));

  const days: WidgetDayForecast[] = wx.days.slice(0, 5).map((d) => {
    const lo = Math.min(d[2], d[3]);
    const hi = Math.max(d[2], d[3]);
    return {
      label: d[0],
      cond: d[1],
      lo,
      hi,
      pop: d[4],
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    tzOffsetMinutes,
    unit,
    ...(staleAt !== undefined ? { staleAt } : {}),
    city: {
      id: city.id,
      name: city.name,
      lat: city.lat,
      lon: city.lon,
      ...(city.admin1 !== undefined ? { admin1: city.admin1 } : {}),
      ...(city.country !== undefined ? { country: city.country } : {}),
      ...(city.isCurrentLocation !== undefined
        ? { isCurrentLocation: city.isCurrentLocation }
        : {}),
    },
    current: {
      temp: wx.temp,
      feels: wx.feels,
      hi: curHi,
      lo: curLo,
      cond: wx.cond,
      label: wx.label,
      isNight: wx.isNight,
      humidity: wx.humidity,
      wind: wx.wind,
      precipProb: wx.precip, // percent — NOT precipMm
      uv: wx.uv,
      ...(wx.aqi !== undefined ? { aqi: wx.aqi } : {}),
      ...(wx.aqiWord !== undefined ? { aqiWord: wx.aqiWord } : {}),
      // Richer metric fields for the tile redesign (always present on the
      // WeatherScenario; written unconditionally, decoded as optionals in Swift).
      dir: wx.dir,
      uvWord: wx.uvWord,
      dew: wx.dew,
    },
    headline: {
      pre: wx.headline.pre,
      em: wx.headline.em,
      post: wx.headline.post,
    },
    summary: wx.summary,
    sun: {
      sunrise: wx.sunrise,
      sunset: wx.sunset,
      srHour: wx.srHour,
      ssHour: wx.ssHour,
      sunPct: wx.sunPct,
      isNight: wx.isNight,
    },
    hourly,
    days,
  };
}

// ---------------------------------------------------------------------------
// Writers — best-effort, never throw into the app render path.
// ---------------------------------------------------------------------------

let reloadTimer: ReturnType<typeof setTimeout> | undefined;

/** Coalesce rapid writes into a single budgeted WidgetKit reload. */
function requestReload(): void {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    reloadTimer = undefined;
    try {
      reloadAllTimelines();
    } catch {
      // best-effort
    }
  }, 400);
}

function readIndex(): WidgetIndexEntry[] {
  try {
    const raw = getItem(WIDGET_KEYS.index);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WidgetIndexEntry[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: WidgetIndexEntry[]): void {
  try {
    setItem(WIDGET_KEYS.index, JSON.stringify(entries));
  } catch {
    // best-effort
  }
}

/** Insert/update a city's index entry (keyed by id). */
function upsertIndexEntry(city: City): void {
  const entries = readIndex();
  const next: WidgetIndexEntry = {
    id: city.id,
    name: city.name,
    lat: city.lat,
    lon: city.lon,
  };
  const i = entries.findIndex((e) => e.id === city.id);
  if (i >= 0) entries[i] = next;
  else entries.push(next);
  writeIndex(entries);
}

/**
 * Write the ACTIVE city's full snapshot to the shared container under both the
 * active-pointer key and the per-id key, refresh activeId + index, then request
 * a debounced widget reload. Best-effort: swallows all errors.
 */
export function writeWidgetSnapshot(
  city: City,
  wx: WeatherScenario,
  unit: 'C' | 'F',
  staleAt?: number
): void {
  try {
    const snapshot = buildSnapshot(wx, city, unit, staleAt);
    const json = JSON.stringify(snapshot);
    setItem(WIDGET_KEYS.active, json);
    setItem(WIDGET_KEYS.snapshotPrefix + city.id, json);
    setItem(WIDGET_KEYS.activeId, city.id);
    upsertIndexEntry(city);
    requestReload();
  } catch {
    // best-effort — never throw into the app's render path
  }
}

/**
 * Mirror the temperature unit into the shared container (bare string) and flip
 * the already-stored active snapshot's `unit` so the widget switches °C/°F
 * without waiting for the next fetch. Requests a debounced reload.
 */
export function writeUnit(unit: 'C' | 'F'): void {
  try {
    setItem(WIDGET_KEYS.unit, unit);
    const raw = getItem(WIDGET_KEYS.active);
    if (raw) {
      try {
        const snap = JSON.parse(raw) as WidgetSnapshot;
        snap.unit = unit;
        const json = JSON.stringify(snap);
        setItem(WIDGET_KEYS.active, json);
        if (snap.city?.id) {
          setItem(WIDGET_KEYS.snapshotPrefix + snap.city.id, json);
        }
      } catch {
        // active snapshot unparseable — unit key still mirrored
      }
    }
    requestReload();
  } catch {
    // best-effort
  }
}

/**
 * Prune a custom city's per-id snapshot and its index entry. Presets and
 * my-location cannot be removed in-app, so callers should only invoke this for
 * custom cities; we guard against my-location regardless.
 */
export function removeCitySnapshot(cityId: string): void {
  if (cityId === MY_LOCATION_ID) return;
  try {
    removeItem(WIDGET_KEYS.snapshotPrefix + cityId);
    const entries = readIndex().filter((e) => e.id !== cityId);
    writeIndex(entries);
    requestReload();
  } catch {
    // best-effort
  }
}
