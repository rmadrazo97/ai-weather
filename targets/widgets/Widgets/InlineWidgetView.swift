// ---------------------------------------------------------------------------
// InlineWidgetView.swift — accessoryInline lock-screen complication (PRD 05 US-001).
//
// COUNTERPART (data): src/widgets/snapshot.ts → WidgetSnapshot.swift; glyph
// mapping mirrors DesignSystem/WeatherGlyph.swift (PRD 02 US-002).
//
// HARD PLATFORM CONSTRAINT (PRD 05 US-001): `accessoryInline` renders ONLY a
// single `Text` plus AT MOST ONE leading SF Symbol. A custom Path, HStack, or
// any multi-view layout renders BLANK. So this view is exactly one `Label`
// (Text + systemImage). No background — the system supplies the inline tint.
// Custom `Path` glyphs do not survive here; SF Symbols only.
//
// City is intentionally omitted (PRD 05 Open Questions, resolved): inline length
// is tiny, so we show "<temp> <condition label>" only, e.g. "72° Partly cloudy".
// ---------------------------------------------------------------------------

import SwiftUI
import WidgetKit

struct InlineWidgetView: View {
    let entry: WeatherEntry

    var body: some View {
        // Exactly one Label: the SF Symbol leads, the single Text follows. Any
        // richer layout would blank the family, so keep this a one-liner.
        Label {
            Text(inlineText)
        } icon: {
            Image(systemName: symbolName)
        }
        // Inline ignores most styling; accessibilityLabel is "temp, condition".
        .accessibilityLabel(accessibilityText)
    }

    // MARK: - Derived strings

    /// No-data sentinel (US-005). Shared detection lives in WidgetSupport
    /// (`isEmptyState`, keyed off the reserved sentinel city id).
    private var hasNoData: Bool { entry.isEmptyState }

    private var current: WidgetSnapshot.CurrentConditions { entry.snapshot.current }

    /// "72° Partly cloudy" — or the "Open app" affordance when there is no data.
    private var inlineText: String {
        if hasNoData {
            // "—°" uses U+2014 em dash + degree so the shape still reads as a
            // temperature slot the user must fill by opening the app.
            return "—° Open app"
        }
        let temp = Temp.format(current.temp, unit: entry.snapshot.unit)
        // Single space separator; the inline family truncates this on its own.
        return "\(temp) \(current.label)"
    }

    /// Leading SF Symbol for the projected condition (PRD 02 US-002 mapping).
    /// Neutral cloud for the no-data state so the slot never looks broken.
    private var symbolName: String {
        if hasNoData { return "cloud" }
        return WeatherGlyph.symbolName(for: current.cond)
    }

    /// VoiceOver: "<temp> degrees, <condition>" (US-001 acceptance). Spells
    /// "degrees" rather than the `°` glyph so VoiceOver announces it cleanly.
    private var accessibilityText: String {
        if hasNoData { return "No data. Open AI Weather to set up." }
        return "\(degreesValue) degrees, \(current.label)"
    }

    /// Unit-converted integer for the spoken VoiceOver string (no `°` glyph).
    private var degreesValue: Int {
        entry.snapshot.unit == "F"
            ? Int((Double(current.temp) * 9 / 5 + 32).rounded())
            : current.temp
    }
}

// MARK: - Preview

#if DEBUG
@available(iOS 17.0, *)
#Preview("Inline — live", as: .accessoryInline) {
    AccessoryInlinePreviewWidget()
} timeline: {
    WeatherEntry(
        date: .now,
        snapshot: SnapshotStore.placeholder,
        isStale: false,
        relevance: nil
    )
}

@available(iOS 17.0, *)
#Preview("Inline — no data", as: .accessoryInline) {
    AccessoryInlinePreviewWidget()
} timeline: {
    WeatherEntry(
        date: .now,
        snapshot: SnapshotStore.placeholder.noDataVariant,
        isStale: true,
        relevance: nil
    )
}

/// Minimal widget wrapper so the accessory `#Preview` can host the view in the
/// real `accessoryInline` context (the bundle/Widget defs land in Integrate).
private struct AccessoryInlinePreviewWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "InlineWidgetPreview", provider: PreviewInlineProvider()) { entry in
            InlineWidgetView(entry: entry)
        }
        .supportedFamilies([.accessoryInline])
    }
}

private struct PreviewInlineProvider: TimelineProvider {
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
