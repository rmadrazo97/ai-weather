# PRD 06a: Widget Deep Linking

## Introduction/Overview

Tapping a widget should open the app to the city that widget is showing — not just cold-launch to whatever was last active. This PRD ships **tap-through deep linking** at the suite-wide **iOS 16.4** floor: every widget family carries a `widgetURL` pointing at its city, and the app routes that URL to set the active city.

This is the shippable, high-value half of the original combined deep-linking + city-configuration PRD. It needs **no `AppIntent`** and works on every device the app supports (16.4+). Per-widget *city selection* (which requires `AppIntentConfiguration`, iOS 17+) is split out into the fast-follow **PRD 06b** and gated on the spike defined here.

The app is intentionally **flat** — it has no navigation router. This PRD adds only minimal link handling, colocated with the active-city state in `App.tsx`. The `aiweather` URL scheme is **not** added here: it is registered once, foundationally, in **PRD 00** (a scheme change forces a native rebuild and cannot ship OTA, so it belongs with the other native config). This PRD references that scheme and consumes it.

Depends on: **PRD 00** (registers the `aiweather` scheme + the apple-targets widget extension), **PRD 01** (writes `wxai.widget.index` with `{id, name, lat, lon}` entries), **PRD 04/05** (the widget views to make tappable).

## Goals

1. Tapping any widget family (system Small/Medium/Large, accessory) opens the app to that widget's city, on both cold and warm start.
2. Add link handling using a single, already-available mechanism with zero new dependencies (RN core `Linking`).
3. Guarantee a deep link never lands on the *wrong* city: links arriving before app state hydrates are buffered and applied once hydration completes.
4. Prove, in an early spike, that the apple-targets/SDK-56-generated project actually wires `widgetURL` routing and the `aiweather://` scheme end-to-end — separating "is the generated project wired" risk from the (stable) WidgetKit API.

## User Stories

### US-001: Early spike — prove the generated project wires deep linking
**Description:** As a developer, I want to confirm — early — that the apple-targets-generated widget extension links the WidgetKit/AppIntents frameworks and that the CNG-generated `Info.plist` round-trips the `aiweather://` scheme and `widgetURL` routes, *before* the home-screen/lock-screen PRDs depend on it.

**Context:** The WidgetKit `widgetURL`/`Link` APIs themselves are stable and well-documented. The genuine unknown is the **generated-project wiring** under `@bacons/apple-targets` on Expo SDK 56: (a) does the generated extension target link `WidgetKit` (and `AppIntents`, for 06b later), and (b) does the Continuous-Native-Generation (CNG) `Info.plist` actually expose the `aiweather://` scheme registered in PRD 00 so a `widgetURL` reaches the app. The earlier "widgetURL unconfirmed" caveat is attributed to this wiring, **not** to the WidgetKit API.

**Acceptance Criteria:**
- [ ] Runs **right after PRD 00**, in **parallel with PRD 02** (it does not depend on PRD 01/03 data).
- [ ] On a clean checkout, `rm -rf ios && npx expo prebuild -p ios --clean` produces the widget extension; confirm the extension target links the `WidgetKit` framework (and `AppIntents` is available for the later 06b spike).
- [ ] The generated app `Info.plist` contains the `aiweather` scheme under `CFBundleURLTypes` (registered in PRD 00); confirm via the prebuilt `Info.plist`, not a hardcoded assumption.
- [ ] A throwaway widget view attaches `.widgetURL(URL(string: "aiweather://city/test")!)`; tapping it in the **iOS Simulator** launches the app and the URL is observed by RN core `Linking`.
- [ ] Outcome is recorded as a tracked decision artifact: if `widgetURL` routing does **not** work in this setup, the fallback (plain app launch to active city) is documented and the 06b spike is reassessed before 06b starts.

### US-002: App-side handling of incoming `aiweather://city/<cityId>` links
**Description:** As a user, I want tapping a widget to open the app to that widget's city, whether the app was closed or backgrounded.

**Acceptance Criteria:**
- [ ] Link handling uses **RN core `Linking`** (already imported in `src/components/CitySheet.tsx:14`), not `expo-linking`. `expo-linking` is **absent** from `package.json` and `node_modules`; adopting core `Linking` avoids adding a new dependency. (Decision: core `Linking`; do not install `expo-linking`.)
- [ ] **Cold start** (app not running): `Linking.getInitialURL()` is read once on mount and the resulting URL is routed.
- [ ] **Warm start** (backgrounded): `Linking.addEventListener('url', handler)` routes subsequent URLs; the subscription is removed on unmount.
- [ ] A `city/<cityId>` link resolves the city and sets it active (see US-003), rendering its weather; an unknown/malformed link **no-ops safely** and the app opens to the current active city.
- [ ] Handling is colocated with the active-city state in `App.tsx` (no router migration).
- [ ] Typecheck passes (0 errors).
- [ ] Verified in the **iOS Simulator**: tapping a widget opens the app to the correct city, from both cold and warm start.

### US-003: Resolve the cityId against the composite city list / index
**Description:** As a user, I want deep links to *any* of my cities — including the 4 preset cities — to land correctly, not silently fall back to the active city.

**Context:** `wxai.cities.v2` stores **only** custom cities — presets and My Location are **not** in it. The real, complete list is the composite `[myLocation.city, ...PRESET_CITIES, ...customCities]` assembled in `App.tsx:195-199`. PRD 01 populates `wxai.widget.index` from this same composite.

**Acceptance Criteria:**
- [ ] Incoming `cityId` is resolved against the **composite list** `[myLocation.city, ...PRESET_CITIES, ...customCities]` (App.tsx:195-199) **or** equivalently against `wxai.widget.index` — **never** against `wxai.cities.v2` alone.
- [ ] A deep link to a **preset** city (e.g. Madrid `40.417,-3.704`) resolves and activates that preset (it would silently fall through if only `wxai.cities.v2` were consulted).
- [ ] A deep link to `my-location` activates the device-location pseudo-city (`MY_LOCATION_ID`); its `City` object carries coords, the id string does not — resolve by id match, not by parsing the id.
- [ ] An id with no match in the composite list no-ops to the active city.

### US-004: Buffer deep links until app state has hydrated
**Description:** As a user, I want a tapped link to land on the right city even when the app is cold-launching and its persisted state hasn't loaded yet — with no flash of the wrong city.

**Context:** `App.tsx` hydrates from AsyncStorage asynchronously and gates work on three flags: `citiesHydrated` (App.tsx:69), `activeHydrated` (App.tsx:73), and `migrationDone` (App.tsx:93, set by the migration effect at :105-150). A deep link from `getInitialURL()` can arrive before these are true; applying it immediately would resolve against an empty/partial city list.

**Acceptance Criteria:**
- [ ] A deep link arriving before `citiesHydrated && activeHydrated && migrationDone` is **queued** (held in a ref/state), not dropped.
- [ ] Once all three flags are true, the queued link is applied exactly once and then cleared.
- [ ] No flash of the wrong city: the initial render does not commit a default active city that the buffered link then overrides visibly.
- [ ] Verified in the **iOS Simulator**: force-quit the app, tap a widget for a non-active city, and confirm the app opens directly on the target city with no intermediate wrong-city frame.

### US-005: Make every widget family tappable with `widgetURL`
**Description:** As a developer, I want each widget to carry a deep link to the active city it displays.

**Acceptance Criteria:**
- [ ] System families (Small/Medium/Large) attach `.widgetURL(URL(string: "aiweather://city/\(encodedCityId)"))` for the **active** city the widget shows.
- [ ] Accessory families (inline/circular/rectangular) attach `widgetURL` (accessory widgets support a single whole-widget tap target).
- [ ] In 06a, **all** families deep-link to the **active** city (per-instance city selection is 06b). The URL is built from the active cityId carried in the snapshot.
- [ ] The `cityId` is **percent-encoded** when building the URL (see US-006) and decoded app-side.
- [ ] Verified in the **iOS Simulator**: tapping each family opens the app to the active city. (Per-element `Link` on Medium/Large hourly columns — e.g. an `hour` param — is **out of scope** for v1; document as deferred.)

### US-006: Percent-encode the cityId in the URL (and round-trip it)
**Description:** As a developer, I want the cityId to survive the URL round-trip even when it contains reserved characters.

**Context:** `cityId(lat, lon)` returns `` `${lat.toFixed(3)},${lon.toFixed(3)}` `` (`src/data/weatherData.ts:100-102`) — e.g. Madrid is `40.417,-3.704`. The **comma** is a reserved sub-delimiter in URLs and the value can contain a leading minus. The **same** id string is used **verbatim** as a UserDefaults key suffix `wxai.widget.snapshot.<cityId>` (commas, dots, and minus are all legal in a UserDefaults key) — so it must **not** be encoded there, but it **must** be encoded inside the URL.

**Acceptance Criteria:**
- [ ] When building `widgetURL`, the cityId is percent-encoded on the Swift side (`addingPercentEncoding(withAllowedCharacters: .urlPathAllowed)` or stricter), so the comma and any reserved characters are escaped.
- [ ] App-side, the path component is percent-decoded before resolution.
- [ ] **Unit-test fixture (negative-longitude round-trip):** Madrid `cityId(40.4168, -3.7038)` → `40.417,-3.704` → percent-encoded → embedded in `aiweather://city/...` → decoded app-side → equals `40.417,-3.704` exactly, and resolves to the Madrid preset.
- [ ] The fixture explicitly documents that the **un-encoded** id (`40.417,-3.704`) is the legal UserDefaults key suffix used in `wxai.widget.snapshot.<cityId>`, confirming the encode/decode is URL-only.

## Functional Requirements

- FR-1: The app MUST consume the `aiweather` URL scheme (registered in PRD 00) and route `aiweather://city/<cityId>` to set the active city.
- FR-2: Link handling MUST use RN core `Linking` — `getInitialURL()` for cold start and `addEventListener('url', …)` for warm start — and MUST NOT install `expo-linking`.
- FR-3: cityId resolution MUST run against the composite list `[myLocation.city, ...PRESET_CITIES, ...customCities]` (App.tsx:195-199) or `wxai.widget.index`, NOT `wxai.cities.v2`; unknown/malformed links MUST no-op to the active city.
- FR-4: Deep links arriving before `citiesHydrated && activeHydrated && migrationDone` MUST be buffered and applied once, after hydration, with no flash of the wrong city.
- FR-5: All widget families MUST attach a `widgetURL` deep link to the active city they display.
- FR-6: The cityId MUST be percent-encoded inside the URL and decoded app-side; it MUST remain un-encoded where used as the `wxai.widget.snapshot.<cityId>` UserDefaults key suffix.

## Non-Goals (Out of Scope)

- Per-widget *city selection* via `AppIntentConfiguration` — that is **PRD 06b** (iOS 17+, gated on the spike).
- A full navigation router / React Navigation migration — the app stays flat; only minimal linking is added.
- Deep links to specific app sub-views beyond city selection (e.g. open chat, open hourly sheet) — possible future, not v1.
- Per-element `Link` deep links on Medium/Large hourly columns (`hour` param) — deferred.
- Per-widget unit override — widgets follow the app's global unit (mirrored to the App Group in PRD 01).

## Design Considerations

- Tap-through must feel instant and land on the expected city. The hydration buffer (US-004) exists specifically to avoid a flash of the wrong city before routing resolves.
- The user-visible name shown after routing comes from the resolved `City.name`; widgets themselves carry only the cityId in the URL.

## Technical Considerations

- The app has **no existing router**; keep link handling minimal and colocated with the active-city state in `App.tsx`. RN core `Linking` is already imported in `CitySheet.tsx:14`, so the dependency surface is unchanged.
- The `aiweather` scheme is added in **PRD 00** (`app.json` → `"scheme": "aiweather"`), which lands it in the prebuilt `Info.plist` `CFBundleURLTypes`. This PRD only consumes it. Do **not** re-add the scheme here.
- `cityId` format is `lat.toFixed(3),lon.toFixed(3)` (or `my-location` / `MY_LOCATION_ID`). The comma is a reserved URL sub-delimiter — percent-encode in the URL, decode app-side; keep it un-encoded as the UserDefaults key suffix.
- Resolution depends on PRD 01's enriched `wxai.widget.index` entry shape `{id, name, lat, lon}` so non-active routing and (in 06b) on-demand fetch have coordinates.
- Hydration flags to gate on: `citiesHydrated` (App.tsx:69), `activeHydrated` (App.tsx:73), `migrationDone` (App.tsx:93/105-150).

## Success Metrics

- Tapping any widget family opens the app to the active city it displays, on both cold and warm start, verified in the iOS Simulator.
- A deep link to a preset city (Madrid) resolves correctly rather than falling through to active-city.
- A force-quit cold-launch deep link lands directly on the target city with no wrong-city flash.
- The negative-longitude (Madrid `-3.704`) percent-encode round-trip unit test passes.

## Open Questions

- None blocking. The spike (US-001) resolves the one real unknown (generated-project wiring of `widgetURL` + scheme). If the spike fails, the documented fallback is a plain app launch to the active city, and PRD 06b is reassessed.
