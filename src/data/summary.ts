// ---------------------------------------------------------------------------
// Data-driven headline / summary / precipitation-note generation.
// Keeps the existing { pre, em, post } headline contract used by HeroScreen.
// ---------------------------------------------------------------------------

import type { Condition, DaySeriesEntry, Headline } from './weatherData';

export interface SummaryInput {
  cond: Condition;
  label: string;
  temp: number;
  hi: number;
  lo: number;
  wind: number;
  uv: number;
  isNight: boolean;
  daySeries: DaySeriesEntry[];
  nowHour: number;
  /** precipitation_probability_max per day, index 0 = today. */
  dailyPop: number[];
  /** Day labels matching dailyPop ('Today', 'Tue', ...). */
  dayLabels: string[];
  /** Visual condition per day, matching dailyPop. */
  dailyCond: Condition[];
  precipMm: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TempBand = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';

function tempBand(temp: number): TempBand {
  if (temp >= 30) return 'hot';
  if (temp >= 24) return 'warm';
  if (temp >= 16) return 'mild';
  if (temp >= 8) return 'cool';
  return 'cold';
}

function hourWord(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** First upcoming hour (from now to end of day) with pop >= threshold. */
function firstWetHour(
  series: DaySeriesEntry[],
  nowHour: number,
  threshold = 50
): DaySeriesEntry | null {
  for (let i = nowHour; i < series.length; i++) {
    if (series[i].pop >= threshold) return series[i];
  }
  return null;
}

function precipWord(cond: Condition): string {
  if (cond === 'snow') return 'snow';
  if (cond === 'storm') return 'storms';
  return 'rain';
}

// ---------------------------------------------------------------------------
// Headline
// ---------------------------------------------------------------------------

export function buildHeadline(input: SummaryInput): Headline {
  const { cond, label, temp, wind, isNight, daySeries, nowHour } = input;
  const band = tempBand(temp);

  // Active precipitation / obscuration takes priority.
  switch (cond) {
    case 'storm':
      return { pre: 'A', em: 'thunderstorm', post: 'is rolling through.' };
    case 'snow':
      return { pre: "It's", em: 'snowing', post: isNight ? 'out there tonight.' : 'out there right now.' };
    case 'fog':
      return { pre: 'Dense', em: 'fog', post: 'is settling in.' };
    case 'rain':
      if (label === 'Drizzle') {
        return { pre: 'Light', em: 'drizzle', post: 'is falling now.' };
      }
      if (label === 'Freezing rain') {
        return { pre: 'Icy', em: 'rain', post: 'is falling — take care.' };
      }
      if (label === 'Showers') {
        return { pre: 'Passing', em: 'showers', post: 'are moving through.' };
      }
      return { pre: isNight ? 'Steady' : 'Light', em: 'rain', post: 'is falling now.' };
    default:
      break;
  }

  // Rain expected later today?
  const wet = firstWetHour(daySeries, nowHour);
  if (wet) {
    return { pre: 'Rain', em: 'likely', post: `around ${hourWord(wet.hour)}.` };
  }

  // Notably windy?
  if (wind >= 25) {
    return { pre: "It's", em: 'windy', post: isNight ? 'out there tonight.' : 'out there today.' };
  }

  // Night variants.
  if (isNight) {
    switch (band) {
      case 'hot':
      case 'warm':
        return { pre: 'A', em: 'warm', post: 'night ahead.' };
      case 'mild':
        return { pre: 'Clear and', em: 'calm', post: 'tonight.' };
      case 'cool':
        return { pre: 'A', em: 'cool', post: 'and quiet night.' };
      case 'cold':
        return { pre: 'A', em: 'cold', post: 'night — bundle up.' };
    }
  }

  // Daytime clear / cloud by temperature band.
  if (cond === 'cloud') {
    switch (band) {
      case 'hot':
        return { pre: 'Hot and', em: 'hazy', post: 'under the clouds.' };
      case 'warm':
        return { pre: 'Warm with', em: 'clouds', post: 'overhead.' };
      case 'mild':
        return { pre: "It's", em: 'overcast', post: 'but mild out.' };
      case 'cool':
        return { pre: 'Cool and', em: 'cloudy', post: 'out there.' };
      case 'cold':
        return { pre: 'Cold and', em: 'grey', post: 'today.' };
    }
  }

  if (cond === 'partly') {
    switch (band) {
      case 'hot':
        return { pre: 'Hot with', em: 'sun', post: 'between the clouds.' };
      case 'warm':
        return { pre: 'Warm', em: 'sunshine', post: 'with passing clouds.' };
      case 'mild':
        return { pre: 'Mild with', em: 'sun', post: 'and a few clouds.' };
      case 'cool':
        return { pre: 'Cool with', em: 'bright', post: 'spells today.' };
      case 'cold':
        return { pre: 'Cold with', em: 'some sun', post: 'breaking through.' };
    }
  }

  switch (band) {
    case 'hot':
      return { pre: "It's", em: 'hot', post: 'and sunny out.' };
    case 'warm':
      return { pre: 'Warm', em: 'sunshine', post: 'all day.' };
    case 'mild':
      return { pre: "It's", em: 'clear', post: 'and mild today.' };
    case 'cool':
      return { pre: 'Crisp and', em: 'clear', post: 'today.' };
    case 'cold':
      return { pre: 'Cold but', em: 'clear', post: 'today.' };
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function conditionSentence(input: SummaryInput): string {
  const { cond, label, isNight } = input;
  const band = tempBand(input.temp);
  switch (cond) {
    case 'storm':
      return 'Thunderstorms are in the area — best to stay indoors.';
    case 'snow':
      return 'Snow is falling, so expect slick roads and slower travel.';
    case 'fog':
      return 'Fog is limiting visibility, so allow extra time getting around.';
    case 'rain':
      return label === 'Drizzle'
        ? 'A light drizzle is keeping things damp.'
        : 'Wet roads are likely while the rain lasts.';
    case 'night':
      return band === 'cold'
        ? 'A cold, clear night with calm conditions.'
        : 'A calm night with mostly clear skies.';
    case 'cloud':
      return 'Soft, even light all day with clouds overhead.';
    case 'partly':
      return 'A mix of sun and clouds through the day.';
    case 'clear':
    default:
      if (isNight) return 'A calm night with mostly clear skies.';
      if (band === 'hot') return 'Strong sun and high heat through the afternoon.';
      if (band === 'cold') return 'Cold but bright, with plenty of sun.';
      return 'Comfortable and dry, with plenty of light.';
  }
}

function actionableSentence(input: SummaryInput): string {
  const { daySeries, nowHour, uv, isNight } = input;

  // Precipitation window first.
  const wet = firstWetHour(daySeries, nowHour);
  if (wet) {
    return `${wet.cond === 'snow' ? 'Snow' : 'Rain'} is likely around ${hourWord(wet.hour)} — worth planning around.`;
  }

  // Sunscreen.
  if (!isNight && uv >= 6) {
    return `UV is high at ${uv} — sunscreen is a good idea if you head out.`;
  }

  // Temperature swing across the rest of the day.
  const rest = daySeries.slice(nowHour);
  if (rest.length >= 2) {
    const temps = rest.map((e) => e.temp);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    if (max - min >= 8) {
      return `Temperatures swing from ${min}° to ${max}° — layers will help.`;
    }
  }

  return isNight
    ? 'Steady conditions expected through the night.'
    : 'Steady conditions expected for the rest of the day.';
}

export function buildSummary(input: SummaryInput): string {
  return `${conditionSentence(input)} ${actionableSentence(input)}`;
}

// ---------------------------------------------------------------------------
// Precipitation note
// ---------------------------------------------------------------------------

export function buildPrecipNote(input: SummaryInput): string {
  const { dailyPop, dayLabels, dailyCond, precipMm } = input;

  if (precipMm > 0) {
    return `${precipMm} mm expected today.`;
  }

  // Scan upcoming days (skipping today) for a likely-precip day.
  for (let i = 1; i < dailyPop.length; i++) {
    if ((dailyPop[i] ?? 0) >= 40) {
      return `Next expected: ${precipWord(dailyCond[i])} on ${dayLabels[i]}.`;
    }
  }

  if ((dailyPop[0] ?? 0) >= 40) {
    return `${dailyPop[0]}% chance of precipitation today.`;
  }

  return 'No rain expected in the next few days.';
}
