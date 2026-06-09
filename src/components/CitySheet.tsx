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
} from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import WeatherIcon from './WeatherIcon';
import { SCENARIOS } from '../data/weatherData';
import type { Condition, WeatherScenario } from '../data/weatherData';
import { fmtTemp } from '../utils/helpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { height: SCREEN_H } = Dimensions.get('window');
const COLLAPSED_H = SCREEN_H * 0.6;
const EXPANDED_H = SCREEN_H * 0.94;
const INK = '#15131a';
const MUTED = 'rgba(21,19,26,0.55)';
const HAIR = 'rgba(21,19,26,0.13)';

// ---------------------------------------------------------------------------
// ListIcon
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CityEntry {
  name: string;
  cond: string;
  custom?: boolean;
}

interface CitySheetProps {
  visible: boolean;
  activeCity: { name: string; cond: string };
  customCities: CityEntry[];
  unit: 'C' | 'F';
  onSelect: (city: CityEntry) => void;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Preset cities
// ---------------------------------------------------------------------------

const PRESET_CITIES: CityEntry[] = [
  { name: 'Madrid', cond: 'clear' },
  { name: 'Berlin', cond: 'cloud' },
  { name: 'London', cond: 'rain' },
  { name: 'Lisbon', cond: 'night' },
];

// ---------------------------------------------------------------------------
// Helper: get scenario temp for a condition
// ---------------------------------------------------------------------------

function getCityTemp(cond: string, unit: 'C' | 'F'): number {
  const scenario = SCENARIOS[cond as Condition];
  if (!scenario) return 0;
  return fmtTemp(scenario.temp, unit);
}

function getCityHumidity(cond: string): number {
  const scenario = SCENARIOS[cond as Condition];
  if (!scenario) return 0;
  return scenario.humidity;
}

function getCityLabel(cond: string): string {
  const scenario = SCENARIOS[cond as Condition];
  if (!scenario) return '';
  return scenario.label;
}

// ---------------------------------------------------------------------------
// CitySheet component
// ---------------------------------------------------------------------------

const CitySheet: React.FC<CitySheetProps> = ({
  visible,
  activeCity,
  customCities,
  unit,
  onSelect,
  onAdd,
  onRemove,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentHeight = useRef(COLLAPSED_H);

  const [addInput, setAddInput] = useState('');

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
          useNativeDriver: true,
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
          useNativeDriver: true,
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

  const handleAdd = () => {
    const name = addInput.trim();
    if (!name) return;
    onAdd(name);
    setAddInput('');
  };

  // Reset input on close
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => setAddInput(''), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const allCities = [...PRESET_CITIES, ...customCities];

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
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeBtnText}>{'\u2715'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* City list */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          {allCities.map((city) => {
            const isActive = city.name === activeCity.name;
            return (
              <TouchableOpacity
                key={city.name}
                style={[styles.cityRow, isActive && styles.cityRowActive]}
                onPress={() => onSelect(city)}
                activeOpacity={0.7}
              >
                <View style={styles.cityLeft}>
                  <WeatherIcon cond={city.cond as Condition} size={34} stroke={INK} />
                  <View style={styles.cityInfo}>
                    <Text style={styles.cityName}>{city.name}</Text>
                    <Text style={styles.citySub}>
                      {getCityLabel(city.cond)} · Humidity {getCityHumidity(city.cond)}%
                    </Text>
                  </View>
                </View>
                <View style={styles.cityRight}>
                  <Text style={styles.cityTemp}>{getCityTemp(city.cond, unit)}°</Text>
                  {city.custom && (
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => onRemove(city.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.removeBtnText}>{'\u2715'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Add city input */}
        <View style={styles.addBar}>
          <TextInput
            style={styles.addInput}
            placeholder="Add a city..."
            placeholderTextColor={MUTED}
            value={addInput}
            onChangeText={setAddInput}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !addInput.trim() && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={!addInput.trim()}
            activeOpacity={0.7}
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
