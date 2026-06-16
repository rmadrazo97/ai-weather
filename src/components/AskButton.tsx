import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INK = '#15131a';
const FONT = Platform.select({
  ios: 'Helvetica Neue',
  android: 'sans-serif-medium',
  default: 'System',
});

// Color sheet rotating INSIDE the pill (clipped, so only the moving tint is
// visible). Must cover the pill's diagonal.
const SHEET = 240;

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
// AuroraSheet — color blobs rotating inside the glass
// ---------------------------------------------------------------------------

function AuroraSheet() {
  return (
    <Svg width={SHEET} height={SHEET}>
      <Defs>
        <RadialGradient id="tintViolet" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#a78bfa" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="tintBlue" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#7cb8ff" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#7cb8ff" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="tintPink" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#ff9ecd" stopOpacity="0.5" />
          <Stop offset="1" stopColor="#ff9ecd" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="tintMint" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#9ff0d8" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#9ff0d8" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={SHEET * 0.25} cy={SHEET * 0.3} r={SHEET * 0.38} fill="url(#tintViolet)" />
      <Circle cx={SHEET * 0.75} cy={SHEET * 0.3} r={SHEET * 0.38} fill="url(#tintBlue)" />
      <Circle cx={SHEET * 0.72} cy={SHEET * 0.72} r={SHEET * 0.38} fill="url(#tintPink)" />
      <Circle cx={SHEET * 0.28} cy={SHEET * 0.7} r={SHEET * 0.38} fill="url(#tintMint)" />
    </Svg>
  );
}

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
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinLoop.start();
    return () => spinLoop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.stack} pointerEvents="box-none">
        <View style={styles.shadowWrap}>
          {/* Plain View does the clipping — BlurView doesn't reliably clip
              its children to the pill radius */}
          <View style={styles.glassClip}>
            <BlurView
              intensity={55}
              tint="light"
              experimentalBlurMethod="dimezisBlurView"
              style={styles.fill}
            />

            {/* Moving colors, clipped inside the glass */}
            <Animated.View
              style={[styles.aurora, { transform: [{ rotate }] }]}
              pointerEvents="none"
            >
              <AuroraSheet />
            </Animated.View>

            <TouchableOpacity
              style={styles.button}
              onPress={onPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Ask WeatherAI about the weather"
            >
              {/* Glossy top highlight */}
              <LinearGradient
                colors={[
                  'rgba(255,255,255,0.55)',
                  'rgba(255,255,255,0.12)',
                  'rgba(255,255,255,0.05)',
                  'rgba(255,255,255,0.28)',
                ]}
                locations={[0, 0.4, 0.75, 1]}
                style={styles.gloss}
                pointerEvents="none"
              />
              <SparkIcon size={17} color={INK} />
              <Text style={styles.text}>Ask WeatherAI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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

  stack: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  aurora: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: SHEET,
    height: SHEET,
    marginLeft: -SHEET / 2,
    marginTop: -SHEET / 2,
  },

  shadowWrap: {
    borderRadius: 999,
    shadowColor: '#8b78d8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },

  glassClip: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 14,
    paddingHorizontal: 22,
    paddingLeft: 18,
    borderRadius: 999,
  },

  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
  },

  text: {
    color: INK,
    fontFamily: FONT,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: -0.15,
  },
});
