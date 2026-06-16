# PRD 05: Lock-Screen Widgets (Circular / Rectangular / Inline)

## Introduction/Overview

iOS 16+ lets widgets live on the **lock screen** as small "accessory" complications. This PRD delivers the three accessory families — `accessoryCircular`, `accessoryRectangular`, and `accessoryInline` — so users see the current temperature and condition without unlocking. These are the highest-frequency glances a weather app gets.

Accessory widgets are **template-tinted and monochrome/vibrant** — they ignore full-color backgrounds. The system renders them in `.accented`/`.vibrant` rendering modes and only respects shape, glyph, and text. The design must communicate with shape, glyph, and text alone, and any condition glyph MUST be an SF Symbol (or a monochrome template image) — full-color art and custom `Path` strokes do not survive vibrancy. This is a distinct design problem from the home-screen widgets and is why it gets its own PRD.

All accessory views and the provider live in the widget extension bundle `com.myweatherai.app.widgets`, share data through App Group `group.com.myweatherai.app`, and read the snapshot keys `wxai.widget.active` / `wxai.widget.snapshot.<cityId>` defined in PRD 01.

Depends on: **PRD 02** (vibrant-aware design system; specifically the SF Symbol condition mapping in PRD 02 US-002), **PRD 03** (timeline provider). The suite-wide deployment-target floor is **iOS 16.4** (set in PRD 00 FR-5); accessory families are available from iOS 16, so no extra gating is needed for the families themselves, but any iOS 17+-only API used inside a view MUST be `#available(iOS 17, *)`-gated.

## Goals

- Ship all three iPhone lock-screen accessory families rendering live, unit-aware temperature + condition.
- Guarantee legibility under `.vibrant`/`.accented` rendering on a busy wallpaper, with no color-dependent meaning.
- Reuse the single `WeatherProvider` (PRD 03) and the SF Symbol condition mapping (PRD 02 US-002) so accessory views are view-only differences.
- Handle missing/stale/no-data states without crashing.

## User Stories

### US-001: accessoryInline — one line of text
**Description:** As a user, I want a single line like "72° Sunny" above my lock-screen clock.

**Acceptance Criteria:**
- [ ] `targets/widgets/Widgets/InlineWidget.swift` renders **a single `Text`** plus **at most one leading SF Symbol** (e.g. `Label("72° Partly cloudy", systemImage: "cloud.sun")`). This is a hard platform constraint: `accessoryInline` renders only one `Text` and one optional leading system image — a custom `Path`/`HStack`/multi-view layout renders **blank**.
- [ ] The leading glyph is the SF Symbol for the projected `cond`, taken from the PRD 02 US-002 mapping (8 conditions). If PRD 02 chose custom Paths, they MUST be supplied here as monochrome template images; raw `Path` strokes are not permitted in this family.
- [ ] Uses the system-provided tint; no custom background.
- [ ] Text truncates gracefully; respects the very limited inline length (city omitted — see Open Questions).
- [ ] Unit-aware temperature: `Temp.format(_:unit:)` returns a number and the `°` (`U+00B0`) is appended with no separating space (per PRD 02 US-003).
- [ ] Accessibility: the view exposes an `accessibilityLabel` of the form "temp, condition" (e.g. "72 degrees, partly cloudy"); verified with VoiceOver on the lock screen.

### US-002: accessoryCircular — temp + glyph dial
**Description:** As a user, I want a compact circular complication with temperature and condition.

**Acceptance Criteria:**
- [ ] `targets/widgets/Widgets/CircularWidget.swift` renders **temp prominently with the condition glyph only** — no gauge in v1 (see Non-Goals).
- [ ] Uses `AccessoryWidgetBackground()` for the standard circular backing material.
- [ ] Legible in `.vibrant`/`.accented` rendering (no color-dependent meaning); the condition is conveyed by glyph shape + the temperature number.
- [ ] Glyph is the SF Symbol for `cond` (PRD 02 US-002) and readable at circular size; `.symbolRenderingMode(.monochrome)` applied.
- [ ] Unit-aware temperature (per US-001 formatting rule).
- [ ] Accessibility: `accessibilityLabel` "temp, condition"; verified with VoiceOver.

### US-003: accessoryRectangular — compact summary
**Description:** As a user, I want a small rectangle with city, temp, condition, and hi/lo.

**Acceptance Criteria:**
- [ ] `targets/widgets/Widgets/RectangularWidget.swift`: line 1 = city + temp; line 2 = SF Symbol glyph + condition label; line 3 = hi/lo (and precip percent if notable).
- [ ] hi/lo are read from the named `days[].lo` / `days[].hi` fields (PRD 01 `DayTuple` mapping: `d[2]=lo, d[3]=hi`); never index the raw tuple on the Swift side. Precip is `precipProb` (a percent, sourced from `wx.precip` per PRD 01), rendered only when `> 0`.
- [ ] Monochrome/vibrant-friendly; no reliance on color.
- [ ] No clipping with long city names; truncates with tail.
- [ ] Unit-aware temperatures (per US-001 formatting rule).
- [ ] Accessibility: `accessibilityLabel` "city, temp, condition, high temp, low temp"; verified with VoiceOver and at the largest Dynamic Type the widget exposes (widgets cap type size; document the observed cap if line 3 must drop).

### US-004: Register accessory families
**Description:** As a developer, I want these addable from the lock-screen editor.

**Acceptance Criteria:**
- [ ] Accessory families added to the widget bundle (either same widget with extended `supportedFamilies`, or a dedicated accessory widget — document choice).
- [ ] All three appear in the lock-screen widget editor on a real build/simulator (iOS 16+) following the steps in Technical Considerations.
- [ ] Verified on the lock screen; **screenshots captured for each family** (inline above the clock, plus the circular and rectangular slots).
- [ ] When placed in a Smart Stack, **entry relevance (PRD 03 US-005) influences rotation/ordering of stacked widgets**; a **pinned accessory complication displays unconditionally** and is not gated by relevance.

### US-005: No-data / empty / error states
**Description:** As a user who added an accessory widget before ever opening the app, I want a clear state rather than a blank or crashing complication.

**Acceptance Criteria:**
- [ ] **Widget added but app never opened** (no `wxai.widget.active` key exists yet — the Madrid default lives only in JS and is not written to the App Group container until the first `saveWx` at App.tsx:166): all three families show a minimal "Open app" affordance (e.g. inline "—° Open app"; circular a neutral glyph; rectangular a single "Open AI Weather to set up" line) instead of placeholder garbage or a crash.
- [ ] **Stale snapshot** (`generatedAt`/`staleAt` past the PRD 03 threshold): the family still renders the last known values; the rectangular family MAY show a subtle staleness affordance (no color dependence).
- [ ] **Missing/corrupt snapshot or future `schemaVersion`**: views degrade to the "Open app" state without crashing.
- [ ] First app launch is documented as a prerequisite for live accessory data.

## Functional Requirements

- FR-1: Provide `accessoryInline`, `accessoryCircular`, `accessoryRectangular` views.
- FR-2: All accessory views MUST be legible in `.vibrant`/`.accented` modes and MUST NOT depend on color to convey meaning.
- FR-3: Circular MUST use `AccessoryWidgetBackground()`; accessory views MUST NOT paint full-color gradients.
- FR-4: All temps unit-aware; all views handle missing data + stale state without crashing (US-005).
- FR-5: Condition glyphs MUST be rendered as **SF Symbols** drawn from the PRD 02 US-002 8-condition mapping. The accessory families **require** the SF Symbol option from PRD 02; if PRD 02 settled on custom `Path` glyphs, those MUST be provided to these families as **monochrome template images** — a raw `Path` renders blank under vibrancy, and `accessoryInline` accepts only a single SF Symbol regardless.
- FR-6: The suite-wide deployment-target floor is iOS 16.4 (PRD 00 FR-5). Accessory families require iOS 16; guard any iOS 17+-only API behind `#available(iOS 17, *)`.

### Condition glyph mapping (port from PRD 02 / `wmoInfo`)

The 8 conditions resolved by `wmoInfo` (module-private in `src/data/weatherApi.ts` — port, do not import; `!isDay && code<=3 → night`):

| cond | candidate SF Symbol |
| --- | --- |
| clear | `sun.max` |
| partly | `cloud.sun` |
| cloud | `cloud` |
| overcast | `smoke` |
| fog | `cloud.fog` |
| rain | `cloud.rain` |
| snow | `cloud.snow` |
| storm | `cloud.bolt.rain` |
| night (clear/partly/cloud/overcast at night) | `moon` |

(Final symbols are owned by PRD 02 US-002; this table is the dependency contract — keep it byte-consistent with PRD 02.)

## Non-Goals (Out of Scope)

- **Any gauge/ring in the circular family for v1.** v1 is temp + glyph only. If a gauge is ever wanted, it requires `Gauge(.accessoryCircularCapacity)` — **not** `AccessoryWidgetBackground()`, which only supplies the circular backing material and cannot show a value arc.
- Tap deep links (PRD 06).
- Per-widget city selection (PRD 06).
- `accessoryCorner` (watchOS) — iPhone lock screen only.
- Always-On Display-specific tuning beyond standard vibrant rendering.
- Widget-side localization (condition/day/city strings are passed through verbatim from the app snapshot).

## Design Considerations

- Maximize glanceability: temperature is the priority element in all three families.
- Circular has almost no room — temp + glyph only (no gauge in v1).
- Rectangular: 2–3 short lines, generous tail truncation.
- Test on a busy lock-screen wallpaper to confirm legibility under vibrancy; "indistinguishable from app intent" is operationalized as: a reviewer reads the temperature and condition in under 1 second on a complex wallpaper.

## Technical Considerations

- Use `.widgetAccentable()` where appropriate to keep key elements (temperature) in the accent group.
- Accessory families, `widgetRenderingMode`, and `.vibrant` require iOS 16+; the floor is 16.4 (PRD 00).
- **Deployment-target check:** Confirm PRD 00 set the extension target to **16.4** (its FR-5). No action is required here unless the generated `Podfile` (or the apple-targets-generated extension `IPHONEOS_DEPLOYMENT_TARGET`) shows a value that diverges from the app's 16.4.
- The same `WeatherProvider` (PRD 03) feeds these; only the views differ.

### Simulator verification steps

1. Build the app + widget extension to an iOS 16.4+ simulator (or device) via the prebuilt Xcode project.
2. On the simulator, **long-press the Lock Screen → Customize → tap the Lock Screen → tap a widget slot** (the strip below the clock for circular/rectangular, or the line above the clock for inline).
3. Add each accessory family (Inline, Circular, Rectangular) from the "AI Weather" group and confirm live snapshot data renders.
4. Capture a **screenshot per family**.
5. `.vibrant` rendering and Always-On Display behavior are best confirmed on a **physical device** (the simulator approximates vibrancy and mis-renders some accent grouping); note any device-only follow-ups.
6. Run the no-data path (US-005) by clearing the App Group container or testing before first `saveWx`; confirm the "Open app" state and no crash.

## Success Metrics

- All three accessory families are selectable in the Lock Screen editor and render live data on the lock screen in the simulator.
- Temperature is legible at a glance under vibrant rendering on a complex wallpaper (read in <1s).
- VoiceOver announces "city, temp, condition" for each family.
- No crashes on missing/stale/no-data state (US-005), verified via the cleared-container path.

## Open Questions

- Inline: include city name or assume the "current/active city" is obvious? Proposed: omit city to save space; temp + condition only.
- Should accessory widgets always follow the active city, or also be configurable (PRD 06b, iOS 17+)? Proposed: follow the active city in v1; per-widget configuration is deferred to PRD 06b.

(Resolved: the circular gauge question is closed — v1 is temp + glyph only; gauge moved to Non-Goals.)
