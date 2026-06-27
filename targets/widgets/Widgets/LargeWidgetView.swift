// ---------------------------------------------------------------------------
// LargeWidgetView.swift — systemLarge (full briefing).
//
// COUNTERPART: the app's full hero + headline + hourly + 5-day over
// WidgetSnapshot (src/widgets/snapshot.ts writer). PRD 04 US-003.
//
// Composition (top→bottom):
//  • Header: city + a COARSE time-of-day label derived from sun.isNight/sunPct
//    (TimeOfDay) — NOT a clock; the snapshot has no wall-clock field (US-003).
//  • NowBlock: big temp + glyph + hi/lo from days[0].lo/.hi (FR-3).
//  • Headline: pre + BOLD em + post (US-003); summary fills remaining space
//    when present (Open Question: headline always, summary if room).
//  • HourlyStrip(6): same entry-relative slice as Medium (US-005).
//  • 5-day: iterates snapshot.days by NAMED fields only (label/cond/lo/hi/pop) —
//    never positional DayTuple indexing (FR-3 / Technical Considerations).
//
// Gradient = entry's projected cond (FR-2). Stale badge on isStale; empty
// state on the no-data sentinel (US-006). Guards short/empty days & summary
// (FR-6). Combined "city, temp, condition" a11y label; glyphs hidden (US-007).
// ---------------------------------------------------------------------------

import SwiftUI
import WidgetKit

struct LargeWidgetView: View {
    let entry: WeatherEntry

    private var snapshot: WidgetSnapshot { entry.snapshot }
    private var timeOfDay: TimeOfDay { TimeOfDay(sun: snapshot.sun) }

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
        VStack(alignment: .leading, spacing: 8) {
            // Header: city + coarse time-of-day (NOT a clock) + stale badge.
            HStack(alignment: .firstTextBaseline) {
                Text(snapshot.city.name)
                    .kicker()
                    .foregroundStyle(Color.ink)
                    .lineLimit(1)
                Text("· \(timeOfDay.label)")
                    .kickerStyle()
                    .foregroundStyle(Color.muted)
                    .lineLimit(1)
                Spacer(minLength: 4)
                if entry.isStale { StaleBadge() }
                // Interactive refresh (iOS 17+ only). Unobtrusive top-trailing
                // glyph; on iOS 16 the control is simply absent and the header
                // layout is unchanged. `Button(intent:)` is an iOS 17 API.
                if #available(iOS 17.0, *) {
                    Button(intent: RefreshIntent()) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.muted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Refresh weather")
                }
                // Quick-access AI chat (Medium/Large only — see ChatButton).
                WidgetChatButton(size: 26)
            }

            // Hero row: now-block (city + label suppressed — the header shows the
            // city, the headline carries the prose) beside the condition glyph,
            // with the headline tucked under it. Keeps the top compact so the AQI
            // bar + metric tiles + hourly strip all fit the systemLarge frame.
            NowBlock(snapshot: snapshot, tempSize: 46, glyphSize: 32, showLabel: false, showCity: false)

            headlineView

            // The redesign centerpiece: colorful AQI severity bar (when present).
            if let aqi = snapshot.current.aqi {
                AQIBar(aqi: aqi, word: snapshot.current.aqiWord)
            }

            // Colorful metric tiles — up to 6 (feels/humidity/wind/UV/precip/dew),
            // laid out 3-across so they fill the card width. Optional fields
            // (dir/uvWord/dew) degrade gracefully inside the builder.
            MetricGrid(
                metrics: Array(MetricBuilder.metrics(for: snapshot).prefix(6)),
                columns: 3,
                compact: true
            )

            Divider().overlay(Color.hair)

            HourlyStrip(
                hours: snapshot.hourly,
                unit: snapshot.unit,
                isFirstEntry: isFirstEntry,
                glyphSize: 18
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetContainer(gradient: gradient(for: snapshot.current.cond))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(a11yLabel(for: snapshot))
    }

    // MARK: Headline (pre + bold em + post)

    @ViewBuilder
    private var headlineView: some View {
        let h = snapshot.headline
        if h.pre.isEmpty && h.em.isEmpty && h.post.isEmpty {
            EmptyView()
        } else {
            // Concatenated Text preserves the bold-middle treatment inline and
            // wraps naturally, matching the app's {pre, em, post} hero headline.
            // `.foregroundColor` (not `.foregroundStyle`) is the concatenable,
            // 16.4-available text color modifier that returns `Text`.
            (
                Text(h.pre)
                + Text(h.em).fontWeight(.heavy)
                + Text(h.post)
            )
            .foregroundColor(Color.ink)
            .font(.system(size: 17, weight: .regular))
            .lineLimit(2)
            .minimumScaleFactor(0.9)
            .fixedSize(horizontal: false, vertical: true)
        }
    }

}

// MARK: - Preview

#if DEBUG
import Foundation

private func largePreviewEntry(
    cond: Condition,
    label: String,
    temp: Int,
    unit: String,
    city: String = "Madrid",
    sunPct: Double = 0.42,
    isNight: Bool = false,
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
              isNight: isNight, humidity: c.humidity, wind: c.wind,
              precipProb: c.precipProb, uv: c.uv, aqi: c.aqi, aqiWord: c.aqiWord,
              dir: c.dir, uvWord: c.uvWord, dew: c.dew)
    let sun = WidgetSnapshot.SunInfo(
        sunrise: base.sun.sunrise, sunset: base.sun.sunset,
        srHour: base.sun.srHour, ssHour: base.sun.ssHour,
        sunPct: sunPct, isNight: isNight
    )
    let snap = WidgetSnapshot(
        schemaVersion: 1, generatedAt: base.generatedAt, tzOffsetMinutes: 0, unit: unit,
        staleAt: isStale ? 0 : nil, city: cityRef, current: c, headline: base.headline,
        summary: base.summary, sun: sun, hourly: base.hourly, days: base.days
    )
    return WeatherProvider.entry(from: snap, at: Date(), isStale: isStale)
}

#Preview("Large — storm/clear/snow, both units") {
    WidgetPreviewGrid(family: .large) {
        AnyView(LargeWidgetView(entry: largePreviewEntry(cond: .storm, label: "Thunderstorm", temp: 18, unit: "C", city: "San Francisco", sunPct: 0.8)))
        AnyView(LargeWidgetView(entry: largePreviewEntry(cond: .storm, label: "Thunderstorm", temp: 64, unit: "F")))
        AnyView(LargeWidgetView(entry: largePreviewEntry(cond: .clear, label: "Sunny", temp: 27, unit: "C", sunPct: 0.2)))
        AnyView(LargeWidgetView(entry: largePreviewEntry(cond: .snow, label: "Snow", temp: -2, unit: "F", isNight: true, isStale: true)))
        AnyView(LargeWidgetView(entry: largePreviewEntry(cond: .clear, label: "Sunny", temp: 24, unit: "C", empty: true)))
    }
}
#endif
