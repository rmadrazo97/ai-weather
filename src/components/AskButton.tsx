import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INK = '#15131a';
const FONT = Platform.select({
  ios: 'Helvetica Neue',
  android: 'sans-serif-medium',
  default: 'System',
});

// ---------------------------------------------------------------------------
// SparkIcon
// ---------------------------------------------------------------------------

function SparkIcon({ size = 17, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5z"
        fill={color}
      />
      <Path
        d="M19 14.5l.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3z"
        fill={color}
        opacity={0.55}
      />
    </Svg>
  );
}

export { SparkIcon };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AskButtonProps {
  onPress: () => void;
}

// ---------------------------------------------------------------------------
// AskButton component
// ---------------------------------------------------------------------------

export default function AskButton({ onPress }: AskButtonProps) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.85}>
        <SparkIcon size={17} color="#fff" />
        <Text style={styles.text}>Ask WeatherAI</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 38,
    alignItems: 'center',
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 14,
    paddingHorizontal: 22,
    paddingLeft: 18,
    borderRadius: 999,
    backgroundColor: INK,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 15,
    elevation: 12,
  },

  text: {
    color: '#fff',
    fontFamily: FONT,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: -0.15,
  },
});
