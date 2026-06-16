# PRD 06b: Per-Widget City Configuration (iOS 17+)

## Introduction/Overview

A user with several cities should be able to pin a **specific** city to each widget via the system's "Edit Widget" flow, instead of every widget mirroring the active city. This PRD delivers that with a `WidgetConfigurationIntent` (`SelectCityIntent`) whose city options come from the enriched `wxai.widget.index`.

This is a **fast-follow** to **PRD 06a** (deep linking). It is **iOS 17+ only**: `AppIntentConfiguration` / `WidgetConfigurationIntent` / `AppIntentTimelineProvider` are iOS 17 APIs, and the suite-wide deployment floor is **iOS 16.4** (PRD 00 FR-5). iOS 16 devices stay on the **active-city** path shipped in 06a — no static-intent fallback is built.

This PRD is **gated on the early spike** in **PRD 06a US-001**, which proves the apple-targets/SDK-56-generated widget extension links `WidgetKit`/`AppIntents` and round-trips the scheme. The uncertainty was always the **generated-project wiring**, not the (stable) WidgetKit/AppIntents API. Do **not** start 06b until that spike passes.

Depends on: **PRD 06a** (deep linking + the spike that unblocks this), **PRD 01** (enriched `wxai.widget.index` entries `{id, name, lat, lon}` + per-city snapshot keys + on-demand fetch coordinates), **PRD 03** (the timeline provider this PRD upgrades to `AppIntentTimelineProvider`), **PRD 04/05** (the configurable widget views).

## Goals

1. Let users pick which city each widget instance shows via long-press → "Edit Widget", with selection persisting per instance.
2. Source the picker options from the enriched `wxai.widget.index` so options stay in sync with the app's cities.
3. Render a configured city even when its full snapshot was never pushed (non-active cities), via an on-demand fetch using the index `lat`/`lon`.
4. Keep iOS 16 devices working unchanged on the active-city path; gate all iOS 17-only APIs behind `#available(iOS 17, *)`.

## User Stories

### US-001: SelectCityIntent — configurable city parameter
**Description:** As a user with several cities, I want to choose which city each widget shows.

**Acceptance Criteria:**
- [ ] A `WidgetConfigurationIntent` named `SelectCityIntent` exposes a single **city** parameter whose options are sourced from the `wxai.widget.index` written by PRD 01 (each entry `{id, name, lat, lon}`).
- [ ] Option **display names** use the human-readable `name` from the index; option **values** carry the `id` (and `lat`/`lon` for fetch fallback). Raw `cityId`s are never shown to the user.
- [ ] The default selection (no city configured) resolves to the snapshot stored under the `wxai.widget.active` **key**.
- [ ] All `AppIntentConfiguration` / `WidgetConfigurationIntent` code is `#available(iOS 17, *)`-gated; on iOS 16 the widget stays on the active-city path (06a) with no configuration UI.
- [ ] The intent option provider reads the App Group index; the widget extension already carries the App Group `group.com.myweatherai.app` entitlement (PRD 00). Compiles against the iOS 17 SDK.

### US-002: AppIntentTimelineProvider reads the selected city
**Description:** As a developer, I want the timeline provider to render the configured city per instance.

**Acceptance Criteria:**
- [ ] The provider is upgraded to `AppIntentTimelineProvider` (iOS 17) reading the selected `cityId` from the `SelectCityIntent`.
- [ ] When the intent has no city configured, the provider reads the snapshot under the `wxai.widget.active` key (default path).
- [ ] When a city is configured, the provider reads `wxai.widget.snapshot.<cityId>` (un-encoded id as the key suffix, per PRD 06a US-006).
- [ ] Selection **persists per widget instance** across reloads (handled by WidgetKit's per-instance configuration storage).
- [ ] Verified in the **iOS Simulator** (iOS 17+): two instances of the Small widget configured to two different cities render those two cities simultaneously.

### US-003: On-demand fallback fetch for configured non-active cities
**Description:** As a user, I want a city I pinned to render even though the app only ever pushes the *active* city's full snapshot.

**Context:** Per the PRD 01 scope decision, the app writes a **full** snapshot only for the **active** city (`saveWx`, App.tsx:166). Other cities have at most `CityCurrent {temp, cond, label, humidity}` from the batch `fetchCitiesCurrent` path — not a full snapshot. So for any configured **non-active** city, an on-demand fetch is the **primary** path, not an exception.

**Acceptance Criteria:**
- [ ] When the configured city's `wxai.widget.snapshot.<cityId>` is **missing** (or older than the PRD 03 staleness threshold), the provider performs an on-demand fetch using the `lat`/`lon` read from the `wxai.widget.index` entry for that id.
- [ ] The fetch follows the PRD 03 concurrency model (classic completion-handler nesting with an explicit request timeout, or the iOS 17 async `AppIntentTimelineProvider` variant) and falls back deterministically to any prior snapshot on timeout/error rather than blanking.
- [ ] For `my-location` (`MY_LOCATION_ID`): the id string carries **no** coords, so the provider does **not** attempt a coordinate fetch — it uses the last `wxai.widget.active`/`my-location` snapshot instead.
- [ ] This on-demand path is documented as the **primary** way non-active configured cities are rendered (cross-referenced from PRD 01 and PRD 03 US-004).

### US-004: Keep the city index fresh; bound option-refresh latency
**Description:** As a user, I want newly added cities to appear in the widget's city picker, and removed cities to disappear.

**Acceptance Criteria:**
- [ ] Confirm PRD 01's `wxai.widget.index` updates when cities are added in-app (and pruned on `removeCity`, App.tsx:243, for custom cities).
- [ ] After adding a city in-app, the new city appears in the widget "Edit Widget" options. **Latency is best-effort:** iOS caches `WidgetConfigurationIntent` option lists and provides **no** public force-refresh API; the new option typically appears after a `WidgetCenter.reloadAllTimelines()` and/or after backgrounding/reopening the widget editor. This is **non-blocking** and documented as a known limitation, not a bug.
- [ ] Removing a custom city in-app removes it from options; any widget instance pinned to the removed city falls back to the active city (its snapshot key no longer exists, so the provider resolves to `wxai.widget.active`).

## Functional Requirements

- FR-1: System widgets MUST support per-instance city selection via a `SelectCityIntent` (`WidgetConfigurationIntent`) sourcing options from `wxai.widget.index`.
- FR-2: The provider MUST be an `AppIntentTimelineProvider` reading the selected `cityId`, defaulting to the `wxai.widget.active` key when unset.
- FR-3: A configured city whose snapshot is missing/stale MUST be rendered via an on-demand fetch using `lat`/`lon` from the index; `my-location` MUST use the last snapshot instead of fetching.
- FR-4: All configuration APIs MUST be `#available(iOS 17, *)`-gated; iOS 16 devices MUST remain on the 06a active-city path with no configuration UI.
- FR-5: Option-list freshness MUST be treated as best-effort (no force-refresh API); the index itself MUST stay in sync with in-app add/remove.

## Non-Goals (Out of Scope)

- iOS 16 configuration support / a static-intent fallback — iOS 16 stays on active-city (06a).
- Deep linking and `widgetURL` — delivered in **PRD 06a**.
- Configuration options beyond city (e.g. per-widget units) — widgets follow the app's global unit.
- Interactive (button) widgets via `AppIntent` *actions* — tracked separately.
- A force-refresh of the system's cached intent option list — no public API exists; best-effort only.

## Design Considerations

- The "Edit Widget" city list MUST show human-readable names (`name`, optionally `admin1`) from the index, not raw `cityId`s.
- A configured city that briefly lacks a snapshot should show a sensible loading/last-known state during the on-demand fetch, not a blank widget.

## Technical Considerations

- `AppIntentConfiguration`, `WidgetConfigurationIntent`, and `AppIntentTimelineProvider` are **iOS 17+**. The suite floor is **16.4** (PRD 00 FR-5), so every use MUST be `#available(iOS 17, *)`-gated; iOS 16 falls back to the 06a active-city configuration.
- This PRD is gated on **PRD 06a US-001** proving the apple-targets extension links `AppIntents`/`WidgetKit` under SDK 56 and the generated `Info.plist` is correctly wired.
- The intent option provider reads the App Group index (`group.com.myweatherai.app`); the widget extension already holds that entitlement from PRD 00.
- On-demand fetch needs the enriched index entry shape `{id, name, lat, lon}` from PRD 01 — FR-3 is unimplementable without `lat`/`lon` in the index. `my-location` is the documented exception (no coords in id).
- The configured `cityId` is the un-encoded form (`lat.toFixed(3),lon.toFixed(3)` or `my-location`) used directly as the `wxai.widget.snapshot.<cityId>` UserDefaults key suffix; URL percent-encoding (PRD 06a US-006) applies only to `widgetURL`.
- Index pruning hooks `removeCity` (App.tsx:243), scoped to custom cities (presets and My Location cannot be removed).

## Success Metrics

- A user can pin two different cities to two widget instances on iOS 17+ and both render correctly, verified in the iOS Simulator.
- A configured non-active city (no pushed snapshot) renders via the on-demand fetch from the index `lat`/`lon`.
- Newly added in-app cities become selectable in the widget editor (best-effort latency); removed cities disappear and their pinned widgets fall back to active-city.
- iOS 16 devices continue to work on the active-city path with no configuration UI and no crash.

## Open Questions

- None blocking. Intent-option refresh latency is accepted as best-effort (no public force-refresh API). If the 06a spike reveals an `AppIntents` linking gap in the generated project, this PRD's scope is reassessed before work begins.
