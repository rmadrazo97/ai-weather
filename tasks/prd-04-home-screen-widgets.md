# PRD 04: Home-Screen Widgets (Small / Medium / Large)

## Introduction/Overview

This PRD delivers the three **home-screen** widget families users actually add: `systemSmall`, `systemMedium`, and `systemLarge`. Each is a SwiftUI view that composes the design system (PRD 02) over the `WidgetSnapshot` and per-entry data from the timeline provider (PRD 03). They progressively reveal more of the app's weather story as size grows: a glanceable now, an hourly strip, and a full briefing with the AI headline.

This is the headline deliverable of the suite — the first thing users see and judge.

Depends on: **PRD 02** (design system views + `Condition`/`Unit`/`Temp.format`), **PRD 03** (timeline provider + per-entry slicing). Tap-through deep linking is added in **PRD 06**.

Deployment-target note: the suite floor is **iOS 16.4** (PRD 00 FR-5; the app target per `ios/Podfile`). `ViewThatFits` is available at 16+ and may be used freely. `containerRelativeFrame(_:)` and the `.contentMargins`/widget content-margins APIs are **iOS 17+** and MUST be `#available(iOS 17, *)`-gated with a 16.4 fallback (see Technical Considerations).

## Goals

- Ship `systemSmall`, `systemMedium`, and `systemLarge` widgets that render correct, unclipped, brand-matching weather for the active city.
- Reuse the PRD 02 design system (gradients, glyphs, `Temp.format`) so widgets visually match the app hero.
- Drive every view from the PRD 01 `WidgetSnapshot` contract and PRD 03 per-entry projection, with no view assuming non-empty arrays.
- Degrade gracefully when there is no snapshot, stale data, or short/empty `hourly`/`days`.
- Meet the app's accessibility bar (VoiceOver labels, Dynamic Type) in the widget context.

## User Stories

### US-001: systemSmall — glanceable now
**Description:** As a user, I want a compact widget showing my city's current temperature and condition.

**Acceptance Criteria:**
- [ ] `targets/widgets/Widgets/SmallWidget.swift` renders: city name (truncating), large current temp (unit-aware via `Temp.format(_:unit:)`), condition glyph, condition label, and hi/lo from `entry.snapshot.days[0].lo`/`.hi`.
- [ ] Background uses the condition gradient for the entry's projected `cond` (PRD 02 `LinearGradient`, `startPoint (0.8,0)`/`endPoint (0.2,1)`).
- [ ] Layout holds at the real `systemSmall` point size without clipping for long city names (e.g. "San Francisco") and 3-digit °F temps (e.g. `108°`).
- [ ] A subtle stale indicator appears when `entry.isStale`.
- [ ] If the entry has no snapshot (empty/no-data state, see US-006), Small shows the "Open AI Weather" prompt instead of crashing or showing zeros.
- [ ] Glyph fidelity is contingent on PRD 02's recorded glyph decision: if SF Symbols are chosen, the bar is "a reviewer reads the condition in < 1s," not pixel parity with the app's `WeatherIcon.tsx`.
- [ ] Renders in Xcode preview for ≥3 conditions (clear, rain, night) in °C and °F.

### US-002: systemMedium — now + hourly strip
**Description:** As a user, I want current conditions plus the next few hours.

**Acceptance Criteria:**
- [ ] `targets/widgets/Widgets/MediumWidget.swift`: left block = city + temp + glyph + label + hi/lo (`days[0].lo`/`.hi`); right block = horizontal strip of the next **6** hours (hour label, mini glyph, temp, and a precip-probability percent when `pop > 0`).
- [ ] The strip is built from the **entry-relative** hourly slice supplied by PRD 03 (see US-005), so its first column is the entry's current hour — never a raw `snapshot.hourly[0]` after timeline scrubbing.
- [ ] Hourly count is fixed at **6** columns, matching the shared `HourlyStrip` subview and the snapshot's 6-element `hourly`.
- [ ] `pop` is rendered as a percent (the snapshot carries `pop` per PRD 01; render `Int(round(pop … ))%` only when `pop > 0`, using the unit convention pinned in PRD 01 #7).
- [ ] Precipitation chance uses the `rainBlue` token (`#3f6fb0`) when shown.
- [ ] No clipping at real `systemMedium` size; strip columns evenly spaced via `ViewThatFits` and/or fixed insets (no iOS 17-only API on the 16.4 path).
- [ ] Xcode preview for clear/partly/rain in both units.

### US-003: systemLarge — full briefing
**Description:** As a user, I want a rich at-a-glance briefing including the app's headline.

**Acceptance Criteria:**
- [ ] `targets/widgets/Widgets/LargeWidget.swift`: header (city + a **coarse time-of-day** label derived from `snapshot.sun.isNight`/`sun.sunPct` — see below), big temp + glyph + label + hi/lo (`days[0].lo`/`.hi`), the AI **headline** (`pre` + bold `em` + `post`) and/or `summary`, the hourly strip (6h, same entry-relative slice as Medium), and a compact 5-day forecast.
- [ ] The header time-of-day is **not** a clock. The snapshot has no `time` field; derive a coarse label from `sun`: when `sun.isNight` show a night label, otherwise bucket by `sun.sunPct` (e.g. early/mid/late day). No `H:MM AM/PM` string is rendered.
- [ ] The 5-day forecast iterates `snapshot.days` and references named fields only: `day.label`, `day.cond`, `day.lo`, `day.hi`, `day.pop`. It MUST NOT index the raw `DayTuple` positionally on the Swift side (the decoded model exposes named `lo`/`hi` per PRD 01 #6).
- [ ] Headline renders with the emphasized middle segment bold (matching the app's `{pre, em, post}` treatment).
- [ ] 5-day rows show a simple lo→hi range bar or numeric range (`day.lo`–`day.hi`).
- [ ] Everything fits the real `systemLarge` size with comfortable spacing; degrades gracefully if `summary`/`days` are short/empty (guards per FR-6).
- [ ] Xcode preview for storm/clear/snow in both units.

### US-004: Widget bundle registration
**Description:** As a developer, I want the three families exposed as addable widgets.

**Acceptance Criteria:**
- [ ] A `WidgetBundle` (or one `Widget` with `.supportedFamilies([.systemSmall, .systemMedium, .systemLarge])`) registers the home-screen widget under bundle id `com.myweatherai.app.widgets`.
- [ ] `configurationDisplayName` = "AI Weather", with a helpful `description`.
- [ ] All three families selectable from the gallery on a real build/Simulator.
- [ ] Verified in the iOS Simulator widget gallery; screenshots captured for each family.

### US-005: Entry-relative hourly slice (reconcile "Now" with forward projection)
**Description:** As a developer, I want each timeline entry's hourly strip to start at that entry's current hour, not at a fixed `snapshot.hourly[0]`.

**Acceptance Criteria:**
- [ ] The widget consumes a per-entry hourly slice rather than reading `snapshot.hourly[0]` directly. As the timeline scrubs forward, `snapshot.hourly[0]` becomes a past hour, so labeling it "Now" is wrong for any entry after the first.
- [ ] Reconciled explicitly with **PRD 03 FR-2** forward projection: PRD 03 either (a) drops elapsed hours so the entry's first hourly element is that entry's current hour, or (b) rewrites `hourly` per entry. This PRD consumes whichever PRD 03 produces and does not re-slice independently.
- [ ] Only the first entry's strip is labeled "Now"; later entries label by hour. The widget reads the per-hour machine-readable time (`ts` epoch ms + snapshot-level `tzOffsetMinutes`, per PRD 01 #5) for any time math, never the pre-formatted display `h`.

### US-006: No-data / empty / error state
**Description:** As a user who added a widget before ever opening the app (or after removing the active city), I want a clear, non-broken widget.

**Acceptance Criteria:**
- [ ] "Widget added but app never opened": when no `wxai.widget.active` snapshot exists in the App Group container (`group.com.myweatherai.app`), all three families show an "Open AI Weather to set up" view rather than zeros/placeholders-forever. The Madrid default lives only in JS and is not written to the container until the first `saveWx`, so first app launch is a documented prerequisite for live widget data.
- [ ] "Configured city removed AND no active city": the widget falls back to the active-city snapshot, or — if none exists — the empty-state view.
- [ ] Corrupt or future-`schemaVersion` snapshot: the view renders the empty state rather than crashing (decode failure is caught).
- [ ] The empty state inherits the neutral/clear gradient and remains accessible (VoiceOver reads the setup prompt).

### US-007: Accessibility
**Description:** As a VoiceOver user, I want each widget to announce its weather meaningfully and remain legible at large text sizes.

**Acceptance Criteria:**
- [ ] Each family exposes a combined `accessibilityLabel` in the form "city, temp, condition" (e.g. "San Francisco, 64 degrees, partly cloudy"); decorative glyphs are hidden from VoiceOver via `accessibilityHidden(true)` so the label is not duplicated.
- [ ] VoiceOver reads the small/medium/large widgets correctly on the Simulator (verified via the Accessibility Inspector or VoiceOver).
- [ ] Layout is exercised at the largest Dynamic Type setting: text truncates/scales without clipping the hero temp. If WidgetKit caps the effective type size, document that behavior in Technical Considerations rather than leaving it unverified.

## Functional Requirements

- FR-1: Provide `systemSmall`, `systemMedium`, `systemLarge` views.
- FR-2: All temps unit-aware via the shared `Temp.format(_:unit:)` formatter (returns a String reproducing the app's number rounding + no-space `°` suffix, per PRD 02); all backgrounds use condition gradients keyed off the entry's projected `cond`.
- FR-3: Medium/Large MUST show the entry-relative hourly strip (6 columns); Large MUST show the AI headline and 5-day forecast using named `days[].lo`/`.hi`.
- FR-4: All families MUST handle long city names, 3-digit °F, missing optional data, the stale state, and the no-data/empty state without clipping or crashing.
- FR-5: Each family MUST render its placeholder before data loads, and the empty-state view (US-006) when no snapshot exists.
- FR-6: No view may assume non-empty `hourly`/`days` — guard for short/empty arrays.
- FR-7: iOS 17-only layout APIs (`containerRelativeFrame`, widget content-margins) MUST be `#available(iOS 17, *)`-gated with a working 16.4 fallback; `ViewThatFits` (16+) may be used directly.

## Non-Goals (Out of Scope)

- Tap targets / deep links (PRD 06).
- Per-widget city selection (PRD 06b, iOS 17+) — until then, all families show the active city.
- Lock-screen / accessory families (PRD 05).
- Charts beyond a simple hourly strip and lo/hi range (no full curve port).
- Widget-side localization — all strings (city names, condition/day labels, headline/summary) pass through verbatim from the app snapshot (suite-wide Non-Goal).
- A literal clock / `H:MM AM/PM` header on Large (resolved to coarse time-of-day from `sun`).

## Design Considerations

- Mirror the app hero hierarchy: temperature is the hero element; condition glyph secondary; supporting stats tertiary.
- Use the PRD 02 `kicker` style for the city/label and `displayTemp` for the number.
- Keep one consistent inset across families; on iOS 17 use widget content-margins, on 16.4 use a fixed inset (see Technical Considerations).
- Keep Large readable — prefer whitespace over packing every stat.
- Glyph treatment follows PRD 02's recorded glyph decision; if SF Symbols are used, optimize for "condition readable in < 1s," not pixel parity with `WeatherIcon.tsx`.

## Technical Considerations

- **iOS 16.4 floor (PRD 00 FR-5).** Use `ViewThatFits` (16+) for resilient layout. Wrap any `containerRelativeFrame(_:)` or `.contentMargins(...)` usage in `if #available(iOS 17, *)` and provide a `GeometryReader`/fixed-inset fallback for 16.4. Do not adopt `containerRelativeFrame` as the only layout path.
- The hourly strip is shared between Medium and Large — extract a `HourlyStrip` subview that takes the entry-relative slice (6 columns) and the `Unit`.
- Consume the per-entry hourly slice from PRD 03 (US-005); never read `snapshot.hourly[0]` as "Now" after entry 0.
- On the Swift side, reference the decoded snapshot's named fields (`days[].label/.cond/.lo/.hi/.pop`, `hourly[].ts`, `sun.isNight/.sunPct`); never index the raw `DayTuple` and never reparse display strings (`h`, `sun.sunrise`).
- Decode failures (corrupt/future `schemaVersion`) must be caught and routed to the empty-state view, not crash the extension.
- Accessibility: combine each card into a single `accessibilityElement(children: .combine)` with the "city, temp, condition" label; hide decorative glyphs. Verify VoiceOver and largest Dynamic Type on the Simulator; document any WidgetKit type-size cap.
- Verify against real point sizes, not just default previews (iPhone SE vs Pro Max differ).

## Success Metrics

- All three families render correct, unclipped, brand-matching weather for the active city in the Simulator (screenshots per family).
- A reviewer can read current temp + condition in < 1 second on Small.
- Large shows a genuinely useful briefing (headline + hourly + 5-day) without scrolling (widgets don't scroll).
- VoiceOver announces "city, temp, condition" for each family; no clipping at the largest Dynamic Type.
- The empty/no-data state appears (not zeros) when the App Group container has no snapshot.

## Open Questions

- On Large, headline **and** summary, or headline only when both present? Proposed: headline always; summary if vertical space remains.
- Show AQI tile on Large? Proposed: only if space allows after the 5-day row; otherwise omit.
- Coarse time-of-day buckets from `sun.sunPct` — how many bands (e.g. early/mid/late day + night)? Proposed: derive 3–4 buckets; finalize during PRD 02/03 integration.
