import React, { useRef, useState, useEffect } from 'react';
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
import MetricIcon from './MetricIcon';
import type { WeatherScenario } from '../data/weatherData';
import type { MetricDef } from '../data/metrics';
import { fmtTemp } from '../utils/helpers';
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

interface MetricTimelineSheetProps {
  metric: MetricDef | null;
  wx: WeatherScenario;
  unit: 'C' | 'F';
  visible: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Catmull-Rom spline helper (same proven curve as HourlyExpandedSheet)
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
// MetricTimelineSheet component
// ---------------------------------------------------------------------------

const MetricTimelineSheet: React.FC<MetricTimelineSheetProps> = ({
  metric,
  wx,
  unit,
  visible,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

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

  // Reset scrub position on close
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => setSelectedHour(null), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible || !metric) return null;

  // -------------------------------------------------------------------------
  // Value formatting (dew is temp-like → fmtTemp; others use metric.unit)
  // -------------------------------------------------------------------------

  const isTempLike = metric.key === 'dew';

  const valueParts = (v: number): { big: string; unit: string } => {
    if (isTempLike) return { big: String(fmtTemp(v, unit)), unit: '°' };
    return { big: metric.format(v), unit: metric.unit };
  };

  const valueLabel = (v: number | undefined): string => {
    if (v === undefined || Number.isNaN(v)) return '—';
    const { big, unit: u } = valueParts(v);
    if (!u) return big;
    if (u === '%' || u === '°') return `${big}${u}`;
    return `${big} ${u}`;
  };

  // -------------------------------------------------------------------------
  // Series + chart geometry
  // -------------------------------------------------------------------------

  const series = metric.getSeries(wx);
  const nowHour = wx.nowHour ?? 14;

  const firstHour = series.length ? series[0].hour : 0;
  const lastHour = series.length ? series[series.length - 1].hour : 23;
  const hourSpan = lastHour - firstHour || 1;
  const xForHour = (h: number) =>
    CHART_PAD_L + ((h - firstHour) / hourSpan) * PLOT_W;

  // Defined points only (skip gaps such as missing AQI hours)
  const defined = series.filter(
    (p): p is typeof p & { value: number } =>
      typeof p.value === 'number' && !Number.isNaN(p.value),
  );

  const current = metric.getCurrent(wx);

  // Empty state — no plottable data for this metric.
  if (defined.length === 0) {
    return (
      <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
          accessibilityViewIsModal
        >
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={styles.grabber} />
          </View>
          {renderHeader()}
          <View style={styles.divider} />
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No timeline data available.</Text>
          </View>
        </Animated.View>
      </Modal>
    );
  }

  const vals = defined.map((p) => p.value);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const rawRange = rawMax - rawMin;
  // Pad the value axis so flat-ish series still read clearly.
  const pad = rawRange > 0 ? rawRange * 0.12 : Math.max(Math.abs(rawMax) * 0.1, 1);
  const minV = rawMin - pad;
  const maxV = rawMax + pad;
  const range = maxV - minV || 1;

  const yForValue = (v: number) =>
    CHART_PAD_T + PLOT_H - ((v - minV) / range) * PLOT_H;

  const points = defined.map((p) => ({
    x: xForHour(p.hour),
    y: yForValue(p.value),
    hour: p.hour,
    value: p.value,
  }));

  const pointByHour = (h: number) => points.find((p) => p.hour === h);

  // High/Low markers (within the defined data)
  const hiPoint = points.reduce((a, b) => (b.value > a.value ? b : a), points[0]);
  const loPoint = points.reduce((a, b) => (b.value < a.value ? b : a), points[0]);

  // Curve, split at "now" for dashed past / solid future
  const fullCurve = catmullRomPath(points);
  const pastPoints = points.filter((p) => p.hour <= nowHour);
  const futurePoints = points.filter((p) => p.hour >= nowHour);
  const pastCurve = pastPoints.length >= 2 ? catmullRomPath(pastPoints) : '';
  const futureCurve = futurePoints.length >= 2 ? catmullRomPath(futurePoints) : '';

  const areaPath =
    points.length >= 2
      ? fullCurve +
        ` L${points[points.length - 1].x},${CHART_PAD_T + PLOT_H}` +
        ` L${points[0].x},${CHART_PAD_T + PLOT_H} Z`
      : '';

  const nowX = xForHour(nowHour);
  const nowPoint = pointByHour(nowHour);

  // Active (focused) hour: scrubbed position, pre-focused on the current time
  const activeHour = selectedHour ?? nowHour;
  const activeEntry = series.find((p) => p.hour === activeHour);
  const activePoint = pointByHour(activeHour);
  const activeX = xForHour(activeHour);
  const activeY = activePoint?.y ?? CHART_PAD_T + PLOT_H / 2;
  const isAtNow = activeHour === nowHour;

  // Value axis ticks (right side)
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = minV + (i / (tickCount - 1)) * range;
    return {
      val: isTempLike ? `${Math.round(fmtTemp(t, unit))}°` : String(Math.round(t)),
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

  // -------------------------------------------------------------------------
  // Header (shared between empty + chart states)
  // -------------------------------------------------------------------------

  function renderHeader() {
    if (!metric) return null;
    const m = metric;
    return (
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.sectionLabel}>{m.label.toUpperCase()}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.valueText}>{valueLabel(current)}</Text>
          </View>
          <Text style={styles.explain}>{m.explain}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.iconBadge}>
            <MetricIcon name={m.iconName} size={26} color={INK} />
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={`Close ${m.label} timeline`}
          >
            <Text style={styles.closeBtnText}>{'✕'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        accessibilityViewIsModal
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.grabber} />
        </View>

        {renderHeader()}

        <View style={styles.divider} />

        {/* Chart */}
        <View style={styles.chartContainer}>
          <View
            ref={chartWrapRef}
            onLayout={() => {
              chartWrapRef.current?.measureInWindow((x) => {
                chartLeftRef.current = x;
              });
            }}
            {...chartPan.panHandlers}
            accessible
            accessibilityLabel={`${metric.label} timeline. Drag across to explore the day.`}
          >
            <Svg width={CHART_W} height={CHART_H}>
              <Defs>
                <LinearGradient id="metricAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={INK} stopOpacity="0.18" />
                  <Stop offset="1" stopColor={INK} stopOpacity="0.02" />
                </LinearGradient>
              </Defs>

              {/* Gradient area fill */}
              {areaPath ? <Path d={areaPath} fill="url(#metricAreaGrad)" /> : null}

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

              {/* Single-point fallback */}
              {points.length === 1 ? (
                <Circle cx={points[0].x} cy={points[0].y} r={4} fill={INK} />
              ) : null}

              {/* "Now" reference line */}
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
              {!isAtNow && nowPoint ? (
                <Circle cx={nowX} cy={nowPoint.y} r={3} fill={INK} opacity={0.35} />
              ) : null}

              {/* High marker */}
              <Circle cx={hiPoint.x} cy={hiPoint.y} r={4} fill="#e07738" />
              <SvgText
                x={hiPoint.x}
                y={hiPoint.y - 10}
                textAnchor="middle"
                fontSize={10}
                fontWeight="700"
                fill="#e07738"
              >
                {valueLabel(hiPoint.value)}
              </SvgText>

              {/* Low marker */}
              <Circle cx={loPoint.x} cy={loPoint.y} r={4} fill="#4a7fba" />
              <SvgText
                x={loPoint.x}
                y={loPoint.y + 16}
                textAnchor="middle"
                fontSize={10}
                fontWeight="700"
                fill="#4a7fba"
              >
                {valueLabel(loPoint.value)}
              </SvgText>

              {/* Value axis (right) */}
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
                    {t.val}
                  </SvgText>
                </G>
              ))}

              {/* Time axis (bottom) */}
              {timeLabels.map((tl) => {
                const x = xForHour(tl.hour);
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
              {activeEntry &&
                (() => {
                  const reading = valueLabel(activeEntry.value);
                  const calloutLabel = `${isAtNow ? 'Now' : activeEntry.label} · ${reading}`;
                  const calloutW = Math.max(78, calloutLabel.length * 6.5 + 16);
                  const calloutX = Math.max(
                    CHART_PAD_L,
                    Math.min(activeX - calloutW / 2, CHART_PAD_L + PLOT_W - calloutW),
                  );
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
                      {activePoint ? (
                        <Circle
                          cx={activeX}
                          cy={activeY}
                          r={6}
                          fill={INK}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ) : null}
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

          {/* Min / Max for the day */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>LOW</Text>
              <Text style={styles.statValue}>{valueLabel(loPoint.value)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>HIGH</Text>
              <Text style={styles.statValue}>{valueLabel(hiPoint.value)}</Text>
            </View>
          </View>

          <Text style={styles.caption}>Drag along the chart to explore the day.</Text>
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
    flex: 1,
    paddingRight: 12,
    gap: 2,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 4,
  },

  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  valueText: {
    fontSize: 30,
    fontWeight: '700',
    color: INK,
  },

  explain: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 6,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f4f7',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingTop: 12,
    paddingBottom: 16,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  statItem: {
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 4,
  },

  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: HAIR,
  },

  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1,
  },

  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
  },

  caption: {
    fontSize: 12,
    color: MUTED,
    marginTop: 14,
    textAlign: 'center',
    fontWeight: '400',
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },

  emptyText: {
    fontSize: 14,
    color: MUTED,
    fontWeight: '500',
  },
});

export default MetricTimelineSheet;
