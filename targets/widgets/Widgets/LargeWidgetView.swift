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
        VStack(alignment: .leading, spacing: 12) {
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
            }

            // Now-block (label suppressed — the headline carries the prose).
            NowBlock(snapshot: snapshot, tempSize: 52, glyphSize: 36, showLabel: false)

            headlineView

            // Summary fills remaining vertical space when present (FR-6 guard).
            if !snapshot.summary.isEmpty {
                Text(snapshot.summary)
                    .font(.body15)
                    .foregroundStyle(Color.muted)
                    .lineLimit(2)
                    .minimumScaleFactor(0.9)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Divider().overlay(Color.hair)

            HourlyStrip(
                hours: snapshot.hourly,
                unit: snapshot.unit,
                isFirstEntry: isFirstEntry,
                glyphSize: 18
            )

            Divider().overlay(Color.hair)

            fiveDay
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

    // MARK: 5-day forecast (named day fields only — never positional)

    @ViewBuilder
    private var fiveDay: some View {
        // Guard empty days (FR-6); cap at 5 rows.
        let days = Array(snapshot.days.prefix(5))
        // Shared lo/hi domain so each row's range bar is comparable.
        let los = days.map(\.lo)
        let his = days.map(\.hi)
        let domainLo = los.min() ?? snapshot.current.lo
        let domainHi = his.max() ?? snapshot.current.hi

        VStack(spacing: 6) {
            ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                DayRow(
                    day: day,
                    unit: snapshot.unit,
                    domainLo: domainLo,
                    domainHi: domainHi
                )
            }
        }
    }
}

// MARK: - Single 5-day row

private struct DayRow: View {
    let day: WidgetSnapshot.DayForecast
    let unit: String
    let domainLo: Int
    let domainHi: Int

    var body: some View {
        HStack(spacing: 8) {
            Text(day.label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.ink)
                .frame(width: 40, alignment: .leading)
                .lineLimit(1)

            WeatherGlyph(cond: day.cond, size: 16, weight: .regular)
                .foregroundStyle(Color.ink)
                .frame(width: 22)
                .accessibilityHidden(true)

            // pop% when > 0, in rainBlue (matches the strip convention).
            Text(day.pop > 0 ? "\(day.pop)%" : " ")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.rainBlue)
                .frame(width: 30, alignment: .leading)

            Text(Temp.format(day.lo, unit: unit))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.muted)
                .frame(width: 38, alignment: .trailing)

            rangeBar
                .frame(maxWidth: .infinity)

            Text(Temp.format(day.hi, unit: unit))
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.ink)
                .frame(width: 38, alignment: .leading)
        }
    }

    /// A simple lo→hi range bar normalized over the 5-day domain. ViewThatFits
    /// degrades to a numeric-only row when horizontal space is tight (no iOS
    /// 17-only API on the 16.4 path).
    private var rangeBar: some View {
        ViewThatFits(in: .horizontal) {
            GeometryReader { geo in
                let span = max(1, CGFloat(domainHi - domainLo))
                let leading = CGFloat(day.lo - domainLo) / span
                let width = CGFloat(day.hi - day.lo) / span
                Capsule()
                    .fill(Color.hair)
                    .frame(height: 4)
                    .overlay(alignment: .leading) {
                        Capsule()
                            .fill(Color.ink.opacity(0.65))
                            .frame(width: max(6, geo.size.width * width), height: 4)
                            .offset(x: geo.size.width * leading)
                    }
            }
            .frame(height: 4)
            // Tight fallback: a thin hairline so the row never clips.
            Capsule().fill(Color.hair).frame(height: 4)
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
              precipProb: c.precipProb, uv: c.uv, aqi: c.aqi, aqiWord: c.aqiWord)
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
