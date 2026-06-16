// ---------------------------------------------------------------------------
// WeatherProvider.swift — the shared classic TimelineProvider for all families.
//
// COUNTERPART: src/widgets/snapshot.ts (writer) → SnapshotStore.swift (reader).
// PRD 03 (Timeline Provider & Refresh Strategy).
//
// Responsibilities:
//  • placeholder/getSnapshot/getTimeline for every widget family (US-001).
//  • Forward-projected 6-entry timeline from cached `hourly` so the displayed
//    hour/temp advances WITHOUT a reload (US-002). Each entry is stamped from
//    the per-hour `ts` (epoch ms) — never from the display label `h`.
//  • `.after(lastEntryDate)` reload policy at the projection horizon (US-003).
//    NOTE: `.after` REQUESTS (does not guarantee) a reload; the system may
//    defer/coalesce it. The app-side reloadAllTimelines() (PRD 01) is the
//    primary freshness path; this is the backstop. iOS 26+ APNs widget push is
//    a future enhancement, out of scope here.
//  • Direct keyless Open-Meteo fallback when the snapshot is missing/stale
//    (OpenMeteoFetcher, US-004). Coordinates come from the enriched index or
//    snapshot.city — never parsed from the cityId string. my-location skips the
//    network fetch and uses its last snapshot.
//  • TimelineEntryRelevance from condition severity for Smart-Stack (US-005).
//  • Accepts an optional `cityId` (default → active) for PRD 06 configuration.
//
// `getTimeline` is SYNCHRONOUS: any network work nests inside the URLSession
// completion and calls `completion(timeline)` from there (US-004 concurrency).
// ---------------------------------------------------------------------------

import WidgetKit
import Foundation

struct WeatherProvider: TimelineProvider {

    /// Per-widget city id. `nil` → resolve the active city: `SnapshotStore` reads
    /// the snapshot stored under `wxai.widget.active` (the bare active id lives at
    /// `wxai.widget.activeId`). PRD 06 swaps a configured id in here, no other change.
    let cityId: String?

    init(cityId: String? = nil) {
        self.cityId = cityId
    }

    // MARK: - TimelineProvider

    func placeholder(in context: Context) -> WeatherEntry {
        // Gallery/redacted placeholder: bundled sample, no I/O (US-001).
        WeatherProvider.entry(
            from: SnapshotStore.placeholder,
            at: Date(),
            isStale: false
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        let snapshot = SnapshotStore.load(cityId: cityId) ?? SnapshotStore.placeholder
        let stale = WeatherProvider.isSnapshotStale(snapshot)
        completion(WeatherProvider.entry(from: snapshot, at: Date(), isStale: stale))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        let now = Date()
        let loaded = SnapshotStore.load(cityId: cityId)

        // Staleness gate (US-004): missing snapshot, or now-generatedAt>3h, or
        // (staleAt set AND now-staleAt>3h). When tripped, try a bounded fetch.
        let needsFetch: Bool = {
            guard let snap = loaded else { return true }
            return WeatherProvider.gateTrips(snap, now: now)
        }()

        guard needsFetch, let coords = WeatherProvider.coordinates(for: cityId, snapshot: loaded) else {
            // Either fresh enough, or no resolvable coordinates (my-location with
            // no coords, or never-opened). Build from what we have.
            WeatherProvider.completeFromSnapshot(loaded, now: now, completion: completion)
            return
        }

        // Bounded fallback fetch. The URLSession completion nests the
        // completion(timeline) call so the synchronous getTimeline always
        // resolves — even on a dead network (timeoutIntervalForRequest).
        OpenMeteoFetcher.fetch(lat: coords.lat, lon: coords.lon) { fetched in
            if let fetched = fetched {
                let timeline = WeatherProvider.buildTimeline(from: fetched, now: now, isStale: false)
                completion(timeline)
            } else {
                // Network/decoding failure → last snapshot (even stale) → placeholder.
                WeatherProvider.completeFromSnapshot(loaded, now: now, completion: completion)
            }
        }
    }

    // MARK: - Snapshot → timeline

    /// Build the timeline from a loaded snapshot (or placeholder when nil),
    /// flagging staleness off the snapshot's own generatedAt/staleAt.
    private static func completeFromSnapshot(
        _ snapshot: WidgetSnapshot?,
        now: Date,
        completion: @escaping (Timeline<WeatherEntry>) -> Void
    ) {
        let snap = snapshot ?? SnapshotStore.placeholder
        let stale = isSnapshotStale(snap) || snapshot == nil
        completion(buildTimeline(from: snap, now: now, isStale: stale))
    }

    /// Forward-project up to 6 entries (current hour + next 5, ~5h horizon) from
    /// the snapshot's `hourly`. Each entry advances current.temp/cond/pop to that
    /// hour and carries an entry-relative hourly slice so a view never mislabels
    /// a past hour as "Now". Reload policy: `.after` the last entry's date.
    static func buildTimeline(
        from snapshot: WidgetSnapshot,
        now: Date,
        isStale: Bool
    ) -> Timeline<WeatherEntry> {
        let hourly = snapshot.hourly

        // Fall back to a single "now" entry if hourly is empty/short (US-002).
        guard hourly.count >= 2 else {
            let entry = entry(from: snapshot, at: now, isStale: isStale)
            // Backstop reload ~1h out when we couldn't project a horizon.
            let next = now.addingTimeInterval(60 * 60)
            return Timeline(entries: [entry], policy: .after(next))
        }

        var entries: [WeatherEntry] = []
        let count = min(hourly.count, 6)

        for i in 0..<count {
            let point = hourly[i]
            // Each entry's date is the hour's machine-readable ts (epoch ms).
            // hourly[0] is "Now" → use `now` so the first entry is current even
            // if the snapshot's ts drifted slightly past the clock.
            let date = (i == 0) ? now : Date(timeIntervalSince1970: point.ts / 1000)

            // Advance current to this projected hour. cond already encodes night.
            var current = snapshot.current
            current = WidgetSnapshot.CurrentConditions(
                temp: point.temp,
                feels: current.feels,
                hi: current.hi,
                lo: current.lo,
                cond: point.cond,
                label: current.label,
                isNight: current.isNight,
                humidity: current.humidity,
                wind: current.wind,
                precipProb: point.pop,
                uv: current.uv,
                aqi: current.aqi,
                aqiWord: current.aqiWord
            )

            // Entry-relative hourly slice: drop the hours already behind this
            // entry so the strip's first column ("Now") matches `date`.
            let slice = Array(hourly[i...])

            let projected = WidgetSnapshot(
                schemaVersion: snapshot.schemaVersion,
                generatedAt: snapshot.generatedAt,
                tzOffsetMinutes: snapshot.tzOffsetMinutes,
                unit: snapshot.unit,
                staleAt: snapshot.staleAt,
                city: snapshot.city,
                current: current,
                headline: snapshot.headline,
                summary: snapshot.summary,
                sun: snapshot.sun,
                hourly: slice,
                days: snapshot.days
            )

            entries.append(
                WeatherEntry(
                    date: date,
                    snapshot: projected,
                    isStale: isStale,
                    relevance: relevance(for: point.cond)
                )
            )
        }

        // Guarantee strictly-increasing dates (defend against equal/inverted ts).
        var lastDate = entries[0].date
        for i in 1..<entries.count {
            if entries[i].date <= lastDate {
                let bumped = lastDate.addingTimeInterval(60 * 60)
                entries[i] = WeatherEntry(
                    date: bumped,
                    snapshot: entries[i].snapshot,
                    isStale: entries[i].isStale,
                    relevance: entries[i].relevance
                )
            }
            lastDate = entries[i].date
        }

        // Reload at the projection horizon — the last entry's date (~5h out).
        return Timeline(entries: entries, policy: .after(lastDate))
    }

    /// Build a single entry rendering `snapshot` as-is at `date`.
    static func entry(
        from snapshot: WidgetSnapshot,
        at date: Date,
        isStale: Bool
    ) -> WeatherEntry {
        WeatherEntry(
            date: date,
            snapshot: snapshot,
            isStale: isStale,
            relevance: relevance(for: snapshot.current.cond)
        )
    }

    // MARK: - Coordinates

    /// Resolve lat/lon for `cityId` from the enriched index or the snapshot's
    /// own `city`. NEVER parses coordinates out of the id string. Returns nil
    /// for my-location (no coords) so the caller skips the network fetch.
    static func coordinates(for cityId: String?, snapshot: WidgetSnapshot?) -> (lat: Double, lon: Double)? {
        // my-location id carries no coordinates and may be stale → skip fetch.
        if let id = cityId, id == myLocationId { return nil }
        if let snap = snapshot, snap.city.id == myLocationId { return nil }

        // Prefer the enriched index entry for the requested id.
        if let id = cityId, let entry = indexEntry(for: id) {
            return (entry.lat, entry.lon)
        }
        // Active path (cityId == nil): fall back to the snapshot's own city.
        if let snap = snapshot {
            return (snap.city.lat, snap.city.lon)
        }
        // No snapshot: try the active id's index entry if one exists.
        if cityId == nil, let activeId = activeCityId(), let entry = indexEntry(for: activeId) {
            return (entry.lat, entry.lon)
        }
        return nil
    }

    // MARK: - Staleness

    /// 3h gate threshold (PRD 03 / Open Question — tune after Simulator testing).
    static let staleThreshold: TimeInterval = 3 * 60 * 60

    /// Fetch gate: now - generatedAt > 3h, OR (staleAt set AND now - staleAt > 3h).
    static func gateTrips(_ snapshot: WidgetSnapshot, now: Date) -> Bool {
        let nowMs = now.timeIntervalSince1970 * 1000
        if (nowMs - snapshot.generatedAt) > staleThreshold * 1000 { return true }
        if let staleAt = snapshot.staleAt, (nowMs - staleAt) > staleThreshold * 1000 { return true }
        return false
    }

    /// Per-entry stale flag: data older than the gate, or a stale-fallback write.
    static func isSnapshotStale(_ snapshot: WidgetSnapshot) -> Bool {
        if snapshot.staleAt != nil { return true }
        let nowMs = Date().timeIntervalSince1970 * 1000
        return (nowMs - snapshot.generatedAt) > staleThreshold * 1000
    }

    // MARK: - Relevance (Smart Stack)

    /// Map condition severity → Smart-Stack relevance. Hazardous/active weather
    /// ranks higher so the system surfaces it. Unit-testable over all 8 cases.
    static func relevance(for cond: Condition) -> TimelineEntryRelevance {
        let score: Float
        switch cond {
        case .storm: score = 100
        case .snow:  score = 80
        case .rain:  score = 70
        case .fog:   score = 50
        case .cloud: score = 25
        case .partly: score = 20
        case .clear: score = 15
        case .night: score = 10
        }
        return TimelineEntryRelevance(score: score)
    }

    // MARK: - Shared-container readers

    private static let suiteName = "group.com.myweatherai.app"
    private static let indexKey = "wxai.widget.index"
    private static let activeIdKey = "wxai.widget.activeId"
    private static let myLocationId = "my-location"

    private static var defaults: UserDefaults? { UserDefaults(suiteName: suiteName) }

    /// Enriched index entry shape `{ id, name, lat, lon }` (PRD 01).
    private struct IndexEntry: Decodable {
        let id: String
        let name: String
        let lat: Double
        let lon: Double
    }

    private static func indexEntry(for id: String) -> IndexEntry? {
        guard
            let raw = defaults?.string(forKey: indexKey),
            let data = raw.data(using: .utf8),
            let entries = try? JSONDecoder().decode([IndexEntry].self, from: data)
        else { return nil }
        return entries.first { $0.id == id }
    }

    private static func activeCityId() -> String? {
        defaults?.string(forKey: activeIdKey)
    }
}
