# PRD 07: Testing, QA Matrix & Release

## Introduction/Overview

The widget suite (PRDs 00–06) ships a native WidgetKit extension that renders entirely outside the React Native runtime, reading a versioned `WidgetSnapshot` JSON from the App Group's shared `UserDefaults`. Because widgets run in a separate, memory-constrained process and only update when the app pushes a snapshot or the timeline provider runs, almost every failure mode (no network, no snapshot, corrupt snapshot, stale data, a future schema version, a removed city, a widget added before the app was ever opened) surfaces on-device with no in-app error UI to lean on.

This PRD consolidates the "verify in simulator" hand-waving scattered across PRDs 00–06 into one **authoritative QA matrix, state checklist, automated test-harness spec, gallery/copy spec, and release checklist**. It is the single source of truth for "is the widget feature done and shippable." It is not a feature PRD — it adds no product surface; it adds verifiable acceptance gates and cross-references each gate back to the PRD it validates.

Depends on: **PRD 00–06** (this is the closing gate). Some harnesses (the TypeScript `buildSnapshot` fixture tests, the Swift `WidgetSnapshot` decode tests) can and should be authored alongside PRD 01 rather than at the end.

## Goals

- Define one **device × OS × appearance** test matrix that every widget family must pass before release.
- Define a **state checklist** that enumerates every data condition a widget can encounter and the expected render for each.
- Specify **automated test harnesses** on both sides of the contract: TypeScript `buildSnapshot` fixture tests and Swift `WidgetSnapshot` decode-tolerance tests, so the contract is regression-protected in CI rather than only eyeballed.
- Specify the **App Store gallery assets and copy** the extension requires (`configurationDisplayName`, `description`, preview snapshot), and record the decision that widgets inherit the app icon (no separate widget icon).
- Specify **accessibility verification** (VoiceOver labels, Dynamic Type) and confirm the **localization-passthrough** stance.
- Provide a **release/build checklist** that captures the hard constraints (dev/EAS build required — not OTA; App Group portal provisioning; EAS build profile).
- Cross-reference every check to the PRD(s) it validates so coverage gaps are visible.

## User Stories

### US-001: Run the device/OS/appearance matrix
**Description:** As a release manager, I want a fixed matrix of device, OS, and appearance combinations so "tested on simulator" means the same thing every time.

**Acceptance Criteria:**
- [ ] Every widget family (`systemSmall`, `systemMedium`, `systemLarge`, `accessoryCircular`, `accessoryRectangular`, `accessoryInline`) is screenshotted on **iPhone SE (3rd gen)** (smallest current screen) and **iPhone 15 Pro Max** (largest) simulators.
- [ ] Each is captured in **Light** and **Dark** appearance.
- [ ] Each is captured on **iOS 16.4** (the suite floor per PRD 00 FR-5) and **iOS 17** simulators, to confirm `#available(iOS 17, *)`-gated APIs (`containerRelativeFrame`, content-margins, any `AppIntentConfiguration`/06b path) degrade correctly at 16.4 and engage at 17.
- [ ] Lock-screen accessory families are additionally verified over a **busy/photo lock-screen wallpaper** (vibrancy and `.vibrant` rendering mis-render on plain backgrounds and in Xcode previews); best confirmed on a **physical device** for Always-On, noted as such.
- [ ] No layout truncation, clipping, or unreadable contrast in any cell of the matrix.
- [ ] Validates: PRD 00 (deployment-target floor), PRD 02 (gradients/typography/contrast), PRD 04 (home-screen families), PRD 05 (lock-screen accessory families).

The matrix (each cell = one screenshot per family):

| Device | Appearance | iOS | Lock-screen wallpaper |
|--------|-----------|-----|-----------------------|
| iPhone SE (3rd gen) | Light | 16.4 | busy photo |
| iPhone SE (3rd gen) | Dark | 16.4 | busy photo |
| iPhone SE (3rd gen) | Light | 17 | busy photo |
| iPhone SE (3rd gen) | Dark | 17 | busy photo |
| iPhone 15 Pro Max | Light | 16.4 | busy photo |
| iPhone 15 Pro Max | Dark | 16.4 | busy photo |
| iPhone 15 Pro Max | Light | 17 | busy photo |
| iPhone 15 Pro Max | Dark | 17 | busy photo |

### US-002: Walk the data-state checklist
**Description:** As a QA engineer, I want every data condition a widget can hit enumerated with an expected, screenshot-backed render, so degraded states are designed, not accidental.

**Acceptance Criteria:**
- [ ] Each state below is reproducible via a documented setup step and produces the specified render, captured as a screenshot:
- [ ] **No-network**: app online once (snapshot written), then device offline. Widget renders the last snapshot; the timeline provider's independent fetch (PRD 03 US-004) times out and falls back to the snapshot — no spinner, no blank.
- [ ] **No-snapshot ("widget added but app never opened")**: shared suite has no `wxai.widget.active` key (the Madrid default lives only in JS and is not written to the container until the first `saveWx` commit). Widget renders a "no data" placeholder reading "Open AI Weather to set up" (or a sensible bundled default) — never a crash or empty box. Validates the new no-data acceptance state added to PRD 03/04/05.
- [ ] **Corrupt-snapshot**: write malformed/truncated JSON to `wxai.widget.active`. `SnapshotStore.load` returns `nil` (PRD 01 US-005); widget shows the placeholder, no crash.
- [ ] **Future `schemaVersion`**: write a snapshot with `schemaVersion: 99` and otherwise-valid fields. Swift decode tolerates the greater version and renders best-effort (PRD 01 US-005 AC) — no crash, no placeholder when data is present.
- [ ] **Unknown condition**: write `cond: "tornado"` (not one of the 8). Swift `Condition` decodes to the safe default `cloud` (PRD 01 US-005); the gradient/glyph fall back, not crash.
- [ ] **Stale**: snapshot carries `staleAt` (app fell back to cache; App.tsx stale-fallback branch). Widget renders the stale indicator per PRD 03 US-004's staleness gating (`now - staleAt > 3h`) without implying fresh data.
- [ ] **Configured-city-removed**: a per-widget configured city (06b) or a custom city is removed in-app via `removeCity` (App.tsx:243). Its `wxai.widget.snapshot.<cityId>` and `wxai.widget.index` entry are pruned; the widget falls back to `wxai.widget.active`. The "configured city removed AND no active city" sub-state renders the no-data placeholder.
- [ ] Validates: PRD 01 (snapshot contract, pruning), PRD 03 (provider fallback, staleness), PRD 04/05 (degraded-state views).

### US-003: TypeScript `buildSnapshot` fixture tests
**Description:** As a developer, I want the snapshot writer covered by fast unit tests so the contract can't silently drift.

**Acceptance Criteria:**
- [ ] A test file (e.g. `src/widgets/__tests__/snapshot.test.ts`) exercises `buildSnapshot(wx, city, unit)` (PRD 01 US-002) against fixtures.
- [ ] **Field-completeness fixture**: a representative `WeatherScenario` → asserts every `WidgetSnapshot` field is populated and `schemaVersion === 1`.
- [ ] **`hi >= lo` invariant**: asserts `current.hi >= current.lo`, and for every `days[]` entry that `hi >= lo` — guarding the `DayTuple = [label, cond, lo, hi, pop]` index mapping (`d[2]=lo`, `d[3]=hi`) against a lo/hi swap.
- [ ] **`precipProb`/`pop` units**: asserts `precipProb` is sourced from `wx.precip` (a percent), not `wx.precipMm`, and that `pop` units match the documented 0–1 vs 0–100 choice from PRD 01.
- [ ] **Negative-longitude `cityId` round-trip**: build a snapshot for Madrid (`lat 40.417, lon -3.704`), assert `city.id === cityId(40.4168, -3.7038)` (`"40.417,-3.704"`), and assert that id round-trips through the widget-URL percent-encode/decode used by PRD 06 (`encodeURIComponent` → `decodeURIComponent` yields the original, comma and minus preserved).
- [ ] **`my-location` coords**: assert `city.lat`/`city.lon` are read from the `City` object, not parsed from the id string `"my-location"`, and that the enriched index entry shape is `{ id, name, lat, lon }`.
- [ ] **Per-hour `ts` / `tzOffsetMinutes`**: assert each `hourly[]` item carries a machine-readable `ts: number` (epoch ms) and the snapshot carries `tzOffsetMinutes`, derived in `buildSnapshot` from the source ISO `hourly.time` (not the display `h` label).
- [ ] Tests run under the project's existing test runner; `npm test` (or equivalent) passes; typecheck passes.
- [ ] Validates: PRD 01 (US-002 schema + buildSnapshot), PRD 03 (per-hour `ts`), PRD 06 (cityId encoding).

### US-004: Swift `WidgetSnapshot` decode tests
**Description:** As a widget developer, I want the Swift decoder's tolerance behaviors proven by tests, since they are the app's only crash guard in the extension process.

**Acceptance Criteria:**
- [ ] A Swift test target (or Xcode-preview-backed unit tests) under `targets/widgets/` decodes JSON fixtures into `WidgetSnapshot` (PRD 01 US-005).
- [ ] **Round-trip**: a snapshot produced by the TS `buildSnapshot` (captured as a JSON fixture shared with US-003) decodes into the Swift model with every field present and byte-matching key names.
- [ ] **Unknown-condition tolerance**: `cond: "tornado"` decodes `Condition` to the safe default `cloud`, not a thrown error.
- [ ] **Future-version tolerance**: `schemaVersion: 99` decodes successfully and renders best-effort.
- [ ] **Missing-optional tolerance**: omitting optional fields (`aqi`, `aqiWord`, `staleAt`, `admin1`, `country`, `isCurrentLocation`) decodes without error.
- [ ] **Corrupt input**: malformed JSON → `SnapshotStore.load(cityId:)` returns `nil`, never throws into the view.
- [ ] These tests run in Xcode (or `xcodebuild test`); they are wired so a regression fails the build, not just a manual preview.
- [ ] Validates: PRD 01 (US-005 Swift model + tolerance), PRD 03 (provider consumes decoded model).

### US-005: Gallery assets and copy
**Description:** As a release manager, I want the widget gallery presentation specified so it ships polished.

**Acceptance Criteria:**
- [ ] Each widget defines a `configurationDisplayName` and `description` string (the text shown in the iOS widget gallery / add-widget sheet). Final copy is recorded in this PRD's Design Considerations.
- [ ] A representative **preview/placeholder snapshot** (a bundled `placeholder` constant per PRD 01 US-005) drives the gallery preview so the widget shows realistic data, not a blank, before being added.
- [ ] **No separate widget icon** is created or required — widget extensions inherit the host app icon. This decision is recorded so no time is spent producing one.
- [ ] Gallery preview verified across all families on both SE and Pro Max (US-001 matrix) in the add-widget sheet.
- [ ] Validates: PRD 00 (extension config), PRD 01 (placeholder snapshot), PRD 04/05 (per-family previews).

### US-006: Accessibility verification
**Description:** As a user relying on VoiceOver or large text, I want widgets to be readable and announced sensibly, matching the app's accessibility bar.

**Acceptance Criteria:**
- [ ] Each home-screen and lock-screen family exposes an `accessibilityLabel` of the form "city, temperature, condition" (e.g. "Madrid, 24 degrees, partly cloudy"), per the accessibility ACs added to PRD 04 and PRD 05.
- [ ] VoiceOver navigation over each widget announces that label (verified with VoiceOver enabled in the simulator/device).
- [ ] Rendering is checked at the **largest Dynamic Type** setting: either the widget remains legible without truncation, or it is documented why widgets cap type size (WidgetKit limits dynamic type scaling in some families).
- [ ] Contrast meets legibility on both light and dark and over the busy lock-screen wallpaper (cross-checks US-001).
- [ ] Validates: PRD 02 (typography/contrast), PRD 04, PRD 05 (per-family labels).

### US-007: Localization-passthrough confirmation
**Description:** As a developer, I want it explicit that the widget does no localization of its own in v1, so no time is spent on it and no string is unexpectedly hard-coded.

**Acceptance Criteria:**
- [ ] Confirmed: all user-facing strings the widget renders (city `name`, condition `label`, day `label`, `headline`, `summary`) are passed through **verbatim** from the app-written snapshot; the widget adds no `Localizable.strings` and performs no translation.
- [ ] The only widget-authored strings are the gallery `configurationDisplayName`/`description` (US-005) and the no-data placeholder copy (US-002), which are English-only in v1 and recorded as such.
- [ ] This matches the README Non-Goals localization line; no contradiction exists between PRDs.
- [ ] Validates: PRD 01 (snapshot carries display strings), README (localization Non-Goal).

### US-008: Release / build checklist
**Description:** As a release manager, I want a pre-flight checklist so the widget binary is provisioned and built correctly, since widgets cannot ship OTA.

**Acceptance Criteria:**
- [ ] **Dev/native build required, not OTA**: confirmed that a new dev build / EAS build is produced; `expo-updates` is NOT relied on to deliver the extension (it cannot ship a native target).
- [ ] **App Group portal provisioning**: the App Group container `group.com.myweatherai.app` exists in the Apple Developer portal and is assigned to BOTH App IDs — the app (`com.myweatherai.app`) and the widget extension (`com.myweatherai.app.widgets`) — per PRD 00 FR-3/AC.
- [ ] **EAS build profile**: a build profile produces the app + extension in one binary; the profile is recorded and reproducible. The build succeeds with the second target present (PRD 00 go/no-go gate).
- [ ] **Clean prebuild from `targets/`**: `rm -rf ios && npx expo prebuild -p ios --clean` regenerates the extension from `targets/widgets/` (`/ios` is gitignored CNG output); the generated extension's `IPHONEOS_DEPLOYMENT_TARGET == 16.4` (PRD 00 AC) and the `aiweather` scheme lands in `CFBundleURLTypes` (PRD 00 / PRD 06).
- [ ] **App Group smoke test** passes on the installed build: app writes `wxai.widget.active`, widget reads it back (PRD 00 US-002/US-004; PRD 01 US-001).
- [ ] Validates: PRD 00 (target, App Group, scheme, EAS), PRD 01 (write/read bridge), PRD 06 (scheme in Info.plist).

## Functional Requirements

- FR-1: Every widget family MUST pass every cell of the US-001 device/OS/appearance matrix before release.
- FR-2: Every state in the US-002 checklist MUST have a documented reproduction and an expected, screenshot-backed render; no state may crash the widget process.
- FR-3: The TypeScript `buildSnapshot` fixture tests (US-003) and Swift decode tests (US-004) MUST run in CI and fail the build on regression — not be manual-only.
- FR-4: The shared snapshot JSON fixture MUST be used by BOTH the TS and Swift round-trip tests so the contract is verified end-to-end.
- FR-5: Gallery `configurationDisplayName`/`description` and a preview/placeholder snapshot MUST exist for each widget; no separate widget icon is produced.
- FR-6: Each widget MUST expose a "city, temperature, condition" `accessibilityLabel`, verified under VoiceOver; Dynamic Type behavior MUST be checked or documented.
- FR-7: The release checklist (US-008) MUST be completed for each shipped build, including App Group portal assignment to both App IDs and the App Group read/write smoke test on the installed binary.
- FR-8: All widget-rendered display strings MUST be snapshot passthrough; the widget MUST NOT introduce its own localization in v1.

## Non-Goals (Out of Scope)

- Building new widget UI or behavior — this PRD only verifies and releases what PRDs 00–06 deliver.
- Localized widget strings (condition/day labels, headline, summary, city names) — passthrough only in v1 (US-007; README Non-Goal).
- Automated UI/snapshot-diff testing of rendered SwiftUI pixels (the matrix is screenshot-by-inspection in v1); pixel-diff harnessing is a fast-follow.
- Always-On / physical-device performance profiling beyond the noted manual lock-screen checks.
- App Store submission mechanics beyond the build/provisioning checklist (covered by the app's existing release process).

## Design Considerations

- **Gallery copy (v1, English-only):**
  - `configurationDisplayName`: "AI Weather"
  - `description`: "Current conditions, hourly trend, and the day ahead for your weather."
  - Per-family display names MAY refine this (e.g. "Weather — Compact" for `systemSmall`), recorded here when finalized.
- **Preview snapshot:** reuse PRD 01 US-005's bundled `placeholder` constant (a realistic Madrid `partly` snapshot) so gallery previews and the no-data state share one source of truth.
- **No-data placeholder copy:** "Open AI Weather to set up" (US-002), reused as the empty-state render across families.
- **Screenshots** are the matrix deliverable: organize captures as `device/appearance/ios/family` so missing cells are obvious at a glance.
- Widgets inherit the app icon; do not design a separate glyph.

## Technical Considerations

- **TS tests** run under the project's existing test setup; `buildSnapshot` is a pure function (PRD 01 US-002), so fixtures are plain objects — no native mocking needed. The negative-longitude case uses Madrid (`-3.7038 → "-3.704"` via `cityId`'s `toFixed(3)`); the URL round-trip uses `encodeURIComponent`/`decodeURIComponent` to mirror PRD 06's `addingPercentEncoding` on the Swift side.
- **Swift tests** decode JSON fixtures; the round-trip fixture is the exact JSON the TS writer emits (capture it once into a shared fixtures file committed under `targets/widgets/`). Tolerance behaviors (unknown condition → `cloud`, future `schemaVersion`, missing optionals, corrupt → `nil`) are the only crash guards in the extension process and MUST be tested, not assumed.
- **Simulator verification** replaces all prior "verify in browser/dev-browser" language: home-screen families via the simulator Home Screen → Edit → add widget; accessory families via long-press Lock Screen → Customize → add complication; appearance via Settings → Developer / Appearance toggle; OS via separate 16.4 and 17 simulator runtimes; VoiceOver via Settings → Accessibility.
- **iOS 16.4 vs 17 gating** is the reason both runtimes are in the matrix: APIs gated behind `#available(iOS 17, *)` (`containerRelativeFrame`, content-margins, `AppIntentConfiguration` / 06b) must visibly degrade on 16.4 and engage on 17.
- **CNG constraint:** native test code and fixtures live under `targets/widgets/`; `/ios` is regenerated and must never be the deliverable.
- The App Group read/write smoke test is the only proof the shared container is wired; gallery appearance alone does not prove it (PRD 00 note).

## Success Metrics

- 100% of US-001 matrix cells captured and signed off (no truncation/contrast failures).
- 100% of US-002 states reproduced with the expected render; zero widget-process crashes across all states.
- TS `buildSnapshot` and Swift decode test suites green in CI; the shared round-trip fixture passes on both sides.
- App Group read/write smoke test passes on the installed release build.
- VoiceOver announces a correct "city, temp, condition" label for every family.
- Release checklist (US-008) fully completed before submission.

## Open Questions

- Which test runner is wired for the TS suite in this repo today (Jest vs none yet)? If none, US-003 includes standing one up; resolve before PRD 01 US-002 lands so the writer ships with tests.
- Does CI have macOS runners able to execute `xcodebuild test` for US-004, or are the Swift tests gated to local/manual until macOS CI exists? Record the decision; if manual, mark US-004 as a release-blocking manual gate.
- Are physical devices available for the Always-On / `.vibrant` lock-screen confirmation, or is that confirmation deferred to TestFlight feedback? (Simulator covers everything except Always-On fidelity.)
- Finalize per-family `configurationDisplayName` strings (US-005) — keep one shared name, or differentiate per family?
