import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persisted state backed by AsyncStorage.
 * Returns [value, setValue, hydrated] — `hydrated` flips to true once the
 * stored value (if any) has been read, so consumers can gate initial work
 * on it and avoid double-fetching with the default value.
 */
export function useStorage<T>(
  key: string,
  defaultValue: T
): [T, (val: T) => void, boolean] {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;
        if (raw !== null) {
          try {
            setValue(JSON.parse(raw));
          } catch {}
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const set = useCallback(
    (val: T) => {
      setValue(val);
      AsyncStorage.setItem(key, JSON.stringify(val)).catch(() => {});
    },
    [key]
  );

  return [value, set, hydrated];
}
