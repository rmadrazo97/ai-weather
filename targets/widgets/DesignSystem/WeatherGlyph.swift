// ---------------------------------------------------------------------------
// WeatherGlyph.swift — the 8 weather glyphs (SwiftUI port)
//
// COUNTERPART: src/components/WeatherIcon.tsx (the app's stroke-based SVGs).
//
// DESIGN DECISION (PRD 02 US-002): we use SF Symbols, not custom Path redraws.
// Rationale: SF Symbols give free lock-screen vibrancy, automatic scaling, and
// accessibility, and read crisp at the tiny accessory-circular size. Pixel-
// exact custom `Path` glyphs matching WeatherIcon.tsx's thin strokes are a
// documented FAST-FOLLOW if brand fidelity demands it (see note below).
//
// SYMBOL AVAILABILITY: the names below are the PRD's CANDIDATE mapping and are
// UNVERIFIED against the deployment floor (iOS 16.4). Each MUST be confirmed in
// the SF Symbols app "Availability" pane (or `if #available`) before ship — a
// missing symbol renders an empty placeholder box. All names chosen here are
// long-standing core weather symbols (shipped well before iOS 16), but verify.
//
// FAST-FOLLOW: if `.monochrome` + weight reads too heavy vs the app's hairline
// strokes, replace this with a custom `Shape`/`Path` per condition.
// ---------------------------------------------------------------------------

import SwiftUI
import WidgetKit  // for `\.widgetRenderingMode` in the render-mode preview

/// A single weather glyph for a `Condition`, rendered as a monochrome SF Symbol.
///
/// Legible from ~16pt (lock-screen accessory circular) to ~64pt (large widget).
/// Colour comes from the ambient `foregroundStyle`; in `.accented`/`.vibrant`
/// widget rendering modes SF Symbols are tinted by the system automatically.
struct WeatherGlyph: View {
    let cond: Condition
    /// Glyph size in points. Keep within the legible 16–64pt band.
    var size: CGFloat = 48
    /// Stroke weight approximating the app's thin strokes.
    var weight: Font.Weight = .regular

    var body: some View {
        Image(systemName: Self.symbolName(for: cond))
            .font(.system(size: size, weight: weight))
            // Monochrome so the glyph inherits ink / vibrant tint rather than
            // baking in multicolour fills that vanish under lock-screen tint.
            .symbolRenderingMode(.monochrome)
    }

    /// Candidate SF Symbol per condition (PRD 02 US-002). No `default` so a new
    /// `Condition` fails the build rather than rendering a blank glyph.
    static func symbolName(for cond: Condition) -> String {
        switch cond {
        case .clear:  return "sun.max"        // plain sun, no ray cluster
        case .partly: return "cloud.sun"
        case .cloud:  return "cloud"
        case .rain:   return "cloud.rain"
        case .snow:   return "cloud.snow"
        case .fog:    return "cloud.fog"
        case .storm:  return "cloud.bolt.rain"
        case .night:  return "moon"           // no stars (matches app glyph)
        }
    }
}

// MARK: - Preview

#if DEBUG
#Preview("Glyph gallery — small + large") {
    VStack(spacing: 20) {
        // 16pt row (accessory-circular floor)
        HStack(spacing: 14) {
            ForEach(Condition.allCases, id: \.self) { cond in
                WeatherGlyph(cond: cond, size: 16)
            }
        }
        // 64pt row (large widget ceiling)
        VStack(spacing: 14) {
            ForEach(Condition.allCases, id: \.self) { cond in
                HStack {
                    WeatherGlyph(cond: cond, size: 64, weight: .regular)
                        .frame(width: 80)
                    Text(cond.rawValue).font(.system(size: 15))
                }
            }
        }
    }
    .foregroundStyle(Color.ink)
    .padding()
    .background(gradient(for: .clear))
}

#Preview("Glyph render modes") {
    HStack(spacing: 24) {
        WeatherGlyph(cond: .rain, size: 44)
            .environment(\.widgetRenderingMode, .fullColor)
        WeatherGlyph(cond: .rain, size: 44)
            .environment(\.widgetRenderingMode, .accented)
        WeatherGlyph(cond: .rain, size: 44)
            .environment(\.widgetRenderingMode, .vibrant)
    }
    .foregroundStyle(Color.ink)
    .padding()
    .background(gradient(for: .rain))
}
#endif
