// ---------------------------------------------------------------------------
// NowBlock.swift — the shared "current conditions" block (Medium + Large).
//
// COUNTERPART: the app hero's now column over WidgetSnapshot (src/widgets/
// snapshot.ts writer). PRD 04 US-002 / US-003.
//
// City + big unit-aware Temp.format + glyph + condition label + hi/lo from
// days[0].lo/.hi (FR-3, never current.hi/lo). Reads only NAMED decoded fields.
// Sizing knobs let Medium use a compact temp and Large a larger one. No
// background here — the family view owns the gradient container.
// ---------------------------------------------------------------------------

import SwiftUI

struct NowBlock: View {
    let snapshot: WidgetSnapshot
    /// Hero temp point size (Medium ~44, Large ~52).
    var tempSize: CGFloat = 44
    /// Glyph point size next to the temp.
    var glyphSize: CGFloat = 30
    /// Whether to show the condition label line (Large hides it when the
    /// headline already carries the descriptive copy).
    var showLabel: Bool = true
    /// Whether to show the city name line. Large hides it — its header already
    /// renders "city · time-of-day", so showing it here would duplicate it
    /// (and waste vertical space the systemLarge frame can't spare).
    var showCity: Bool = true

    private var current: WidgetSnapshot.CurrentConditions { snapshot.current }
    private var today: WidgetSnapshot.DayForecast? { snapshot.days.first }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if showCity {
                Text(snapshot.city.name)
                    .kicker()
                    .foregroundStyle(Color.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }

            HStack(alignment: .top, spacing: 6) {
                Text(Temp.format(current.temp, unit: snapshot.unit))
                    .font(.displayTemp(tempSize))
                    .foregroundStyle(Color.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                WeatherGlyph(cond: current.cond, size: glyphSize, weight: .regular)
                    .foregroundStyle(Color.ink)
                    .accessibilityHidden(true)
            }

            if showLabel {
                Text(current.label)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            HStack(spacing: 6) {
                Text("H:\(Temp.format(today?.hi ?? current.hi, unit: snapshot.unit))")
                Text("L:\(Temp.format(today?.lo ?? current.lo, unit: snapshot.unit))")
            }
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(Color.muted)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
    }
}
