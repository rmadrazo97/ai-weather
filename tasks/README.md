# iOS Widgets — PRD Suite

This folder contains the Product Requirements Documents for adding **iOS home-screen and lock-screen widgets** to the AI Weather app (Expo SDK 56 / React Native 0.85).

## Reading order

The PRDs are dependency-ordered. The default is to implement them in sequence, but PRDs 02 and 06a can be built in parallel right after PRD 00 (see the dependency note below).

| # | PRD | What it delivers |
|---|-----|------------------|
| 00 | [prd-00-widget-foundation.md](./prd-00-widget-foundation.md) | Native widget extension target via `@bacons/apple-targets`, App Group, entitlements, `aiweather` URL scheme, EAS build config |
| 01 | [prd-01-shared-data-bridge.md](./prd-01-shared-data-bridge.md) | Custom `ExpoSharedDefaults` native module (default bridge), `WidgetSnapshot` JSON contract, Swift decoding model, persisted unit, active-city write-on-fetch |
| 02 | [prd-02-widget-design-system.md](./prd-02-widget-design-system.md) | SwiftUI parity layer: linear condition gradients, weather glyphs, typography, unit formatting |
| 03 | [prd-03-timeline-provider.md](./prd-03-timeline-provider.md) | `TimelineProvider`, entry model, refresh strategy, placeholder/snapshot, independent fetch fallback |
| 04 | [prd-04-home-screen-widgets.md](./prd-04-home-screen-widgets.md) | systemSmall / systemMedium / systemLarge widgets |
| 05 | [prd-05-lock-screen-widgets.md](./prd-05-lock-screen-widgets.md) | accessoryCircular / accessoryRectangular / accessoryInline widgets |
| 06a | [prd-06a-deep-linking.md](./prd-06a-deep-linking.md) | `aiweather://` deep linking, `widgetURL` tap-through (all families follow active city); ships at the 16.4 floor |
| 06b | [prd-06b-per-widget-city-config.md](./prd-06b-per-widget-city-config.md) | Per-widget configurable city via `AppIntent` (**iOS 17+ only**); fast-follow, gated on the 06a spike |
| 07 | [prd-07-testing-qa-release.md](./prd-07-testing-qa-release.md) | Device/OS/appearance matrix, empty/error-state checklist, snapshot decode tests, gallery copy, release |

## Dependency & parallelization note

- **PRD 02 has NO runtime dependency on PRD 01.** It needs only the 1-line `Condition` enum (or accepts `unit: String`), so it can be built in **parallel right after PRD 00**.
- **PRD 03 is the true join point** — it needs PRD 01's snapshot data *and* PRD 02's SwiftUI views.
- **PRD 06a is the second parallelizable track** — run its `widgetURL` + URL-scheme spike right after PRD 00 (alongside PRD 02). The genuine unknown is the CNG-generated project wiring (does the apple-targets target link WidgetKit/AppIntents and does the Info.plist round-trip `aiweather://`), not the WidgetKit APIs.
- **Front-load the two riskiest critical-path items:** (1) PRD 01's `ExpoSharedDefaults` Expo native-module work (the only bridge that calls `WidgetCenter.reloadAllTimelines()`), and (2) the PRD 06a deep-link spike. Treat both as early spikes, not late checkboxes.

## Cross-cutting conventions (single source of truth)

These identifiers are referenced by every PRD. Change them here only.

| Concept | Value |
|---------|-------|
| App bundle id | `com.myweatherai.app` |
| Widget extension bundle id | `com.myweatherai.app.widgets` |
| App Group id | `group.com.myweatherai.app` |
| Shared `UserDefaults` suite | `group.com.myweatherai.app` (same as App Group) |
| URL scheme | `aiweather` (registered in **PRD 00** — scheme changes force a native rebuild and cannot ship OTA) |
| Min iOS deployment target (suite-wide floor) | `16.4` (matches app `ios/Podfile`; apple-targets defaults a target to **18.0** and **must** be pinned to 16.4). iOS 17-only APIs are `#available(iOS 17, *)`-gated |
| Snapshot key (active city) | `wxai.widget.active` |
| Snapshot key (per city) | `wxai.widget.snapshot.<cityId>` |
| City index key | `wxai.widget.index` |
| City index entry shape | `{ id, name, lat, lon }` (lat/lon populated from `City.lat`/`City.lon`) |
| Shared unit key | `wxai.widget.unit` (mirrors the persisted `'C' \| 'F'`) |
| Tracked native source dir | `targets/widgets/` (regenerated into `ios/` on prebuild) |
| Snapshot schema version | `1` |

## Source of truth for weather data

All widget data mirrors the app's existing model. The canonical definitions live in:

- `src/data/weatherData.ts` — `WeatherScenario`, `City`, `Condition`, `HourlyEntry`, `DayTuple`
- `src/data/weatherApi.ts` — `fetchWeather()`, `fetchCitiesCurrent()`/`CityCurrent`, WMO → condition mapping (`wmoInfo`)
- `src/data/weatherCache.ts` — per-city AsyncStorage cache (`wxai.wx.<cityId>`)
- `src/utils/colors.ts` — `GRADIENTS`, `INK`, `RAIN_BLUE`, ink/muted constants
- `src/components/WeatherIcon.tsx` — the 8 condition glyphs
- `src/utils/helpers.ts` — `cToF`, `fmtTemp`

Notes:
- **`wmoInfo` is module-private (not exported).** The Swift port must **transcribe** it, not import it.
- **`fmtTemp` returns a NUMBER** (`Math.round(...)`); the `°` (U+00B0, no separating space) is appended at each call site.
- **Hex case is insignificant.** Hex literals here are lowercase to match `colors.ts`; do not flag case-only differences as mismatches.

The 8 conditions are: `clear`, `partly`, `cloud`, `rain`, `snow`, `fog`, `storm`, `night`.

## Hard constraints (apply to all PRDs)

1. **`/ios` is gitignored** — it is a Continuous Native Generation (CNG) artifact. Native widget code (and the `ExpoSharedDefaults` module) MUST live under `targets/` and be wired in by config plugins / local Expo modules so it survives `expo prebuild`. Never hand-edit `ios/` as the deliverable.
2. **Widgets ship in a native binary, not OTA.** A new dev build / EAS build is required; `expo-updates` cannot deliver an extension. App Group provisioning requires the Apple Developer account.
3. **Read the versioned docs** at https://docs.expo.dev/versions/v56.0.0/ before writing native code (per repo `AGENTS.md`).
4. Temperatures are stored in **°C** everywhere; the widget converts to °F at render time using the shared, persisted `unit` value (`wxai.widget.unit`).

## Non-Goals (suite-wide)

- **Widget-side localization is out of scope for v1.** City names and all widget strings — condition labels, day labels, headline/summary — are passed through **verbatim** from the app's snapshot. The widget does not translate, reformat, or re-localize any string it receives.

## Status

- [ ] 00 Foundation (target, App Group, entitlements, `aiweather` scheme)
- [ ] 01 Shared data bridge (`ExpoSharedDefaults`, snapshot contract, persisted unit)
- [ ] 02 Design system
- [ ] 03 Timeline provider
- [ ] 04 Home-screen widgets
- [ ] 05 Lock-screen widgets
- [ ] 06a Deep linking
- [ ] 06b Per-widget city config (iOS 17+)
- [ ] 07 Testing, QA & release
