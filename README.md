# AI Weather

An ultra-minimal, AI-centered weather app built with React Native and Expo. Designed to be the next generation weather experience — clean, bold, and conversational.

## Features

- **Bold typography** — Helvetica Neue heavy weights, conversational AI headlines with outlined emphasis words
- **Pastel mesh gradients** — background shifts with weather conditions (peach for clear, blue for rain, lavender for clouds, periwinkle for night)
- **Hourly forecast** — horizontally scrollable temperature curve with weather icons, expandable to a full-day chart with Actual/Feels Like toggle
- **Detail sections** — sunlight arc with glowing orb, precipitation bars, 10-day forecast with range indicators, conditions grid
- **Ask WeatherAI** — conversational AI chat sheet grounded in the current location and timeframe
- **Multi-city support** — switch between preset cities (Madrid, Berlin, London, Lisbon) or add your own
- **Scroll-reveal animations** — sections fade and rise into view as you scroll
- **Unit toggle** — switch between Celsius and Fahrenheit

## Project Structure

```
ai-weather/
├── App.tsx                          # Root — gradient background, state, sheet orchestration
├── app.json                         # Expo config (icons, splash, permissions)
├── src/
│   ├── components/
│   │   ├── HeroScreen.tsx           # Hero: headline, temp, stats, hourly graph
│   │   ├── DetailsView.tsx          # Sunlight arc, precipitation, 10-day, conditions grid
│   │   ├── ChatSheet.tsx            # WeatherAI chat bottom sheet
│   │   ├── CitySheet.tsx            # City switcher bottom sheet
│   │   ├── HourlyExpandedSheet.tsx  # Full-day 24h temperature chart
│   │   ├── AskButton.tsx            # Floating "Ask WeatherAI" pill
│   │   └── WeatherIcon.tsx          # SVG weather icons (sun, moon, cloud, rain)
│   ├── data/
│   │   └── weatherData.ts           # Weather scenarios, diurnal temp curves, city helpers
│   ├── hooks/
│   │   └── useStorage.ts            # AsyncStorage persistence hook
│   └── utils/
│       ├── colors.ts                # Gradient palettes and theme colors per condition
│       └── helpers.ts               # Temperature conversion utilities
└── assets/                          # App icons, splash assets
```

## Getting Started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `i` for iOS simulator / `a` for Android emulator.

## Stack

- React Native + Expo SDK 56
- TypeScript
- react-native-svg for icons and charts
- expo-linear-gradient for mesh gradient backgrounds
- react-native-reanimated + gesture-handler
- AsyncStorage for city persistence

## Weather Conditions

The app supports four weather scenarios, each with its own gradient palette and data:

| Condition | Gradient     | Example City |
|-----------|-------------|--------------|
| Clear     | Peach       | Madrid       |
| Cloud     | Lavender    | Berlin       |
| Rain      | Blue        | London       |
| Night     | Periwinkle  | Lisbon       |

## Building for Stores

```bash
# iOS
npx expo run:ios --configuration Release

# Android
npx expo run:android --variant release

# Or use EAS Build
npx eas build --platform all
```

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a PR

## License

MIT
