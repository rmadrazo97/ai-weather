// ---------------------------------------------------------------------------
// WeatherGlyph.swift — the 8 weather glyphs (custom-path SwiftUI port).
//
// COUNTERPART (source of truth): src/components/WeatherIcon.tsx — the app's
// react-native-svg stroke glyphs, authored on a 0…100 viewBox. This file is a
// 1:1 SwiftUI redraw of those exact paths so the widget matches the app pixel
// for pixel (PRD 02 US-002, custom-path fast-follow now landed).
//
// DESIGN DECISION: we draw custom `Shape`/`Path` glyphs (NOT SF Symbols) for
// the widget bodies. Rationale: brand fidelity — SF Symbols read heavier than
// the app's hairline strokes. Each glyph is STROKE-based and MONOCHROME (single
// foreground ink), so lock-screen `.vibrant`/`.accented` widget rendering tints
// it correctly. Fills (star/snow dots) reuse the same foreground colour.
//
// HARD CONSTRAINT — accessoryInline: custom `Path`s render BLANK in the inline
// family (it allows only Text + one SF Symbol). InlineWidgetView therefore does
// NOT use this view; it keeps its own local SF-Symbol mapping. See that file.
//
// PUBLIC API IS UNCHANGED: `WeatherGlyph(cond:)` (with the same optional
// `size:` and `weight:` params and ambient `foregroundStyle` colour) so every
// existing caller — Small/Medium/Large/Circular/Rectangular/Hourly/NowBlock —
// compiles untouched. `weight` now maps to relative stroke thickness rather
// than an SF Symbol font weight.
// ---------------------------------------------------------------------------

import SwiftUI
import WidgetKit  // for `\.widgetRenderingMode` in the render-mode preview

/// A single weather glyph for a `Condition`, drawn as monochrome stroked paths
/// that mirror `src/components/WeatherIcon.tsx`.
///
/// Legible from ~16pt (lock-screen accessory circular) to ~64pt (large widget).
/// Colour comes from the ambient `foregroundStyle`; in `.accented`/`.vibrant`
/// widget rendering modes the stroke is tinted by the system automatically.
///
/// PUBLIC API (unchanged): construct as `WeatherGlyph(cond:)`, optionally with
/// `size:` and `weight:`. Colour is the ambient foreground style.
struct WeatherGlyph: View {
    let cond: Condition
    /// Glyph size in points. Keep within the legible 16–64pt band.
    var size: CGFloat = 48
    /// Relative stroke thickness. Mirrors the API's old `Font.Weight` knob;
    /// heavier weights thicken the hairline stroke (see `strokeWidth`).
    var weight: Font.Weight = .regular

    var body: some View {
        WeatherGlyphShape(cond: cond)
            .stroke(
                style: StrokeStyle(
                    lineWidth: strokeWidth,
                    lineCap: .round,
                    lineJoin: .round
                )
            )
            // Filled accents (stars, snow dots) share the same path; fill them
            // with the ambient foreground so they read as solid dots, matching
            // WeatherIcon.tsx where those nodes use `fill={stroke}`.
            .background(
                WeatherGlyphFillShape(cond: cond).fill(.foreground)
            )
            // Inherit ink / vibrant tint rather than baking in any colour, so
            // lock-screen `.vibrant`/`.accented` modes tint the glyph cleanly.
            .foregroundStyle(.foreground)
            .frame(width: size, height: size)
    }

    /// Stroke width on the 0…100 design grid, scaled to `size`. Mirrors
    /// WeatherIcon.tsx: `strokeWidth = max(1.4, size * 0.045)`. We add a small
    /// weight bump so callers passing `.medium`/`.semibold` read a touch heavier
    /// at tiny sizes (Rectangular/Circular), preserving the old `weight` knob.
    private var strokeWidth: CGFloat {
        let base = max(1.4, size * 0.045)
        return base * Self.weightFactor(weight)
    }

    private static func weightFactor(_ weight: Font.Weight) -> CGFloat {
        switch weight {
        case .ultraLight, .thin, .light: return 0.85
        case .medium:                    return 1.12
        case .semibold:                  return 1.25
        case .bold, .heavy, .black:      return 1.4
        default:                         return 1.0  // .regular
        }
    }

    /// SF Symbol mapping per condition. RETAINED for any caller that needs a
    /// system symbol (custom paths can't render in `accessoryInline`). Kept in
    /// sync with InlineWidgetView's local fallback. No `default` so a new
    /// `Condition` fails the build rather than rendering a blank glyph.
    static func symbolName(for cond: Condition) -> String {
        switch cond {
        case .clear:  return "sun.max"
        case .partly: return "cloud.sun"
        case .cloud:  return "cloud"
        case .rain:   return "cloud.rain"
        case .snow:   return "cloud.snow"
        case .fog:    return "cloud.fog"
        case .storm:  return "cloud.bolt.rain"
        case .night:  return "moon"
        }
    }
}

// MARK: - Stroked path (the body of every glyph)

/// All stroked geometry for a condition, authored on the same 0…100 grid as
/// `WeatherIcon.tsx` and scaled into the view's rect. Drawing only — colour and
/// stroke width come from the caller's `.stroke(...)`/`.foregroundStyle(...)`.
private struct WeatherGlyphShape: Shape {
    let cond: Condition

    func path(in rect: CGRect) -> Path {
        // Uniform scale that preserves the square 0…100 viewBox aspect, then
        // centres it inside `rect` (matches SVG `viewBox="0 0 100 100"`).
        let s = min(rect.width, rect.height) / 100
        let dx = (rect.width - 100 * s) / 2
        let dy = (rect.height - 100 * s) / 2
        let g = GlyphGeometry(scale: s, dx: dx, dy: dy)

        var p = Path()
        switch cond {
        case .clear:  g.clearStrokes(&p)
        case .night:  g.nightStrokes(&p)
        case .partly: g.partlyStrokes(&p)
        case .cloud:  g.cloudStrokes(&p)
        case .rain:   g.rainStrokes(&p)
        case .snow:   g.snowStrokes(&p)
        case .fog:    g.fogStrokes(&p)
        case .storm:  g.stormStrokes(&p)
        }
        return p
    }
}

/// Filled accents only (the nodes WeatherIcon.tsx draws with `fill={stroke}`):
/// the two stars on `night` and the five snow dots on `snow`. Empty for every
/// other condition so the `.background(...).fill()` is a no-op.
private struct WeatherGlyphFillShape: Shape {
    let cond: Condition

    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 100
        let dx = (rect.width - 100 * s) / 2
        let dy = (rect.height - 100 * s) / 2
        let g = GlyphGeometry(scale: s, dx: dx, dy: dy)

        var p = Path()
        switch cond {
        case .night: g.nightDots(&p)
        case .snow:  g.snowDots(&p)
        default:     break
        }
        return p
    }
}

// MARK: - Geometry helpers (0…100 grid → view space)

/// Translates the 0…100 SVG coordinates from `WeatherIcon.tsx` into the view's
/// coordinate space. Every method below mirrors a `case` in that file 1:1.
private struct GlyphGeometry {
    let scale: CGFloat
    let dx: CGFloat
    let dy: CGFloat

    /// Map a design-grid point to view space.
    private func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: dx + x * scale, y: dy + y * scale)
    }
    /// Scale a design-grid length.
    private func len(_ v: CGFloat) -> CGFloat { v * scale }

    // -- primitives ---------------------------------------------------------

    private func line(_ p: inout Path, _ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat) {
        p.move(to: pt(x1, y1))
        p.addLine(to: pt(x2, y2))
    }

    private func circle(_ p: inout Path, cx: CGFloat, cy: CGFloat, r: CGFloat) {
        p.addEllipse(in: CGRect(
            x: dx + (cx - r) * scale,
            y: dy + (cy - r) * scale,
            width: len(r * 2),
            height: len(r * 2)
        ))
    }

    /// The shared cloud silhouette used by cloud/rain/snow/storm. `cy` shifts
    /// the cloud up so precipitation rows fit underneath (WeatherIcon.tsx uses
    /// the y=58 variant for those; y=70 for the bare `cloud`).
    /// Faithful re-trace of the SVG arc path:
    ///   M30 <base> a16 16 0 0 1 1 -31 a21 21 0 0 1 40 5 a13 13 0 0 1 -3 26 Z
    private func cloud(_ p: inout Path, base: CGFloat) {
        // SVG arcs use elliptical-arc semantics; SwiftUI lacks a direct
        // relative-arc builder, so we approximate each `a` segment with a cubic
        // whose endpoints match the SVG exactly. The control offsets are tuned
        // to reproduce the puffy lobes at all sizes.
        let start = CGPoint(x: 30, y: base)
        // a16 16 … 1 -31  → up the left lobe
        let aEnd = CGPoint(x: start.x + 1, y: start.y - 31)
        // a21 21 … 40 5    → over the top
        let bEnd = CGPoint(x: aEnd.x + 40, y: aEnd.y + 5)
        // a13 13 … -3 26   → down the right lobe
        let cEnd = CGPoint(x: bEnd.x - 3, y: bEnd.y + 26)

        p.move(to: pt(start.x, start.y))
        // left lobe (bulges left/up)
        p.addCurve(
            to: pt(aEnd.x, aEnd.y),
            control1: pt(start.x - 13, start.y - 9),
            control2: pt(aEnd.x - 13, aEnd.y + 9)
        )
        // top lobe (bulges up)
        p.addCurve(
            to: pt(bEnd.x, bEnd.y),
            control1: pt(aEnd.x + 6, aEnd.y - 18),
            control2: pt(bEnd.x - 18, bEnd.y - 19)
        )
        // right lobe (bulges right/down)
        p.addCurve(
            to: pt(cEnd.x, cEnd.y),
            control1: pt(bEnd.x + 13, bEnd.y + 4),
            control2: pt(cEnd.x + 11, cEnd.y - 13)
        )
        // close along the flat base back to start
        p.closeSubpath()
    }

    // -- conditions (1:1 with WeatherIcon.tsx) ------------------------------

    /// clear: sun circle r=17 at (50,50) + 8 rays from r=26 to r=34.
    func clearStrokes(_ p: inout Path) {
        let cx: CGFloat = 50, cy: CGFloat = 50
        circle(&p, cx: cx, cy: cy, r: 17)
        for deg in stride(from: 0, to: 360, by: 45) {
            let rad = CGFloat(deg) * .pi / 180
            line(&p,
                 cx + 26 * cos(rad), cy + 26 * sin(rad),
                 cx + 34 * cos(rad), cy + 34 * sin(rad))
        }
    }

    /// night: crescent (two arcs). WeatherIcon.tsx path:
    ///   M64 22 A30 30 0 1 0 78 64 A24 24 0 0 1 64 22 Z
    /// Outer arc sweeps the big circle, inner arc carves the crescent bite.
    func nightStrokes(_ p: inout Path) {
        // Outer circle centre/radius from the A30 arc between (64,22)→(78,64).
        // The large-arc/sweep flags trace the long way round a 30-radius circle.
        // We reproduce it as an explicit arc on its geometric centre.
        let outerStart = pt(64, 22)
        p.move(to: outerStart)
        // Big sweep: large-arc, counter-clockwise (sweep 0) to (78,64).
        // Centre of a 30-r circle through both points (chosen to match the
        // crescent's open-left orientation in the app).
        addSVGArc(&p, to: pt(78, 64), r: 30, largeArc: true, clockwise: false)
        // Inner bite: 24-r arc back to the start (sweep 1 / clockwise).
        addSVGArc(&p, to: pt(64, 22), r: 24, largeArc: false, clockwise: true)
        p.closeSubpath()
    }

    /// night fill: the two stars (filled dots).
    func nightDots(_ p: inout Path) {
        circle(&p, cx: 32, cy: 30, r: 1.6)
        circle(&p, cx: 22, cy: 46, r: 1.2)
    }

    /// partly: small sun (arc + 4 rays) behind a smaller cloud.
    func partlyStrokes(_ p: inout Path) {
        let cx: CGFloat = 60, cy: CGFloat = 36
        // Sun arc: M(cx-11)(cy+4) a11 11 0 1 1 18 8  → ~3/4 sun behind the cloud.
        let arcStart = CGPoint(x: cx - 11, y: cy + 4)
        let arcEnd = CGPoint(x: arcStart.x + 18, y: arcStart.y + 8)
        p.move(to: pt(arcStart.x, arcStart.y))
        addSVGArc(&p, to: pt(arcEnd.x, arcEnd.y), r: 11, largeArc: true, clockwise: true)

        // 4 rays at 225/270/315/0° from r=17 to r=24.
        for deg in [225, 270, 315, 0] {
            let rad = CGFloat(deg) * .pi / 180
            line(&p,
                 cx + 17 * cos(rad), cy + 17 * sin(rad),
                 cx + 24 * cos(rad), cy + 24 * sin(rad))
        }

        // Smaller foreground cloud:
        //   M26 78 a13 13 0 0 1 1 -25 a17 17 0 0 1 33 4 a11 11 0 0 1 -3 21 Z
        partlyCloud(&p)
    }

    /// The smaller front cloud on `partly` (distinct radii from the main cloud).
    private func partlyCloud(_ p: inout Path) {
        let start = CGPoint(x: 26, y: 78)
        let aEnd = CGPoint(x: start.x + 1, y: start.y - 25)
        let bEnd = CGPoint(x: aEnd.x + 33, y: aEnd.y + 4)
        let cEnd = CGPoint(x: bEnd.x - 3, y: bEnd.y + 21)

        p.move(to: pt(start.x, start.y))
        p.addCurve(
            to: pt(aEnd.x, aEnd.y),
            control1: pt(start.x - 11, start.y - 7),
            control2: pt(aEnd.x - 11, aEnd.y + 7)
        )
        p.addCurve(
            to: pt(bEnd.x, bEnd.y),
            control1: pt(aEnd.x + 5, aEnd.y - 14),
            control2: pt(bEnd.x - 15, bEnd.y - 15)
        )
        p.addCurve(
            to: pt(cEnd.x, cEnd.y),
            control1: pt(bEnd.x + 11, bEnd.y + 3),
            control2: pt(cEnd.x + 9, cEnd.y - 11)
        )
        p.closeSubpath()
    }

    /// cloud: the bare cloud silhouette (base y=70 variant).
    func cloudStrokes(_ p: inout Path) {
        cloud(&p, base: 70)
    }

    /// rain: cloud (base y=58) + three slanted drops.
    func rainStrokes(_ p: inout Path) {
        cloud(&p, base: 58)
        line(&p, 34, 70, 30, 82)
        line(&p, 50, 70, 46, 84)
        line(&p, 66, 70, 62, 82)
    }

    /// snow strokes: just the cloud (base y=58). Dots are filled separately.
    func snowStrokes(_ p: inout Path) {
        cloud(&p, base: 58)
    }

    /// snow fill: five flake dots (r=2.2).
    func snowDots(_ p: inout Path) {
        circle(&p, cx: 34, cy: 72, r: 2.2)
        circle(&p, cx: 50, cy: 78, r: 2.2)
        circle(&p, cx: 66, cy: 72, r: 2.2)
        circle(&p, cx: 42, cy: 84, r: 2.2)
        circle(&p, cx: 58, cy: 86, r: 2.2)
    }

    /// fog: three horizontal bars at y=40/52/64 (middle bar inset).
    func fogStrokes(_ p: inout Path) {
        line(&p, 22, 40, 78, 40)
        line(&p, 28, 52, 72, 52)
        line(&p, 22, 64, 78, 64)
    }

    /// storm: cloud (base y=58) + a lightning bolt polyline (closed).
    func stormStrokes(_ p: inout Path) {
        cloud(&p, base: 58)
        // M52 64 L42 78 L50 78 L46 90 L58 74 L50 74 L56 64 Z
        p.move(to: pt(52, 64))
        p.addLine(to: pt(42, 78))
        p.addLine(to: pt(50, 78))
        p.addLine(to: pt(46, 90))
        p.addLine(to: pt(58, 74))
        p.addLine(to: pt(50, 74))
        p.addLine(to: pt(56, 64))
        p.closeSubpath()
    }

    // -- SVG arc → SwiftUI arc -----------------------------------------------

    /// Adds an arc that ends at `to`, reproducing an SVG elliptical-arc segment
    /// (`A r r 0 largeArc sweep x y`) for the equal-radii (circular) case used
    /// by every glyph here. We derive the circle centre from the current path
    /// endpoint and `to`, then add the corresponding `addArc` sweep.
    private func addSVGArc(
        _ p: inout Path,
        to end: CGPoint,
        r designRadius: CGFloat,
        largeArc: Bool,
        clockwise: Bool
    ) {
        guard let start = p.currentPoint else {
            p.addLine(to: end)
            return
        }
        let radius = len(designRadius)

        // Midpoint and half-chord between the two endpoints.
        let mid = CGPoint(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
        let dxc = end.x - start.x
        let dyc = end.y - start.y
        let halfChord = (CGFloat(hypot(Double(dxc), Double(dyc)))) / 2

        // Clamp so a slightly-too-small radius (rounding) still yields a centre.
        let r = max(radius, halfChord)
        let h = sqrt(max(0, r * r - halfChord * halfChord))

        // Unit normal to the chord; the centre sits ±h along it. The sign is
        // chosen from largeArc/sweep to match the SVG's visual orientation.
        let chordLen = max(0.0001, hypot(dxc, dyc))
        let nx = -dyc / chordLen
        let ny = dxc / chordLen
        // SVG: when largeArc == sweep the centre is on one side, else the other.
        let sign: CGFloat = (largeArc == clockwise) ? 1 : -1
        let center = CGPoint(x: mid.x + sign * h * nx, y: mid.y + sign * h * ny)

        let startAngle = atan2(start.y - center.y, start.x - center.x)
        let endAngle = atan2(end.y - center.y, end.x - center.x)

        p.addArc(
            center: center,
            radius: r,
            startAngle: .radians(Double(startAngle)),
            endAngle: .radians(Double(endAngle)),
            clockwise: !clockwise // SwiftUI's `clockwise` is screen-space inverted (y-down)
        )
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
