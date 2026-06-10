/**
 * Smoke test for the Open-Meteo tools (no LLM / no Firebase needed).
 *
 * Usage (from functions/):
 *   npm run build && npx tsc scripts/smoke.ts --outDir scripts --module nodenext --target es2022 --skipLibCheck && node scripts/smoke.js
 * Or simpler, against the built lib output:
 *   npm run build && node -e "require('./scripts/smoke.js')"
 */
import { getWeatherTool, geocodeCityTool, getAirQualityTool } from '../lib/tools';

async function main() {
  console.log('=== get_weather (Madrid 40.42, -3.70) ===');
  console.log(await getWeatherTool.invoke({ lat: 40.42, lon: -3.7 }));

  console.log('\n=== geocode_city ("Berlin") ===');
  console.log(await geocodeCityTool.invoke({ name: 'Berlin' }));

  console.log('\n=== get_air_quality (Madrid 40.42, -3.70) ===');
  console.log(await getAirQualityTool.invoke({ lat: 40.42, lon: -3.7 }));
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
