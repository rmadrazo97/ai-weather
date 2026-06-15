// ---------------------------------------------------------------------------
// RectangularWidgetView.swift — accessoryRectangular lock-screen complication
// (PRD 05 US-003).
//
// COUNTERPART (data): src/widgets/snapshot.ts → WidgetSnapshot.swift; glyph
// mapping mirrors DesignSystem/WeatherGlyph.swift (PRD 02 US-002).
//
// Layout (US-003):
//   line 1 = city + temp
//   line 2 = SF Symbol glyph + condition label
//   line 3 = hi/lo (+ precip % when notable)
//
// hi/lo come from the NAMED `days[0].hi` / `days[0].lo` (today), never a raw
// tuple index (PRD 01 DayTuple d[2]=lo,d[3]=hi is resolved app-side into named
// fields). Precip uses `current.precipProb` (a percent) and renders only when
// > 0. Monochrome/vibrant-friendly — no color carries meaning. Long city names
// truncate with a tail. `.widgetAccentable()` keeps the temp in the accent group.
// ---------------------------------------------------------------------------

import SwiftUI
import WidgetKit

struct RectangularWidgetView: View {
    let entry: WeatherEntry

    var body: some View {
        if hasNoData {
            // US-005: never-opened state — one explanatory line, no crash.
            VStack(alignment: .leading, spacing: 2) {
                Text("AI Weather")
                    .font(.system(size: 15, weight: .semibold))
                Text("Open AI Weather to set up")
                    .font(.system(size: 13))
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("No data. Open AI Weather to set up.")
        } else {
            content
        }
    }

    // MARK: - Live content

    private var content: some View {
        VStack(alignment: .leading, spacing: 1) {
            // Line 1: city + temp. City truncates; temp stays in the accent group.
            HStack(spacing: 4) {
                Text(snapshot.city.name)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                    .truncationMode(.tail)

                Spacer(minLength: 4)

                Text(tempText)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                    .widgetAccentable()
            }

            // Line 2: glyph + condition label.
            HStack(spacing: 4) {
                WeatherGlyph(cond: current.cond, size: 13, weight: .medium)
                Text(current.label)
                    .font(.system(size: 13))
                    .lineLimit(1)
                    .truncationMode(.tail)
            }

            // Line 3: hi/lo (+ precip % when notable). Staleness adds a dot.
            HStack(spacing: 6) {
                Text(hiLoText)
                    .font(.system(size: 13))
                    .lineLimit(1)

                if let precip = precipText {
                    Label(precip, systemImage: "drop")
                        .font(.system(size: 12))
                        .labelStyle(.titleAndIcon)
                        .lineLimit(1)
                }

                if entry.isStale {
                    // Subtle, color-free staleness affordance (US-005). A glyph,
                    // not a hue, so it survives monochrome/vibrant rendering.
                    Image(systemName: "clock.badge.exclamationmark")
                        .font(.system(size: 11))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
    }

    // MARK: - Derived values

    private var hasNoData: Bool { entry.isEmptyState }
    private var snapshot: WidgetSnapshot { entry.snapshot }
    private var current: WidgetSnapshot.CurrentConditions { entry.snapshot.current }
    private var today: WidgetSnapshot.DayForecast? { snapshot.days.first }

    private var tempText: String {
        Temp.format(current.temp, unit: snapshot.unit)
    }

    /// Today's hi/lo from the NAMED day fields (PRD 01). Falls back to the
    /// current-conditions hi/lo if `days` is somehow empty (never crashes).
    private var hiLoText: String {
        let unit = snapshot.unit
        let hi = today?.hi ?? current.hi
        let lo = today?.lo ?? current.lo
        // H/L prefixes read in monochrome where color can't distinguish them.
        return "H:\(Temp.format(hi, unit: unit)) L:\(Temp.format(lo, unit: unit))"
    }

    /// Precip percent string, only when notable (> 0); otherwise nil so line 3
    /// stays compact (US-003 / PRD 01: `precipProb` is a percent).
    private var precipText: String? {
        let pop = current.precipProb
        return pop > 0 ? "\(pop)%" : nil
    }

    /// VoiceOver: "city, temp, condition, high temp, low temp" (US-003).
    private var accessibilityText: String {
        let unit = snapshot.unit
        let hi = today?.hi ?? current.hi
        let lo = today?.lo ?? current.lo
        var parts = [
            snapshot.city.name,
            Temp.format(current.temp, unit: unit),
            current.label,
            "high \(Temp.format(hi, unit: unit))",
            "low \(Temp.format(lo, unit: unit))"
        ]
        if let pop = precipText { parts.append("\(pop) chance of precipitation") }
        if entry.isStale { parts.append("data may be outdated") }
        return parts.joined(separator: ", ")
    }
}

// MARK: - Preview

#if DEBUG
@available(iOS 17.0, *)
#Preview("Rectangular — live", as: .accessoryRectangular) {
    AccessoryRectangularPreviewWidget()
} timeline: {
    WeatherEntry(
        date: .now,
        snapshot: SnapshotStore.placeholder,
        isStale: false,
        relevance: nil
    )
}

@available(iOS 17.0, *)
#Preview("Rectangular — stale", as: .accessoryRectangular) {
    AccessoryRectangularPreviewWidget()
} timeline: {
    WeatherEntry(
        date: .now,
        snapshot: SnapshotStore.placeholder,
        isStale: true,
        relevance: nil
    )
}

@available(iOS 17.0, *)
#Preview("Rectangular — no data", as: .accessoryRectangular) {
    AccessoryRectangularPreviewWidget()
} timeline: {
    WeatherEntry(
        date: .now,
        snapshot: SnapshotStore.placeholder.noDataVariant,
        isStale: true,
        relevance: nil
    )
}

private struct AccessoryRectangularPreviewWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "RectangularWidgetPreview", provider: PreviewRectangularProvider()) { entry in
            RectangularWidgetView(entry: entry)
        }
        .supportedFamilies([.accessoryRectangular])
    }
}

private struct PreviewRectangularProvider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(date: .now, snapshot: SnapshotStore.placeholder, isStale: false, relevance: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> Void) {
        completion(placeholder(in: context))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<WeatherEntry>) -> Void) {
        completion(Timeline(entries: [placeholder(in: context)], policy: .never))
    }
}
#endif
