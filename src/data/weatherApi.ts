import type {
  City,
  Condition,
  DaySeriesEntry,
  DayTuple,
  HourlyEntry,
  WeatherScenario,
} from './weatherData';
import { cityId } from './weatherData';
import { buildHeadline, buildPrecipNote, buildSummary } from './summary';
import type { SummaryInput } from './summary';

// ---------------------------------------------------------------------------
// City search (geocoding)
// ---------------------------------------------------------------------------

export async function searchCities(
  query: string,
  signal?: AbortSignal
): Promise<City[]> {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}` +
    `&count=8&language=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocoding responded ${res.status}`);
  const data = await res.json();
  const results: any[] = data?.results ?? [];
  return results.map((r) => ({
    id: cityId(r.latitude, r.longitude),
    name: r.name,
    admin1: r.admin1 || undefined,
    country: r.country || undefined,
    lat: r.latitude,
    lon: r.longitude,
  }));
}

// ---------------------------------------------------------------------------
// Batch current conditions for the city list
// ---------------------------------------------------------------------------

export interface CityCurrent {
  temp: number;
  cond: Condition;
  label: string;
  humidity: number;
}

export async function fetchCitiesCurrent(
  cities: City[]
): Promise<Record<string, CityCurrent>> {
  if (cities.length === 0) return {};
  const lats = cities.map((c) => c.lat).join(',');
  const lons = cities.map((c) => c.lon).join(',');
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,is_day`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  const d = await res.json();
  // CAUTION: a single location returns a plain object; multiple return an array.
  const arr: any[] = Array.isArray(d) ? d : [d];

  const out: Record<string, CityCurrent> = {};
  cities.forEach((c, i) => {
    const cur = arr[i]?.current;
    if (!cur) return;
    const { cond, label } = wmoInfo(cur.weather_code, cur.is_day === 1);
    out[c.id] = {
      temp: Math.round(cur.temperature_2m),
      cond,
      label,
      humidity: Math.round(cur.relative_humidity_2m),
    };
  });
  return out;
}

// ---------------------------------------------------------------------------
// Weather fetch (throws on failure)
// ---------------------------------------------------------------------------

export async function fetchWeather(
  lat: number,
  lon: number,
  displayName: string
): Promise<WeatherScenario> {
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,cloud_cover,is_day` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,is_day,visibility,dew_point_2m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset,uv_index_max` +
    `&forecast_days=10&timezone=auto`;

  const aqiUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=us_aqi`;

  // AQI failure must never fail the weather fetch.
  const [wxResult, aqiResult] = await Promise.allSettled([
    fetch(forecastUrl),
    fetch(aqiUrl),
  ]);

  if (wxResult.status === 'rejected') throw wxResult.reason;
  const res = wxResult.value;
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  const data = await res.json();

  let aqi: number | undefined;
  if (aqiResult.status === 'fulfilled' && aqiResult.value.ok) {
    try {
      const aqiData = await aqiResult.value.json();
      const v = aqiData?.current?.us_aqi;
      if (typeof v === 'number') aqi = Math.round(v);
    } catch {
      // ignore — AQI is optional
    }
  }

  return buildScenario(data, displayName, aqi);
}

// ---------------------------------------------------------------------------
// WMO weather-code mapping (visual condition + text label)
// ---------------------------------------------------------------------------

function wmoInfo(code: number, isDay: boolean): { cond: Condition; label: string } {
  let cond: Condition;
  let label: string;

  if (code <= 1) {
    cond = 'clear';
    label = isDay ? 'Sunny' : 'Clear';
  } else if (code === 2) {
    cond = 'partly';
    label = 'Partly cloudy';
  } else if (code === 3) {
    cond = 'cloud';
    label = 'Overcast';
  } else if (code === 45 || code === 48) {
    cond = 'fog';
    label = 'Fog';
  } else if (code >= 51 && code <= 57) {
    cond = 'rain';
    label = 'Drizzle';
  } else if (code >= 61 && code <= 67) {
    cond = 'rain';
    label = code >= 66 ? 'Freezing rain' : 'Rain';
  } else if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    cond = 'snow';
    label = 'Snow';
  } else if (code >= 80 && code <= 82) {
    cond = 'rain';
    label = 'Showers';
  } else if (code >= 95) {
    cond = 'storm';
    label = 'Thunderstorm';
  } else {
    cond = 'cloud';
    label = 'Cloudy';
  }

  // At night, only clear/cloudy skies render as the night glyph; precipitation,
  // fog and storms keep their own visual.
  if (!isDay && code <= 3) cond = 'night';

  return { cond, label };
}

// ---------------------------------------------------------------------------
// Word helpers
// ---------------------------------------------------------------------------

function uvWord(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

/** EPA US AQI bands. */
export function aqiWord(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(deg / 45) % 8;
  return `${Math.round(deg)}° ${dirs[idx]}`;
}

// ---------------------------------------------------------------------------
// Time formatting helpers
// ---------------------------------------------------------------------------

/** Format an ISO datetime string like "2026-06-10T06:44" to "6:44". */
function formatTimeShort(iso: string): string {
  const timePart = iso.includes('T') ? iso.split('T')[1] : iso;
  const [hStr, mStr] = timePart.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  return `${h}:${m}`;
}

/** Format current time from ISO string to "H:MM AM/PM". */
function formatCurrentTime(iso: string): string {
  const timePart = iso.includes('T') ? iso.split('T')[1] : iso;
  const [hStr, mStr] = timePart.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/** Parse an ISO time string to decimal hours. */
function isoToDecimalHour(iso: string): number {
  const timePart = iso.includes('T') ? iso.split('T')[1] : iso;
  const [h, m] = timePart.split(':').map(Number);
  return h + (m || 0) / 60;
}

function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  if (hh === 0) return '12AM';
  if (hh === 12) return '12PM';
  return hh < 12 ? `${hh}AM` : `${hh - 12}PM`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Build the full WeatherScenario from the API response
// ---------------------------------------------------------------------------

function buildScenario(
  data: any,
  displayName: string,
  aqi: number | undefined
): WeatherScenario {
  const current = data.current;
  const hourly = data.hourly;
  const daily = data.daily;

  const weatherCode: number = current.weather_code;
  const isNight = current.is_day === 0;
  const sunriseIso: string = daily.sunrise[0];
  const sunsetIso: string = daily.sunset[0];
  const currentTimeIso: string = current.time;

  const currentHour = isoToDecimalHour(currentTimeIso);
  const srHour = isoToDecimalHour(sunriseIso);
  const ssHour = isoToDecimalHour(sunsetIso);

  // Current-hour index: timezone=auto means hourly index 0 is local midnight;
  // find the hourly slot whose date-hour prefix matches current.time.
  const nowPrefix = currentTimeIso.slice(0, 13);
  let nowHour = (hourly.time as string[]).findIndex(
    (t) => t.slice(0, 13) === nowPrefix
  );
  if (nowHour < 0) nowHour = Math.floor(currentHour);
  nowHour = Math.max(0, Math.min(23, nowHour));

  const { cond, label } = wmoInfo(weatherCode, !isNight);

  // Sun progress percentage (0 = sunrise, 1 = sunset, clamped)
  let sunPct: number;
  if (currentHour < srHour) sunPct = 0;
  else if (currentHour >= ssHour) sunPct = 1;
  else sunPct = Math.round(((currentHour - srHour) / (ssHour - srHour)) * 100) / 100;

  const temp = Math.round(current.temperature_2m);
  const feels = Math.round(current.apparent_temperature);
  const humidity = Math.round(current.relative_humidity_2m);
  const precipPct = Math.round(daily.precipitation_probability_max[0] ?? 0);
  const precipMm = Math.round(current.precipitation * 10) / 10;
  const hi = Math.round(daily.temperature_2m_max[0]);
  const lo = Math.round(daily.temperature_2m_min[0]);
  const uv = Math.round(daily.uv_index_max[0] ?? 0);
  const wind = Math.round(current.wind_speed_10m);
  const gust = Math.round(current.wind_gusts_10m);
  const pressure = Math.round(current.surface_pressure);

  // Real visibility (meters → km) and dew point at the current hour.
  const visMeters = hourly.visibility?.[nowHour];
  const vis =
    typeof visMeters === 'number' ? Math.round(visMeters / 1000) : 10;
  const dewVal = hourly.dew_point_2m?.[nowHour];
  const dew = typeof dewVal === 'number' ? Math.round(dewVal) : temp;

  // Full 24h series for today (local hours 0–23), with real apparent temps.
  const daySeries: DaySeriesEntry[] = [];
  for (let i = 0; i < 24 && i < hourly.time.length; i++) {
    const hIsDay = hourly.is_day[i] === 1;
    const info = wmoInfo(hourly.weather_code[i], hIsDay);
    daySeries.push({
      hour: i,
      label: hourLabel(i),
      temp: Math.round(hourly.temperature_2m[i]),
      feels: Math.round(hourly.apparent_temperature[i]),
      cond: info.cond,
      pop: Math.round(hourly.precipitation_probability[i] ?? 0),
      isNow: i === nowHour,
      isPast: i < nowHour,
    });
  }

  // Hourly forecast: next 8 hours from the current hour.
  const hourlyEntries: HourlyEntry[] = [];
  for (let i = 0; i < 8; i++) {
    const idx = nowHour + i;
    if (idx >= hourly.time.length) break;
    const hIsDay = hourly.is_day[idx] === 1;
    const info = wmoInfo(hourly.weather_code[idx], hIsDay);
    hourlyEntries.push({
      h: i === 0 ? 'Now' : hourLabel(Math.floor(isoToDecimalHour(hourly.time[idx]))),
      cond: info.cond,
      temp: Math.round(hourly.temperature_2m[idx]),
      pop: Math.round(hourly.precipitation_probability[idx] ?? 0),
    });
  }

  // Daily forecast: up to 10 days.
  const dayEntries: DayTuple[] = [];
  const dayCount = Math.min(daily.time.length, 10);
  for (let i = 0; i < dayCount; i++) {
    const date = new Date(daily.time[i] + 'T00:00:00');
    const dayLabelStr = i === 0 ? 'Today' : DAY_NAMES[date.getDay()];
    const dInfo = wmoInfo(daily.weather_code[i], true);
    dayEntries.push([
      dayLabelStr,
      dInfo.cond,
      Math.round(daily.temperature_2m_min[i]),
      Math.round(daily.temperature_2m_max[i]),
      Math.round(daily.precipitation_probability_max[i] ?? 0),
    ]);
  }

  const summaryInput: SummaryInput = {
    cond,
    label,
    temp,
    hi,
    lo,
    wind,
    uv,
    isNight,
    daySeries,
    nowHour,
    dailyPop: dayEntries.map((d) => d[4]),
    dayLabels: dayEntries.map((d) => d[0]),
    dailyCond: dayEntries.map((d) => d[1]),
    precipMm,
  };

  return {
    cond,
    label,
    location: displayName,
    time: formatCurrentTime(currentTimeIso),
    utcOffsetSeconds:
      typeof data.utc_offset_seconds === 'number' ? data.utc_offset_seconds : 0,
    temp,
    feels,
    humidity,
    precip: precipPct,
    precipMm,
    hi,
    lo,
    uv,
    uvWord: uvWord(uv),
    vis,
    wind,
    gust,
    dir: degreesToCompass(current.wind_direction_10m),
    pressure,
    dew,
    sunrise: formatTimeShort(sunriseIso),
    sunset: formatTimeShort(sunsetIso),
    sunPct,
    isNight,
    aqi,
    aqiWord: aqi !== undefined ? aqiWord(aqi) : undefined,
    headline: buildHeadline(summaryInput),
    summary: buildSummary(summaryInput),
    precipNote: buildPrecipNote(summaryInput),
    hourly: hourlyEntries,
    days: dayEntries,
    daySeries,
    nowHour,
    srHour,
    ssHour,
  };
}
