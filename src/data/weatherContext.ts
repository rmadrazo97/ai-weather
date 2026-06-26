// ---------------------------------------------------------------------------
// Builds the compact `context` payload sent with every weatherChat request.
// All temperatures in the summary are °C (the source of truth); the `unit`
// field tells the agent which unit to answer in.
// ---------------------------------------------------------------------------

import type { WeatherScenario, City } from './weatherData';
import type { WeatherChatContext } from '../lib/firebase';
import { formatLocalTime } from '../utils/liveClock';

const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, max) : s);

export function buildWeatherContext(
  wx: WeatherScenario,
  city: Pick<City, 'name' | 'lat' | 'lon'> | null | undefined,
  unit: 'C' | 'F',
): WeatherChatContext {
  const lines: string[] = [];

  lines.push(
    `Now: ${wx.temp}°C (feels ${wx.feels}°C), ${wx.label}${wx.isNight ? ', nighttime' : ''}`,
  );
  lines.push(`Today: high ${wx.hi}°C, low ${wx.lo}°C, precip chance ${wx.precip}%`);
  lines.push(`Humidity ${wx.humidity}%, dew point ${wx.dew}°C`);
  lines.push(`Wind ${wx.wind} km/h from ${wx.dir}, gusts ${wx.gust} km/h`);
  lines.push(`UV index ${wx.uv} (${wx.uvWord}), pressure ${wx.pressure} hPa`);
  if (typeof wx.vis === 'number') lines.push(`Visibility ${wx.vis} km`);
  lines.push(`Sunrise ${wx.sunrise}, sunset ${wx.sunset}`);
  if (typeof wx.aqi === 'number') {
    lines.push(`Air quality index ${wx.aqi}${wx.aqiWord ? ` (${wx.aqiWord})` : ''}`);
  }

  if (wx.hourly.length > 0) {
    const hourly = wx.hourly
      .slice(0, 8)
      .map((h) => `${h.h} ${h.temp}° ${h.pop}% rain`)
      .join('; ');
    lines.push(`Coming hours: ${hourly}`);
  }

  if (wx.days.length > 1) {
    // DayTuple = [label, cond, lo, hi, popMax]
    const days = wx.days
      .slice(1, 4)
      .map((d) => `${d[0]} ${d[1]} ${d[3]}°/${d[2]}° ${d[4]}% rain`)
      .join('; ');
    lines.push(`Next days: ${days}`);
  }

  if (wx.summary) lines.push(wx.summary);

  // Live local time for the city (the stored wx.time is rounded + frozen at
  // fetch); fall back to the stored value only if the offset is unavailable.
  const localTime =
    typeof wx.utcOffsetSeconds === 'number'
      ? formatLocalTime(wx.utcOffsetSeconds)
      : wx.time || new Date().toLocaleString();

  return {
    location: clip(city?.name || wx.location || 'Unknown', 80),
    lat: city?.lat ?? 0,
    lon: city?.lon ?? 0,
    unit,
    localTime: clip(localTime, 40),
    weatherSummary: clip(lines.join('\n'), 1500),
  };
}
