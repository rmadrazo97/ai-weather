// ---------------------------------------------------------------------------
// AIWeatherWidget.swift — widget definitions + bundle + deep-link wiring.
//
// COUNTERPART: the app-side link handler in App.tsx (RN core `Linking`) that
// receives `aiweather://city/<encodedCityId>` (PRD 06a). The URL scheme itself
// is registered in PRD 00 (app.json `scheme: "aiweather"`); this file only
// consumes it. Views: targets/widgets/Widgets/* (PRD 04/05); provider:
// targets/widgets/Provider/WeatherProvider.swift (PRD 03).
//
// Registers two widgets under bundle id `com.myweatherai.app.widgets`:
//   • AIWeatherHome (StaticConfiguration) — systemSmall/Medium/Large (PRD 04).
//   • AIWeatherLock (StaticConfiguration) — accessoryCircular/Rectangular/
//     Inline (PRD 05).
// Both attach `.widgetURL` deep-linking to the ACTIVE city the entry displays
// (PRD 06a US-005/US-006), with the cityId percent-encoded (the comma in
// `lat,lon` is a reserved URL sub-delimiter; the un-encoded form remains the
// `wxai.widget.snapshot.<cityId>` UserDefaults key suffix).
//
// PRD 06b (per-instance city configuration) is iOS 17+-only and lives in the
// separate, `#available`-gated SelectCityIntent.swift + the AppIntentConfiguration
// variant below. It is a FAST-FOLLOW gated on the PRD 06a US-001 spike (proving
// the apple-targets / SDK-56 extension links WidgetKit/AppIntents and round-trips
// the scheme). The 16.4 build path (StaticConfiguration → active city) is the
// shipping default and stands alone if 06b is deferred.
// ---------------------------------------------------------------------------

import WidgetKit
import SwiftUI

// MARK: - Deep-link URL (PRD 06a US-005 / US-006)

/// Builds the `aiweather://city/<encodedCityId>` deep link for the active city
/// an entry displays. The cityId (`lat.toFixed(3),lon.toFixed(3)` or
/// `my-location`) is percent-encoded so the reserved comma + any leading minus
/// survive the URL round-trip; App.tsx decodes it before resolution. The
/// un-encoded id is used VERBATIM as the `wxai.widget.snapshot.<cityId>` key
/// suffix — encoding applies to the URL only (PRD 06a US-006).
enum WidgetDeepLink {
    static let scheme = "aiweather"

    /// `aiweather://chat` — opens the app straight into the AI chat sheet.
    /// Used by the quick-access chat button on the Medium/Large home widgets
    /// (the only families WidgetKit lets host a tap target beyond the
    /// whole-widget `widgetURL`). App.tsx routes this to `setChatOpen(true)`.
    static var chatURL: URL { URL(string: "\(scheme)://chat")! }

    /// `aiweather://city/<encoded>` for the entry's city, or nil for the
    /// no-data / empty-state entry (nothing meaningful to route to — a plain
    /// app launch to the active city is the documented fallback there).
    static func url(for entry: WeatherEntry) -> URL? {
        guard !entry.isEmptyState else { return nil }
        return url(forCityId: entry.snapshot.city.id)
    }

    static func url(forCityId cityId: String) -> URL? {
        // `.urlPathAllowed` does NOT escape the comma (it's a path sub-delim),
        // so use an explicit allowed set that excludes the reserved characters
        // we must encode (comma, and to be safe the sub-delimiters). Letters,
        // digits, `.`, `-`, `_` survive; everything else is percent-encoded.
        let allowed = CharacterSet(charactersIn:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.-_")
        let encoded = cityId.addingPercentEncoding(withAllowedCharacters: allowed) ?? cityId
        return URL(string: "\(scheme)://city/\(encoded)")
    }
}

// MARK: - Home-screen widget (PRD 04, iOS 16.4 floor)

/// systemSmall/Medium/Large over the shared `WeatherProvider`. StaticConfiguration
/// is the 16.4 shipping path; per-instance city selection (06b) is the iOS 17+
/// AppIntentConfiguration variant below, gated on the 06a spike.
struct AIWeatherHomeWidget: Widget {
    let kind: String = "AIWeatherHome"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherProvider()) { entry in
            HomeWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("AI Weather")
        .description("Current conditions, air quality, key metrics, and the hourly outlook for your city.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

/// Routes a home entry to the correct family view by the environment's
/// `widgetFamily`, and attaches the active-city deep link to every family
/// (PRD 06a US-005). A view-level switch keeps the three PRD 04 structs pristine.
struct HomeWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: WeatherEntry

    var body: some View {
        familyView
            .widgetURL(WidgetDeepLink.url(for: entry))
    }

    @ViewBuilder
    private var familyView: some View {
        switch family {
        case .systemSmall:  SmallWidgetView(entry: entry)
        case .systemMedium: MediumWidgetView(entry: entry)
        case .systemLarge:  LargeWidgetView(entry: entry)
        default:            SmallWidgetView(entry: entry) // defensive fallback
        }
    }
}

// MARK: - Lock-screen widget (PRD 05, iOS 16+)

/// accessoryCircular/Rectangular/Inline over the same `WeatherProvider`. A
/// single dedicated accessory widget (documented choice, PRD 05 US-004) keeps
/// the lock-screen families grouped separately in the editor from the
/// home-screen families. Accessory widgets support one whole-widget tap target,
/// so the active-city `widgetURL` attaches here too (PRD 06a US-005).
struct AIWeatherLockWidget: Widget {
    let kind: String = "AIWeatherLock"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WeatherProvider()) { entry in
            LockWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("AI Weather")
        .description("Temperature and conditions on your lock screen.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

/// Routes a lock-screen entry to the correct accessory view and attaches the
/// active-city deep link (accessory families take a single whole-widget tap).
struct LockWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: WeatherEntry

    var body: some View {
        familyView
            .widgetURL(WidgetDeepLink.url(for: entry))
    }

    @ViewBuilder
    private var familyView: some View {
        switch family {
        case .accessoryCircular:    CircularWidgetView(entry: entry)
        case .accessoryRectangular: RectangularWidgetView(entry: entry)
        case .accessoryInline:      InlineWidgetView(entry: entry)
        default:                    InlineWidgetView(entry: entry) // defensive fallback
        }
    }
}

// MARK: - Bundle

/// The widget bundle exposed under `com.myweatherai.app.widgets`. The
/// StaticConfiguration active-city home widget (PRD 04) ships on ALL supported
/// versions (16.4 floor). On iOS 17+ the configurable (`AppIntentConfiguration`)
/// home widget (PRD 06b) is ALSO bundled, so both appear in the gallery there
/// with distinct kinds — "AI Weather" (active city) and "AI Weather (Choose
/// City)" (per-instance selection). iOS 16 sees only the static one (no
/// configuration UI). The lock-screen widget is StaticConfiguration on all
/// versions (06b targets system families only). See SelectCityIntent.swift for
/// the gated 06b code.
@main
struct AIWeatherWidgetBundle: WidgetBundle {
    var body: some Widget {
        // PRD 04: active-city home widget (StaticConfiguration), all supported versions.
        AIWeatherHomeWidget()
        // PRD 05: lock-screen accessory families.
        AIWeatherLockWidget()
        // PRD 06b (iOS 17+): per-instance city selection via the configurable
        // home widget (kind "AIWeatherHomeConfigurable", distinct from the static
        // "AIWeatherHome"). Single-branch `#available` only — `WidgetBundleBuilder`
        // has no `buildEither`, so an if/else here would be a compile error.
        if #available(iOS 17.0, *) {
            AIWeatherHomeConfigurableWidget()
        }
    }
}
