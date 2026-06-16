// ---------------------------------------------------------------------------
// Tokens.swift — color tokens + unit-aware temperature formatting (SwiftUI)
//
// COUNTERPART: src/utils/colors.ts (INK/MUTED/FAINT/HAIR/RAIN_BLUE) and
// src/utils/helpers.ts (`fmtTemp`/`cToF`). The ink-RGB and rainBlue hex are
// transcribed VERBATIM. The alpha tokens are the SAME ink RGB painted with an
// opacity channel over whatever is beneath (the gradient) — NOT a composite
// over a solid background (PRD 02 US-004 / FR-6). Keep both files in sync.
// ---------------------------------------------------------------------------

import SwiftUI

extension Color {
    /// Builds a `Color` from a 0xRRGGBB integer literal (sRGB, opaque).
    /// Hex casing is insignificant (PRD 02 US-004).
    init(hex: UInt32) {
        let r = Double((hex >> 16) & 0xff) / 255
        let g = Double((hex >> 8) & 0xff) / 255
        let b = Double(hex & 0xff) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }

    // App ink palette — INK is opaque; the rest are ink RGB with an alpha
    // channel (rgba over transparent), per colors.ts. Painted over the
    // gradient, NOT blended against a background color.

    /// `#15131a` — primary ink. (colors.ts INK)
    static let ink = Color(hex: 0x15131a)

    /// `rgba(21,19,26,0.52)` — secondary text. (colors.ts MUTED)
    static let muted = Color.ink.opacity(0.52)

    /// `rgba(21,19,26,0.34)` — tertiary/de-emphasized. (colors.ts FAINT)
    static let faint = Color.ink.opacity(0.34)

    /// `rgba(21,19,26,0.14)` — hairline dividers. (colors.ts HAIR)
    static let hair = Color.ink.opacity(0.14)

    /// `#3f6fb0` — precipitation accent. (colors.ts RAIN_BLUE)
    static let rainBlue = Color(hex: 0x3f6fb0)
}

// MARK: - Temperature formatting

/// Unit-aware temperature formatting that reproduces the app's `fmtTemp`.
///
/// `fmtTemp` returns a NUMBER (helpers.ts) and the `°` (U+00B0) is appended at
/// each JSX call site with NO separating space; this helper folds the suffix in
/// so the rest of the widget never adds a degree sign (PRD 02 US-003/US-004).
enum Temp {
    /// Formats an integer-°C value for display.
    ///
    /// - Parameters:
    ///   - celsius: temperature in whole °C (already integer-rounded upstream).
    ///   - unit: `"F"` for Fahrenheit, anything else (`"C"`) for Celsius.
    /// - Returns: the value with a trailing `°` and no space, e.g. `"20°"`.
    ///
    /// Mirrors `cToF` = `Math.round(c * 9 / 5 + 32)`; rounds defensively even
    /// though the input is already integer.
    static func format(_ celsius: Int, unit: String) -> String {
        let value = unit == "F"
            ? Int((Double(celsius) * 9 / 5 + 32).rounded())
            : celsius
        return "\(value)°"
    }
}

// MARK: - Preview

#if DEBUG
#Preview("Tokens") {
    VStack(alignment: .leading, spacing: 12) {
        Text("ink 20°").foregroundStyle(Color.ink)
        Text("muted \(Temp.format(20, unit: "C"))").foregroundStyle(Color.muted)
        Text("faint \(Temp.format(0, unit: "F"))").foregroundStyle(Color.faint)
        Text("rainBlue \(Temp.format(-3, unit: "F"))").foregroundStyle(Color.rainBlue)
        Divider().overlay(Color.hair)
    }
    .font(.system(size: 18, weight: .bold))
    .padding()
    .background(gradient(for: .clear))
}
#endif
