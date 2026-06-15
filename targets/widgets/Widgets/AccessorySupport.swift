// ---------------------------------------------------------------------------
// AccessorySupport.swift — DEBUG preview helpers for the lock-screen accessory
// views (PRD 05: InlineWidgetView / CircularWidgetView / RectangularWidgetView).
//
// COUNTERPART (data): src/widgets/snapshot.ts → WidgetSnapshot.swift.
//
// No-data detection is SHARED with the home-screen families: it lives in
// WidgetSupport.swift as `WeatherEntry.isEmptyState`, keyed off the reserved
// sentinel city id `WidgetEmpty.sentinelCityId` the provider stamps onto the
// never-opened entry (PRD 05 US-005 / PRD 04 US-006). The accessory views call
// that same `entry.isEmptyState` so all six families agree byte-for-byte.
//
// This file only adds a DEBUG `#Preview` fixture for the no-data branch (a
// snapshot whose city.id is the sentinel) so accessory previews can exercise it.
// ---------------------------------------------------------------------------

import Foundation

#if DEBUG
extension WidgetSnapshot {
    /// A copy of this snapshot stamped with the reserved no-data sentinel city
    /// id, so `WeatherEntry.isEmptyState` trips in accessory `#Preview`s of the
    /// US-005 "Open app" path. Mirrors the entry the provider builds at runtime.
    var noDataVariant: WidgetSnapshot {
        WidgetSnapshot(
            schemaVersion: schemaVersion,
            generatedAt: generatedAt,
            tzOffsetMinutes: tzOffsetMinutes,
            unit: unit,
            staleAt: staleAt,
            city: .init(
                id: WidgetEmpty.sentinelCityId,
                name: city.name,
                lat: city.lat,
                lon: city.lon,
                admin1: city.admin1,
                country: city.country,
                isCurrentLocation: city.isCurrentLocation
            ),
            current: current,
            headline: headline,
            summary: summary,
            sun: sun,
            hourly: hourly,
            days: days
        )
    }
}
#endif
