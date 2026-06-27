// ---------------------------------------------------------------------------
// MetricTiles.swift — colorful metric tiles + AQI severity bar (home families).
//
// COUNTERPART: the app's new colorful detail tiles (hero/details cards) over the
// same WidgetSnapshot the TS writer (src/widgets/snapshot.ts) produces. Reads
// only NAMED decoded fields; every richer field is OPTIONAL on the snapshot
// (dir/uvWord/dew may be nil on older writes or the keyless fallback fetch), so
// each builder guards nil and simply omits the tile when the datum is absent.
//
// These sit on top of the existing per-condition gradient container (the "soft
// sky-gradient"); tiles are translucent white cards with a colored SF Symbol so
// they stay vibrant-but-legible on the warm gradient. HOME families only — the
// lock-screen accessory families stay minimal/monochrome (see AccessorySupport).
//
// All of these are DECORATIVE for VoiceOver: the card's combined
// "city, temp, condition" a11y label (WidgetSupport.a11yLabel) already carries
// the headline, so the tile rows are `.accessibilityHidden(true)` at the call
// sites to avoid a noisy element-by-element announce.
// ---------------------------------------------------------------------------

import SwiftUI

// MARK: - Metric accent palette

/// Vibrant accent tints for the metric tiles. Chosen to read clearly on the warm
/// per-condition gradients while echoing the app's colorful detail tiles. These
/// are full-color (home widgets render `.fullColor`); they carry no semantic
/// meaning required on the lock screen, where these tiles are never used.
enum MetricPalette {
    static let feels   = Color(hex: 0xe0556e) // warm pink/red
    static let humidity = Color(hex: 0x3f6fb0) // rain blue
    static let wind    = Color(hex: 0x2c9c8f) // teal
    static let uv      = Color(hex: 0xe8861e) // amber
    static let precip  = Color(hex: 0x3f8fd6) // sky blue
    static let dew     = Color(hex: 0x4aa3c7) // cyan
    static let sun     = Color(hex: 0xf0a72e) // sun gold
}

// MARK: - AQI severity scale (US EPA bands, mirrors aqiWord in weatherApi.ts)

/// US-AQI severity colors and 0…300 domain used by the gradient bar. The band
/// breakpoints mirror `aqiWord` in src/data/weatherApi.ts (50/100/150/200/300).
enum AQIScale {
    /// Upper bound of the gradient domain; values clamp here so 300+ pins right.
    static let domainMax: Double = 300

    static let good      = Color(hex: 0x3fb55b) // ≤ 50
    static let moderate  = Color(hex: 0xe6c12e) // ≤ 100
    static let usg       = Color(hex: 0xe8861e) // ≤ 150
    static let unhealthy = Color(hex: 0xdf4b4b) // ≤ 200
    static let veryBad   = Color(hex: 0x9b59b6) // ≤ 300 (and 300+ Hazardous)

    /// The five-stop gradient (green → yellow → orange → red → purple) laid out
    /// at the real US-AQI breakpoints over the 0…300 domain.
    static var gradient: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: good,      location: 0.0),
                .init(color: good,      location: 50.0 / 300),
                .init(color: moderate,  location: 100.0 / 300),
                .init(color: usg,       location: 150.0 / 300),
                .init(color: unhealthy, location: 200.0 / 300),
                .init(color: veryBad,   location: 1.0),
            ],
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    /// Solid tint for the dot/number at a given AQI (nearest band color).
    static func tint(for aqi: Int) -> Color {
        switch aqi {
        case ..<51:   return good
        case ..<101:  return moderate
        case ..<151:  return usg
        case ..<201:  return unhealthy
        default:      return veryBad
        }
    }

    /// 0…1 marker position for `aqi` over the 0…300 domain (clamped).
    static func fraction(for aqi: Int) -> CGFloat {
        CGFloat(min(max(Double(aqi), 0), domainMax) / domainMax)
    }
}

// MARK: - Tile card chrome

extension View {
    /// Paints the frosted tile card chrome behind a metric tile's content. Kept
    /// thin and light so the condition gradient still reads through (the app's
    /// frosted tile look). One place to tune corner radius / fill across tiles.
    func tileCard(cornerRadius: CGFloat = 12) -> some View {
        self.background(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(Color.white.opacity(0.4))
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .stroke(Color.white.opacity(0.35), lineWidth: 0.5)
                )
        )
    }
}

// MARK: - Slim metric chip (icon + value + label)

/// A compact colorful metric chip: a tinted SF Symbol, a bold value, and a small
/// muted label, on the frosted tile card. Used in the Medium/Large metric rows.
/// Horizontal layout so a row of 3 reads cleanly at widget sizes.
struct MetricChip: View {
    let icon: String      // SF Symbol name (iOS 16-safe)
    let value: String
    let label: String
    let tint: Color
    var compact: Bool = false

    var body: some View {
        HStack(spacing: compact ? 5 : 6) {
            Image(systemName: icon)
                .font(.system(size: compact ? 12 : 14, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: compact ? 14 : 16)

            VStack(alignment: .leading, spacing: 0) {
                Text(value)
                    .font(.system(size: compact ? 13 : 15, weight: .bold))
                    .foregroundStyle(Color.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(label)
                    .font(.system(size: compact ? 9 : 10, weight: .semibold))
                    .foregroundStyle(Color.muted)
                    .textCase(.uppercase)
                    .tracking(0.3)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, compact ? 8 : 10)
        .padding(.vertical, compact ? 6 : 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tileCard()
    }
}

// MARK: - Metric model + builders from a snapshot

/// One renderable metric (already formatted for the current unit). The builder
/// below emits only the metrics whose underlying data is present, so callers can
/// `prefix(n)` into whatever row/grid count a family has room for.
struct Metric: Identifiable {
    let id: String
    let icon: String
    let value: String
    let label: String
    let tint: Color
}

enum MetricBuilder {
    /// Build the ordered metric set for a snapshot's current conditions. Order is
    /// by glanceable importance: feels, humidity, wind, UV, precip, dew. Optional
    /// data (dir/uvWord/dew) gracefully degrades — wind drops its direction and
    /// UV its word when absent, and the dew tile is omitted entirely when nil.
    static func metrics(for snapshot: WidgetSnapshot) -> [Metric] {
        let c = snapshot.current
        let unit = snapshot.unit
        var out: [Metric] = []

        out.append(Metric(
            id: "feels", icon: "thermometer.medium",
            value: Temp.format(c.feels, unit: unit),
            label: "Feels", tint: MetricPalette.feels
        ))
        out.append(Metric(
            id: "humidity", icon: "humidity.fill",
            value: "\(c.humidity)%",
            label: "Humidity", tint: MetricPalette.humidity
        ))
        out.append(Metric(
            id: "wind", icon: "wind",
            value: c.dir.map { "\(c.wind) \($0)" } ?? "\(c.wind)",
            label: "km/h", tint: MetricPalette.wind
        ))
        out.append(Metric(
            id: "uv", icon: "sun.max.fill",
            value: "\(c.uv)",
            label: c.uvWord ?? "UV index", tint: MetricPalette.uv
        ))
        out.append(Metric(
            id: "precip", icon: "umbrella.fill",
            value: "\(c.precipProb)%",
            label: "Precip", tint: MetricPalette.precip
        ))
        if let dew = c.dew {
            out.append(Metric(
                id: "dew", icon: "drop.fill",
                value: Temp.format(dew, unit: unit),
                label: "Dew point", tint: MetricPalette.dew
            ))
        }
        return out
    }
}

/// Renders a fixed-column grid of `MetricChip`s from a metric list. Uses a manual
/// row layout (not `LazyVGrid`) so it lays out deterministically inside the fixed
/// widget frame with no scroll/lazy behavior.
struct MetricGrid: View {
    let metrics: [Metric]
    var columns: Int = 3
    var compact: Bool = false
    var spacing: CGFloat = 6

    private var rows: [[Metric]] {
        stride(from: 0, to: metrics.count, by: columns).map {
            Array(metrics[$0 ..< min($0 + columns, metrics.count)])
        }
    }

    var body: some View {
        VStack(spacing: spacing) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: spacing) {
                    ForEach(row) { m in
                        MetricChip(icon: m.icon, value: m.value, label: m.label,
                                   tint: m.tint, compact: compact)
                    }
                    // Pad a short final row so chips keep a consistent width.
                    if row.count < columns {
                        ForEach(0 ..< (columns - row.count), id: \.self) { _ in
                            Color.clear.frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - AQI severity bar (the colorful centerpiece)

/// The Air Quality readout: a colored severity gradient bar (green → yellow →
/// red → purple) with a marker dot at the live AQI position, plus the numeric
/// AQI and its qualitative word. Renders nothing when the snapshot carries no
/// `aqi` (older write / keyless fallback). The whole control is one combined
/// VoiceOver element so it announces "Air quality, 32, Good".
struct AQIBar: View {
    let aqi: Int
    let word: String?
    /// Compact mode (Medium) tightens the type + bar height.
    var compact: Bool = false

    private var tint: Color { AQIScale.tint(for: aqi) }

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 4 : 6) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("Air Quality")
                    .font(.system(size: compact ? 10 : 11, weight: .bold))
                    .textCase(.uppercase)
                    .tracking(0.6)
                    .foregroundStyle(Color.muted)
                Spacer(minLength: 4)
                Text("\(aqi)")
                    .font(.system(size: compact ? 14 : 16, weight: .heavy))
                    .foregroundStyle(Color.ink)
                if let word = word, !word.isEmpty {
                    Text(word)
                        .font(.system(size: compact ? 10 : 11, weight: .bold))
                        .foregroundStyle(tint)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }

            severityBar
                .frame(height: compact ? 8 : 10)
        }
        .padding(.horizontal, compact ? 10 : 12)
        .padding(.vertical, compact ? 7 : 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tileCard(cornerRadius: 14)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Air quality \(aqi)\(word.map { ", \($0)" } ?? "")")
    }

    /// The gradient capsule + a white marker dot at the live AQI fraction.
    private var severityBar: some View {
        GeometryReader { geo in
            let frac = AQIScale.fraction(for: aqi)
            let dot = geo.size.height + 2
            Capsule()
                .fill(AQIScale.gradient)
                .overlay(alignment: .leading) {
                    Circle()
                        .fill(Color.white)
                        .overlay(Circle().stroke(tint, lineWidth: 2))
                        .frame(width: dot, height: dot)
                        // Clamp the dot fully inside the bar at both ends.
                        .offset(x: min(max(geo.size.width * frac - dot / 2, 0),
                                       geo.size.width - dot))
                        .shadow(color: Color.ink.opacity(0.18), radius: 1, y: 0.5)
                }
        }
    }
}

// MARK: - Compact AQI pill (systemSmall)

/// A one-line AQI pill for the tight systemSmall frame: a band-tinted dot, the
/// numeric AQI, and the qualitative word (truncating). Decorative for VoiceOver
/// (the card's combined label already conveys conditions).
struct AQIPill: View {
    let aqi: Int
    let word: String?

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(AQIScale.tint(for: aqi))
                .frame(width: 8, height: 8)
            Text("AQI \(aqi)")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.ink)
            if let word = word, !word.isEmpty {
                Text(word)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .tileCard(cornerRadius: 10)
        .accessibilityHidden(true)
    }
}

// MARK: - Preview

#if DEBUG
#Preview("Metric tiles + AQI bar") {
    VStack(spacing: 12) {
        AQIBar(aqi: 32, word: "Good")
        AQIBar(aqi: 128, word: "Unhealthy for Sensitive Groups", compact: true)
        AQIBar(aqi: 260, word: "Very Unhealthy")
        MetricGrid(metrics: MetricBuilder.metrics(for: SnapshotStore.placeholder), columns: 3)
    }
    .padding()
    .background(gradient(for: .clear))
}
#endif
