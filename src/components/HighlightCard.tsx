import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import WeatherIcon from './WeatherIcon';
import { fmtTemp } from '../utils/helpers';
import type { WeatherScenario, Condition } from '../data/weatherData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });
const FG = '#fff';

/**
 * Solid, condition-tinted background colors for the card. Each is darkened
 * far enough that white (#fff) foreground text clears WCAG AA (>= 4.5:1).
 */
const CARD_BG: Record<Condition, string> = {
  clear: '#a85d18', // deep amber
  partly: '#a06224', // bronze
  cloud: '#5b6178', // slate
  rain: '#3f6fb0', // rain blue
  snow: '#557089', // cool blue-gray
  fog: '#6b6862', // warm gray
  storm: '#3f4654', // deep slate
  night: '#3f3d66', // indigo
};

// ---------------------------------------------------------------------------
// Pin icon (location) — white stroke variant
// ---------------------------------------------------------------------------

function PinIcon({ color = FG }: { color?: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9} r={2.5} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HighlightCardProps {
  wx: WeatherScenario;
  unit: 'C' | 'F';
  onPress: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Solid condition-tinted card summarizing the current location. Tapping the
 * "View Highlights" pill calls `onPress` (wired to open the AI chat).
 */
const HighlightCard: React.FC<HighlightCardProps> = ({ wx, unit, onPress }) => {
  const bg = CARD_BG[wx.cond] ?? CARD_BG.cloud;
  const temp = fmtTemp(wx.temp, unit);
  const feels = fmtTemp(wx.feels, unit);

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      {/* ---- Top row: location + condition icon ---- */}
      <View style={styles.topRow}>
        <View style={styles.locationRow}>
          <PinIcon />
          <Text style={styles.location} numberOfLines={1}>
            {'  '}{wx.location.toUpperCase()}
          </Text>
        </View>
        <WeatherIcon cond={wx.cond} size={46} stroke={FG} />
      </View>

      {/* ---- Big temperature ---- */}
      <Text style={styles.temp}>{temp}{'°'}</Text>

      {/* ---- Sub stats ---- */}
      <Text style={styles.detail}>Feels like {feels}{'°'}</Text>
      <Text style={styles.detail}>
        {wx.dir} wind {wx.wind} km/h
      </Text>

      {/* ---- View Highlights pill ---- */}
      <TouchableOpacity
        style={styles.pill}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="View highlights"
      >
        <Text style={[styles.pillText, { color: bg }]}>View Highlights {'›'}</Text>
      </TouchableOpacity>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingTop: 4,
  },
  location: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: FG,
    flexShrink: 1,
  },
  temp: {
    fontFamily: FONT,
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 70,
    color: FG,
    marginTop: 8,
    includeFontPadding: false,
  },
  detail: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.86)',
    marginTop: 4,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 16,
  },
  pillText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default HighlightCard;
