import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WeatherIcon from './WeatherIcon';
import { fmtTemp } from '../utils/helpers';
import { useLiveClock } from '../utils/liveClock';
import { INK, MUTED, FAINT, HAIR, RAIN_BLUE } from '../utils/colors';
import type { WeatherScenario } from '../data/weatherData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HOUR_COL_W = 52;
const HOURLY_COUNT = 18;
const GRAPH_H = 48;
const FONT_BOLD = Platform.select({
  ios: 'Helvetica Neue',
  android: 'sans-serif-medium',
  default: 'System',
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HeroScreenProps {
  wx: WeatherScenario;
  unit: 'C' | 'F';
  outline: boolean;
  onUnitChange: (unit: 'C' | 'F') => void;
  onShowDetails: () => void;
  onOpenCities: () => void;
  onExpandHourly: () => void;
  onAskAI: () => void;
}

// ---------------------------------------------------------------------------
// Catmull-Rom to cubic bezier SVG path
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

function catmullRomPath(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Cities button — 3 rows of dot + line */
function CitiesButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.iconBtn}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel="Open city list"
    >
      <Svg width={20} height={20} viewBox="0 0 20 20">
        <Circle cx={4} cy={5} r={1.5} fill={INK} />
        <Line x1={8} y1={5} x2={18} y2={5} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
        <Circle cx={4} cy={10} r={1.5} fill={INK} />
        <Line x1={8} y1={10} x2={18} y2={10} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
        <Circle cx={4} cy={15} r={1.5} fill={INK} />
        <Line x1={8} y1={15} x2={18} y2={15} stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </TouchableOpacity>
  );
}

/** Unit toggle pill */
function UnitToggle({
  unit,
  onChange,
}: {
  unit: 'C' | 'F';
  onChange: (u: 'C' | 'F') => void;
}) {
  return (
    <View style={styles.unitPill}>
      <TouchableOpacity
        style={[styles.unitBtn, unit === 'C' && styles.unitBtnActive]}
        onPress={() => onChange('C')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Show temperatures in Celsius"
        accessibilityState={{ selected: unit === 'C' }}
      >
        <Text
          style={[
            styles.unitBtnText,
            unit === 'C' && styles.unitBtnTextActive,
          ]}
        >
          {'\u00b0'}C
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.unitBtn, unit === 'F' && styles.unitBtnActive]}
        onPress={() => onChange('F')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Show temperatures in Fahrenheit"
        accessibilityState={{ selected: unit === 'F' }}
      >
        <Text
          style={[
            styles.unitBtnText,
            unit === 'F' && styles.unitBtnTextActive,
          ]}
        >
          {'\u00b0'}F
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/** Pin arrow icon (location) */
function PinIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="none"
        stroke={INK}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9} r={2.5} fill="none" stroke={INK} strokeWidth={2} />
    </Svg>
  );
}

/** Expand icon (square with arrows) */
function ExpandIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
        fill="none"
        stroke={INK}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Bouncing chevron */
function ChevronDown({ onPress }: { onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel="Show weather details"
    >
      <Animated.View style={{ transform: [{ translateY: anim }] }}>
        <Svg width={28} height={28} viewBox="0 0 24 24">
          <Path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke={INK}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Hourly graph strip
// ---------------------------------------------------------------------------

function HourlyGraph({
  wx,
  unit,
  onExpand,
}: {
  wx: WeatherScenario;
  unit: 'C' | 'F';
  onExpand: () => void;
}) {
  const fullSeries = wx.daySeries;
  const nowHour = wx.nowHour;
  // Forward-looking window: from "now" through 18 hours ahead
  const ordered = [];
  for (let k = 0; k < HOURLY_COUNT; k++)
    ordered.push(fullSeries[(nowHour + k) % fullSeries.length]);
  const series = ordered.map((d, k) => ({ ...d, h: k === 0 ? 'Now' : d.label }));
  const temps = series.map((e) => fmtTemp(e.temp, unit));
  const minT = Math.min(...temps);
  const maxT = Math.max(...temps);
  const range = maxT - minT || 1;

  // Build points for the SVG curve
  const points: Point[] = temps.map((t, i) => ({
    x: i * HOUR_COL_W + HOUR_COL_W / 2,
    y: GRAPH_H - ((t - minT) / range) * (GRAPH_H - 8) - 4,
  }));

  const svgW = HOURLY_COUNT * HOUR_COL_W;
  const pathD = catmullRomPath(points);

  return (
    <View style={styles.hourlySection}>
      {/* Header */}
      <View style={styles.hourlyHeader}>
        <Text style={styles.hourlyLabel}>HOURLY</Text>
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={onExpand}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Expand hourly forecast"
        >
          <ExpandIcon />
        </TouchableOpacity>
      </View>

      {/* Scrollable strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: svgW }}
      >
        <View style={{ width: svgW }}>
          {/* Icons row */}
          <View style={styles.hourlyIconsRow}>
            {series.map((entry, i) => (
              <View key={i} style={styles.hourlyCol}>
                <WeatherIcon cond={entry.cond} size={20} />
              </View>
            ))}
          </View>

          {/* SVG temp curve */}
          <Svg width={svgW} height={GRAPH_H}>
            <Path d={pathD} fill="none" stroke={INK} strokeWidth={1.5} />
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={3} fill={INK} />
            ))}
          </Svg>

          {/* Temp labels row */}
          <View style={styles.hourlyIconsRow}>
            {series.map((entry, i) => (
              <View key={i} style={styles.hourlyCol}>
                <Text style={styles.hourlyTemp}>
                  {fmtTemp(entry.temp, unit)}{'\u00b0'}
                </Text>
              </View>
            ))}
          </View>

          {/* Precip row */}
          <View style={styles.hourlyIconsRow}>
            {series.map((entry, i) => (
              <View key={i} style={styles.hourlyCol}>
                {entry.pop > 0 ? (
                  <Text style={styles.hourlyPrecip}>{entry.pop}%</Text>
                ) : (
                  <Text style={styles.hourlyPrecipHidden}>{' '}</Text>
                )}
              </View>
            ))}
          </View>

          {/* Time labels row */}
          <View style={styles.hourlyIconsRow}>
            {series.map((entry, i) => (
              <View key={i} style={styles.hourlyCol}>
                <Text style={styles.hourlyTime}>{entry.h}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HeroScreen({
  wx,
  unit,
  outline,
  onUnitChange,
  onShowDetails,
  onOpenCities,
  onExpandHourly,
  onAskAI,
}: HeroScreenProps) {
  const insets = useSafeAreaInsets();
  const liveTime = useLiveClock(wx.utcOffsetSeconds, wx.time);
  const temp = fmtTemp(wx.temp, unit);
  const hi = fmtTemp(wx.hi, unit);
  const lo = fmtTemp(wx.lo, unit);
  const feels = fmtTemp(wx.feels, unit);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* ---- Top bar ---- */}
      <View style={styles.topBar}>
        <CitiesButton onPress={onOpenCities} />
        <View style={styles.topBarCenter}>
          <WeatherIcon cond={wx.cond} size={42} />
        </View>
        <UnitToggle unit={unit} onChange={onUnitChange} />
      </View>

      {/* ---- Spacer ---- */}
      <View style={{ flex: 1 }} />

      {/* ---- Location kicker ---- */}
      <View style={styles.locationRow}>
        <PinIcon />
        <Text style={styles.locationName}>
          {'  '}{wx.location.toUpperCase()}
        </Text>
        <Text style={styles.locationDot}> {'\u00b7'} </Text>
        <Text style={styles.locationTime}>{liveTime}</Text>
      </View>

      {/* ---- AI Headline ---- */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', maxWidth: SCREEN_W - 48, marginBottom: 12 }}>
        <Text style={styles.headline}>{wx.headline.pre} </Text>
        <Text style={[styles.headline, outline && styles.headlineEmOutline]}>
          {wx.headline.em}
        </Text>
        <Text style={styles.headline}> {wx.headline.post}</Text>
      </View>

      {/* ---- AI Summary ---- */}
      <Text style={styles.summary}>{wx.summary}</Text>

      {/* ---- Spacer ---- */}
      <View style={{ flex: 1 }} />

      {/* ---- Current temp ---- */}
      <View style={styles.tempRow}>
        <Text style={styles.tempBig}>{temp}{'\u00b0'}</Text>
        <View style={styles.tempMeta}>
          <Text style={styles.condLabel}>{wx.label}</Text>
          <Text style={styles.hiLo}>
            H:{hi}{'\u00b0'}  L:{lo}{'\u00b0'}
          </Text>
        </View>
      </View>

      {/* ---- Divider ---- */}
      <View style={styles.divider} />

      {/* ---- Core stats row ---- */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{wx.humidity}%</Text>
          <Text style={styles.statLabel}>Humidity</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{wx.precip}%</Text>
          <Text style={styles.statLabel}>Precip</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{feels}{'\u00b0'}</Text>
          <Text style={styles.statLabel}>Feels Like</Text>
        </View>
      </View>

      {/* ---- Divider ---- */}
      <View style={styles.divider} />

      {/* ---- Hourly graph ---- */}
      <HourlyGraph wx={wx} unit={unit} onExpand={onExpandHourly} />

      {/* ---- Chevron down ---- */}
      <View style={styles.chevronWrap}>
        <ChevronDown onPress={onShowDetails} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: SCREEN_W,
    // minHeight (not a fixed height) so on short viewports the content flows and
    // pushes DetailsView down instead of overflowing into it (the SUNLIGHT /
    // "Golden hour" overlap). On tall screens the flex spacers still fill it.
    minHeight: SCREEN_H,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },

  // ---- Top bar ----
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  topBarCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Unit toggle ----
  unitPill: {
    flexDirection: 'row',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
  },
  unitBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  unitBtnActive: {
    backgroundColor: INK,
  },
  unitBtnText: {
    fontFamily: FONT_BOLD,
    fontSize: 13,
    fontWeight: '700',
    color: INK,
  },
  unitBtnTextActive: {
    color: '#fff',
  },

  // ---- Location ----
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationName: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 12 * 0.14,
    color: INK,
  },
  locationDot: {
    fontSize: 12,
    color: MUTED,
  },
  locationTime: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    fontWeight: '500',
    color: MUTED,
  },

  // ---- Headline ----
  headline: {
    fontFamily: FONT_BOLD,
    fontSize: 54,
    fontWeight: '800',
    lineHeight: 58,
    color: INK,
    marginBottom: 12,
    maxWidth: SCREEN_W - 48,
  },
  headlineEmOutline: {
    fontFamily: FONT_BOLD,
    fontWeight: '800',
    color: 'rgba(21,19,26,0.22)',
  },

  // ---- Summary ----
  summary: {
    fontSize: 15,
    lineHeight: 21,
    color: MUTED,
    maxWidth: 320,
  },

  // ---- Temperature ----
  tempRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  tempBig: {
    fontFamily: FONT_BOLD,
    fontSize: 104,
    fontWeight: '800',
    lineHeight: 104,
    color: INK,
    includeFontPadding: false,
  },
  tempMeta: {
    marginLeft: 8,
    marginBottom: 14,
  },
  condLabel: {
    fontFamily: FONT_BOLD,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    marginBottom: 2,
  },
  hiLo: {
    fontFamily: FONT_BOLD,
    fontSize: 14,
    fontWeight: '500',
    color: MUTED,
  },

  // ---- Divider ----
  divider: {
    height: 1,
    backgroundColor: HAIR,
    marginVertical: 12,
  },

  // ---- Core stats ----
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONT_BOLD,
    fontSize: 18,
    fontWeight: '700',
    color: INK,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: FAINT,
    fontWeight: '500',
  },

  // ---- Hourly section ----
  hourlySection: {
    marginTop: 4,
  },
  hourlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hourlyLabel: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 12 * 0.1,
    color: FAINT,
  },
  expandBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourlyIconsRow: {
    flexDirection: 'row',
  },
  hourlyCol: {
    width: HOUR_COL_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourlyTemp: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    fontWeight: '600',
    color: INK,
    marginTop: 4,
  },
  hourlyPrecip: {
    fontSize: 10,
    fontWeight: '600',
    color: RAIN_BLUE,
    marginTop: 2,
  },
  hourlyPrecipHidden: {
    fontSize: 10,
    marginTop: 2,
    color: 'transparent',
  },
  hourlyTime: {
    fontSize: 10,
    fontWeight: '500',
    color: FAINT,
    marginTop: 2,
  },

  // ---- Chevron ----
  chevronWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
});
