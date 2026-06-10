import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import WeatherIcon from './WeatherIcon';
import type { City } from '../data/weatherData';
import { PRESET_CITIES } from '../data/weatherData';
import { searchCities } from '../data/weatherApi';
import type { CityCurrent } from '../data/weatherApi';
import type { MyLocationState } from '../hooks/useMyLocation';
import { fmtTemp } from '../utils/helpers';
import { INK, MUTED, FAINT, HAIR } from '../utils/colors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { height: SCREEN_H } = Dimensions.get('window');
const COLLAPSED_H = SCREEN_H * 0.6;
const EXPANDED_H = SCREEN_H * 0.94;

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const ListIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = INK }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="5" width="3" height="2" rx="1" fill={color} />
    <Line x1="9" y1="6" x2="21" y2="6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Rect x="3" y="11" width="3" height="2" rx="1" fill={color} />
    <Line x1="9" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Rect x="3" y="17" width="3" height="2" rx="1" fill={color} />
    <Line x1="9" y1="18" x2="21" y2="18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

const PinIcon: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = INK }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx={12} cy={9} r={2.5} stroke={color} strokeWidth={1.8} />
  </Svg>
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CitySheetProps {
  visible: boolean;
  activeCityId: string;
  customCities: City[];
  cityWx: Record<string, CityCurrent | undefined>;
  unit: 'C' | 'F';
  myLocation: MyLocationState;
  onSelect: (city: City) => void;
  onAdd: (city: City) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// CitySheet component
// ---------------------------------------------------------------------------

const CitySheet: React.FC<CitySheetProps> = ({
  visible,
  activeCityId,
  customCities,
  cityWx,
  unit,
  myLocation,
  onSelect,
  onAdd,
  onRemove,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentHeight = useRef(COLLAPSED_H);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<City[] | null>(null);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Track sheetHeight
  useEffect(() => {
    const id = sheetHeight.addListener(({ value }) => {
      currentHeight.current = value;
    });
    return () => sheetHeight.removeListener(id);
  }, [sheetHeight]);

  // Slide in/out
  useEffect(() => {
    if (visible) {
      sheetHeight.setValue(COLLAPSED_H);
      currentHeight.current = COLLAPSED_H;
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          // JS driver: this view also animates `height`, which the native
          // animated module can't drive — mixing drivers on one style throws.
          useNativeDriver: false,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_H,
          duration: 280,
          useNativeDriver: false,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropOpacity, sheetHeight]);

  // PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderMove: (_, gs) => {
        const newH = Math.min(EXPANDED_H, Math.max(COLLAPSED_H * 0.5, currentHeight.current - gs.dy));
        sheetHeight.setValue(newH);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          onClose();
        } else if (gs.dy < -50) {
          Animated.spring(sheetHeight, {
            toValue: EXPANDED_H,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        } else {
          const mid = (COLLAPSED_H + EXPANDED_H) / 2;
          const target = currentHeight.current > mid ? EXPANDED_H : COLLAPSED_H;
          Animated.spring(sheetHeight, {
            toValue: target,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    }),
  ).current;

  // Search-as-you-type: ≥2 chars, 300ms debounce, abort stale requests
  useEffect(() => {
    abortRef.current?.abort();
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const found = await searchCities(q, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setResults(found);
          setSearching(false);
        }
      } catch {
        if (!ctrl.signal.aborted) {
          setResults([]);
          setSearching(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const addAndSelect = (city: City) => {
    setQuery('');
    setResults(null);
    onAdd(city);
  };

  const handleSubmit = async () => {
    const q = query.trim();
    if (!q) return;
    if (results && results.length > 0) {
      addAndSelect(results[0]);
      return;
    }
    // No debounced result yet — search immediately and take the top match.
    try {
      setSearching(true);
      const found = await searchCities(q);
      setSearching(false);
      if (found.length > 0) addAndSelect(found[0]);
      else setResults([]);
    } catch {
      setSearching(false);
      setResults([]);
    }
  };

  // Reset input on close
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setQuery('');
        setResults(null);
        setSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const allCities: City[] = [...PRESET_CITIES, ...customCities];
  const isSearchMode = query.trim().length >= 2;

  // ---- My Location row content ----
  const locCity = myLocation.city;
  const locWx = locCity ? cityWx[locCity.id] : undefined;
  let locName = 'My Location';
  let locSub = 'Tap to enable location';
  if (myLocation.status === 'loading') {
    locSub = 'Locating…';
  } else if (myLocation.status === 'denied') {
    locSub = 'Permission denied — open Settings';
  } else if (locCity) {
    locName = locCity.name;
    locSub = locWx
      ? `${locWx.label} · Humidity ${locWx.humidity}%`
      : 'Current location';
  }

  const handleMyLocationPress = async () => {
    if (myLocation.status === 'denied') {
      Linking.openSettings().catch(() => {});
      return;
    }
    if (locCity && myLocation.status === 'ready') {
      onSelect(locCity);
      return;
    }
    const located = await myLocation.request();
    if (located) onSelect(located);
  };

  const renderCityRow = (city: City) => {
    const isActive = city.id === activeCityId;
    const cur = cityWx[city.id];
    const a11yLabel = cur
      ? `${city.name}, ${fmtTemp(cur.temp, unit)} degrees, ${cur.label.toLowerCase()}`
      : city.name;
    return (
      <TouchableOpacity
        key={city.id}
        style={[styles.cityRow, isActive && styles.cityRowActive]}
        onPress={() => onSelect(city)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ selected: isActive }}
      >
        <View style={styles.cityLeft}>
          <WeatherIcon cond={cur?.cond ?? 'cloud'} size={34} stroke={cur ? INK : FAINT} />
          <View style={styles.cityInfo}>
            <Text style={styles.cityName}>{city.name}</Text>
            <Text style={styles.citySub}>
              {cur
                ? `${cur.label} · Humidity ${cur.humidity}%`
                : [city.admin1, city.country].filter(Boolean).join(' · ') || '—'}
            </Text>
          </View>
        </View>
        <View style={styles.cityRight}>
          <Text style={styles.cityTemp}>
            {cur ? `${fmtTemp(cur.temp, unit)}°` : '—'}
          </Text>
          {city.custom && (
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => onRemove(city.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${city.name} from cities`}
            >
              <Text style={styles.removeBtnText}>{'✕'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderResultRow = (city: City) => (
    <TouchableOpacity
      key={`${city.id}-${city.name}`}
      style={styles.cityRow}
      onPress={() => addAndSelect(city)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Add ${city.name}${city.country ? `, ${city.country}` : ''}`}
    >
      <View style={styles.cityLeft}>
        <View style={styles.resultPin}>
          <PinIcon size={20} color={MUTED} />
        </View>
        <View style={styles.cityInfo}>
          <Text style={styles.cityName}>{city.name}</Text>
          <Text style={styles.citySub}>
            {[city.admin1, city.country].filter(Boolean).join(' · ') || '—'}
          </Text>
        </View>
      </View>
      <Text style={styles.resultAdd}>+</Text>
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        accessibilityViewIsModal
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.grabber} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ListIcon size={22} color={INK} />
            <Text style={styles.headerTitle}>Cities</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close city list"
          >
            <Text style={styles.closeBtnText}>{'✕'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* City list / search results */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {isSearchMode ? (
            <>
              {searching && (
                <View style={styles.statusRow}>
                  <ActivityIndicator size="small" color={MUTED} />
                  <Text style={styles.statusText}>Searching…</Text>
                </View>
              )}
              {!searching && results && results.length === 0 && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusText}>No matches</Text>
                </View>
              )}
              {results?.map(renderResultRow)}
            </>
          ) : (
            <>
              {/* Pinned: My Location */}
              <TouchableOpacity
                style={[
                  styles.cityRow,
                  locCity && locCity.id === activeCityId && styles.cityRowActive,
                ]}
                onPress={handleMyLocationPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  locCity && locWx
                    ? `My location, ${locName}, ${fmtTemp(locWx.temp, unit)} degrees, ${locWx.label.toLowerCase()}`
                    : `My location. ${locSub}`
                }
              >
                <View style={styles.cityLeft}>
                  {locWx ? (
                    <WeatherIcon cond={locWx.cond} size={34} stroke={INK} />
                  ) : (
                    <View style={styles.locIconWrap}>
                      <PinIcon size={24} color={INK} />
                    </View>
                  )}
                  <View style={styles.cityInfo}>
                    <Text style={styles.cityName}>{locName}</Text>
                    <Text style={styles.citySub}>{locSub}</Text>
                  </View>
                </View>
                <View style={styles.cityRight}>
                  {myLocation.status === 'loading' ? (
                    <ActivityIndicator size="small" color={MUTED} />
                  ) : (
                    <Text style={styles.cityTemp}>
                      {locWx ? `${fmtTemp(locWx.temp, unit)}°` : '—'}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              {allCities.map(renderCityRow)}
            </>
          )}
        </ScrollView>

        {/* Search / add input */}
        <View style={styles.addBar}>
          <TextInput
            style={styles.addInput}
            placeholder="Search for a city..."
            placeholderTextColor={MUTED}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search for a city"
          />
          <TouchableOpacity
            style={[styles.addBtn, !query.trim() && styles.addBtnDisabled]}
            onPress={handleSubmit}
            disabled={!query.trim()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add top search result"
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },

  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },

  grabber: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: HAIR,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: INK,
  },

  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: HAIR,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeBtnText: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '600',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIR,
    marginHorizontal: 20,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },

  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 4,
    minHeight: 44,
  },

  cityRowActive: {
    backgroundColor: 'rgba(21,19,26,0.04)',
  },

  cityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },

  cityInfo: {
    gap: 2,
    flex: 1,
  },

  cityName: {
    fontSize: 16,
    fontWeight: '600',
    color: INK,
  },

  citySub: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '400',
  },

  cityRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  cityTemp: {
    fontSize: 22,
    fontWeight: '600',
    color: INK,
  },

  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: HAIR,
    alignItems: 'center',
    justifyContent: 'center',
  },

  removeBtnText: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '600',
  },

  locIconWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultPin: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultAdd: {
    fontSize: 22,
    fontWeight: '600',
    color: MUTED,
    paddingHorizontal: 4,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },

  statusText: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '500',
  },

  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIR,
    gap: 10,
    paddingBottom: 34, // safe area
  },

  addInput: {
    flex: 1,
    fontSize: 15,
    color: INK,
    backgroundColor: '#f5f4f7',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxHeight: 44,
  },

  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addBtnDisabled: {
    opacity: 0.3,
  },

  addBtnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginTop: -1,
  },
});

export default CitySheet;
