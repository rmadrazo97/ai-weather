// ---------------------------------------------------------------------------
// WMO.swift — WMO weather-code → (Condition, label) classifier.
//
// COUNTERPART: `wmoInfo` in src/data/weatherApi.ts (module-private there, so it
// is TRANSCRIBED here, not imported). Keep the code bands, label strings, and
// the night rule byte-for-byte in sync with the TS source. See PRD 03 FR-8.
//
// Bands (exact): code<=1 clear · ==2 partly · ==3 cloud · 45/48 fog ·
// 51–57 drizzle(rain) · 61–67 rain · 71–77/85/86 snow · 80–82 showers(rain) ·
// >=95 storm · else cloud. Night rule applied LAST: !isDay && code<=3 → .night
// (only clear/partly/cloud/overcast flip; precip/fog/storm keep their day cond).
// ---------------------------------------------------------------------------

import Foundation

/// Map an Open-Meteo WMO weather code to the visual `Condition` and a display
/// label. `isDay` flips clear/cloudy skies to the night glyph after band
/// classification — mirrors `wmoInfo(code, isDay)` in weatherApi.ts exactly.
func wmoInfo(code: Int, isDay: Bool) -> (Condition, String) {
    var cond: Condition
    var label: String

    if code <= 1 {
        cond = .clear
        label = isDay ? "Sunny" : "Clear"
    } else if code == 2 {
        cond = .partly
        label = "Partly cloudy"
    } else if code == 3 {
        cond = .cloud
        label = "Overcast"
    } else if code == 45 || code == 48 {
        cond = .fog
        label = "Fog"
    } else if code >= 51 && code <= 57 {
        cond = .rain
        label = "Drizzle"
    } else if code >= 61 && code <= 67 {
        cond = .rain
        label = code >= 66 ? "Freezing rain" : "Rain"
    } else if (code >= 71 && code <= 77) || code == 85 || code == 86 {
        cond = .snow
        label = "Snow"
    } else if code >= 80 && code <= 82 {
        cond = .rain
        label = "Showers"
    } else if code >= 95 {
        cond = .storm
        label = "Thunderstorm"
    } else {
        cond = .cloud
        label = "Cloudy"
    }

    // At night, only clear/cloudy skies render as the night glyph; precipitation,
    // fog and storms keep their own visual.
    if !isDay && code <= 3 { cond = .night }

    return (cond, label)
}
