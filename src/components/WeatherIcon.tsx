import React from 'react';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import type { Condition } from '../data/weatherData';

interface WeatherIconProps {
  cond: Condition;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const WeatherIcon: React.FC<WeatherIconProps> = ({
  cond,
  size = 48,
  stroke = '#15131a',
  strokeWidth: strokeWidthProp,
}) => {
  const strokeWidth = strokeWidthProp ?? Math.max(1.4, size * 0.045);

  const common = {
    fill: 'none' as const,
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const renderContent = () => {
    switch (cond) {
      case 'clear': {
        const cx = 50;
        const cy = 50;
        const rays = RAY_ANGLES.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <Line
              key={deg}
              x1={cx + 26 * Math.cos(rad)}
              y1={cy + 26 * Math.sin(rad)}
              x2={cx + 34 * Math.cos(rad)}
              y2={cy + 34 * Math.sin(rad)}
              {...common}
            />
          );
        });
        return (
          <>
            <Circle cx={cx} cy={cy} r={17} {...common} />
            {rays}
          </>
        );
      }

      case 'night':
        return (
          <>
            <Path
              d="M64 22 A30 30 0 1 0 78 64 A24 24 0 0 1 64 22 Z"
              {...common}
            />
            <Circle cx={32} cy={30} r={1.6} fill={stroke} />
            <Circle cx={22} cy={46} r={1.2} fill={stroke} />
          </>
        );

      case 'partly': {
        const cx = 60;
        const cy = 36;
        const rays = [225, 270, 315, 0].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <Line
              key={deg}
              x1={cx + 17 * Math.cos(rad)}
              y1={cy + 17 * Math.sin(rad)}
              x2={cx + 24 * Math.cos(rad)}
              y2={cy + 24 * Math.sin(rad)}
              {...common}
            />
          );
        });
        return (
          <>
            <Path d={`M${cx - 11} ${cy + 4} a11 11 0 1 1 18 8`} {...common} />
            {rays}
            <Path
              d="M26 78 a13 13 0 0 1 1 -25 a17 17 0 0 1 33 4 a11 11 0 0 1 -3 21 Z"
              {...common}
            />
          </>
        );
      }

      case 'cloud':
        return (
          <Path
            d="M30 70 a16 16 0 0 1 1 -31 a21 21 0 0 1 40 5 a13 13 0 0 1 -3 26 Z"
            {...common}
          />
        );

      case 'rain':
        return (
          <>
            <Path
              d="M30 58 a16 16 0 0 1 1 -31 a21 21 0 0 1 40 5 a13 13 0 0 1 -3 26 Z"
              {...common}
            />
            <Line x1={34} y1={70} x2={30} y2={82} {...common} />
            <Line x1={50} y1={70} x2={46} y2={84} {...common} />
            <Line x1={66} y1={70} x2={62} y2={82} {...common} />
          </>
        );

      case 'snow':
        return (
          <>
            <Path
              d="M30 58 a16 16 0 0 1 1 -31 a21 21 0 0 1 40 5 a13 13 0 0 1 -3 26 Z"
              {...common}
            />
            <Circle cx={34} cy={72} r={2.2} fill={stroke} />
            <Circle cx={50} cy={78} r={2.2} fill={stroke} />
            <Circle cx={66} cy={72} r={2.2} fill={stroke} />
            <Circle cx={42} cy={84} r={2.2} fill={stroke} />
            <Circle cx={58} cy={86} r={2.2} fill={stroke} />
          </>
        );

      case 'fog':
        return (
          <>
            <Line x1={22} y1={40} x2={78} y2={40} {...common} />
            <Line x1={28} y1={52} x2={72} y2={52} {...common} />
            <Line x1={22} y1={64} x2={78} y2={64} {...common} />
          </>
        );

      case 'storm':
        return (
          <>
            <Path
              d="M30 58 a16 16 0 0 1 1 -31 a21 21 0 0 1 40 5 a13 13 0 0 1 -3 26 Z"
              {...common}
            />
            <Path d="M52 64 L42 78 L50 78 L46 90 L58 74 L50 74 L56 64 Z" {...common} />
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

export default WeatherIcon;
