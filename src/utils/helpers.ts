export const cToF = (c: number): number => Math.round(c * 9 / 5 + 32);
export const fmtTemp = (c: number, unit: 'C' | 'F'): number =>
  unit === 'F' ? cToF(c) : Math.round(c);
