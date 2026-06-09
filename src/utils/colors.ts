export const INK = '#15131a';
export const MUTED = 'rgba(21,19,26,0.52)';
export const FAINT = 'rgba(21,19,26,0.34)';
export const HAIR = 'rgba(21,19,26,0.14)';
export const RAIN_BLUE = '#3f6fb0';

// Gradient color stops per weather condition
export const GRADIENTS: Record<string, { colors: [string, string, ...string[]]; locations: [number, number, ...number[]] }> = {
  clear: {
    colors: ['#ffe6bf', '#ffd6a6', '#fef5ea', '#ffc790', '#fbecda'],
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
};

export const THEME_COLORS: Record<string, string> = {
  clear: '#fef5ea',
  cloud: '#f3f1f8',
  rain: '#eef5fc',
  night: '#eeecf8',
};
