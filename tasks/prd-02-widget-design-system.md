# PRD 02: Widget Design System (SwiftUI Parity Layer)

## Introduction/Overview

The app has a distinctive, hand-built visual language: warm per-condition **linear** gradients, eight bespoke stroke-based weather glyphs, a heavy display typeface for temperature, and a small set of ink/muted color tokens. Widgets must feel like a piece of the same app, not a generic system widget.

This PRD ports that visual language into a reusable **SwiftUI design system** inside the widget target. Every widget (PRD 04–05) composes these primitives. Building it once, correctly, is what makes the widgets look native to the brand and keeps the widget families visually consistent.

Depends on: **PRD 00** (target exists, scheme, App Group, suite-wide iOS **16.4** deployment floor). This PRD has **no runtime dependency on PRD 01** — it needs only the 1-line `Condition` enum (the `'clear'|'partly'|'cloud'|'rain'|'night'|'snow'|'fog'|'storm'` value set) and, for temperature formatting, the unit string. It can therefore be built **in parallel** right after PRD 00. PRD 03 is the true join point where this view layer meets PRD 01 data.

## Goals

- Reproduce the 8 condition gradients from `src/utils/colors.ts` `GRADIENTS` as SwiftUI **LinearGradient**s with byte-exact stops/locations and matching direction.
- Reproduce the 8 weather glyphs from `src/components/WeatherIcon.tsx` as SwiftUI shapes (or a **vetted, existence-checked** SF Symbol mapping), legible at widget sizes including the tiny lock-screen accessory circular.
- Reproduce typography tokens (display temperature, kicker labels, stat values) within SwiftUI's font system.
- Provide unit-aware temperature formatting that reproduces `fmtTemp`'s rounding plus the app's separately-appended no-space `°` suffix.
- Provide light/dark and lock-screen (`.accessory*` tinted/vibrant) rendering modes.

## User Stories

### US-001: Condition → gradient
**Description:** As a widget, I want the same background gradient the app shows for a condition.

**Acceptance Criteria:**
- [ ] `targets/widgets/DesignSystem/Gradients.swift` defines `func gradient(for cond: Condition) -> LinearGradient` (strictly a SwiftUI `LinearGradient` — there is **no** radial option; the app's hero uses `LinearGradient` only, App.tsx:262-267).
- [ ] The function returns `LinearGradient(stops: <stops>, startPoint: UnitPoint(x: 0.8, y: 0), endPoint: UnitPoint(x: 0.2, y: 1))` — direction taken verbatim from App.tsx:265-266 (`start={{x:0.8,y:0}}` → `end={{x:0.2,y:1}}`).
- [ ] Each condition supplies **exactly 5** `Gradient.Stop(color:location:)` entries at locations `[0, 0.2, 0.45, 0.7, 1]` (identical across all 8 conditions; sourced from `GRADIENTS[*].locations` in `colors.ts`).
- [ ] All **8** conditions are transcribed in full (8 × 5 = 40 colors + 40 locations) from `GRADIENTS` in `src/utils/colors.ts` — see the transcription table in Design Considerations. The mapping is implemented with a `switch cond` that has **no `default` clause**, so SwiftUI's exhaustiveness checking makes a missing condition a **compile-time error**.
- [ ] Hex casing is insignificant in SwiftUI `Color(red:green:blue:)` literals; the source hex is lowercase and the Swift port MAY use any case. Do not flag a case difference as a mismatch.
- [ ] Renders correctly in an Xcode SwiftUI `#Preview` for all 8 conditions (a preview gallery iterating `Condition.allCases`).

### US-002: Condition → icon
**Description:** As a widget, I want the same weather glyph the app uses.

**Acceptance Criteria:**
- [ ] `targets/widgets/DesignSystem/WeatherGlyph.swift` provides a `WeatherGlyph(cond:)` view for all 8 conditions.
- [ ] Glyphs are legible at 16pt (lock-screen accessory circular) through 64pt (large widget).
- [ ] Decision recorded: custom `Shape`/`Path` redraw of the app's SVGs **vs** curated SF Symbols. Default recommendation: **SF Symbols** for crispness/accessibility + automatic lock-screen vibrancy, with a note that exact-parity custom paths are a documented fast-follow if brand fidelity demands it.
- [ ] **The SF Symbol mapping below is a CANDIDATE / UNVERIFIED list — each symbol name MUST be confirmed to exist on the deployment-target iOS version (16.4) before use**, gated with `if #available` or verified against the SF Symbols app's "Availability" pane (do not assume a symbol shipped on iOS 16). Candidate mapping (reconsidered for this app's art): `clear → sun.max` (the app's clear glyph is a plain sun, no rays cluster — prefer `sun.max` over `sun.min`), `partly → cloud.sun`, `cloud → cloud`, `rain → cloud.rain`, `snow → cloud.snow`, `fog → cloud.fog`, `storm → cloud.bolt.rain`, `night → moon` (use `moon`, **not** `moon.stars` — the app's night glyph has no stars).
- [ ] Apply `.symbolRenderingMode(.monochrome)` + an explicit `.fontWeight` to approximate the app's thin strokes; if the rendered weight reads too heavy versus `WeatherIcon.tsx`, fall back to custom `Path` (documented fast-follow).
- [ ] In lock-screen accessory contexts, glyphs render monochrome/vibrant correctly (no full-color fills that disappear under tint).
- [ ] Preview shows all 8 at small + large sizes.

### US-003: Typography tokens
**Description:** As a widget, I want type that matches the app's hierarchy.

**Acceptance Criteria:**
- [ ] `targets/widgets/DesignSystem/Typography.swift` defines reusable fonts: `displayTemp` (heavy, large), `kicker` (12pt bold, tracked, uppercased), `statValue` (bold ~18pt), `body` (~15pt).
- [ ] App uses Helvetica Neue / system on iOS; the widget uses the system font with matching weights (custom fonts in extensions require bundling — default to system `.heavy`/`.bold` unless a font file is added).
- [ ] Degree handling matches the app: in the app, `fmtTemp` returns a **number** (`Math.round(...)`, helpers.ts:2) and the `°` (`U+00B0`) is appended at each JSX call site with **no separating space**. The widget reproduces this in the `Temp.format` helper (US-004), not by adding a space anywhere.

### US-004: Color tokens + units
**Description:** As a widget, I want ink/muted colors and °C/°F formatting identical to the app.

**Acceptance Criteria:**
- [ ] `targets/widgets/DesignSystem/Tokens.swift` defines the color tokens transcribed from `src/utils/colors.ts`:
  - `ink` = `#15131a` → `Color(red: 0x15/255, green: 0x13/255, blue: 0x1a/255)`
  - `muted` = `rgba(21,19,26,0.52)` → same RGB as ink with `.opacity(0.52)`
  - `faint` = `rgba(21,19,26,0.34)` → same RGB as ink with `.opacity(0.34)`
  - `hair` = `rgba(21,19,26,0.14)` → same RGB as ink with `.opacity(0.14)`
  - `rainBlue` = `#3f6fb0` → `Color(red: 0x3f/255, green: 0x6f/255, blue: 0xb0/255)`
- [ ] These alpha tokens are **RGBA-over-transparent** (the same ink RGB drawn with an alpha channel, painted over whatever is beneath — i.e. the gradient), **not** a "52% of ink composited over a background color" blend. Implement strictly as `ink.opacity(0.52)` etc.
- [ ] Hex casing is insignificant (`#15131a` ≡ `#15131A`, `#3f6fb0` ≡ `#3F6FB0`). Do not flag a case difference as a mismatch.
- [ ] `Temp.format(_ celsius: Int, unit: Unit) -> String` reproduces `fmtTemp` exactly: compute `unit == .f ? Int((Double(celsius) * 9 / 5 + 32).rounded()) : celsius` (input `celsius` is already integer-rounded upstream, but round defensively to match `cToF`'s `Math.round`), then return that number with a trailing `°` and **no space**, e.g. `"\(value)°"`. (Alternatively the helper MAY accept `unit: String` — `"C"|"F"` — to stay self-contained; see Technical Considerations.)
- [ ] Foreground/ink color adapts for legibility on each gradient and in lock-screen vibrant mode.

### US-005: Render-mode awareness
**Description:** As a widget, I want to look right on home screen (full color) and lock screen (tinted/vibrant).

**Acceptance Criteria:**
- [ ] Design components read SwiftUI's `widgetRenderingMode` environment and adapt (full color vs accented/vibrant).
- [ ] In `.accessory*` families, backgrounds are omitted (system provides the material) and content uses vibrant-friendly monochrome.
- [ ] A preview gallery shows each primitive in `.fullColor`, `.accented`, and `.vibrant`.

## Functional Requirements

- FR-1: Gradients MUST be SwiftUI `LinearGradient`s using the exact hex stops and the shared `[0, 0.2, 0.45, 0.7, 1]` locations from `src/utils/colors.ts` `GRADIENTS`, with `startPoint: UnitPoint(x:0.8,y:0)` / `endPoint: UnitPoint(x:0.2,y:1)`. No `RadialGradient`.
- FR-2: A glyph MUST exist for all 8 conditions and be legible from 16pt to 64pt. Any SF Symbol used MUST be existence-checked for iOS 16.4.
- FR-3: Temperature formatting MUST reproduce `fmtTemp`'s rounding (`cToF` = `Math.round(c*9/5+32)`; °C = `Math.round(c)`) and append `U+00B0` with no preceding space — `fmtTemp` itself returns a number, so the suffix is the helper's responsibility.
- FR-4: All primitives MUST render correctly in `.fullColor`, `.accented`, and `.vibrant` rendering modes.
- FR-5: The design system MUST have zero dependency on the RN runtime or the bridge data — pure presentation given inputs.
- FR-6: Color tokens MUST match the app's `INK`/`MUTED`/`FAINT`/`HAIR`/`RAIN_BLUE` constants, implemented as ink-RGB-with-opacity for the alpha tokens.
- FR-7: The condition→gradient mapping MUST be a `switch` with no `default`, so a missing condition fails the build rather than rendering blank at runtime.

## Non-Goals (Out of Scope)

- Animations (widgets are largely static; no animated gradients).
- Porting the app's full SVG curve/hourly-chart renderer (a simplified chart is specified per-widget in PRD 04).
- Dark-mode palette redesign — reuse condition gradients; only ensure foreground legibility.

## Design Considerations

- Lock-screen accessory widgets are **template-tinted** — full-color gradients won't show; design those views to rely on shape + monochrome glyph + text, not color.
- At small sizes, prefer one strong element (big temp + glyph) over cramming stats.
- Keep contrast AA-legible on the lightest gradient stop.

### Gradient transcription table (all 8 × 5, from `colors.ts` `GRADIENTS`)

Locations for **every** condition are `[0, 0.2, 0.45, 0.7, 1]`. Colors, in stop order:

| Condition | stop 0 | stop 1 (0.2) | stop 2 (0.45) | stop 3 (0.7) | stop 4 (1.0) |
|-----------|--------|--------------|---------------|--------------|--------------|
| `clear`  | `#ffe6bf` | `#ffd6a6` | `#fef5ea` | `#ffc790` | `#fbecda` |
| `partly` | `#fae3c4` | `#f0d7b8` | `#f8f2e9` | `#e3cfae` | `#f3e8d8` |
| `cloud`  | `#e4def0` | `#d6d3e6` | `#f3f1f8` | `#c8cfe0` | `#e9e7f1` |
| `rain`   | `#cfe1f4` | `#b6cfec` | `#eef5fc` | `#a3c0e6` | `#e0ecf8` |
| `night`  | `#d2d4f2` | `#c4c4ea` | `#eeecf8` | `#bcbfe4` | `#dddaf0` |
| `snow`   | `#e3f0fa` | `#d4e7f6` | `#f7fbfe` | `#c9e0f2` | `#ecf4fb` |
| `fog`    | `#e8e4dd` | `#ddd8d0` | `#f5f3ef` | `#d2cdc4` | `#ece9e3` |
| `storm`  | `#c3cada` | `#b2bccf` | `#e3e7ef` | `#a5b1c8` | `#d3d9e5` |

(Note the app's `GRADIENTS` literal orders the keys `clear, partly, cloud, rain, night, snow, fog, storm`; the `Condition` enum order is irrelevant since the `switch` is exhaustive.)

## Technical Considerations

- **`Condition` / `Unit` dependency:** `Condition` and `Unit` are defined in **PRD 01** (the shared bridge). The `Temp.format` helper must decode the app's `'C'|'F'` unit string. To keep this design-system PRD buildable in isolation (before PRD 01 lands), the helper MAY accept `unit: String` instead of the `Unit` enum; reconcile to the `Unit` enum when PRD 01 merges.
- **iOS version floor:** the suite-wide deployment target is **16.4** (set in PRD 00). `widgetRenderingMode`, the `.accessory*` families, and `.vibrant`/`.accented` modes require **iOS 16+** — satisfied by the 16.4 floor. `systemSmall/Medium/Large` need only iOS 14+. Any iOS 17-only API encountered while building primitives MUST be `#available(iOS 17, *)`-gated or avoided.
- **SF Symbols:** SF Symbols give free vibrancy/scaling and are the pragmatic default; custom `Path` glyphs are the parity-maximizing alternative — the PRD allows either but asks for an explicit, recorded decision. **Every symbol name is unverified until checked against iOS 16.4 availability** (SF Symbols app or `if #available`).
- **Custom fonts:** Custom fonts in an extension require adding the font file to the target and an `Info.plist` `UIAppFonts` entry; avoid unless parity demands it.
- **Transcribe hex exactly:** a single wrong stop is visually obvious against the app. The no-`default` switch guards against a *missing* condition; the transcription table above is the source of truth for *correct* values.

## Success Metrics

- Side-by-side, each condition's widget background `LinearGradient` is operationally **indistinguishable** from the app hero — defined concretely as: the Swift stops match the `colors.ts` hex byte-for-byte (case-insensitive), the 5 locations equal `[0, 0.2, 0.45, 0.7, 1]`, and the start/end points equal `(0.8,0)`/`(0.2,1)`. A unit/snapshot test asserting these values passing is the proof, not an eyeball "looks close."
- Glyphs readable on the smallest accessory circular size.
- °C↔°F toggle in app flips widget numbers correctly (validated once PRD 01/03 wire the unit through).

## Open Questions

- SF Symbols vs custom paths for glyphs — pick during US-002 and record. (Recommendation: SF Symbols first, contingent on existence-checking each name on iOS 16.4.)
- Does brand fidelity require bundling Helvetica Neue into the extension, or is system `.heavy` acceptable? Recommendation: system first.

## Verification

- **Gradients:** Xcode SwiftUI `#Preview` rendering `Condition.allCases`, each showing its `LinearGradient`; visually confirm all 8 render and none is blank (a blank would have been a compile error given FR-7). Back this with a Swift unit test asserting per-condition stop hex + locations + start/end points against the transcription table.
- **Temperature helper:** Swift unit test on `Temp.format`: e.g. `Temp.format(0, "F") == "32°"`, `Temp.format(20, "C") == "20°"`, `Temp.format(-3, "F")` rounds to match `cToF(-3)` — assert the trailing `°` with no space, no leading space.
- **Glyphs / SF Symbols:** in an iOS **16.4** Simulator, render each `WeatherGlyph` in a sample widget and confirm the symbol resolves (a missing symbol renders an empty/placeholder box); confirm via Xcode preview at 16pt and 64pt.
- **Render modes:** Xcode preview gallery in `.fullColor`, `.accented`, `.vibrant`.
- **Lock-screen accessory fidelity (NIT, real-device-preferred):** add each accessory family to a **Lock Screen with a busy / tinted wallpaper** on an iOS 16+ Simulator (or, for `.vibrant`/Always-On accuracy, a physical device — Simulator previews mis-render vibrancy). Confirm the monochrome glyph + text remain legible under tint; capture a screenshot per family as the deliverable.
