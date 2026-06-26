import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  Text as SvgText,
  G,
  Rect,
} from 'react-native-svg';
import WeatherIcon from './WeatherIcon';
import type { WeatherScenario, Condition } from '../data/weatherData';
import { fmtTemp } from '../utils/helpers';
import { useLiveClock } from '../utils/liveClock';
import { INK, MUTED, HAIR } from '../utils/colors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.92;

// Chart layout
const CHART_PAD_L = 12;
const CHART_PAD_R = 48;
const CHART_PAD_T = 40;
const CHART_PAD_B = 42;
const CHART_W = SCREEN_W - 40; // horizontal margin
const CHART_H = 260;
const PLOT_W = CHART_W - CHART_PAD_L - CHART_PAD_R;
const PLOT_H = CHART_H - CHART_PAD_T - CHART_PAD_B;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HourlyExpandedSheetProps {
  wx: WeatherScenario | null;
  unit: 'C' | 'F';
  visible: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Catmull-Rom spline helper
// ---------------------------------------------------------------------------

function catmullRomPath(
  points: Array<{ x: number; y: number }>,
  tension: number = 0.3,
): string {
  if (points.length < 2) return '';
  const n = points.length;

  let d = `M${points[0].x},${points[0].y}`;

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, n - 1)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return d;
}

// ---------------------------------------------------------------------------
// HourlyExpandedSheet component
// ---------------------------------------------------------------------------

const HourlyExpandedSheet: React.FC<HourlyExpandedSheetProps> = ({
  wx,
  unit,
  visible,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const liveTime = useLiveClock(wx?.utcOffsetSeconds, wx?.time);

  const [mode, setMode] = useState<'actual' | 'feels'>('actual');
  // Scrubbed hour; null means "follow the current time"
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const chartLeftRef = useRef(0);
  const chartWrapRef = useRef<View>(null);

  // Slide in/out
  useEffect(() => {
    if (visible) {
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
  }, [visible, slideAnim, backdropOpacity]);

  // PanResponder for drag-down dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) onClose();
      },
    }),
  ).current;

  // Real 24h chart data straight from the scenario
  const scenario = wx;
  const series = scenario?.daySeries ?? [];
  const nowHour = scenario?.nowHour ?? 14;

  // Scrub gesture over the chart: map touch x to an hour index
  const scrubTo = (pageX: number) => {
    const x = pageX - chartLeftRef.current - CHART_PAD_L;
    const hour = Math.round((x / PLOT_W) * 23);
    setSelectedHour(Math.max(0, Math.min(23, hour)));
  };
  const chartPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => scrubTo(evt.nativeEvent.pageX),
      onPanResponderMove: (evt) => scrubTo(evt.nativeEvent.pageX),
    }),
  ).current;

  // Feels-like mode uses the real per-hour apparent temperature
  const displaySeries = useMemo(() => {
    if (mode === 'feels') {
      return series.map((e) => ({ ...e, temp: e.feels }));
    }
    return series;
  }, [series, mode]);

  // Chart computations
  const temps = displaySeries.map((e) => e.temp);
  const minT = Math.min(...temps) - 1;
  const maxT = Math.max(...temps) + 1;
  const range = maxT - minT || 1;

  const points = displaySeries.map((e, i) => ({
    x: CHART_PAD_L + (i / 23) * PLOT_W,
    y: CHART_PAD_T + PLOT_H - ((e.temp - minT) / range) * PLOT_H,
  }));

  // High/Low markers
  const hiIdx = temps.indexOf(Math.max(...temps));
  const loIdx = temps.indexOf(Math.min(...temps));

  // Split path at "now" for dashed past / solid future
  const nowX = CHART_PAD_L + (nowHour / 23) * PLOT_W;

  // Active (focused) hour: scrubbed position, pre-focused on the current time
  const activeHour = selectedHour ?? nowHour;
  const activeEntry = displaySeries[activeHour];
  const activeX = CHART_PAD_L + (activeHour / 23) * PLOT_W;
  const activeY = points[activeHour]?.y ?? CHART_PAD_T + PLOT_H / 2;
  const isAtNow = activeHour === nowHour;

  // Full curve
  const fullCurve = catmullRomPath(points);

  // Gradient area path
  const areaPath =
    fullCurve +
    ` L${points[points.length - 1].x},${CHART_PAD_T + PLOT_H}` +
    ` L${points[0].x},${CHART_PAD_T + PLOT_H} Z`;

  // Past curve (up to now)
  const pastPoints = points.slice(0, nowHour + 1);
  const pastCurve = pastPoints.length >= 2 ? catmullRomPath(pastPoints) : '';

  // Future curve (from now onward)
  const futurePoints = points.slice(nowHour);
  const futureCurve = futurePoints.length >= 2 ? catmullRomPath(futurePoints) : '';

  // Temperature axis ticks (right side)
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = minT + (i / (tickCount - 1)) * range;
    return {
      val: Math.round(fmtTemp(t, unit)),
      y: CHART_PAD_T + PLOT_H - (i / (tickCount - 1)) * PLOT_H,
    };
  });

  // Time axis labels
  const timeLabels = [
    { label: '12AM', hour: 0 },
    { label: '6AM', hour: 6 },
    { label: '12PM', hour: 12 },
    { label: '6PM', hour: 18 },
  ];

  // Hour icons (every 2 hours)
  const iconHours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

  // Reset mode and scrub position on close
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setMode('actual');
        setSelectedHour(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible || !scenario) return null;

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
          { transform: [{ translateY: slideAnim }] },
        ]}
        accessibilityViewIsModal
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.grabber} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.sectionLabel}>HOURLY FORECAST</Text>
            <Text style={styles.locationName}>{scenario.location}</Text>
            <Text style={styles.headerTime}>
              {isAtNow ? liveTime : activeEntry?.label ?? liveTime}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerTemp}>
              <WeatherIcon
                cond={(activeEntry?.cond as Condition) ?? scenario.cond}
                size={32}
                stroke={INK}
              />
              <Text style={styles.tempText}>
                {fmtTemp(
                  activeEntry?.temp ??
                    (mode === 'feels' ? scenario.feels : scenario.temp),
                  unit,
                )}
                {'\u00b0'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close hourly forecast"
            >
              <Text style={styles.closeBtnText}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Chart */}
        <View style={styles.chartContainer}>
          {/* Hour icons row */}
          <View style={styles.iconRow}>
            {iconHours.map((h) => {
              const entry = displaySeries[h];
              if (!entry) return null;
              const x = CHART_PAD_L + (h / 23) * PLOT_W;
              return (
                <View
                  key={h}
                  style={[
                    styles.iconItem,
                    { left: x + 20 - 12 }, // offset for chart container padding
                  ]}
                >
                  <WeatherIcon cond={entry.cond as Condition} size={16} stroke={MUTED} />
                </View>
              );
            })}
          </View>

          <View
            ref={chartWrapRef}
            onLayout={() => {
              chartWrapRef.current?.measureInWindow((x) => {
                chartLeftRef.current = x;
              });
            }}
            {...chartPan.panHandlers}
            accessible
            accessibilityLabel="Hourly temperature chart. Drag across to explore the day."
          >
          <Svg width={CHART_W} height={CHART_H}>
            <Defs>
              <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#f0945a" stopOpacity="0.35" />
                <Stop offset="0.5" stopColor="#f0c27a" stopOpacity="0.15" />
                <Stop offset="1" stopColor="#6fa8dc" stopOpacity="0.12" />
              </LinearGradient>
            </Defs>

            {/* Gradient area fill */}
            <Path d={areaPath} fill="url(#areaGrad)" />

            {/* Past (dashed) */}
            {pastCurve ? (
              <Path
                d={pastCurve}
                fill="none"
                stroke={INK}
                strokeWidth={2}
                strokeDasharray="6,4"
                strokeLinecap="round"
                opacity={0.45}
              />
            ) : null}

            {/* Future (solid) */}
            {futureCurve ? (
              <Path
                d={futureCurve}
                fill="none"
                stroke={INK}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            ) : null}

            {/* "Now" reference line (always visible) */}
            <Line
              x1={nowX}
              y1={CHART_PAD_T}
              x2={nowX}
              y2={CHART_PAD_T + PLOT_H}
              stroke={INK}
              strokeWidth={1}
              strokeDasharray="3,3"
              opacity={0.3}
            />
            {!isAtNow && (
              <Circle cx={nowX} cy={points[nowHour]?.y ?? 0} r={3} fill={INK} opacity={0.35} />
            )}

            {/* High marker */}
            <Circle cx={points[hiIdx].x} cy={points[hiIdx].y} r={4} fill="#e07738" />
            <SvgText
              x={points[hiIdx].x}
              y={points[hiIdx].y - 10}
              textAnchor="middle"
              fontSize={10}
              fontWeight="700"
              fill="#e07738"
            >
              H {fmtTemp(displaySeries[hiIdx].temp, unit)}{'\u00b0'}
            </SvgText>

            {/* Low marker */}
            <Circle cx={points[loIdx].x} cy={points[loIdx].y} r={4} fill="#4a7fba" />
            <SvgText
              x={points[loIdx].x}
              y={points[loIdx].y + 16}
              textAnchor="middle"
              fontSize={10}
              fontWeight="700"
              fill="#4a7fba"
            >
              L {fmtTemp(displaySeries[loIdx].temp, unit)}{'\u00b0'}
            </SvgText>

            {/* Temperature axis (right) */}
            {ticks.map((t, i) => (
              <G key={i}>
                <Line
                  x1={CHART_PAD_L}
                  y1={t.y}
                  x2={CHART_PAD_L + PLOT_W}
                  y2={t.y}
                  stroke={HAIR}
                  strokeWidth={StyleSheet.hairlineWidth}
                />
                <SvgText
                  x={CHART_PAD_L + PLOT_W + 8}
                  y={t.y + 4}
                  fontSize={10}
                  fill={MUTED}
                  fontWeight="500"
                >
                  {t.val}{'\u00b0'}
                </SvgText>
              </G>
            ))}

            {/* Time axis (bottom) */}
            {timeLabels.map((tl) => {
              const x = CHART_PAD_L + (tl.hour / 23) * PLOT_W;
              return (
                <SvgText
                  key={tl.label}
                  x={x}
                  y={CHART_PAD_T + PLOT_H + 18}
                  textAnchor="middle"
                  fontSize={10}
                  fill={MUTED}
                  fontWeight="500"
                >
                  {tl.label}
                </SvgText>
              );
            })}

            {/* Scrub indicator (pre-focused on now, drag to explore) */}
            {activeEntry && (() => {
              const calloutW = 78;
              const calloutX = Math.max(
                CHART_PAD_L,
                Math.min(activeX - calloutW / 2, CHART_PAD_L + PLOT_W - calloutW),
              );
              const calloutLabel = `${isAtNow ? 'Now' : activeEntry.label} · ${fmtTemp(
                activeEntry.temp,
                unit,
              )}°`;
              return (
                <G>
                  <Line
                    x1={activeX}
                    y1={CHART_PAD_T - 4}
                    x2={activeX}
                    y2={CHART_PAD_T + PLOT_H}
                    stroke={INK}
                    strokeWidth={1.5}
                    opacity={0.55}
                  />
                  <Circle
                    cx={activeX}
                    cy={activeY}
                    r={6}
                    fill={INK}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <Rect
                    x={calloutX}
                    y={CHART_PAD_T - 28}
                    width={calloutW}
                    height={20}
                    rx={10}
                    fill={INK}
                  />
                  <SvgText
                    x={calloutX + calloutW / 2}
                    y={CHART_PAD_T - 14}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight="700"
                    fill="#fff"
                  >
                    {calloutLabel}
                  </SvgText>
                </G>
              );
            })()}
          </Svg>
          </View>
        </View>

        {/* Toggle: Actual / Feels Like */}
        <View style={styles.toggleContainer}>
          <View style={styles.segmented}>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === 'actual' && styles.segmentBtnActive]}
              onPress={() => setMode('actual')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Show actual temperatures"
              accessibilityState={{ selected: mode === 'actual' }}
            >
              <Text style={[styles.segmentText, mode === 'actual' && styles.segmentTextActive]}>
                Actual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, mode === 'feels' && styles.segmentBtnActive]}
              onPress={() => setMode('feels')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Show feels-like temperatures"
              accessibilityState={{ selected: mode === 'feels' }}
            >
              <Text style={[styles.segmentText, mode === 'feels' && styles.segmentTextActive]}>
                Feels Like
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.caption}>
            {mode === 'actual'
              ? 'Drag along the chart to explore the day.'
              : 'Adjusted for wind chill and humidity effects.'}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
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
    height: SHEET_H,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },

  headerContent: {
    gap: 2,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 4,
  },

  locationName: {
    fontSize: 20,
    fontWeight: '700',
    color: INK,
  },

  headerTime: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  headerTemp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  tempText: {
    fontSize: 28,
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

  chartContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },

  iconRow: {
    height: 24,
    position: 'relative',
    marginBottom: 4,
  },

  iconItem: {
    position: 'absolute',
    top: 2,
  },

  toggleContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: '#f5f4f7',
    borderRadius: 12,
    padding: 3,
  },

  segmentBtn: {
    paddingHorizontal: 24,
    paddingVertical: 9,
    borderRadius: 10,
  },

  segmentBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
  },

  segmentTextActive: {
    color: INK,
  },

  caption: {
    fontSize: 12,
    color: MUTED,
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '400',
  },
});

export default HourlyExpandedSheet;
