import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Pressable,
  Modal,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Ellipse,
  G,
} from 'react-native-svg';
import WeatherIcon from './WeatherIcon';
import MetricTile from './MetricTile';
import MetricIcon from './MetricIcon';
import HourlyForecastCard from './HourlyForecastCard';
import HighlightCard from './HighlightCard';
import { fmtTemp } from '../utils/helpers';
import { tapHaptic } from '../utils/haptics';
import { INK, MUTED, FAINT, HAIR, RAIN_BLUE, TILE } from '../utils/colors';
import type { WeatherScenario, DayTuple } from '../data/weatherData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });
const PH = 34; // horizontal padding
const PV = 26; // vertical padding

// ---------------------------------------------------------------------------
// Section wrapper with reveal animation
// ---------------------------------------------------------------------------

interface SectionProps {
  index: number;
  first?: boolean;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ index, first, children }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(26)).current;

  useEffect(() => {
    const delay = index * 120;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 480,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.section,
        !first && styles.sectionBorder,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {children}
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sunPhaseNote(sunPct: number, isNight: boolean): string {
  if (isNight || sunPct >= 1 || sunPct <= 0) return 'The sun has set for the day';
  if (sunPct < 0.1) return 'Dawn is breaking';
  if (sunPct < 0.25) return 'Morning light is growing';
  if (sunPct < 0.4) return 'Sun is climbing higher';
  if (sunPct < 0.6) return 'Sun is high overhead';
  if (sunPct < 0.75) return 'Afternoon light is softening';
  if (sunPct < 0.9) return 'Golden hour';
  return 'Sunset is approaching';
}

/** Quadratic bezier point at t for control points P0, P1, P2 */
function quadBezier(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

function daylightDuration(sunrise: string, sunset: string): string {
  const parseMins = (s: string) => {
    const parts = s.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };
  const diff = parseMins(sunset) - parseMins(sunrise);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DetailsViewProps {
  wx: WeatherScenario;
  unit: 'C' | 'F';
  /** Opens the AI chat (wired to the HighlightCard "View Highlights" pill). */
  onAskAI?: () => void;
  /** Optional hook for expanding the full details/hourly view. */
  onShowDetails?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MetricInfo {
  label: string;
  value: string;
  explain: string;
}

const DetailsView: React.FC<DetailsViewProps> = ({ wx, unit, onAskAI }) => {
  const isNight = wx.isNight;
  const sunPct = wx.sunPct as number;

  // Long-press explainer modal: null when closed, populated with the tapped
  // metric's name, value and a one-sentence plain-language note when open.
  const [metricInfo, setMetricInfo] = useState<MetricInfo | null>(null);

  const openMetric = (info: MetricInfo) => {
    tapHaptic();
    setMetricInfo(info);
  };

  // Sun arc geometry
  const P0: [number, number] = [18, 118];
  const P1: [number, number] = [160, 2];
  const P2: [number, number] = [302, 118];
  const sunPos = quadBezier(Math.min(Math.max(sunPct, 0), 1), P0, P1, P2);

  // Build the progress sub-path by sampling the bezier
  const progressSteps = 40;
  const tMax = Math.min(Math.max(sunPct, 0), 1);
  let progressD = '';
  for (let i = 0; i <= progressSteps; i++) {
    const t = (i / progressSteps) * tMax;
    const [px, py] = quadBezier(t, P0, P1, P2);
    progressD += i === 0 ? `M${px},${py}` : ` L${px},${py}`;
  }

  // Global lo/hi across all days for range bar normalization
  const allLos = (wx.days as DayTuple[]).map((d) => d[2]);
  const allHis = (wx.days as DayTuple[]).map((d) => d[3]);
  const globalLo = Math.min(...allLos);
  const globalHi = Math.max(...allHis);
  const tempRange = globalHi - globalLo || 1;

  // Precip bars max
  const precipBars = (wx.hourly as any[]).slice(0, 8);
  const maxPop = Math.max(...precipBars.map((h: any) => h.pop), 10);

  // Conditions grid — data-driven so each tile gets a long-press explainer.
  // `detail` is the value shown in the modal; `explain` is a plain-language note.
  const conditionTiles: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    value: string | number;
    unit?: string;
    subtitle?: string;
    bg: string;
    detail: string;
    explain: string;
  }> = [
    {
      key: 'humidity',
      icon: <MetricIcon name="humidity" />,
      label: 'Humidity',
      value: wx.humidity,
      unit: '%',
      bg: TILE.humidity,
      detail: `${wx.humidity}%`,
      explain:
        'Share of moisture in the air — higher values feel muggier and slow how fast sweat evaporates to cool you.',
    },
    {
      key: 'pressure',
      icon: <MetricIcon name="pressure" />,
      label: 'Pressure',
      value: wx.pressure,
      unit: 'hPa',
      bg: TILE.pressure,
      detail: `${wx.pressure} hPa`,
      explain:
        'Air pressure at the surface — falling pressure often brings storms, while rising pressure points to clearer skies.',
    },
    {
      key: 'dew',
      icon: <MetricIcon name="dew" />,
      label: 'Dew Point',
      value: `${fmtTemp(wx.dew, unit)}°`,
      bg: TILE.dew,
      detail: `${fmtTemp(wx.dew, unit)}°`,
      explain:
        'The temperature at which air becomes saturated — the higher it is, the stickier and more humid it feels.',
    },
    {
      key: 'wind',
      icon: <MetricIcon name="wind" />,
      label: 'Wind',
      value: wx.wind,
      unit: 'km/h',
      bg: TILE.wind,
      detail: `${wx.wind} km/h`,
      explain:
        'Current wind speed — stronger wind makes it feel colder and can make outdoor plans harder.',
    },
    {
      key: 'aqi',
      icon: <MetricIcon name="aqi" />,
      label: 'Air Quality',
      value: wx.aqi ?? '—',
      subtitle: wx.aqiWord,
      bg: TILE.aqi,
      detail: `${wx.aqi ?? '—'}${wx.aqiWord ? ` (${wx.aqiWord})` : ''}`,
      explain:
        'Air Quality Index — lower is cleaner; as it climbs, sensitive groups should limit time outdoors.',
    },
    {
      key: 'uv',
      icon: <MetricIcon name="uv" />,
      label: 'UV',
      value: wx.uv,
      subtitle: wx.uvWord,
      bg: TILE.uv,
      detail: `${wx.uv}${wx.uvWord ? ` (${wx.uvWord})` : ''}`,
      explain:
        'Strength of the sun’s ultraviolet rays, strongest midday — wear sunscreen and limit exposure when it is high.',
    },
    {
      key: 'vis',
      icon: <MetricIcon name="vis" />,
      label: 'Visibility',
      value: wx.vis,
      unit: 'km',
      bg: TILE.vis,
      detail: `${wx.vis} km`,
      explain:
        'How far you can clearly see — cut down by fog, haze, or heavy rain.',
    },
  ];

  let sIdx = 0;

  return (
    <View>
      {/* ================================================================= */}
      {/* 1. SUNLIGHT                                                       */}
      {/* ================================================================= */}
      <Section index={sIdx++} first>
        <Text style={styles.label}>SUNLIGHT</Text>
        <Text style={styles.phaseNote}>
          {sunPhaseNote(sunPct, isNight)}
        </Text>

        <Svg width="100%" height={150} viewBox="0 0 320 150">
          <Defs>
            <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={FAINT} />
              <Stop offset="1" stopColor="#d4952a" />
            </LinearGradient>
            <RadialGradient id="bloom" cx="0.5" cy="0" rx="0.5" ry="1">
              <Stop offset="0" stopColor="#d4952a" stopOpacity="0.32" />
              <Stop offset="1" stopColor="#d4952a" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Full path (faint dotted) */}
          <Path
            d={`M${P0[0]},${P0[1]} Q${P1[0]},${P1[1]} ${P2[0]},${P2[1]}`}
            fill="none"
            stroke={HAIR}
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />

          {/* Progress path (gradient) */}
          {tMax > 0 && (
            <Path
              d={progressD}
              fill="none"
              stroke="url(#arcGrad)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}

          {/* Bloom ellipse beneath orb */}
          {!isNight && tMax > 0 && tMax < 1 && (
            <Ellipse
              cx={sunPos[0]}
              cy={118}
              rx={28}
              ry={18}
              fill="url(#bloom)"
            />
          )}

          {/* Sun orb or moon crescent */}
          {isNight || sunPct >= 1 || sunPct <= 0 ? (
            <G>
              <Circle
                cx={sunPct >= 1 ? P2[0] : sunPct <= 0 ? P0[0] : sunPos[0]}
                cy={sunPct >= 1 || sunPct <= 0 ? 118 : sunPos[1]}
                r={8.5}
                fill="#c4c4ea"
                stroke="#fff"
                strokeWidth={2}
              />
              <Path
                d={`M${(sunPct >= 1 ? P2[0] : sunPct <= 0 ? P0[0] : sunPos[0]) + 3},${
                  (sunPct >= 1 || sunPct <= 0 ? 118 : sunPos[1]) - 7
                } A6 6 0 1 0 ${(sunPct >= 1 ? P2[0] : sunPct <= 0 ? P0[0] : sunPos[0]) + 3},${
                  (sunPct >= 1 || sunPct <= 0 ? 118 : sunPos[1]) + 7
                } A4.5 4.5 0 0 1 ${(sunPct >= 1 ? P2[0] : sunPct <= 0 ? P0[0] : sunPos[0]) + 3},${
                  (sunPct >= 1 || sunPct <= 0 ? 118 : sunPos[1]) - 7
                }`}
                fill="#8080b0"
                opacity={0.45}
              />
            </G>
          ) : (
            <Circle
              cx={sunPos[0]}
              cy={sunPos[1]}
              r={8.5}
              fill="#d4952a"
              stroke="#fff"
              strokeWidth={2.5}
            />
          )}

          {/* Horizon line */}
          <Line
            x1={10}
            y1={118}
            x2={310}
            y2={118}
            stroke={HAIR}
            strokeWidth={1}
          />
        </Svg>

        {/* Sunrise / Daylight / Sunset row */}
        <View style={styles.sunRow}>
          <View style={styles.sunCol}>
            <Text style={styles.sunTime}>{wx.sunrise}</Text>
            <Text style={styles.sunLabel}>Sunrise</Text>
          </View>
          <View style={[styles.sunCol, { alignItems: 'center' }]}>
            <Text style={styles.sunTime}>
              {daylightDuration(wx.sunrise, wx.sunset)}
            </Text>
            <Text style={styles.sunLabel}>Daylight</Text>
          </View>
          <View style={[styles.sunCol, { alignItems: 'flex-end' }]}>
            <Text style={styles.sunTime}>{wx.sunset}</Text>
            <Text style={styles.sunLabel}>Sunset</Text>
          </View>
        </View>
      </Section>

      {/* ================================================================= */}
      {/* 2. PRECIPITATION                                                  */}
      {/* ================================================================= */}
      <Section index={sIdx++}>
        <Text style={styles.label}>PRECIPITATION</Text>

        <View style={styles.precipHeader}>
          <Text style={styles.precipValue}>{wx.precipMm} mm</Text>
          <Text style={styles.precipToday}>Today</Text>
        </View>

        {/* Bar chart */}
        <View style={styles.barChart}>
          {precipBars.map((h: any, i: number) => {
            const height = Math.max((h.pop / maxPop) * 56, 2);
            return (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height,
                        backgroundColor:
                          h.pop > 40 ? RAIN_BLUE : h.pop > 0 ? '#a3c0e6' : HAIR,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{h.h}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.precipNote}>{wx.precipNote}</Text>
      </Section>

      {/* ================================================================= */}
      {/* 3. 10-DAY FORECAST                                                */}
      {/* ================================================================= */}
      <Section index={sIdx++}>
        <Text style={styles.label}>THIS WEEK &middot; 10 DAYS</Text>

        {(wx.days as DayTuple[]).map((day, i) => {
          const [name, cond, lo, hi, pop] = day;
          const loFrac = (lo - globalLo) / tempRange;
          const hiFrac = (hi - globalLo) / tempRange;

          return (
            <View
              key={i}
              style={[styles.dayRow, i > 0 && styles.dayRowBorder]}
            >
              {/* Day name */}
              <Text style={styles.dayName}>{name}</Text>

              {/* Weather icon */}
              <View style={styles.dayIcon}>
                <WeatherIcon cond={cond} size={22} />
              </View>

              {/* Precip % */}
              <Text style={styles.dayPop}>
                {pop >= 30 ? `${pop}%` : ''}
              </Text>

              {/* Lo temp */}
              <Text style={styles.dayTemp}>
                {fmtTemp(lo, unit)}&deg;
              </Text>

              {/* Range bar */}
              <View style={styles.rangeBarOuter}>
                <View style={styles.rangeBarBg}>
                  <View
                    style={[
                      styles.rangeBarFill,
                      {
                        left: `${loFrac * 100}%`,
                        right: `${(1 - hiFrac) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Hi temp */}
              <Text style={[styles.dayTemp, { textAlign: 'right' }]}>
                {fmtTemp(hi, unit)}&deg;
              </Text>
            </View>
          );
        })}
      </Section>

      {/* ================================================================= */}
      {/* 4. CONDITIONS GRID                                                */}
      {/* ================================================================= */}
      <Section index={sIdx++}>
        <Text style={styles.label}>CONDITIONS</Text>

        <View style={styles.tileGrid}>
          {conditionTiles.map((tile) => (
            <Pressable
              key={tile.key}
              style={styles.tileCell}
              delayLongPress={250}
              onLongPress={() =>
                openMetric({
                  label: tile.label,
                  value: tile.detail,
                  explain: tile.explain,
                })
              }
              accessibilityRole="button"
              accessibilityHint="Long press for a plain-language explanation"
            >
              <MetricTile
                icon={tile.icon}
                label={tile.label}
                value={tile.value}
                unit={tile.unit}
                subtitle={tile.subtitle}
                bg={tile.bg}
              />
            </Pressable>
          ))}
        </View>
      </Section>

      {/* ================================================================= */}
      {/* 5. HOURLY FORECAST                                                */}
      {/* ================================================================= */}
      <Section index={sIdx++}>
        <HourlyForecastCard wx={wx} unit={unit} />
      </Section>

      {/* ================================================================= */}
      {/* 6. HIGHLIGHTS                                                     */}
      {/* ================================================================= */}
      <Section index={sIdx++}>
        <HighlightCard wx={wx} unit={unit} onPress={() => onAskAI?.()} />
      </Section>

      {/* ================================================================= */}
      {/* 7. FOOTER                                                         */}
      {/* ================================================================= */}
      <Section index={sIdx++}>
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>{'\u2726'} AI Weather</Text>
          <Text style={styles.footerUpdated}>Pull down to refresh</Text>
        </View>
      </Section>

      {/* ================================================================= */}
      {/* Metric explainer (long-press a conditions tile)                   */}
      {/* ================================================================= */}
      <Modal
        visible={metricInfo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMetricInfo(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setMetricInfo(null)}
          accessibilityRole="button"
          accessibilityLabel="Close explanation"
        >
          {/* Inner press swallows taps so they don't dismiss the sheet. */}
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {metricInfo && (
              <>
                <Text style={styles.modalLabel}>
                  {metricInfo.label.toUpperCase()}
                </Text>
                <Text style={styles.modalValue}>{metricInfo.value}</Text>
                <Text style={styles.modalExplain}>{metricInfo.explain}</Text>
                <Pressable
                  style={styles.modalClose}
                  onPress={() => setMetricInfo(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss explanation"
                >
                  <Text style={styles.modalCloseText}>Got it</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: PH,
    paddingVertical: PV,
  },
  sectionBorder: {
    borderTopWidth: 1,
    borderTopColor: HAIR,
  },

  // Labels
  label: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: FAINT,
    marginBottom: 10,
  },

  // Sunlight
  phaseNote: {
    fontFamily: FONT,
    fontSize: 15,
    color: MUTED,
    marginBottom: 14,
    lineHeight: 20,
  },
  sunRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sunCol: {
    alignItems: 'flex-start',
  },
  sunTime: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },
  sunLabel: {
    fontFamily: FONT,
    fontSize: 11,
    color: FAINT,
    marginTop: 2,
  },

  // Precipitation
  precipHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  precipValue: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: '700',
    color: INK,
  },
  precipToday: {
    fontFamily: FONT,
    fontSize: 13,
    color: MUTED,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 76,
    marginBottom: 12,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    height: 56,
    width: 20,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 4,
  },
  bar: {
    width: 14,
    borderRadius: 4,
  },
  barLabel: {
    fontFamily: FONT,
    fontSize: 10,
    color: FAINT,
  },
  precipNote: {
    fontFamily: FONT,
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },

  // 10-day forecast
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dayRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIR,
  },
  dayName: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '500',
    color: INK,
    width: 52,
  },
  dayIcon: {
    width: 28,
    alignItems: 'center',
  },
  dayPop: {
    fontFamily: FONT,
    fontSize: 12,
    color: RAIN_BLUE,
    width: 36,
    textAlign: 'right',
    marginRight: 8,
  },
  dayTemp: {
    fontFamily: FONT,
    fontSize: 14,
    color: MUTED,
    width: 34,
    textAlign: 'left',
  },
  rangeBarOuter: {
    flex: 1,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  rangeBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: HAIR,
    overflow: 'hidden',
    position: 'relative',
  },
  rangeBarFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: '#e8b06a',
  },

  // Conditions metric-tile grid (2-column wrap)
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tileCell: {
    width: '48%',
    marginTop: 12,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerBrand: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 4,
  },
  footerUpdated: {
    fontFamily: FONT,
    fontSize: 11,
    color: FAINT,
  },

  // Metric explainer modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(21,19,26,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
  },
  modalLabel: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: FAINT,
    marginBottom: 8,
  },
  modalValue: {
    fontFamily: FONT,
    fontSize: 30,
    fontWeight: '700',
    color: INK,
    marginBottom: 10,
  },
  modalExplain: {
    fontFamily: FONT,
    fontSize: 15,
    lineHeight: 21,
    color: MUTED,
  },
  modalClose: {
    alignSelf: 'flex-end',
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: INK,
  },
  modalCloseText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default DetailsView;
