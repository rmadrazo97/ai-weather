// ---------------------------------------------------------------------------
// Metric registry
//
// A single source of truth for the secondary weather metrics shown in the
// CONDITIONS grid (and their per-hour timelines). Each MetricDef knows how to
// pull its current value from a WeatherScenario, how to read its 24h series
// from `daySeries`, how to format a value, a plain-language explanation, and an
// optional indicator config (gradient / progress bar) for the tile.
// ---------------------------------------------------------------------------

import type { MetricName } from '../components/MetricIcon';
import type { DaySeriesEntry, WeatherScenario } from './weatherData';

export type MetricKey =
  | 'humidity'
  | 'pressure'
  | 'dew'
  | 'wind'
  | 'aqi'
  | 'uv'
  | 'visibility'
  | 'cloud';

export interface MetricSeriesPoint {
  hour: number;
  label: string;
  value: number | undefined;
  isNow: boolean;
  isPast: boolean;
}

export interface MetricIndicatorConfig {
  kind: 'gradient' | 'progress';
  min: number;
  max: number;
  /** Gradient color stops, left → right. Ignored for `progress`. */
  stops?: string[];
}

export interface MetricDef {
  key: MetricKey;
  label: string;
  iconName: MetricName;
  unit: string;
  getCurrent: (wx: WeatherScenario) => number | undefined;
  getSeries: (wx: WeatherScenario) => MetricSeriesPoint[];
  /** Format a raw numeric value (temps already converted by the caller). */
  format: (v: number) => string;
  explain: string;
  indicator?: MetricIndicatorConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round = (v: number): string => String(Math.round(v));

/** Build a getSeries reader for a `daySeries` field. */
function seriesReader(
  field: keyof DaySeriesEntry,
): (wx: WeatherScenario) => MetricSeriesPoint[] {
  return (wx) =>
    wx.daySeries.map((e) => ({
      hour: e.hour,
      label: e.label,
      value: e[field] as number | undefined,
      isNow: e.isNow,
      isPast: e.isPast,
    }));
}

// EPA AQI categories: green → yellow → orange → red → purple.
const AQI_STOPS = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7'];
// UV scale: low → moderate → high → very high → extreme.
const UV_STOPS = ['#3ec46d', '#f5d000', '#f59e0b', '#e11d48', '#8b5cf6'];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const METRICS: MetricDef[] = [
  {
    key: 'humidity',
    label: 'Humidity',
    iconName: 'humidity',
    unit: '%',
    getCurrent: (wx) => wx.humidity,
    getSeries: seriesReader('humidity'),
    format: round,
    explain:
      'Share of moisture in the air — higher values feel muggier and slow how fast sweat evaporates to cool you.',
    indicator: { kind: 'progress', min: 0, max: 100 },
  },
  {
    key: 'pressure',
    label: 'Pressure',
    iconName: 'pressure',
    unit: 'hPa',
    getCurrent: (wx) => wx.pressure,
    getSeries: seriesReader('pressure'),
    format: round,
    explain:
      'Air pressure at the surface — falling pressure often brings storms, while rising pressure points to clearer skies.',
  },
  {
    key: 'dew',
    label: 'Dew Point',
    iconName: 'dew',
    // Temp-like: stored °C, converted with fmtTemp at render time.
    unit: '°',
    getCurrent: (wx) => wx.dew,
    getSeries: seriesReader('dew'),
    format: round,
    explain:
      'The temperature at which air becomes saturated — the higher it is, the stickier and more humid it feels.',
  },
  {
    key: 'wind',
    label: 'Wind',
    iconName: 'wind',
    unit: 'km/h',
    getCurrent: (wx) => wx.wind,
    getSeries: seriesReader('wind'),
    format: round,
    explain:
      'Current wind speed — stronger wind makes it feel colder and can make outdoor plans harder.',
  },
  {
    key: 'aqi',
    label: 'Air Quality',
    iconName: 'aqi',
    unit: '',
    getCurrent: (wx) => wx.aqi,
    getSeries: seriesReader('aqi'),
    format: round,
    explain:
      'Air Quality Index — lower is cleaner; as it climbs, sensitive groups should limit time outdoors.',
    indicator: { kind: 'gradient', min: 0, max: 300, stops: AQI_STOPS },
  },
  {
    key: 'uv',
    label: 'UV',
    iconName: 'uv',
    unit: '',
    getCurrent: (wx) => wx.uv,
    getSeries: seriesReader('uv'),
    format: round,
    explain:
      'Strength of the sun’s ultraviolet rays, strongest midday — wear sunscreen and limit exposure when it is high.',
    indicator: { kind: 'gradient', min: 0, max: 11, stops: UV_STOPS },
  },
  {
    key: 'visibility',
    label: 'Visibility',
    iconName: 'vis',
    unit: 'km',
    getCurrent: (wx) => wx.vis,
    getSeries: seriesReader('visibility'),
    format: round,
    explain:
      'How far you can clearly see — cut down by fog, haze, or heavy rain.',
    indicator: { kind: 'progress', min: 0, max: 30 },
  },
  {
    key: 'cloud',
    label: 'Cloud Cover',
    iconName: 'cloud',
    unit: '%',
    // No scenario-level cloud field; read the current hour from daySeries.
    getCurrent: (wx) => wx.daySeries[wx.nowHour]?.cloud,
    getSeries: seriesReader('cloud'),
    format: round,
    explain:
      'Share of the sky covered by clouds — lower means clearer, sunnier skies.',
    indicator: { kind: 'progress', min: 0, max: 100 },
  },
];

const METRIC_BY_KEY: Record<MetricKey, MetricDef> = METRICS.reduce(
  (acc, m) => {
    acc[m.key] = m;
    return acc;
  },
  {} as Record<MetricKey, MetricDef>,
);

export function getMetric(key: MetricKey): MetricDef {
  return METRIC_BY_KEY[key];
}
