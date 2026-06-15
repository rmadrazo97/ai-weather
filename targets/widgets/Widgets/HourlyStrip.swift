// ---------------------------------------------------------------------------
// HourlyStrip.swift — shared 6-column hourly strip (Medium + Large).
//
// COUNTERPART: the app's hourly row over the same WidgetSnapshot.HourlyPoint
// the TS writer (src/widgets/snapshot.ts) produces.
//
// Consumes the ENTRY-RELATIVE slice the provider already sliced (PRD 03
// US-005 / WeatherProvider.buildTimeline): `entry.snapshot.hourly[0]` is THIS
// entry's current hour, so the strip never re-slices and never reads a raw
// `snapshot.hourly[0]` as "Now" after timeline scrubbing. Only the first
// entry's first column is labeled "Now" (`isFirstEntry`); later entries use
// the snapshot's pre-formatted hour label `h` verbatim (US-005 — the strip
// does no time math on display strings).
//
// Layout: exactly 6 fixed columns (matches the snapshot's 6-element hourly),
// evenly distributed; guards short/empty hourly (FR-6). `pop%` renders only
// when `pop > 0`, in the rainBlue token (US-002).
// ---------------------------------------------------------------------------

import SwiftUI

struct HourlyStrip: View {
    /// The entry-relative hourly slice (already sliced by the provider).
    let hours: [WidgetSnapshot.HourlyPoint]
    /// "C" | "F" — drives `Temp.format`.
    let unit: String
    /// Only the FIRST timeline entry may label its leading column "Now".
    var isFirstEntry: Bool = true
    /// Glyph size for the mini column icon.
    var glyphSize: CGFloat = 18

    /// Fixed 6 columns; never assumes hourly is non-empty (FR-6).
    private var columns: [WidgetSnapshot.HourlyPoint] {
        Array(hours.prefix(6))
    }

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(Array(columns.enumerated()), id: \.offset) { index, point in
                column(point, isLeadingNow: isFirstEntry && index == 0)
                    .frame(maxWidth: .infinity)
            }
        }
        .accessibilityHidden(true) // strip detail folds into the card's a11y label
    }

    @ViewBuilder
    private func column(_ point: WidgetSnapshot.HourlyPoint, isLeadingNow: Bool) -> some View {
        VStack(spacing: 4) {
            Text(isLeadingNow ? "Now" : point.h)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            WeatherGlyph(cond: point.cond, size: glyphSize, weight: .regular)
                .foregroundStyle(Color.ink)

            Text(Temp.format(point.temp, unit: unit))
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            // Precip probability only when > 0, in the rainBlue token (US-002).
            // A reserved blank line keeps columns vertically aligned when some
            // hours have pop and others don't.
            Text(point.pop > 0 ? "\(point.pop)%" : " ")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.rainBlue)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

// MARK: - Preview

#if DEBUG
private let stripSample: [WidgetSnapshot.HourlyPoint] = [
    .init(h: "Now", cond: .partly, temp: 24, pop: 10, ts: 0),
    .init(h: "3PM", cond: .clear, temp: 26, pop: 0, ts: 0),
    .init(h: "4PM", cond: .clear, temp: 27, pop: 0, ts: 0),
    .init(h: "5PM", cond: .rain, temp: 23, pop: 60, ts: 0),
    .init(h: "6PM", cond: .rain, temp: 21, pop: 80, ts: 0),
    .init(h: "7PM", cond: .cloud, temp: 20, pop: 20, ts: 0),
]

#Preview("HourlyStrip — °C / °F") {
    VStack(spacing: 24) {
        HourlyStrip(hours: stripSample, unit: "C")
        HourlyStrip(hours: stripSample, unit: "F")
        // Short array guard (FR-6): only 2 hours, still no crash.
        HourlyStrip(hours: Array(stripSample.prefix(2)), unit: "C", isFirstEntry: false)
    }
    .foregroundStyle(Color.ink)
    .padding()
    .background(gradient(for: .partly))
}
#endif
