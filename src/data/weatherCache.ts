import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeatherScenario } from './weatherData';

const KEY_PREFIX = 'wxai.wx.';

export interface CachedWeather {
  ts: number;
  wx: WeatherScenario;
}

export async function saveWx(cityId: string, wx: WeatherScenario): Promise<void> {
  try {
    const entry: CachedWeather = { ts: Date.now(), wx };
    await AsyncStorage.setItem(KEY_PREFIX + cityId, JSON.stringify(entry));
  } catch {
    // best-effort cache
  }
}

export async function loadWx(cityId: string): Promise<CachedWeather | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + cityId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeather;
    if (!parsed || typeof parsed.ts !== 'number' || !parsed.wx) return null;
    return parsed;
  } catch {
    return null;
  }
}
