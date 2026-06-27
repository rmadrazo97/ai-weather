// ---------------------------------------------------------------------------
// SnapshotStore.swift — shared-container loader (Swift reader side)
//
// COUNTERPART: src/widgets/snapshot.ts (TypeScript writer).
// Reads the JSON snapshot the RN app wrote into the App Group's shared
// UserDefaults suite `group.com.myweatherai.app`. Keys match the TS WIDGET_KEYS
// contract byte-for-byte. See PRD 01 (shared data bridge).
//
// Loading is tolerant: a missing suite, missing key, or malformed JSON all
// resolve to `nil` (never a crash). The `placeholder` constant backs previews
// and the "Open AI Weather to set up" no-data state.
// ---------------------------------------------------------------------------

import Foundation

enum SnapshotStore {

    /// App Group suite shared between the RN app and the widget extension.
    static let suiteName = "group.com.myweatherai.app"

    // Shared key contract — keep byte-consistent with src/widgets/snapshot.ts.
    private static let activeKey = "wxai.widget.active"
    private static let snapshotPrefix = "wxai.widget.snapshot."

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    /// Load a snapshot. `cityId == nil` → the active-pointer key; otherwise the
    /// per-id key. Returns `nil` on suite/key miss or parse failure.
    static func load(cityId: String?) -> WidgetSnapshot? {
        let key = cityId.map { snapshotPrefix + $0 } ?? activeKey
        guard
            let defaults = defaults,
            let raw = defaults.string(forKey: key),
            let data = raw.data(using: .utf8)
        else {
            return nil
        }
        let decoder = JSONDecoder()
        return try? decoder.decode(WidgetSnapshot.self, from: data)
    }

    /// Convenience reader for the active-city snapshot.
    static func loadActive() -> WidgetSnapshot? {
        load(cityId: nil)
    }

    // MARK: - Placeholder

    /// Bundled snapshot for SwiftUI previews and the "no data yet" fallback.
    static let placeholder = WidgetSnapshot(
        schemaVersion: 1,
        generatedAt: 0,
        tzOffsetMinutes: 0,
        unit: "C",
        staleAt: nil,
        city: .init(
            id: "40.417,-3.704",
            name: "Madrid",
            lat: 40.4168,
            lon: -3.7038,
            admin1: nil,
            country: "Spain",
            isCurrentLocation: false
        ),
        current: .init(
            temp: 24,
            feels: 23,
            hi: 28,
            lo: 16,
            cond: .partly,
            label: "Partly cloudy",
            isNight: false,
            humidity: 38,
            wind: 12,
            precipProb: 10,
            uv: 6,
            aqi: 32,
            aqiWord: "Good",
            dir: "NW",
            uvWord: "High",
            dew: 11
        ),
        headline: .init(
            pre: "A ",
            em: "mild",
            post: " afternoon ahead."
        ),
        summary: "Partly cloudy with comfortable temperatures. Light winds through the evening.",
        sun: .init(
            sunrise: "6:44",
            sunset: "21:48",
            srHour: 6.73,
            ssHour: 21.8,
            sunPct: 0.42,
            isNight: false
        ),
        hourly: [
            .init(h: "Now", cond: .partly, temp: 24, pop: 10, ts: 0),
            .init(h: "3PM", cond: .clear, temp: 26, pop: 5, ts: 0),
            .init(h: "4PM", cond: .clear, temp: 27, pop: 5, ts: 0),
            .init(h: "5PM", cond: .partly, temp: 26, pop: 10, ts: 0),
            .init(h: "6PM", cond: .cloud, temp: 24, pop: 20, ts: 0),
            .init(h: "7PM", cond: .cloud, temp: 22, pop: 20, ts: 0)
        ],
        days: [
            .init(label: "Today", cond: .partly, lo: 16, hi: 28, pop: 10),
            .init(label: "Sat", cond: .clear, lo: 17, hi: 30, pop: 5),
            .init(label: "Sun", cond: .rain, lo: 15, hi: 24, pop: 70),
            .init(label: "Mon", cond: .cloud, lo: 14, hi: 23, pop: 30),
            .init(label: "Tue", cond: .clear, lo: 16, hi: 27, pop: 10)
        ]
    )
}
