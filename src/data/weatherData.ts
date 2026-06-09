// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Condition = 'clear' | 'cloud' | 'rain' | 'night';

export interface HourlyEntry {
  h: string;
  cond: Condition;
  temp: number;
  pop: number;
}

export type DayTuple = [string, Condition, number, number, number];

export interface Headline {
  pre: string;
  em: string;
  post: string;
}

export interface WeatherScenario {
  cond: Condition;
  label: string;
  location: string;
  time: string;
  temp: number;
  feels: number;
  humidity: number;
  precip: number;
  precipMm: number;
  hi: number;
  lo: number;
  uv: number;
  uvWord: string;
  vis: number;
  wind: number;
  gust: number;
  dir: string;
  pressure: number;
  dew: number;
  sunrise: string;
  sunset: string;
  sunPct: number;
  headline: Headline;
  summary: string;
  precipNote: string;
  hourly: HourlyEntry[];
  days: DayTuple[];
}

export interface PresetCity {
  name: string;
  cond: Condition;
}

// ---------------------------------------------------------------------------
// Scenario data
// ---------------------------------------------------------------------------

export const SCENARIOS: Record<Condition, WeatherScenario> = {
  clear: {
    cond: 'clear',
    label: 'Clear',
    location: 'Madrid',
    time: '2:30 PM',
    temp: 25,
    feels: 24,
    humidity: 40,
    precip: 10,
    precipMm: 0,
    hi: 32,
    lo: 20,
    uv: 7,
    uvWord: 'High',
    vis: 35,
    wind: 6,
    gust: 14,
    dir: '308\u00b0 NW',
    pressure: 1016,
    dew: 11,
    sunrise: '6:44',
    sunset: '9:44',
    sunPct: 0.46,
    headline: { pre: "It's", em: 'clear', post: 'and mild today.' },
    summary:
      'Comfortable and dry. A good window to be outside before the evening.',
    precipNote: 'Next expected: under 1 mm on Wed.',
    hourly: [
      { h: 'Now', cond: 'clear', temp: 25, pop: 0 },
      { h: '3PM', cond: 'clear', temp: 26, pop: 0 },
      { h: '4PM', cond: 'clear', temp: 27, pop: 0 },
      { h: '5PM', cond: 'clear', temp: 26, pop: 0 },
      { h: '6PM', cond: 'cloud', temp: 24, pop: 10 },
      { h: '7PM', cond: 'cloud', temp: 22, pop: 10 },
      { h: '8PM', cond: 'clear', temp: 21, pop: 0 },
      { h: '9PM', cond: 'night', temp: 20, pop: 0 },
    ],
    days: [
      ['Today', 'clear', 20, 32, 0],
      ['Tue', 'clear', 17, 31, 0],
      ['Wed', 'clear', 16, 30, 0],
      ['Thu', 'cloud', 15, 31, 10],
      ['Fri', 'clear', 18, 32, 0],
      ['Sat', 'clear', 19, 33, 0],
      ['Sun', 'clear', 19, 32, 0],
      ['Mon', 'rain', 20, 29, 30],
      ['Tue', 'cloud', 18, 29, 20],
      ['Wed', 'clear', 18, 29, 0],
    ],
  },

  cloud: {
    cond: 'cloud',
    label: 'Cloudy',
    location: 'Berlin',
    time: '11:20 AM',
    temp: 18,
    feels: 17,
    humidity: 62,
    precip: 20,
    precipMm: 0,
    hi: 22,
    lo: 14,
    uv: 3,
    uvWord: 'Moderate',
    vis: 20,
    wind: 10,
    gust: 18,
    dir: '250\u00b0 W',
    pressure: 1012,
    dew: 10,
    sunrise: '5:02',
    sunset: '9:28',
    sunPct: 0.32,
    headline: { pre: "It's", em: 'overcast', post: 'but mild out.' },
    summary:
      'Soft, even light all day. No rain expected, though clouds linger into evening.',
    precipNote: 'Next expected: light showers Monday.',
    hourly: [
      { h: 'Now', cond: 'cloud', temp: 18, pop: 20 },
      { h: '12PM', cond: 'cloud', temp: 19, pop: 20 },
      { h: '1PM', cond: 'cloud', temp: 20, pop: 10 },
      { h: '2PM', cond: 'cloud', temp: 20, pop: 10 },
      { h: '3PM', cond: 'cloud', temp: 19, pop: 20 },
      { h: '4PM', cond: 'rain', temp: 18, pop: 40 },
      { h: '5PM', cond: 'cloud', temp: 17, pop: 30 },
      { h: '6PM', cond: 'cloud', temp: 16, pop: 20 },
    ],
    days: [
      ['Today', 'cloud', 14, 22, 20],
      ['Tue', 'cloud', 13, 21, 30],
      ['Wed', 'rain', 12, 19, 60],
      ['Thu', 'rain', 11, 18, 70],
      ['Fri', 'cloud', 12, 20, 20],
      ['Sat', 'clear', 13, 23, 0],
      ['Sun', 'clear', 14, 24, 0],
      ['Mon', 'cloud', 13, 22, 30],
      ['Tue', 'cloud', 12, 21, 20],
      ['Wed', 'clear', 13, 22, 0],
    ],
  },

  rain: {
    cond: 'rain',
    label: 'Rain',
    location: 'London',
    time: '4:10 PM',
    temp: 14,
    feels: 12,
    humidity: 86,
    precip: 80,
    precipMm: 4,
    hi: 16,
    lo: 11,
    uv: 2,
    uvWord: 'Low',
    vis: 8,
    wind: 18,
    gust: 30,
    dir: '210\u00b0 SW',
    pressure: 1004,
    dew: 12,
    sunrise: '5:10',
    sunset: '9:10',
    sunPct: 0.7,
    headline: { pre: 'Light', em: 'rain', post: 'is falling now.' },
    summary:
      'Wet roads are likely. The rain should ease toward the evening \u2014 worth an umbrella.',
    precipNote: '4 mm expected today, easing after 7 PM.',
    hourly: [
      { h: 'Now', cond: 'rain', temp: 14, pop: 80 },
      { h: '5PM', cond: 'rain', temp: 14, pop: 75 },
      { h: '6PM', cond: 'rain', temp: 13, pop: 70 },
      { h: '7PM', cond: 'cloud', temp: 13, pop: 40 },
      { h: '8PM', cond: 'cloud', temp: 12, pop: 30 },
      { h: '9PM', cond: 'cloud', temp: 12, pop: 20 },
      { h: '10PM', cond: 'night', temp: 11, pop: 10 },
      { h: '11PM', cond: 'night', temp: 11, pop: 10 },
    ],
    days: [
      ['Today', 'rain', 11, 16, 80],
      ['Tue', 'rain', 10, 15, 70],
      ['Wed', 'cloud', 11, 17, 40],
      ['Thu', 'cloud', 12, 18, 30],
      ['Fri', 'clear', 12, 20, 10],
      ['Sat', 'clear', 13, 21, 0],
      ['Sun', 'cloud', 12, 19, 30],
      ['Mon', 'rain', 11, 17, 60],
      ['Tue', 'rain', 10, 16, 70],
      ['Wed', 'cloud', 11, 18, 40],
    ],
  },

  night: {
    cond: 'night',
    label: 'Clear',
    location: 'Madrid',
    time: '10:40 PM',
    temp: 19,
    feels: 19,
    humidity: 55,
    precip: 5,
    precipMm: 0,
    hi: 32,
    lo: 18,
    uv: 0,
    uvWord: 'Low',
    vis: 30,
    wind: 5,
    gust: 10,
    dir: '300\u00b0 NW',
    pressure: 1015,
    dew: 9,
    sunrise: '6:44',
    sunset: '9:44',
    sunPct: 1,
    headline: { pre: 'Clear and', em: 'calm', post: 'tonight.' },
    summary:
      'Mild air and a light breeze. Skies are clear enough to see a few stars.',
    precipNote: 'No precipitation expected overnight.',
    hourly: [
      { h: 'Now', cond: 'night', temp: 19, pop: 5 },
      { h: '11PM', cond: 'night', temp: 18, pop: 0 },
      { h: '12AM', cond: 'night', temp: 18, pop: 0 },
      { h: '1AM', cond: 'night', temp: 17, pop: 0 },
      { h: '2AM', cond: 'night', temp: 17, pop: 0 },
      { h: '3AM', cond: 'night', temp: 16, pop: 0 },
      { h: '4AM', cond: 'night', temp: 16, pop: 0 },
      { h: '5AM', cond: 'night', temp: 17, pop: 0 },
    ],
    days: [
      ['Today', 'clear', 18, 32, 0],
      ['Tue', 'clear', 17, 31, 0],
      ['Wed', 'clear', 16, 30, 0],
      ['Thu', 'cloud', 15, 31, 10],
      ['Fri', 'clear', 18, 32, 0],
      ['Sat', 'clear', 19, 33, 0],
      ['Sun', 'clear', 19, 32, 0],
      ['Mon', 'rain', 20, 29, 30],
      ['Tue', 'cloud', 18, 29, 20],
      ['Wed', 'clear', 18, 29, 0],
    ],
  },
};

// ---------------------------------------------------------------------------
// Preset cities
// ---------------------------------------------------------------------------

export const PRESET_CITIES: PresetCity[] = [
  { name: 'Madrid', cond: 'clear' },
  { name: 'Berlin', cond: 'cloud' },
  { name: 'London', cond: 'rain' },
  { name: 'Lisbon', cond: 'night' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONDITIONS: Condition[] = ['clear', 'cloud', 'rain', 'night'];

/**
 * Hash a city name to deterministically pick a weather condition.
 */
export function wxPickCond(city: string): Condition {
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = (hash * 31 + city.charCodeAt(i)) | 0;
  }
  return CONDITIONS[Math.abs(hash) % CONDITIONS.length];
}

function parseClock(str: string, pm: boolean): number {
  const [h, m] = str.split(':').map(Number);
  let hh = h % 12;
  if (pm) hh += 12;
  return hh + (m || 0) / 60;
}

function hourLabel(i: number): string {
  const h = ((i % 24) + 24) % 24;
  if (h === 0) return '12AM';
  if (h === 12) return '12PM';
  return h < 12 ? `${h}AM` : `${h - 12}PM`;
}

export interface DaySeriesEntry {
  hour: number;
  label: string;
  temp: number;
  feels: number;
  cond: Condition;
  pop: number;
  isNow: boolean;
  isPast: boolean;
}

export interface DaySeriesResult {
  series: DaySeriesEntry[];
  nowHour: number;
  srHour: number;
  ssHour: number;
}

/**
 * Generate a realistic 24-hour series from a scenario using a diurnal
 * temperature curve (cosine interpolation between lo/hi based on
 * sunrise and solar peak).
 */
export function wxDaySeries(scenario: WeatherScenario): DaySeriesResult {
  const srHour = parseClock(scenario.sunrise, false);
  const ssHour = parseClock(scenario.sunset, true);
  const lo = scenario.lo;
  const hi = scenario.hi;
  const peak = 15; // warmest ~3 PM
  const trough = srHour; // coldest ~sunrise
  const peakAdj = peak < trough ? peak + 24 : peak;

  const tempAt = (h: number): number => {
    let hh = h;
    while (hh < trough) hh += 24;
    if (hh <= peakAdj) {
      const f = (hh - trough) / (peakAdj - trough);
      return lo + (hi - lo) * (0.5 - 0.5 * Math.cos(Math.PI * f));
    }
    const f = (hh - peakAdj) / (trough + 24 - peakAdj);
    return hi - (hi - lo) * (0.5 - 0.5 * Math.cos(Math.PI * f));
  };

  const feelsOff = (scenario.feels ?? scenario.temp) - scenario.temp;
  const nowHour = Math.round(
    parseClock(scenario.time, /pm/i.test(scenario.time))
  );
  const dayCond: Condition =
    scenario.cond === 'night' ? 'clear' : scenario.cond;

  const series: DaySeriesEntry[] = [];
  for (let i = 0; i < 24; i++) {
    const dark = i < srHour - 0.5 || i >= ssHour;
    const cond: Condition = dark ? 'night' : dayCond;
    let pop = Math.round(scenario.precip * (i >= 11 && i <= 18 ? 1.05 : 0.72));
    pop = Math.max(0, Math.min(100, pop));
    series.push({
      hour: i,
      label: hourLabel(i),
      temp: Math.round(tempAt(i)),
      feels: Math.round(tempAt(i) + feelsOff),
      cond,
      pop,
      isNow: i === nowHour,
      isPast: i < nowHour,
    });
  }
  return { series, nowHour, srHour, ssHour };
}
