# AI Weather

An ultra-minimal, AI-centered weather app built with React Native and Expo. Designed to be the next generation weather experience — clean, bold, and conversational.

## Features

- **Bold typography** — Helvetica Neue heavy weights, conversational AI headlines with outlined emphasis words
- **Pastel mesh gradients** — background shifts with weather conditions (peach for clear, blue for rain, lavender for clouds, periwinkle for night)
- **Hourly forecast** — horizontally scrollable temperature line with weather icons, expandable to a full-day chart with Actual/Feels Like toggle
- **Detail sections** — sunlight arc with glowing orb, precipitation bars, 10-day forecast with range indicators, conditions grid
- **Ask WeatherAI** — conversational AI chat grounded in the current location and timeframe
- **Multi-city support** — switch between preset cities or add your own
- **Scroll-reveal animations** — sections fade and rise into view

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
- expo-linear-gradient for backgrounds
- react-native-reanimated + gesture-handler

## Building for Stores

```bash
# iOS
npx expo run:ios --configuration Release

# Android
npx expo run:android --variant release

# Or use EAS Build
npx eas build --platform all
```

## License

MIT
