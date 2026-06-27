import React, { useId, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { INK } from '../utils/colors';

// ---------------------------------------------------------------------------
// MetricIndicator
//
// A small bar that visualizes a single value within a [min, max] range.
//   - kind 'gradient': horizontal multi-stop gradient track with a knob at the
//     normalized value (e.g. UV / AQI scales).
//   - kind 'progress': rounded track with a filled pill up to the normalized
//     value (e.g. humidity / visibility).
//
// Pure React Native + react-native-svg / View — no external gradient lib.
// ---------------------------------------------------------------------------

interface MetricIndicatorProps {
  kind: 'gradient' | 'progress';
  /** Raw value; normalized internally against min/max. */
  value: number | undefined;
  min: number;
  max: number;
  /** Gradient stops, left → right. Required for `gradient`. */
  stops?: string[];
  /** Track thickness. */
  height?: number;
}

const TRACK_H = 6;

const PROGRESS_TRACK = 'rgba(21,19,26,0.12)';
const KNOB_BORDER = 'rgba(21,19,26,0.28)';
const FALLBACK_STOPS = ['#22c55e', '#ef4444'];

const normalize = (value: number | undefined, min: number, max: number): number => {
  if (value == null || Number.isNaN(value) || max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

const MetricIndicator: React.FC<MetricIndicatorProps> = ({
  kind,
  value,
  min,
  max,
  stops,
  height = TRACK_H,
}) => {
  const gid = useId();
  const [width, setWidth] = useState(0);

  const t = normalize(value, min, max);

  if (kind === 'progress') {
    return (
      <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: PROGRESS_TRACK }]}>
        <View
          style={[
            styles.fill,
            { width: `${t * 100}%`, height, borderRadius: height / 2, backgroundColor: INK },
          ]}
        />
      </View>
    );
  }

  // gradient
  const list = stops && stops.length >= 2 ? stops : FALLBACK_STOPS;
  const knobR = height * 0.95;
  const svgH = knobR * 2 + 2;
  const cy = svgH / 2;
  const inner = Math.max(0, width - knobR * 2);

  return (
    <View
      style={{ height: svgH, justifyContent: 'center' }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg width={width} height={svgH}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
              {list.map((c, i) => (
                <Stop key={i} offset={list.length > 1 ? i / (list.length - 1) : 0} stopColor={c} stopOpacity={1} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect
            x={knobR}
            y={cy - height / 2}
            width={inner}
            height={height}
            rx={height / 2}
            fill={`url(#${gid})`}
          />
          <Circle
            cx={knobR + t * inner}
            cy={cy}
            r={knobR}
            fill="#fff"
            stroke={KNOB_BORDER}
            strokeWidth={1}
          />
        </Svg>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    minWidth: 2,
  },
});

export default MetricIndicator;
