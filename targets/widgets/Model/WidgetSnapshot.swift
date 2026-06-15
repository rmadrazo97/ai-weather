// ---------------------------------------------------------------------------
// WidgetSnapshot.swift — shared contract (Swift Codable reader side)
//
// COUNTERPART: src/widgets/snapshot.ts (TypeScript writer).
// JSON keys decoded here MUST match the TS field names byte-for-byte. If you
// rename/add a field, change BOTH files. See PRD 01 (shared data bridge).
//
// All temperatures are °C integers; `unit` drives render-time conversion.
// Decoding is tolerant: missing optionals are fine, unknown Condition strings
// fall back to `.cloud`, and a future-greater `schemaVersion` still decodes.
// ---------------------------------------------------------------------------

import Foundation

// MARK: - Condition

/// The 8-value condition set (mirrors src/data/weatherData.ts `Condition`).
/// Unknown / future strings decode to `.cloud` rather than throwing.
enum Condition: String, Codable, CaseIterable {
    case clear
    case partly
    case cloud
    case rain
    case snow
    case fog
    case storm
    case night

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Condition(rawValue: raw) ?? .cloud
    }
}

// MARK: - WidgetSnapshot

struct WidgetSnapshot: Codable {
    let schemaVersion: Int
    let generatedAt: Double      // epoch ms
    let tzOffsetMinutes: Int     // source-city UTC offset
    let unit: String             // "C" | "F"
    let staleAt: Double?         // epoch ms of source cache when stale fallback
    let city: CityRef
    let current: CurrentConditions
    let headline: HeadlineParts
    let summary: String
    let sun: SunInfo
    let hourly: [HourlyPoint]    // next 6
    let days: [DayForecast]      // next 5

    struct CityRef: Codable {
        let id: String
        let name: String
        let lat: Double
        let lon: Double
        let admin1: String?
        let country: String?
        let isCurrentLocation: Bool?
    }

    struct CurrentConditions: Codable {
        let temp: Int            // °C
        let feels: Int           // °C
        let hi: Int              // °C (hi >= lo)
        let lo: Int              // °C
        let cond: Condition
        let label: String
        let isNight: Bool
        let humidity: Int        // %
        let wind: Int            // km/h
        let precipProb: Int      // %  (NOT precipMm)
        let uv: Int
        let aqi: Int?
        let aqiWord: String?
    }

    struct HeadlineParts: Codable {
        let pre: String
        let em: String
        let post: String
    }

    struct SunInfo: Codable {
        let sunrise: String      // pre-formatted display string (verbatim)
        let sunset: String       // pre-formatted display string (verbatim)
        let srHour: Double       // raw decimal hour for arc math
        let ssHour: Double       // raw decimal hour
        let sunPct: Double       // 0–1
        let isNight: Bool
    }

    struct HourlyPoint: Codable {
        let h: String            // display label 'Now'/'3PM' (not Date-parseable)
        let cond: Condition
        let temp: Int            // °C
        let pop: Int             // % (0–100)
        let ts: Double           // epoch ms — machine-readable
    }

    struct DayForecast: Codable {
        let label: String
        let cond: Condition
        let lo: Int
        let hi: Int
        let pop: Int             // % (0–100)
    }
}
