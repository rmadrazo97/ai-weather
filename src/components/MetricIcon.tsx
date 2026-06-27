import React from 'react';
import Svg, { Circle, Path, Line } from 'react-native-svg';

export type MetricName =
  | 'humidity'
  | 'pressure'
  | 'dew'
  | 'wind'
  | 'aqi'
  | 'uv'
  | 'vis';

interface MetricIconProps {
  name: MetricName;
  size?: number;
  color?: string;
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const MetricIcon: React.FC<MetricIconProps> = ({
  name,
  size = 22,
  color = '#fff',
}) => {
  const strokeWidth = Math.max(1.4, size * 0.08);

  const common = {
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const renderContent = () => {
    switch (name) {
      // Water droplet
      case 'humidity':
        return (
          <Path
            d="M50 18 C50 18 28 44 28 60 a22 22 0 0 0 44 0 C72 44 50 18 50 18 Z"
            {...common}
          />
        );

      // Barometer dial with needle
      case 'pressure':
        return (
          <>
            <Circle cx={50} cy={52} r={26} {...common} />
            <Line x1={50} y1={52} x2={64} y2={37} {...common} />
            <Circle cx={50} cy={52} r={3} fill={color} />
          </>
        );

      // Droplet resting on a surface line (dew point)
      case 'dew':
        return (
          <>
            <Path
              d="M50 24 C50 24 34 44 34 56 a16 16 0 0 0 32 0 C66 44 50 24 50 24 Z"
              {...common}
            />
            <Line x1={24} y1={82} x2={76} y2={82} {...common} />
          </>
        );

      // Flowing gust lines
      case 'wind':
        return (
          <>
            <Path d="M20 40 H54 a8 8 0 1 0 -8 -8" {...common} />
            <Path d="M20 56 H66 a8 8 0 1 1 -8 8" {...common} />
            <Path d="M20 72 H46 a6 6 0 1 1 -6 6" {...common} />
          </>
        );

      // Leaf with vein (air quality)
      case 'aqi':
        return (
          <>
            <Path
              d="M28 72 C26 42 48 26 74 28 C76 54 60 76 28 72 Z"
              {...common}
            />
            <Line x1={36} y1={64} x2={66} y2={36} {...common} />
          </>
        );

      // Sun with rays (UV index)
      case 'uv': {
        const cx = 50;
        const cy = 50;
        const rays = RAY_ANGLES.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <Line
              key={deg}
              x1={cx + 22 * Math.cos(rad)}
              y1={cy + 22 * Math.sin(rad)}
              x2={cx + 30 * Math.cos(rad)}
              y2={cy + 30 * Math.sin(rad)}
              {...common}
            />
          );
        });
        return (
          <>
            <Circle cx={cx} cy={cy} r={13} {...common} />
            {rays}
          </>
        );
      }

      // Eye (visibility)
      case 'vis':
        return (
          <>
            <Path
              d="M16 50 C30 30 70 30 84 50 C70 70 30 70 16 50 Z"
              {...common}
            />
            <Circle cx={50} cy={50} r={10} {...common} />
            <Circle cx={50} cy={50} r={3} fill={color} />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {renderContent()}
    </Svg>
  );
};

export default MetricIcon;
