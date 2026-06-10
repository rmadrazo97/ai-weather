// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Condition =
  | 'clear'
  | 'cloud'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'storm'
  | 'night';

export interface HourlyEntry {
  h: string;
  cond: Condition;
  temp: number;
  pop: number;
}

export type DayTuple = [string, Condition, number, number, number];

export interface Headline {
  pre: string;
  em: string;
  post: string;
}

export interface DaySeriesEntry {
  hour: number;
  label: string;
  temp: number;
  feels: number;
  cond: Condition;
  pop: number;
  isNow: boolean;
  isPast: boolean;
}

export interface WeatherScenario {
  cond: Condition;
  label: string;
  location: string;
  time: string;
  temp: number;
  feels: number;
  humidity: number;
  precip: number;
  precipMm: number;
  hi: number;
  lo: number;
  uv: number;
  uvWord: string;
  vis: number;
  wind: number;
  gust: number;
  dir: string;
  pressure: number;
  dew: number;
  sunrise: string;
  sunset: string;
  sunPct: number;
  isNight: boolean;
  aqi?: number;
  aqiWord?: string;
  /** Set when showing cached data after a failed refresh (epoch ms of cache). */
  staleAt?: number;
  headline: Headline;
  summary: string;
  precipNote: string;
  hourly: HourlyEntry[];
  days: DayTuple[];
  /** Real 24h series for today (local hours 0–23). */
  daySeries: DaySeriesEntry[];
  nowHour: number;
  srHour: number;
  ssHour: number;
}

// ---------------------------------------------------------------------------
// City model
// ---------------------------------------------------------------------------

export interface City {
  id: string;
  name: string;
  admin1?: string;
  country?: string;
  lat: number;
  lon: number;
  custom?: boolean;
  isCurrentLocation?: boolean;
}

/** Reserved id for the device-location pseudo-city. */
export const MY_LOCATION_ID = 'my-location';

/** Stable city id derived from coordinates. */
export function cityId(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export const PRESET_CITIES: City[] = [
  { id: cityId(40.4168, -3.7038), name: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038 },
  { id: cityId(52.52, 13.405), name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
  { id: cityId(51.5072, -0.1276), name: 'London', country: 'United Kingdom', lat: 51.5072, lon: -0.1276 },
  { id: cityId(38.7223, -9.1393), name: 'Lisbon', country: 'Portugal', lat: 38.7223, lon: -9.1393 },
];
