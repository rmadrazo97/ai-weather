import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MetricIcon from './MetricIcon';
import MetricIndicator from './MetricIndicator';
import { INK, MUTED, GLASS } from '../utils/colors';
import { fmtTemp } from '../utils/helpers';
import type { MetricDef } from '../data/metrics';
import type { WeatherScenario } from '../data/weatherData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });

const BLUR_TINT = Platform.OS === 'ios' ? 'systemThinMaterialLight' : 'light';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MetricTileProps {
  metric: MetricDef;
  wx: WeatherScenario;
  unit: 'C' | 'F';
  onPress: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MetricTile: React.FC<MetricTileProps> = ({ metric, wx, unit, onPress }) => {
  const raw = metric.getCurrent(wx);
  const hasValue = raw != null && !Number.isNaN(raw);

  // Temps are stored in °C; convert dew-point at render time.
  const shown = hasValue
    ? metric.key === 'dew'
      ? fmtTemp(raw as number, unit)
      : (raw as number)
    : undefined;

  const valueText = shown != null ? metric.format(shown) : '—';

  // Caption next to the value: the unit, or a qualitative word for AQI / UV.
  const word =
    metric.key === 'aqi' ? wx.aqiWord : metric.key === 'uv' ? wx.uvWord : undefined;
  const caption = metric.unit || word;

  const a11yLabel = `${metric.label}: ${valueText}${metric.unit ? ` ${metric.unit}` : ''}${
    word ? `, ${word}` : ''
  }`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Opens the 24-hour timeline"
      style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
    >
      <View style={styles.clip}>
        <BlurView intensity={36} tint={BLUR_TINT} style={StyleSheet.absoluteFill} />
        {/* Translucent white wash to lighten the frost */}
        <View style={[StyleSheet.absoluteFill, styles.wash]} />
        {/* Glossy top highlight */}
        <LinearGradient
          colors={[GLASS.gloss, 'rgba(255,255,255,0)']}
          locations={[0, 0.55]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.content}>
          {/* Top row: label + icon */}
          <View style={styles.topRow}>
            <Text style={styles.label} numberOfLines={1}>
              {metric.label}
            </Text>
            <MetricIcon name={metric.iconName} size={18} color={MUTED} />
          </View>

          {/* Value + unit / word */}
          <View style={styles.valueRow}>
            <Text style={styles.value} numberOfLines={1}>
              {valueText}
            </Text>
            {caption ? (
              <Text style={styles.unit} numberOfLines={1}>
                {caption}
              </Text>
            ) : null}
          </View>

          {/* Indicator bar (when configured) */}
          {metric.indicator ? (
            <View style={styles.bar}>
              <MetricIndicator
                kind={metric.indicator.kind}
                value={raw}
                min={metric.indicator.min}
                max={metric.indicator.max}
                stops={metric.indicator.stops}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 20,
    shadowColor: GLASS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  clip: {
    height: 104,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    backgroundColor: GLASS.bg,
  },
  wash: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 13,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: MUTED,
    flexShrink: 1,
    marginRight: 8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: '700',
    color: INK,
    letterSpacing: -0.5,
  },
  unit: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginLeft: 4,
    flexShrink: 1,
  },
  bar: {
    marginTop: 2,
  },
});

export default MetricTile;
