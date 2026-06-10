import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { City } from '../data/weatherData';
import { MY_LOCATION_ID } from '../data/weatherData';

const STORAGE_KEY = 'wxai.myLocation.v1';

export type MyLocationStatus =
  | 'idle' // never asked / no fix yet
  | 'loading' // permission prompt or fix in flight
  | 'ready' // we have a located City
  | 'denied' // permission denied — user must open Settings
  | 'error'; // permission granted but no position available

export interface MyLocationState {
  status: MyLocationStatus;
  city: City | null;
  /** Ask for permission (if needed) and resolve the current location. */
  request: () => Promise<City | null>;
}

// ---------------------------------------------------------------------------
// Reverse geocoding chain: expo-location → BigDataCloud (keyless) → fallback.
// ---------------------------------------------------------------------------

async function reverseGeocodeName(lat: number, lon: number): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lon,
    });
    const r = results?.[0];
    const name = r?.city ?? r?.subregion ?? r?.region;
    if (name) return name;
  } catch {
    // fall through to keyless web fallback
  }

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (res.ok) {
      const d = await res.json();
      const name = d?.city || d?.locality || d?.principalSubdivision;
      if (name) return name;
    }
  } catch {
    // ignore
  }

  return 'My Location';
}

function buildCity(lat: number, lon: number, name: string): City {
  return {
    id: MY_LOCATION_ID,
    name,
    lat,
    lon,
    isCurrentLocation: true,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMyLocation(): MyLocationState {
  const [status, setStatus] = useState<MyLocationStatus>('idle');
  const [city, setCity] = useState<City | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Hydrate any previously located city without prompting for permission.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && mounted.current) {
          const saved = JSON.parse(raw) as City;
          if (saved && saved.id === MY_LOCATION_ID) {
            setCity(saved);
            setStatus('ready');
          }
        }
        const perm = await Location.getForegroundPermissionsAsync();
        if (mounted.current && perm.status === 'denied' && !perm.canAskAgain) {
          setStatus('denied');
        }
      } catch {
        // never block the app on location
      }
    })();
  }, []);

  const request = useCallback(async (): Promise<City | null> => {
    setStatus('loading');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (mounted.current) setStatus('denied');
        return null;
      }

      // Instant (possibly stale) fix first, then a fresh coarse fix.
      let pos = await Location.getLastKnownPositionAsync();
      if (!pos) {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
      } else {
        // Refresh in the background; we don't need to await it for the UI.
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low })
          .then(async (fresh) => {
            if (!fresh || !mounted.current) return;
            const name = await reverseGeocodeName(
              fresh.coords.latitude,
              fresh.coords.longitude
            );
            const updated = buildCity(
              fresh.coords.latitude,
              fresh.coords.longitude,
              name
            );
            if (mounted.current) {
              setCity(updated);
              setStatus('ready');
            }
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(
              () => {}
            );
          })
          .catch(() => {});
      }

      if (!pos) {
        if (mounted.current) setStatus('error');
        return null;
      }

      const name = await reverseGeocodeName(
        pos.coords.latitude,
        pos.coords.longitude
      );
      const located = buildCity(pos.coords.latitude, pos.coords.longitude, name);
      if (mounted.current) {
        setCity(located);
        setStatus('ready');
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(located)).catch(() => {});
      return located;
    } catch {
      if (mounted.current) setStatus('error');
      return null;
    }
  }, []);

  return { status, city, request };
}
