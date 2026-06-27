// ---------------------------------------------------------------------------
// SmallWidgetView.swift — systemSmall (glanceable now).
//
// COUNTERPART: the app hero, compacted, over WidgetSnapshot (src/widgets/
// snapshot.ts writer). PRD 04 US-001.
//
// Renders: city (truncating) · big unit-aware Temp.format · condition glyph ·
// condition label · hi/lo from days[0].lo/.hi (FR-3, NEVER current.hi/lo —
// the daily extremes live on the day forecast). Background = condition
// gradient for the entry's PROJECTED cond (FR-2). Subtle stale badge when
// `entry.isStale`. Routes to the "Open AI Weather" empty state when the entry
// is the no-data sentinel (US-006). Combined "city, temp, condition" a11y
// label, decorative glyph hidden (US-007). Holds at real systemSmall size for
// long city names and 3-digit °F (FR-4).
// ---------------------------------------------------------------------------

import SwiftUI
import WidgetKit

struct SmallWidgetView: View {
    let entry: WeatherEntry

    private var snapshot: WidgetSnapshot { entry.snapshot }
    private var current: WidgetSnapshot.CurrentConditions { snapshot.current }

    /// hi/lo come from the first day forecast, with a current fallback when
    /// `days` is empty (FR-6 — no array is assumed non-empty).
    private var today: WidgetSnapshot.DayForecast? { snapshot.days.first }

    var body: some View {
        if entry.isEmptyState {
            WidgetEmptyStateView()
        } else {
            content
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header: city + stale badge.
            HStack(alignment: .firstTextBaseline) {
                Text(snapshot.city.name)
                    .kicker()
                    .foregroundStyle(Color.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 4)
                if entry.isStale { StaleBadge() }
            }

            Spacer(minLength: 4)

            // Hero temp + glyph share a row so the glyph reads alongside the
            // number; ViewThatFits keeps it from clipping on the SE point size.
            HStack(alignment: .top, spacing: 4) {
                Text(Temp.format(current.temp, unit: snapshot.unit))
                    .font(.displayTemp(46))
                    .foregroundStyle(Color.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Spacer(minLength: 0)
                WeatherGlyph(cond: current.cond, size: 30, weight: .regular)
                    .foregroundStyle(Color.ink)
                    .accessibilityHidden(true)
            }

            // Condition label + hi/lo on one tight line so the hero metric below
            // gets its own row (FR-3 extremes from days[0], current fallback).
            HStack(spacing: 6) {
                Text(current.label)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 4)
                Text("H:\(Temp.format(today?.hi ?? current.hi, unit: snapshot.unit))")
                Text("L:\(Temp.format(today?.lo ?? current.lo, unit: snapshot.unit))")
            }
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Color.muted)
            .lineLimit(1)
            .minimumScaleFactor(0.8)

            Spacer(minLength: 4)

            // Hero metric: the colorful AQI pill when air-quality data is present
            // (the redesign's signature readout), else a feels-like chip. Both
            // degrade gracefully; ViewThatFits drops the row before it clips.
            heroMetric
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetContainer(gradient: gradient(for: current.cond))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(a11yLabel(for: snapshot))
    }

    @ViewBuilder
    private var heroMetric: some View {
        if let aqi = current.aqi {
            AQIPill(aqi: aqi, word: current.aqiWord)
        } else {
            MetricChip(
                icon: "thermometer.medium",
                value: Temp.format(current.feels, unit: snapshot.unit),
                label: "Feels like",
                tint: MetricPalette.feels,
                compact: true
            )
            .accessibilityHidden(true)
        }
    }
}

// MARK: - Preview

#if DEBUG
import Foundation

/// Build a preview entry from the bundled placeholder with overrides.
private func smallPreviewEntry(
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

#Preview("Small — clear °C / rain °F / night °C / empty") {
    WidgetPreviewGrid(family: .small) {
        AnyView(SmallWidgetView(entry: smallPreviewEntry(cond: .clear, label: "Sunny", temp: 24, unit: "C", city: "San Francisco")))
        AnyView(SmallWidgetView(entry: smallPreviewEntry(cond: .rain, label: "Showers", temp: 42, unit: "F", isStale: true)))
        AnyView(SmallWidgetView(entry: smallPreviewEntry(cond: .night, label: "Clear", temp: 12, unit: "C")))
        AnyView(SmallWidgetView(entry: smallPreviewEntry(cond: .clear, label: "Sunny", temp: 24, unit: "C", empty: true)))
    }
}
#endif
