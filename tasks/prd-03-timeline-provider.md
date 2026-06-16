# PRD 03: Timeline Provider & Refresh Strategy

## Introduction/Overview

WidgetKit renders from a **timeline** of dated entries supplied by a `TimelineProvider`. The provider decides what data each entry holds and when the system should ask for a new timeline. This PRD defines the provider that feeds every AI Weather widget: how it reads the bridge snapshot (PRD 01), how it projects the next several hours from cached hourly data so the widget visibly progresses between reloads, when it requests refreshes, and how it falls back to fetching Open-Meteo directly when the app hasn't run recently.

Getting refresh right matters because **WidgetKit reloads are budgeted requests, not guarantees** — the system may coalesce or defer them. The strategy must look fresh without depending on reloads we won't get, which is why the forward projection (US-002) is load-bearing rather than cosmetic.

Depends on: **PRD 00** (App Group `group.com.myweatherai.app`, widget bundle `com.myweatherai.app.widgets`, deployment-target floor **16.4**), **PRD 01** (the snapshot contract, including the enriched index entry shape `{id, name, lat, lon}`, per-hour machine-readable `ts: number` + snapshot-level `tzOffsetMinutes`, snapshot keys `wxai.widget.active` / `wxai.widget.snapshot.<cityId>` / `wxai.widget.index`, and `wxai.widget.unit`), **PRD 02** (rendering inputs: condition→glyph/gradient).

## Goals

- One shared `TimelineProvider` (and entry type) reused by all widget families.
- Read the active-city bridge snapshot; build a multi-entry timeline so the displayed hour/temperature advances over time without a reload.
- Choose a sensible `TimelineReloadPolicy` and request refreshes appropriately, treating `.after` as a request rather than a guarantee.
- Provide a direct, budget-bounded Open-Meteo fetch fallback (keyless) for when no app-written snapshot exists or it is stale.
- Always render *something*: placeholder (gallery), snapshot (transient), and real entries — never blank, never crash.

## User Stories

### US-001: Entry model + provider skeleton
**Description:** As a widget developer, I want a single entry type and provider all families share.

**Acceptance Criteria:**
- [ ] `targets/widgets/Provider/WeatherEntry.swift` defines `struct WeatherEntry: TimelineEntry` with `date: Date`, the decoded `WidgetSnapshot`, a `relevance: TimelineEntryRelevance?`, and an `isStale: Bool` flag.
- [ ] `targets/widgets/Provider/WeatherProvider.swift` implements `placeholder(in:)`, `getSnapshot(in:completion:)`, and `getTimeline(in:completion:)`.
- [ ] `placeholder` uses the bundled sample snapshot from PRD 01 (renders instantly, no I/O).
- [ ] Compiles and previews for all target families. **Verify:** add a `#Preview` per family in Xcode and confirm each renders the placeholder without console errors.

### US-002: Build a forward-projected timeline from cached hourly
**Description:** As a user, I want the widget's "now" to track the clock even if it hasn't reloaded.

**Acceptance Criteria:**
- [ ] The snapshot's `hourly` array is **6 elements**; `hourly[0]` is "Now" (the snapshot's current hour). The projection emits **6 entries** — the current hour plus the next 5 — for a horizon of **~5h**.
- [ ] Each entry's `date` is computed from that hour's machine-readable time, **not** the display string `h`. Use the per-hour `ts: number` (epoch ms) plus the snapshot-level `tzOffsetMinutes` from the PRD 01 contract; the display `h` ("Now"/"3PM") is intentionally not parseable back to a `Date`.
- [ ] Each entry advances `current.temp`/`current.cond`/`current.pop` to that hour's `hourly` values so the displayed reading tracks the projected hour.
- [ ] Entry `date`s are strictly increasing and the first entry's date is the snapshot's current hour.
- [ ] **Night and glyph/gradient are derived from the projected `cond` only** — no separate `isNight` field is advanced. `cond` already encodes night (the ported `wmoInfo` maps `!isDay && code<=3 → 'night'`), so the glyph/gradient selection in PRD 02 reads from `cond` and stays consistent automatically.
- [ ] If `hourly` is empty or shorter than expected, fall back to a single current entry stamped at "now".
- [ ] **Verify:** in the Xcode timeline preview (`TimelineProvider` preview / `WidgetPreviewContext`), scrub the timeline and confirm the temperature and condition advance across the 6 entries.

### US-003: Reload policy
**Description:** As a developer, I want the system to ask for fresh data at a reasonable cadence without wasting budget.

**Acceptance Criteria:**
- [ ] `getTimeline` returns `.after(date)` set to the **end of the projected window** — the `date` of the last (6th) entry, ~5h out — so WidgetKit requests a new timeline once the projection is exhausted.
- [ ] The app-side reload (PRD 01 US-004, `WidgetCenter.reloadAllTimelines()`) remains the primary freshness path; this `.after` policy is the backstop.
- [ ] Documented in the code/PRD: `.after(date)` **requests** (does not guarantee) a new timeline after `date`; the system may defer it. Do **not** assume any specific per-day reload count — rely on `.after` plus app-triggered reloads.
- [ ] Documented: iOS 26+ APNs-based widget push is a possible future enhancement, out of scope here.

### US-004: Direct Open-Meteo fallback fetch
**Description:** As a user who hasn't opened the app in a while, I still want roughly-current weather.

**Acceptance Criteria:**
- [ ] **Staleness gate:** the provider performs a fallback fetch when the snapshot is missing, OR when `now - generatedAt > 3h`, OR when (`staleAt` is set AND `now - staleAt > 3h`). When neither gate trips, it builds the timeline from the existing snapshot.
- [ ] **Coordinate source:** the fetch reads `lat`/`lon` for the requested `cityId` from the **enriched index** (`wxai.widget.index` entries of shape `{id, name, lat, lon}`) or from `snapshot.city.lat/lon` — never by parsing coordinates out of the `cityId` string.
- [ ] **`my-location` rule:** for the my-location city the id carries no coordinates and its position may be stale; the provider **skips the network fetch** and uses the last available snapshot (even if stale) for that city.
- [ ] **Concurrency model (classic provider):** `TimelineProvider.getTimeline(in:completion:)` is **not** async. The fetch MUST nest the `URLSession` completion handler and call `completion(timeline)` **inside** it, with an explicit `URLSessionConfiguration.timeoutIntervalForRequest` of **8–10s**. A request that exceeds the timeout (or fails) MUST deterministically fall back to the snapshot/placeholder so the closure always completes. Keep the payload tiny (current + next 6 hourly + today hi/lo) to respect the extension's memory budget (jetsam ~30MB) and a single, bounded request. *(Alternative for an iOS-17-only build: adopt `AppIntentTimelineProvider` and use native `async/await` for the fetch — note this raises the family's floor to iOS 17 and must be `#available(iOS 17, *)`-gated against the suite's 16.4 floor.)*
- [ ] **Endpoint parity:** the fetch uses the same Open-Meteo `forecast` endpoint, fields, and WMO mapping as `src/data/weatherApi.ts` (`fetchWeather`), ported minimally to Swift — current + next 6 hourly + today hi/lo. Keyless; no auth, no secret management.
- [ ] **No-data / never-opened state:** if the requested `cityId` has no snapshot AND no `wxai.widget.active` exists yet (the in-app Madrid default lives only in JS and is not written to the App Group until the first `saveWx`), the provider does not crash or render blank. It either (a) performs the fallback fetch when coordinates are resolvable from the index, or (b) renders a clear empty state ("Open AI Weather to set up") when no coordinates are available. First app launch is a documented prerequisite for live widget data.
- [ ] **Failure handling:** any network/decoding failure falls back to the last snapshot (even if stale) or the placeholder; never blank, never crash.
- [ ] **Stale flagging:** when an entry is built from data older than the gate threshold (or from a snapshot whose `staleAt` is set), set `isStale = true` so widgets can show a subtle stale indicator. `isStale` is the entry-level signal derived from `generatedAt`/`staleAt`; PRD 01 owns the snapshot fields, this PRD owns the per-entry flag.

### US-005: Relevance & configuration plumbing
**Description:** As a developer, I want the provider ready for per-widget city selection (PRD 06).

**Acceptance Criteria:**
- [ ] The provider is structured to accept a `cityId` (default: read the snapshot stored under the `wxai.widget.active` key) so PRD 06 can swap in per-widget configuration with minimal change.
- [ ] `TimelineEntryRelevance` is set from condition severity (e.g. storm/precip rank higher) for Smart Stack rotation. **Verify:** unit-test the severity→relevance mapping over all 8 conditions.

## Functional Requirements

- FR-1: A single `TimelineProvider` + `WeatherEntry` MUST serve all widget families.
- FR-2: The provider MUST build a forward-projected 6-entry timeline (current hour + next 5, ~5h horizon) from the snapshot's `hourly`, stamping each entry from the per-hour `ts` + snapshot `tzOffsetMinutes`, so the widget advances without reloads.
- FR-3: The reload policy MUST use `.after(date)` at the projection horizon (last entry's date) and MUST NOT rely on an assumed fixed daily reload budget.
- FR-4: The provider MUST fall back to a direct keyless Open-Meteo fetch when the staleness gate trips (missing snapshot, or `now - generatedAt > 3h`, or `staleAt` set and `now - staleAt > 3h`), reading coordinates from the enriched index; my-location MUST skip the fetch and use the last snapshot.
- FR-5: The provider MUST never return zero entries and MUST never crash on missing/corrupt/never-written data (degrade to fallback fetch, last snapshot, empty state, or placeholder).
- FR-6: All network/decoding work MUST complete within the extension's execution and memory constraints: a single bounded request with an 8–10s timeout, nested before `completion(timeline)`, with a minimal payload.
- FR-7: The provider MUST accept a `cityId` parameter to support PRD 06 configuration, defaulting to the `wxai.widget.active` snapshot.
- FR-8: The provider MUST port `wmoInfo` into Swift (the TS function is **module-private and not exported**, so it is transcribed, not imported) and MUST reproduce its night rule and code bands exactly (see Technical Considerations).

## Non-Goals (Out of Scope)

- Per-widget city selection UI (PRD 06; this PRD only makes the provider parameterizable).
- AppIntent interactive refresh button (separate; see Open Questions).
- APNs push-driven updates (future, iOS 26+).
- Caching the fallback fetch beyond what the snapshot already provides.
- Per-city full snapshots for non-active cities beyond what the on-demand fallback fetch provides (see PRD 01 / PRD 06; the app only writes a full snapshot for the **active** city).

## Design Considerations

- Prefer the app-pushed active-city snapshot; only fetch directly when the staleness gate trips, to conserve the widget's network/CPU/memory budget.
- Keep the fallback fetch payload minimal (current + 6 hourly + today hi/lo) — the widget doesn't need 10 days.
- Derive all glyph/gradient/night decisions from the projected `cond`; do not introduce a parallel `isNight` axis that could drift from `cond`.

## Technical Considerations

- **`getTimeline` is synchronous.** It hands back results via `completion(_:)`. Any async fetch MUST resolve inside a nested `URLSession` completion handler that then calls `completion(timeline)`; the configuration's `timeoutIntervalForRequest` (8–10s) guarantees the closure completes even on a dead network. The iOS 17 `AppIntentTimelineProvider` offers a native `async` form but raises the floor to iOS 17 and must be `#available`-gated against the 16.4 suite floor.
- **Porting `wmoInfo` (module-private in `src/data/weatherApi.ts`).** Transcribe the code bands exactly: `code <= 1 → clear`; `code == 2 → partly`; `code == 3 → cloud`; `code == 45 || 48 → fog`; `(51–57) || (61–67) || (80–82) → rain`; `(71–77) || 85 || 86 → snow`; `code >= 95 → storm`; otherwise `cloud`. Then apply the night rule **last**: `if !isDay && code <= 3 { cond = night }` — i.e. only clear/partly/cloud/overcast flip to the night glyph; fog/rain/snow/storm keep their day condition. The label strings (e.g. "Sunny" vs "Clear", "Drizzle"/"Rain"/"Showers") should match the source for any text the widget surfaces.
- **Reloads are *requests*.** The system may defer or coalesce them; the forward projection is what keeps the widget feeling live between actual reloads — it is essential, not optional. `.after(date)` requests (does not guarantee) a new timeline after `date`.
- **Staleness signals.** `generatedAt` is when the snapshot was produced; `staleAt` (PRD 01) is set only on the stale-fallback write path. The fetch gate is `now - generatedAt > 3h` OR (`staleAt` set AND `now - staleAt > 3h`). The per-entry `isStale` flag is derived from those, and drives the in-widget stale indicator.
- **Open-Meteo is free/keyless** — safe to call from the extension with no secret management. Extensions may issue `URLSession` requests without a dedicated network entitlement (see PRD 00 FR-7).

## Success Metrics

- Widget shows the correct current hour's temp/condition at any time of day from a single timeline (verified by scrubbing the Xcode timeline preview across all 6 entries).
- With the app closed > 3h, the widget self-refreshes to current data on its next reload (verified in the iOS Simulator by aging `generatedAt` in a seeded snapshot and triggering a reload).
- No crashes across: no snapshot, never-opened (no `wxai.widget.active`), corrupt snapshot, network down, future `schemaVersion` (verified via Swift `WidgetSnapshot` decode round-trip unit tests + Simulator runs).

## Open Questions

- Staleness threshold for triggering a direct fetch — proposed 3h; tune after Simulator testing.
- Should the fallback fetch also run opportunistically even when a fresh snapshot exists (to validate)? Default: no, to conserve budget.
- Interactive refresh via `AppIntent` (iOS 17+) — track as a separate stretch PRD only after the base widgets ship and the capability is verified against the apple-targets/SDK 56 project wiring (the WidgetKit APIs themselves are stable; the unknown is the generated project linking AppIntents and round-tripping config).
