// ---------------------------------------------------------------------------
// Offline / error fallback answers. Used only when the weatherChat backend is
// unreachable or the daily limit is hit — simple keyword matching against the
// already-loaded weather data.
// ---------------------------------------------------------------------------

import type { WeatherScenario, HourlyEntry } from '../data/weatherData';

const isRainy = (wx: WeatherScenario): boolean => wx.cond === 'rain' || wx.cond === 'storm';

export function generateLocalResponse(
  question: string,
  wx: WeatherScenario,
  unit: 'C' | 'F',
): string {
  const q = question.toLowerCase();
  const toUnit = (c: number) => (unit === 'F' ? Math.round((c * 9) / 5 + 32) : c);
  const tempDisplay = `${toUnit(wx.temp)}°${unit}`;
  const feelsDisplay = `${toUnit(wx.feels)}°${unit}`;

  if (q.includes('umbrella')) {
    if (wx.cond === 'storm') {
      return `Yes — there's a storm around ${wx.location} with a ${wx.precip}% chance of precipitation. An umbrella helps, but with gusts up to ${wx.gust} km/h you may be better off with a hooded rain jacket.`;
    }
    if (wx.cond === 'snow') {
      return `It's snowing in ${wx.location}, so an umbrella is optional — a warm, water-resistant coat and a hat will serve you better.`;
    }
    if (wx.cond === 'rain' || wx.precip >= 50) {
      return `Yes, I'd definitely bring an umbrella. There's a ${wx.precip}% chance of precipitation right now in ${wx.location}, with about ${wx.precipMm}mm expected. Better safe than sorry!`;
    }
    if (wx.precip >= 20) {
      return `There's a ${wx.precip}% chance of rain in ${wx.location}, so it might be worth keeping one handy just in case. The skies look mostly ${wx.label.toLowerCase()} though.`;
    }
    return `No umbrella needed! It's ${wx.label.toLowerCase()} in ${wx.location} right now with only a ${wx.precip}% chance of rain. You should be fine without one.`;
  }

  if (q.includes('wear') || q.includes('clothes') || q.includes('dress') || q.includes('coat')) {
    if (wx.cond === 'snow') {
      return `It's ${tempDisplay} and snowing in ${wx.location} (feels like ${feelsDisplay}). Bundle up: a warm coat, hat, gloves, and footwear with decent grip for slippery patches.`;
    }
    if (wx.temp >= 25) {
      return `It's warm at ${tempDisplay} in ${wx.location} (feels like ${feelsDisplay}). Light, breathable clothes are the way to go — shorts and a t-shirt would be perfect. Don't forget sunscreen with a UV index of ${wx.uv} (${wx.uvWord}).`;
    }
    if (wx.temp >= 15) {
      return `At ${tempDisplay} in ${wx.location} (feels like ${feelsDisplay}), a light jacket or long sleeves would be comfortable. ${wx.wind > 10 ? "It's a bit breezy, so a windbreaker wouldn't hurt." : 'The wind is gentle, so layers are optional.'}`;
    }
    return `It's cool at ${tempDisplay} in ${wx.location} (feels like ${feelsDisplay}). I'd suggest a warm jacket or sweater. ${isRainy(wx) ? "And a waterproof layer since it's wet out." : ''}`;
  }

  if (q.includes('outside') || q.includes('go out') || q.includes('best time')) {
    const bestHour = wx.hourly.reduce(
      (best: HourlyEntry, h: HourlyEntry) =>
        h.pop < best.pop || (h.pop === best.pop && Math.abs(h.temp - 22) < Math.abs(best.temp - 22))
          ? h
          : best,
      wx.hourly[0],
    );
    return `Based on the forecast for ${wx.location}, around ${bestHour.h} looks like the best window — ${toUnit(bestHour.temp)}° with a ${bestHour.pop}% chance of rain. ${wx.summary}`;
  }

  if (q.includes('snow')) {
    if (wx.cond === 'snow') {
      return `Yes, it's snowing in ${wx.location} right now at ${tempDisplay}. ${wx.precipNote} Watch for slick sidewalks and reduced visibility.`;
    }
    return `No snow in ${wx.location} at the moment — it's ${wx.label.toLowerCase()} at ${tempDisplay} with a ${wx.precip}% precipitation chance.`;
  }

  if (q.includes('fog') || q.includes('visibility')) {
    if (wx.cond === 'fog') {
      return `It's foggy in ${wx.location} with visibility around ${wx.vis} km. Take extra care driving and allow more time — it should improve as the day warms up.`;
    }
    return `Visibility in ${wx.location} is around ${wx.vis} km — no fog issues right now with ${wx.label.toLowerCase()} conditions.`;
  }

  if (q.includes('rain') || q.includes('precipitation') || q.includes('shower') || q.includes('storm')) {
    if (isRainy(wx)) {
      return `Yes, it's currently ${wx.cond === 'storm' ? 'stormy' : 'raining'} in ${wx.location}. ${wx.precipNote} The precipitation chance is around ${wx.precip}% with winds at ${wx.wind} km/h from ${wx.dir}.`;
    }
    const rainyHour = wx.hourly.find((h: HourlyEntry) => h.pop >= 40);
    if (rainyHour) {
      return `While it's ${wx.label.toLowerCase()} now, there's rain possible around ${rainyHour.h} with a ${rainyHour.pop}% chance. ${wx.precipNote}`;
    }
    return `No significant rain is expected in ${wx.location} right now. ${wx.precipNote} The current precipitation chance is only ${wx.precip}%.`;
  }

  if (q.includes('temperature') || q.includes('temp') || q.includes('hot') || q.includes('cold')) {
    return `It's currently ${tempDisplay} in ${wx.location}, feeling like ${feelsDisplay}. Today's high is ${toUnit(wx.hi)}° and the low is ${toUnit(wx.lo)}°. Humidity is at ${wx.humidity}%.`;
  }

  if (q.includes('wind') || q.includes('breeze') || q.includes('gust')) {
    return `Wind in ${wx.location} is currently ${wx.wind} km/h from ${wx.dir}, with gusts up to ${wx.gust} km/h. ${wx.wind > 15 ? "It's fairly breezy out there." : 'Pretty calm conditions overall.'}`;
  }

  if (q.includes('uv') || q.includes('sun') || q.includes('sunscreen') || q.includes('sunburn')) {
    return `The UV index in ${wx.location} is ${wx.uv} (${wx.uvWord}). ${wx.uv >= 6 ? 'Sunscreen is strongly recommended, especially between 10 AM and 4 PM.' : wx.uv >= 3 ? "Some sun protection is advisable if you'll be outside for a while." : "UV levels are low, so sun protection isn't a major concern right now."}`;
  }

  // Default / generic response
  return `Right now in ${wx.location} it's ${wx.label.toLowerCase()} and ${tempDisplay} (feels like ${feelsDisplay}). ${wx.summary} Humidity is at ${wx.humidity}% with winds of ${wx.wind} km/h. Is there anything specific about the weather you'd like to know?`;
}
