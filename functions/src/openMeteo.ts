/**
 * Open-Meteo fetch helpers + compact text formatters.
 *
 * Tool outputs are rendered as terse human-readable text (not raw JSON)
 * to keep LLM token cost low.
 */

const FETCH_TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed (${res.status} ${res.statusText})`);
  }
  return res.json();
}

/** WMO weather interpretation codes → short description. */
const WMO: Record<number, string> = {
  0: 'clear sky',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'depositing rime fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'dense drizzle',
  56: 'light freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'light freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'light showers',
  81: 'showers',
  82: 'violent showers',
  85: 'light snow showers',
  86: 'snow showers',
  95: 'thunderstorm',
  96: 'thunderstorm with light hail',
  99: 'thunderstorm with heavy hail',
};

export function wmoDescription(code: number): string {
  return WMO[code] ?? `weather code ${code}`;
}

/** US EPA AQI band word. */
export function usAqiBand(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

export async function fetchForecast(lat: number, lon: number): Promise<any> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day' +
    '&hourly=temperature_2m,precipitation_probability,weather_code&forecast_hours=24' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset,uv_index_max&forecast_days=7' +
    '&timezone=auto';
  return getJson(url);
}

export function formatForecast(data: any): string {
  const lines: string[] = [];
  const cur = data.current ?? {};
  const cu = data.current_units ?? {};
  const tUnit = cu.temperature_2m ?? '°C';
  const wUnit = cu.wind_speed_10m ?? 'km/h';

  lines.push(
    `Now (${cur.time ?? '?'}, ${data.timezone ?? 'local'}): ` +
      `${cur.temperature_2m}${tUnit} (feels ${cur.apparent_temperature}${tUnit}), ` +
      `${wmoDescription(Number(cur.weather_code))}, ` +
      `humidity ${cur.relative_humidity_2m}%, wind ${cur.wind_speed_10m} ${wUnit}, ` +
      `precip ${cur.precipitation} mm, ${cur.is_day ? 'day' : 'night'}`
  );

  const h = data.hourly;
  if (h?.time?.length) {
    lines.push('Next 24h (time temp/rain%/sky):');
    const parts: string[] = [];
    for (let i = 0; i < h.time.length; i += 3) {
      const hh = String(h.time[i]).slice(11, 16);
      parts.push(
        `${hh} ${Math.round(h.temperature_2m[i])}°/${h.precipitation_probability[i]}%/${wmoDescription(
          Number(h.weather_code[i])
        )}`
      );
    }
    lines.push('  ' + parts.join('; '));
  }

  const d = data.daily;
  if (d?.time?.length) {
    lines.push('Next 7 days:');
    for (let i = 0; i < d.time.length; i++) {
      lines.push(
        `  ${d.time[i]}: ${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}${tUnit}, ` +
          `rain ${d.precipitation_probability_max[i]}%, ${wmoDescription(Number(d.weather_code[i]))}, ` +
          `UV ${d.uv_index_max[i]}, sunrise ${String(d.sunrise[i]).slice(11, 16)}, sunset ${String(
            d.sunset[i]
          ).slice(11, 16)}`
      );
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Air quality
// ---------------------------------------------------------------------------

export async function fetchAirQuality(lat: number, lon: number): Promise<any> {
  const url =
    'https://air-quality-api.open-meteo.com/v1/air-quality' +
    `?latitude=${lat}&longitude=${lon}` +
    '&current=us_aqi,european_aqi,pm2_5,pm10,ozone';
  return getJson(url);
}

export function formatAirQuality(data: any): string {
  const cur = data.current ?? {};
  if (cur.us_aqi == null) return 'No air quality data available for this location.';
  return (
    `Air quality (${cur.time ?? 'now'}): US AQI ${cur.us_aqi} (${usAqiBand(Number(cur.us_aqi))}), ` +
    `European AQI ${cur.european_aqi}, PM2.5 ${cur.pm2_5} µg/m³, PM10 ${cur.pm10} µg/m³, ozone ${cur.ozone} µg/m³`
  );
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

export async function fetchGeocode(name: string): Promise<any> {
  const url =
    'https://geocoding-api.open-meteo.com/v1/search' +
    `?name=${encodeURIComponent(name)}&count=3&language=en`;
  return getJson(url);
}

export function formatGeocode(data: any, query: string): string {
  const results = data.results;
  if (!Array.isArray(results) || results.length === 0) {
    return `No places found matching "${query}".`;
  }
  const lines = results.map((r: any) => {
    const region = [r.admin1, r.country].filter(Boolean).join(', ');
    return `${r.name}${region ? ` (${region})` : ''}: lat ${r.latitude}, lon ${r.longitude}`;
  });
  return 'Matches:\n' + lines.join('\n');
}
