import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  fetchForecast,
  formatForecast,
  fetchAirQuality,
  formatAirQuality,
  fetchGeocode,
  formatGeocode,
} from './openMeteo';

function errorText(action: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `Sorry, I couldn't ${action} right now (${msg}). Let the user know the data is temporarily unavailable.`;
}

export const getWeatherTool = tool(
  async ({ lat, lon, days }) => {
    try {
      const data = await fetchForecast(lat, lon, days);
      return formatForecast(data);
    } catch (err) {
      return errorText('fetch the weather forecast', err);
    }
  },
  {
    name: 'get_weather',
    description:
      'Get current conditions, a 24-hour outlook, and a multi-day daily forecast (up to 14 days, ' +
      'with high/low and feels-like temps, precip chance, and max wind) for a latitude/longitude. ' +
      'Use the optional "days" argument to request only as many days as you need. ' +
      'If you only have a city name (not coordinates), call geocode_city first to get lat/lon.',
    schema: z.object({
      lat: z.number().min(-90).max(90).describe('Latitude in decimal degrees'),
      lon: z.number().min(-180).max(180).describe('Longitude in decimal degrees'),
      days: z
        .number()
        .int()
        .min(1)
        .max(14)
        .optional()
        .describe('Number of forecast days to return (1–14). Defaults to ~10 if omitted.'),
    }),
  }
);

export const getAirQualityTool = tool(
  async ({ lat, lon }) => {
    try {
      const data = await fetchAirQuality(lat, lon);
      return formatAirQuality(data);
    } catch (err) {
      return errorText('fetch air quality data', err);
    }
  },
  {
    name: 'get_air_quality',
    description:
      'Get current air quality (US AQI with EPA band, European AQI, PM2.5, PM10, ozone) for a latitude/longitude. ' +
      'If you only have a city name (not coordinates), call geocode_city first to get lat/lon.',
    schema: z.object({
      lat: z.number().min(-90).max(90).describe('Latitude in decimal degrees'),
      lon: z.number().min(-180).max(180).describe('Longitude in decimal degrees'),
    }),
  }
);

export const geocodeCityTool = tool(
  async ({ name }) => {
    try {
      const data = await fetchGeocode(name);
      return formatGeocode(data, name);
    } catch (err) {
      return errorText('look up that place', err);
    }
  },
  {
    name: 'geocode_city',
    description:
      'Look up a city or place by name and return up to 3 matches with their coordinates. ' +
      'Use this first whenever you need weather or air quality for a location you only know by name.',
    schema: z.object({
      name: z.string().min(1).max(100).describe('City or place name, e.g. "Berlin"'),
    }),
  }
);

export const weatherTools = [getWeatherTool, getAirQualityTool, geocodeCityTool];
