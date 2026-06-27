import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import WeatherIcon from './WeatherIcon';
import { fmtTemp } from '../utils/helpers';
import { INK, FAINT, RAIN_BLUE } from '../utils/colors';
import type { WeatherScenario } from '../data/weatherData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });
const HOUR_COL_W = 56;
const HOURLY_COUNT = 18;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HourlyForecastCardProps {
  wx: WeatherScenario;
  unit: 'C' | 'F';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * White rounded card with a horizontally-scrolling strip of upcoming hours.
 * Reuses the hero HourlyGraph windowing: a forward-looking window of
 * HOURLY_COUNT entries starting at `nowHour`, wrapping the 24h `daySeries`.
 */
const HourlyForecastCard: React.FC<HourlyForecastCardProps> = ({ wx, unit }) => {
  const fullSeries = wx.daySeries;
  const nowHour = wx.nowHour;

  const series = [];
  for (let k = 0; k < HOURLY_COUNT; k++) {
    const entry = fullSeries[(nowHour + k) % fullSeries.length];
    series.push({ ...entry, h: k === 0 ? 'Now' : entry.label });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>HOURLY FORECAST</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {series.map((entry, i) => (
          <View key={i} style={styles.col}>
            <Text style={styles.time}>{entry.h}</Text>
            <View style={styles.iconWrap}>
              <WeatherIcon cond={entry.cond} size={26} />
            </View>
            {entry.pop > 0 ? (
              <Text style={styles.pop}>{entry.pop}%</Text>
            ) : (
              <Text style={styles.popHidden}>{' '}</Text>
            )}
            <Text style={styles.temp}>
              {fmtTemp(entry.temp, unit)}{'°'}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingVertical: 16,
    overflow: 'hidden',
    // subtle lift off the gradient background
    shadowColor: INK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  label: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: FAINT,
    marginBottom: 12,
    marginHorizontal: 18,
  },
  scrollContent: {
    paddingHorizontal: 10,
  },
  col: {
    width: HOUR_COL_W,
    alignItems: 'center',
  },
  time: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: FAINT,
    marginBottom: 8,
  },
  iconWrap: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pop: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '600',
    color: RAIN_BLUE,
    marginTop: 6,
  },
  popHidden: {
    fontSize: 11,
    marginTop: 6,
    color: 'transparent',
  },
  temp: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    marginTop: 6,
  },
});

export default HourlyForecastCard;
