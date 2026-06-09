import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useStorage<T>(key: string, defaultValue: T): [T, (val: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(key).then((raw) => {
      if (raw !== null) {
        try {
          setValue(JSON.parse(raw));
        } catch {}
      }
      setLoaded(true);
    });
  }, [key]);

  const set = (val: T) => {
    setValue(val);
    AsyncStorage.setItem(key, JSON.stringify(val)).catch(() => {});
  };

  return [value, set];
}
