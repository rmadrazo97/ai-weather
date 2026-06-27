import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });

// Muted-white tones layered over the solid tile background.
const LABEL_WHITE = 'rgba(255,255,255,0.82)';
const SUB_WHITE = 'rgba(255,255,255,0.74)';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  bg: string;
  fg?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MetricTile: React.FC<MetricTileProps> = ({
  icon,
  label,
  value,
  unit,
  subtitle,
  bg,
  fg = '#fff',
}) => {
  return (
    <View
      style={[styles.tile, { backgroundColor: bg }]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}${
        subtitle ? `, ${subtitle}` : ''
      }`}
    >
      <View style={styles.header}>
        {icon}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: fg }]} numberOfLines={1}>
            {value}
          </Text>
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  tile: {
    borderRadius: 22,
    padding: 16,
    aspectRatio: 1,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: LABEL_WHITE,
    marginLeft: 8,
    flexShrink: 1,
  },
  body: {},
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: FONT,
    fontSize: 32,
    fontWeight: '700',
  },
  unit: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '500',
    color: LABEL_WHITE,
    marginLeft: 4,
  },
  subtitle: {
    fontFamily: FONT,
    fontSize: 12,
    color: SUB_WHITE,
    marginTop: 2,
    lineHeight: 16,
  },
});

export default MetricTile;
