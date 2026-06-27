// ---------------------------------------------------------------------------
// MediumWidgetView.swift — systemMedium (now + hourly strip).
//
// COUNTERPART: app hero + hourly row over WidgetSnapshot (src/widgets/
// snapshot.ts writer). PRD 04 US-002.
//
// Left = NowBlock (city + temp + glyph + label + hi/lo from days[0]). Right =
// HourlyStrip of the next 6 hours, built from the ENTRY-RELATIVE slice the
// provider already produced (US-005 — `entry.snapshot.hourly[0]` is THIS
// entry's current hour). pop% renders only when > 0 in rainBlue (US-002).
// Background = gradient for the entry's projected cond (FR-2). Stale badge on
// `entry.isStale`; empty state on the no-data sentinel (US-006). Combined
// "city, temp, condition" a11y label, decorative glyph hidden (US-007).
// ---------------------------------------------------------------------------

import SwiftUI
import WidgetKit

struct MediumWidgetView: View {
    let entry: WeatherEntry

    private var snapshot: WidgetSnapshot { entry.snapshot }

    /// First timeline entry labels its leading hourly column "Now"; later
    /// entries label by the hour string. The provider stamps `entry.date`; the
    /// first entry's date is "now", so equal-to-now ⇒ first entry.
    private var isFirstEntry: Bool {
        abs(entry.date.timeIntervalSinceNow) < 60
    }

    var body: some View {
        if entry.isEmptyState {
            WidgetEmptyStateView()
        } else {
            content
        }
    }

    private var content: some View {
        HStack(alignment: .top, spacing: 14) {
            NowBlock(snapshot: snapshot, tempSize: 44, glyphSize: 28)
                .frame(width: 128, alignment: .leading)

            VStack(alignment: .leading, spacing: 7) {
                // Top row: optional stale badge (leading) + quick-access AI chat
                // button (trailing). The button's height sets the row, keeping the
                // content below aligned whether or not the stale indicator shows.
                HStack(spacing: 6) {
                    if entry.isStale { StaleBadge() }
                    Spacer(minLength: 0)
                    WidgetChatButton(size: 24)
                }

                // The redesign's right column: the colorful AQI severity bar (when
                // air-quality data is present) over a row of metric chips. Falls
                // back to the hourly strip when there's no AQI to anchor the card.
                if let aqi = snapshot.current.aqi {
                    AQIBar(aqi: aqi, word: snapshot.current.aqiWord, compact: true)
                    MetricGrid(
                        metrics: Array(MetricBuilder.metrics(for: snapshot).prefix(3)),
                        columns: 3,
                        compact: true
                    )
                } else {
                    MetricGrid(
                        metrics: Array(MetricBuilder.metrics(for: snapshot).prefix(3)),
                        columns: 3,
                        compact: true
                    )
                    HourlyStrip(
                        hours: snapshot.hourly,
                        unit: snapshot.unit,
                        isFirstEntry: isFirstEntry,
                        glyphSize: 18
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetContainer(gradient: gradient(for: snapshot.current.cond))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(a11yLabel(for: snapshot))
    }
}

// MARK: - Preview

#if DEBUG
import Foundation

private func mediumPreviewEntry(
    cond: Condition,
    label: String,
    temp: Int,
    unit: String,
    city: String = "Madrid",
    isStale: Bool = false,
    empty: Bool = false
) -> WeatherEntry {
    let base = SnapshotStore.placeholder
    let cityRef = WidgetSnapshot.CityRef(
        id: empty ? WidgetEmpty.sentinelCityId : base.city.id,
        name: city, lat: base.city.lat, lon: base.city.lon,
        admin1: base.city.admin1, country: base.city.country, isCurrentLocation: false
    )
    var c = base.current
    c = .init(temp: temp, feels: c.feels, hi: c.hi, lo: c.lo, cond: cond, label: label,
              isNight: cond == .night, humidity: c.humidity, wind: c.wind,
              precipProb: c.precipProb, uv: c.uv, aqi: c.aqi, aqiWord: c.aqiWord,
              dir: c.dir, uvWord: c.uvWord, dew: c.dew)
    let snap = WidgetSnapshot(
        schemaVersion: 1, generatedAt: base.generatedAt, tzOffsetMinutes: 0, unit: unit,
        staleAt: isStale ? 0 : nil, city: cityRef, current: c, headline: base.headline,
        summary: base.summary, sun: base.sun, hourly: base.hourly, days: base.days
    )
    return WeatherProvider.entry(from: snap, at: Date(), isStale: isStale)
}

#Preview("Medium — clear/partly/rain, both units") {
    WidgetPreviewGrid(family: .medium) {
        AnyView(MediumWidgetView(entry: mediumPreviewEntry(cond: .clear, label: "Sunny", temp: 24, unit: "C", city: "San Francisco")))
        AnyView(MediumWidgetView(entry: mediumPreviewEntry(cond: .partly, label: "Partly cloudy", temp: 19, unit: "F")))
        AnyView(MediumWidgetView(entry: mediumPreviewEntry(cond: .rain, label: "Showers", temp: 16, unit: "C", isStale: true)))
        AnyView(MediumWidgetView(entry: mediumPreviewEntry(cond: .rain, label: "Showers", temp: 61, unit: "F")))
        AnyView(MediumWidgetView(entry: mediumPreviewEntry(cond: .clear, label: "Sunny", temp: 24, unit: "C", empty: true)))
    }
}
#endif
