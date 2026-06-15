// ---------------------------------------------------------------------------
// SelectCityIntent.swift — per-widget city configuration (PRD 06b, iOS 17+).
//
// COUNTERPART: src/widgets/snapshot.ts writes `wxai.widget.index` (the
// `{id, name, lat, lon}` entries this intent lists) and the per-id snapshot
// keys this provider reads. Home views: targets/widgets/Widgets/* (PRD 04).
//
// FAST-FOLLOW, fully gated on `#available(iOS 17, *)`. The suite floor is 16.4
// (PRD 00 FR-5); `AppIntentConfiguration` / `WidgetConfigurationIntent` /
// `AppIntentTimelineProvider` are iOS 17 APIs, so iOS 16 stays on the
// StaticConfiguration active-city path (PRD 06a) with NO configuration UI and
// no static-intent fallback. This whole file compiles only against the iOS 17
// SDK paths and is unreachable on 16.x.
//
// GATED ON THE 06a SPIKE (PRD 06a US-001): only start relying on this once the
// apple-targets / SDK-56 generated extension is confirmed to link `AppIntents`
// (and `WidgetKit`) and the generated Info.plist round-trips the scheme. If the
// spike reveals an AppIntents linking gap, the bundle keeps shipping the 16.4
// StaticConfiguration home widget and this file is excluded.
//
// On-device verification needed (cannot be proven by `tsc`/desk review):
//   • Two Small instances pinned to two different cities render simultaneously.
//   • Newly added in-app cities appear in "Edit Widget" (best-effort latency;
//     iOS caches the option list, no public force-refresh API — PRD 06b US-004).
//   • On-demand fetch for a configured NON-active city (no pushed snapshot)
//     renders via OpenMeteoFetcher using index lat/lon (PRD 06b US-003).
// ---------------------------------------------------------------------------

import WidgetKit
import SwiftUI
import AppIntents

// MARK: - City option entity (iOS 17+)

/// One selectable city in the "Edit Widget" picker. Display name is the
/// human-readable `name` from `wxai.widget.index`; the value carries the
/// un-encoded `id` (used directly as the `wxai.widget.snapshot.<id>` key suffix)
/// plus `lat`/`lon` for the on-demand fetch fallback (PRD 06b US-001/US-003).
@available(iOS 17.0, *)
struct CityEntity: AppEntity {
    let id: String
    let name: String
    let lat: Double
    let lon: Double

    static var typeDisplayRepresentation: TypeDisplayRepresentation { "City" }
    static var defaultQuery = CityQuery()

    var displayRepresentation: DisplayRepresentation {
        // Raw cityIds are never shown — only the readable name (PRD 06b US-001).
        DisplayRepresentation(title: "\(name)")
    }
}

/// Sources city options from the App Group `wxai.widget.index` written by the
/// app (PRD 01). The extension already holds the `group.com.myweatherai.app`
/// entitlement (PRD 00), so the read needs no extra capability.
@available(iOS 17.0, *)
struct CityQuery: EntityQuery {
    /// All cities currently in the index — the "Edit Widget" option list.
    func suggestedEntities() async throws -> [CityEntity] {
        WidgetCityIndex.all().map {
            CityEntity(id: $0.id, name: $0.name, lat: $0.lat, lon: $0.lon)
        }
    }

    /// Resolve previously-selected ids back to entities across reloads. An id no
    /// longer in the index (city removed in-app) drops out, so the provider then
    /// falls back to the active city (PRD 06b US-004).
    func entities(for identifiers: [String]) async throws -> [CityEntity] {
        let index = WidgetCityIndex.all()
        return identifiers.compactMap { id in
            index.first { $0.id == id }.map {
                CityEntity(id: $0.id, name: $0.name, lat: $0.lat, lon: $0.lon)
            }
        }
    }

    /// Default (no city configured) → the active-city snapshot (`wxai.widget.active`).
    /// Returning nil leaves selection empty; the provider treats empty as "active".
    func defaultResult() async -> CityEntity? { nil }
}

// MARK: - Configuration intent (iOS 17+)

/// The single `city` parameter the system surfaces in "Edit Widget". When unset,
/// the provider reads `wxai.widget.active`; when set, it reads
/// `wxai.widget.snapshot.<id>` (or on-demand-fetches by index lat/lon).
@available(iOS 17.0, *)
struct SelectCityIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Select City" }
    static var description: IntentDescription {
        IntentDescription("Choose which city this widget shows.")
    }

    @Parameter(title: "City")
    var city: CityEntity?

    init() {}
    init(city: CityEntity?) { self.city = city }
}

// MARK: - App Group index reader (iOS 17+)

/// Reads the enriched `wxai.widget.index` (`[{id,name,lat,lon}]`, PRD 01) from
/// the shared suite for the intent option provider. Mirrors the private decoder
/// inside WeatherProvider; kept here so the intent file is self-contained.
@available(iOS 17.0, *)
enum WidgetCityIndex {
    private static let suiteName = "group.com.myweatherai.app"
    private static let indexKey = "wxai.widget.index"

    struct Entry: Decodable {
        let id: String
        let name: String
        let lat: Double
        let lon: Double
    }

    static func all() -> [Entry] {
        guard
            let raw = UserDefaults(suiteName: suiteName)?.string(forKey: indexKey),
            let data = raw.data(using: .utf8),
            let entries = try? JSONDecoder().decode([Entry].self, from: data)
        else { return [] }
        return entries
    }
}

// MARK: - AppIntentTimelineProvider (iOS 17+)

/// iOS 17 provider reading the selected `cityId` from `SelectCityIntent`. It
/// delegates ALL timeline construction to the shared classic `WeatherProvider`
/// (PRD 03) by handing it the configured id — so projection, staleness gating,
/// the on-demand OpenMeteo fetch (incl. the my-location no-coords exception),
/// and Smart-Stack relevance all stay in one place (PRD 06b US-002/US-003).
@available(iOS 17.0, *)
struct ConfigurableWeatherProvider: AppIntentTimelineProvider {
    typealias Entry = WeatherEntry
    typealias Intent = SelectCityIntent

    func placeholder(in context: Context) -> WeatherEntry {
        WeatherProvider().placeholder(in: context)
    }

    func snapshot(for configuration: SelectCityIntent, in context: Context) async -> WeatherEntry {
        await withCheckedContinuation { continuation in
            WeatherProvider(cityId: configuration.city?.id).getSnapshot(in: context) { entry in
                continuation.resume(returning: entry)
            }
        }
    }

    func timeline(for configuration: SelectCityIntent, in context: Context) async -> Timeline<WeatherEntry> {
        await withCheckedContinuation { continuation in
            // Configured id (or nil → active). The shared provider resolves the
            // snapshot/fetch and the my-location no-coords exception (PRD 06b US-003).
            WeatherProvider(cityId: configuration.city?.id).getTimeline(in: context) { timeline in
                continuation.resume(returning: timeline)
            }
        }
    }

}

// MARK: - Configurable home widget (iOS 17+)

/// The iOS 17+ `AppIntentConfiguration` variant of the home-screen widget.
/// Same three system families and views as `AIWeatherHomeWidget` (PRD 04) and
/// the same active-city `widgetURL` (06a); it adds the per-instance city picker.
/// `AIWeatherWidgetBundle` selects this over the static widget when iOS 17+ is
/// available (see AIWeatherWidget.swift).
@available(iOS 17.0, *)
struct AIWeatherHomeConfigurableWidget: Widget {
    let kind: String = "AIWeatherHome"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectCityIntent.self,
            provider: ConfigurableWeatherProvider()
        ) { entry in
            HomeWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("AI Weather")
        .description("Current conditions, hourly, and a 5-day forecast. Long-press to pick a city.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
