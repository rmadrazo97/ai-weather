export const INK = '#15131a';
export const MUTED = 'rgba(21,19,26,0.52)';
export const FAINT = 'rgba(21,19,26,0.34)';
export const HAIR = 'rgba(21,19,26,0.14)';
export const RAIN_BLUE = '#3f6fb0';

// Solid background colors for metric tiles (white foreground text).
// Each tone is tuned for WCAG AA contrast against '#fff'.
export const TILE = {
  humidity: RAIN_BLUE, // '#3f6fb0'
  aqi: RAIN_BLUE, // '#3f6fb0'
  pressure: INK, // '#15131a'
  wind: INK, // '#15131a'
  dew: '#2f8f63', // darkened green for white-text AA
  uv: '#c9781f', // darkened amber for AA
  vis: '#2f8f8f', // teal
  fg: '#fff', // foreground text on tiles
} as const;

// Gradient color stops per weather condition
export const GRADIENTS: Record<string, { colors: [string, string, ...string[]]; locations: [number, number, ...number[]] }> = {
  clear: {
    colors: ['#ffe6bf', '#ffd6a6', '#fef5ea', '#ffc790', '#fbecda'],
    locations: [0, 0.2, 0.45, 0.7, 1],
  },
  partly: {
    colors: ['#fae3c4', '#f0d7b8', '#f8f2e9', '#e3cfae', '#f3e8d8'],
    locations: [0, 0.2, 0.45, 0.7, 1],
  },
  cloud: {
    colors: ['#e4def0', '#d6d3e6', '#f3f1f8', '#c8cfe0', '#e9e7f1'],
    locations: [0, 0.2, 0.45, 0.7, 1],
  },
  rain: {
    colors: ['#cfe1f4', '#b6cfec', '#eef5fc', '#a3c0e6', '#e0ecf8'],
    locations: [0, 0.2, 0.45, 0.7, 1],
  },
  night: {
    colors: ['#d2d4f2', '#c4c4ea', '#eeecf8', '#bcbfe4', '#dddaf0'],
    locations: [0, 0.2, 0.45, 0.7, 1],
  },
  snow: {
    colors: ['#e3f0fa', '#d4e7f6', '#f7fbfe', '#c9e0f2', '#ecf4fb'],
    locations: [0, 0.2, 0.45, 0.7, 1],
  },
  fog: {
    colors: ['#e8e4dd', '#ddd8d0', '#f5f3ef', '#d2cdc4', '#ece9e3'],
    locations: [0, 0.2, 0.45, 0.7, 1],
  },
  storm: {
    colors: ['#c3cada', '#b2bccf', '#e3e7ef', '#a5b1c8', '#d3d9e5'],
    locations: [0, 0.2, 0.45, 0.7, 1],
  },
};

export const THEME_COLORS: Record<string, string> = {
  clear: '#fef5ea',
  partly: '#f8f2e9',
  cloud: '#f3f1f8',
  rain: '#eef5fc',
  night: '#eeecf8',
  snow: '#f7fbfe',
  fog: '#f5f3ef',
  storm: '#e3e7ef',
};
