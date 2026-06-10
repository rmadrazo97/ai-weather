# AI Weather

An ultra-minimal, AI-centered weather app built with React Native and Expo. Clean, bold, and conversational — every value on screen is live data, and the assistant is a real LLM agent.

## Features

- **Live weather everywhere** — Open-Meteo powers current conditions, 24h hourly curve (real per-hour temps and feels-like), 10-day forecast, UV, visibility, dew point, pressure, and air quality (US AQI)
- **WeatherAI assistant** — a LangGraph.js agent on Firebase Cloud Functions (Gemini 2.5 Flash-Lite) that answers practical questions ("Do I need an umbrella?", "Should I wear a coat?") with streaming responses, grounded in the city you're viewing, with tools for other locations and air quality
- **My Location** — coarse (city-level) GPS with reverse geocoding, pinned in the city sheet
- **Real city search** — search-as-you-type geocoding with region/country disambiguation
- **Live city list** — every city row shows current temperature, condition, and humidity from a single batched API call
- **Data-driven headlines** — "Hot and hazy under the clouds." generated from actual condition, temp band, precip window, and wind
- **Seven visual conditions** — clear, cloud, rain, snow, fog, storm, night, each with its own gradient palette and icon
- **Offline resilience** — per-city cache with a stale-data banner and retry; local fallback answers when the agent is unreachable
- **Unit toggle** — Celsius/Fahrenheit, propagated to the AI assistant

## Architecture

```
Expo app (SDK 56, RN 0.85, TypeScript strict)
  ├─ Open-Meteo (forecast + air-quality + geocoding; free, keyless)
  └─ Firebase callable `weatherChat` (streaming SSE)
       └─ LangGraph.js ReAct agent → Gemini 2.5 Flash-Lite
            tools: get_weather · get_air_quality · geocode_city
       └─ Anonymous Auth + per-UID daily rate limit (Firestore)
```

## Project Structure

```
ai-weather/
├── App.tsx                          # Root — state, weather loading, cache, sheet orchestration
├── app.json / eas.json              # Expo + EAS build/submit config (OTA updates enabled)
├── firebase.json / .firebaserc      # Firebase IaC: functions, Firestore rules, hosting
├── functions/                       # Cloud Functions (Node 22, TypeScript)
│   └── src/
│       ├── index.ts                 # Streaming onCall entry (auth, rate limit, validation)
│       ├── agent.ts                 # LangGraph agent + system prompt
│       ├── tools.ts                 # Weather/AQI/geocoding tools
│       └── rateLimit.ts             # Per-UID daily counter
├── public/privacy.html              # Privacy policy (Firebase Hosting)
├── src/
│   ├── components/                  # HeroScreen, DetailsView, ChatSheet, CitySheet,
│   │                                #  HourlyExpandedSheet, StatusBanner, ErrorBoundary, …
│   ├── data/
│   │   ├── weatherApi.ts            # Open-Meteo fetch, WMO mapping, batch city weather
│   │   ├── weatherData.ts           # Types, preset cities
│   │   ├── summary.ts               # Data-driven headline/summary builders
│   │   ├── weatherCache.ts          # Per-city AsyncStorage cache
│   │   └── weatherContext.ts        # Compact weather summary for the agent
│   ├── hooks/                       # useWeatherChat (streaming), useMyLocation, useStorage
│   ├── lib/firebase.ts              # Firebase app/auth/functions client
│   └── utils/                       # colors, helpers, localAnswers (offline fallback)
└── assets/                          # App icons, splash assets
```

## Getting Started

```bash
npm install
npx expo start          # press i for iOS simulator
```

The app points at the deployed Firebase backend via `.env` (`EXPO_PUBLIC_FIREBASE_*` — public client identifiers). To run the backend locally:

```bash
cd functions && npm install && cd ..
echo "GEMINI_API_KEY=<your key>" > functions/.env.local
firebase emulators:start
EXPO_PUBLIC_USE_EMULATOR=1 npx expo start
```

## Deploying the backend

```bash
firebase functions:secrets:set GEMINI_API_KEY   # once
firebase deploy --only functions,firestore,hosting
```

## Building for stores

```bash
npx eas build --platform all --profile production
npx eas submit -p ios                            # needs App Store Connect API key
npx eas submit -p android                        # after the first manual AAB upload
npx eas update --channel production              # OTA updates for JS-only fixes
```

Privacy policy: https://ai-weather-jm7.web.app/privacy.html

## License

MIT
