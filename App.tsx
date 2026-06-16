import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HeroScreen from './src/components/HeroScreen';
import DetailsView from './src/components/DetailsView';
import AskButton from './src/components/AskButton';
import ChatSheet from './src/components/ChatSheet';
import CitySheet from './src/components/CitySheet';
import HourlyExpandedSheet from './src/components/HourlyExpandedSheet';
import StatusBanner from './src/components/StatusBanner';
import ErrorBoundary from './src/components/ErrorBoundary';
import { PRESET_CITIES } from './src/data/weatherData';
import type { City, Condition, WeatherScenario } from './src/data/weatherData';
import {
  writeWidgetSnapshot,
  writeUnit,
  removeCitySnapshot,
} from './src/widgets/snapshot';
import { fetchWeather, fetchCitiesCurrent, searchCities } from './src/data/weatherApi';
import type { CityCurrent } from './src/data/weatherApi';
import { saveWx, loadWx } from './src/data/weatherCache';
import { GRADIENTS, INK, MUTED } from './src/utils/colors';
import { useStorage } from './src/hooks/useStorage';
import { useMyLocation } from './src/hooks/useMyLocation';

const { height: SCREEN_H } = Dimensions.get('window');

const CITY_WX_STALE_MS = 10 * 60 * 1000; // 10 minutes

interface CityWxStore {
  ts: number;
  data: Record<string, CityCurrent>;
}

/** Format an epoch ms timestamp as "5:12 PM" for the stale banner. */
function formatClock(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

/** Best-effort migration of a v1 city entry ({ name, cond, custom }) to a City. */
async function migrateCityName(name: string): Promise<City | null> {
  const preset = PRESET_CITIES.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (preset) return preset;
  try {
    const results = await searchCities(name);
    return results[0] ?? null;
  } catch {
    return null;
  }
}

function AppInner() {
  // Persisted state (v2 keys hold full City objects with coordinates)
  const [customCities, setCustomCities, citiesHydrated] = useStorage<City[]>(
    'wxai.cities.v2',
    []
  );
  const [activeCity, setActiveCity, activeHydrated] = useStorage<City | null>(
    'wxai.activeCity.v2',
    null
  );
  const [cityWxStore, setCityWxStore, cityWxHydrated] = useStorage<CityWxStore>(
    'wxai.citiesWx',
    { ts: 0, data: {} }
  );

  // UI state
  const [unit, setUnit] = useStorage<'C' | 'F'>('wxai.unit', 'C');
  const [chatOpen, setChatOpen] = useState(false);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const [hourlyOpen, setHourlyOpen] = useState(false);

  // Weather data state
  const [wx, setWx] = useState<WeatherScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [migrationDone, setMigrationDone] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const myLocation = useMyLocation();

  // Mirror the latest unit into a ref so loadWeather can write the widget
  // snapshot with the current unit without taking `unit` as a dependency
  // (which would re-create the callback and re-trigger the fetch effect).
  const unitRef = useRef(unit);
  unitRef.current = unit;

  // Resolve current city
  const city = activeCity ?? PRESET_CITIES[0];

  // ---------------------------------------------------------------------
  // One-time migration of v1 storage (names only) → v2 (full City objects)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!citiesHydrated || !activeHydrated || migrationDone) return;
    let cancelled = false;
    (async () => {
      try {
        const [oldCitiesRaw, oldActiveRaw] = await Promise.all([
          AsyncStorage.getItem('wxai.cities'),
          AsyncStorage.getItem('wxai.activeCity'),
        ]);

        if (oldCitiesRaw) {
          try {
            const oldCities: Array<{ name: string }> = JSON.parse(oldCitiesRaw);
            const migrated: City[] = [];
            for (const entry of oldCities) {
              if (!entry?.name) continue;
              const c = await migrateCityName(entry.name);
              if (c && !PRESET_CITIES.some((p) => p.id === c.id)) {
                migrated.push({ ...c, custom: true });
              }
            }
            if (!cancelled && migrated.length > 0) setCustomCities(migrated);
          } catch {}
        }

        if (oldActiveRaw) {
          try {
            const oldActive: { name?: string } | null = JSON.parse(oldActiveRaw);
            if (oldActive?.name) {
              const c = await migrateCityName(oldActive.name);
              if (!cancelled) setActiveCity(c ?? PRESET_CITIES[0]);
            }
          } catch {}
        }

        if (oldCitiesRaw !== null || oldActiveRaw !== null) {
          await AsyncStorage.multiRemove(['wxai.cities', 'wxai.activeCity']);
        }
      } catch {
        // Migration is best-effort; never block the app.
      }
      if (!cancelled) setMigrationDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [citiesHydrated, activeHydrated, migrationDone, setCustomCities, setActiveCity]);

  // ---------------------------------------------------------------------
  // Weather loading with offline cache fallback
  // ---------------------------------------------------------------------
  const loadWeather = useCallback(async (c: City, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else {
      setLoading(true);
      setLoadFailed(false);
    }

    try {
      const data = await fetchWeather(c.lat, c.lon, c.name);
      setWx(data);
      setLoadFailed(false);
      saveWx(c.id, data);
      writeWidgetSnapshot(c, data, unitRef.current);
    } catch {
      const cached = await loadWx(c.id);
      if (cached) {
        setWx({ ...cached.wx, location: c.name, staleAt: cached.ts });
        writeWidgetSnapshot(
          c,
          { ...cached.wx, location: c.name },
          unitRef.current,
          cached.ts
        );
      } else {
        setWx(null);
        setLoadFailed(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch on city change — gated on hydration + migration to avoid the
  // double-fetch on launch.
  useEffect(() => {
    if (!migrationDone) return;
    loadWeather(city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrationDone, city.id, loadWeather]);

  // ---------------------------------------------------------------------
  // Batch city-list conditions, refreshed when the sheet opens (>10 min stale)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!citiesOpen || !cityWxHydrated) return;
    if (Date.now() - cityWxStore.ts < CITY_WX_STALE_MS) return;
    const list: City[] = [
      ...(myLocation.city ? [myLocation.city] : []),
      ...PRESET_CITIES,
      ...customCities,
    ];
    let cancelled = false;
    fetchCitiesCurrent(list)
      .then((data) => {
        if (!cancelled) setCityWxStore({ ts: Date.now(), data });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citiesOpen, cityWxHydrated, myLocation.city?.id]);

  // Determine gradient from current weather
  const condition: Condition = wx?.cond ?? 'clear';
  const grad = GRADIENTS[condition] || GRADIENTS.clear;

  // ---------------------------------------------------------------------
  // City management
  // ---------------------------------------------------------------------
  const selectCity = useCallback(
    (c: City) => {
      setActiveCity(c);
      setCitiesOpen(false);
    },
    [setActiveCity]
  );

  const addCity = useCallback(
    (c: City) => {
      const existing = [...PRESET_CITIES, ...customCities].find(
        (x) => x.id === c.id
      );
      if (existing) {
        selectCity(existing);
        return;
      }
      const newCity: City = { ...c, custom: true };
      setCustomCities([...customCities, newCity]);
      selectCity(newCity);
    },
    [customCities, setCustomCities, selectCity]
  );

  const removeCity = useCallback(
    (id: string) => {
      setCustomCities(customCities.filter((c) => c.id !== id));
      // Prune the removed custom city's widget snapshot + index entry.
      removeCitySnapshot(id);
      if (city.id === id) selectCity(PRESET_CITIES[0]);
    },
    [customCities, setCustomCities, city.id, selectCity]
  );

  // Persist the unit (wxai.unit) and mirror it into the App Group's shared
  // UserDefaults (wxai.widget.unit) so the widget agrees on °C/°F. Independent
  // of any weather commit — see PRD 01 US-000.
  const handleUnitChange = useCallback(
    (next: 'C' | 'F') => {
      setUnit(next);
      writeUnit(next);
    },
    [setUnit]
  );

  // ---------------------------------------------------------------------
  // Widget deep linking — aiweather://city/<cityId> (PRD 06a)
  //
  // Resolve the (percent-decoded) cityId against the composite city list
  // [myLocation, ...PRESET_CITIES, ...customCities] and set it active. Links
  // arriving before hydration (cities + active + migration) are buffered in a
  // ref and applied once ready; unknown/malformed ids no-op to the active city.
  // ---------------------------------------------------------------------
  const linkReady =
    citiesHydrated && activeHydrated && migrationDone;
  const pendingLinkRef = useRef<string | null>(null);
  const linkReadyRef = useRef(linkReady);
  linkReadyRef.current = linkReady;

  const resolveCityId = useCallback(
    (id: string): City | null => {
      const list: City[] = [
        ...(myLocation.city ? [myLocation.city] : []),
        ...PRESET_CITIES,
        ...customCities,
      ];
      return list.find((c) => c.id === id) ?? null;
    },
    [myLocation.city, customCities]
  );

  const applyDeepLink = useCallback(
    (url: string) => {
      // aiweather://chat — quick-access AI chat button on the Medium/Large
      // widgets (WidgetDeepLink.chatURL). Opens the chat sheet over whatever
      // city is active; no city argument to resolve.
      if (/^aiweather:\/\/chat\/?$/i.test(url)) {
        setChatOpen(true);
        return;
      }
      // Expecting aiweather://city/<encodedCityId>
      const match = url.match(/^aiweather:\/\/city\/(.+)$/i);
      if (!match) return;
      let id: string;
      try {
        id = decodeURIComponent(match[1]);
      } catch {
        return; // malformed percent-encoding → no-op
      }
      const target = resolveCityId(id);
      if (target) setActiveCity(target);
    },
    [resolveCityId, setActiveCity]
  );
  const applyDeepLinkRef = useRef(applyDeepLink);
  applyDeepLinkRef.current = applyDeepLink;

  // Cold start: read the launch URL once. Warm start: listen for subsequent
  // URLs. Buffer any link that arrives before state has hydrated. The handler
  // reads the latest ready-state/resolver via refs so it never goes stale.
  useEffect(() => {
    let cancelled = false;
    Linking.getInitialURL()
      .then((url) => {
        if (cancelled || !url) return;
        pendingLinkRef.current = url;
      })
      .catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (linkReadyRef.current) applyDeepLinkRef.current(url);
      else pendingLinkRef.current = url;
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once hydration completes, flush any buffered link exactly once.
  useEffect(() => {
    if (!linkReady) return;
    const pending = pendingLinkRef.current;
    if (pending) {
      pendingLinkRef.current = null;
      applyDeepLink(pending);
    }
  }, [linkReady, applyDeepLink]);

  // Scroll to details
  const showDetails = useCallback(() => {
    scrollRef.current?.scrollTo({ y: SCREEN_H, animated: true });
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar barStyle={wx?.isNight ? 'light-content' : 'dark-content'} />

        {/* Full-screen gradient background */}
        <LinearGradient
          colors={grad.colors}
          locations={grad.locations}
          start={{ x: 0.8, y: 0 }}
          end={{ x: 0.2, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {loading || !wx ? (
          loadFailed && !loading ? (
            /* Friendly full-screen error state (no cache available) */
            <View style={styles.loadingWrap}>
              <Text style={styles.errorTitle}>Couldn't load the weather</Text>
              <Text style={styles.errorSubtitle}>
                Check your connection and try again.
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => loadWeather(city)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Retry loading weather"
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="rgba(21,19,26,0.4)" />
            </View>
          )
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadWeather(city, true)}
                  tintColor="rgba(21,19,26,0.4)"
                />
              }
            >
              <HeroScreen
                wx={wx}
                unit={unit}
                outline={true}
                onUnitChange={handleUnitChange}
                onShowDetails={showDetails}
                onOpenCities={() => setCitiesOpen(true)}
                onExpandHourly={() => setHourlyOpen(true)}
                onAskAI={() => setChatOpen(true)}
              />
              <DetailsView wx={wx} unit={unit} />
            </ScrollView>

            {/* Stale-data banner after a failed refresh */}
            {wx.staleAt !== undefined && (
              <StatusBanner
                message={`Couldn't refresh · showing ${formatClock(wx.staleAt)} data`}
                onRetry={() => loadWeather(city, true)}
              />
            )}

            {/* Floating Ask button */}
            <AskButton onPress={() => setChatOpen(true)} />

            {/* Bottom sheets */}
            <ChatSheet
              wx={wx}
              unit={unit}
              city={city}
              visible={chatOpen}
              onClose={() => setChatOpen(false)}
            />
            <CitySheet
              visible={citiesOpen}
              activeCityId={city.id}
              customCities={customCities}
              cityWx={cityWxStore.data}
              unit={unit}
              myLocation={myLocation}
              onSelect={selectCity}
              onAdd={addCity}
              onRemove={removeCity}
              onClose={() => setCitiesOpen(false)}
            />
            <HourlyExpandedSheet
              wx={wx}
              unit={unit}
              visible={hourlyOpen}
              onClose={() => setHourlyOpen(false)}
            />
          </>
        )}
      </View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 96,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: INK,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: INK,
    borderRadius: 22,
    paddingHorizontal: 28,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
