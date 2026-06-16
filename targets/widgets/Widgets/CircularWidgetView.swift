// ---------------------------------------------------------------------------
// CircularWidgetView.swift — accessoryCircular lock-screen complication
// (PRD 05 US-002).
//
// COUNTERPART (data): src/widgets/snapshot.ts → WidgetSnapshot.swift; glyph
// mapping mirrors DesignSystem/WeatherGlyph.swift (PRD 02 US-002).
//
// V1 = temp + glyph ONLY — NO gauge/ring (PRD 05 Non-Goals; a value arc would
// need `Gauge(.accessoryCircularCapacity)`, not `AccessoryWidgetBackground()`).
// `AccessoryWidgetBackground()` supplies the standard circular backing material.
//
// Lock-screen accessories render in `.accented`/`.vibrant` modes: NO color may
// carry meaning, custom `Path` strokes render blank. Meaning comes from the SF
// Symbol shape + the temperature number. `.widgetAccentable()` keeps the temp
// in the system accent group; `.symbolRenderingMode(.monochrome)` on the glyph.
// ---------------------------------------------------------------------------

import SwiftUI
import WidgetKit

struct CircularWidgetView: View {
    let entry: WeatherEntry

    var body: some View {
        ZStack {
            // Standard circular backing material (US-002 / FR-3). It adapts to
            // the wallpaper vibrancy; we never paint a full-color gradient here.
            AccessoryWidgetBackground()

            VStack(spacing: 1) {
                // Condition glyph, sized small for the circular slot. Monochrome
                // is enforced inside WeatherGlyph so it inherits the system tint.
                WeatherGlyph(cond: glyphCond, size: 15, weight: .medium)

                // Temperature is the priority element — keep it in the accent
                // group so it stays bright under vibrancy.
                Text(tempText)
                    .font(.system(size: 17, weight: .semibold))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .widgetAccentable()
            }
            .padding(2)
        }
        .accessibilityLabel(accessibilityText)
    }

    // MARK: - Derived values

    private var hasNoData: Bool { entry.isEmptyState }
    private var current: WidgetSnapshot.CurrentConditions { entry.snapshot.current }

    /// Neutral cloud glyph for the no-data state so the dial never looks broken.
    private var glyphCond: Condition {
        hasNoData ? .cloud : current.cond
    }

    /// "72°" or the em-dash placeholder when there is no data yet (US-005).
    private var tempText: String {
        hasNoData ? "—°" : Temp.format(current.temp, unit: entry.snapshot.unit)
    }

    /// VoiceOver: "<temp> degrees, <condition>" — or an "Open app" affordance
    /// (US-002). Spells "degrees" so VoiceOver announces it cleanly (no `°`).
    private var accessibilityText: String {
        if hasNoData { return "No data. Open AI Weather to set up." }
        let degrees = entry.snapshot.unit == "F"
            ? Int((Double(current.temp) * 9 / 5 + 32).rounded())
            : current.temp
        return "\(degrees) degrees, \(current.label)"
    }
}

// MARK: - Preview

#if DEBUG
@available(iOS 17.0, *)
#Preview("Circular — live", as: .accessoryCircular) {
    AccessoryCircularPreviewWidget()
} timeline: {
    WeatherEntry(
        date: .now,
        snapshot: SnapshotStore.placeholder,
        isStale: false,
        relevance: nil
    )
}

@available(iOS 17.0, *)
#Preview("Circular — no data", as: .accessoryCircular) {
    AccessoryCircularPreviewWidget()
} timeline: {
    WeatherEntry(
        date: .now,
        snapshot: SnapshotStore.placeholder.noDataVariant,
        isStale: true,
        relevance: nil
    )
}

private struct AccessoryCircularPreviewWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "CircularWidgetPreview", provider: PreviewCircularProvider()) { entry in
            CircularWidgetView(entry: entry)
        }
        .supportedFamilies([.accessoryCircular])
    }
}

private struct PreviewCircularProvider: TimelineProvider {
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
