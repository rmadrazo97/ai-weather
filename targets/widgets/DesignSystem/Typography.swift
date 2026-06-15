// ---------------------------------------------------------------------------
// Typography.swift — type tokens (SwiftUI port)
//
// COUNTERPART: the app's text hierarchy (App.tsx hero temp, kicker labels,
// stat values, body copy). The app uses Helvetica Neue / system on iOS; the
// widget uses the SYSTEM font with matching weights — custom fonts in an
// extension require bundling a font file + an Info.plist `UIAppFonts` entry,
// which we avoid (PRD 02 US-003, Open Questions: system `.heavy`/`.bold` first).
//
// Degree handling lives in `Temp.format` (Tokens.swift), NOT here: `fmtTemp`
// returns a number and the `°` is appended with no space — none of these font
// helpers add a degree sign.
// ---------------------------------------------------------------------------

import SwiftUI

extension Font {
    /// Hero / display temperature — system heavy, caller-supplied size.
    /// Mirrors the app's heavy display typeface for the big temp readout.
    static func displayTemp(_ size: CGFloat) -> Font {
        .system(size: size, weight: .heavy)
    }

    /// Kicker label — 12pt bold. Uppercase + tracking are applied by the
    /// `.kicker()` view modifier (tracking is a text modifier, not a Font).
    static var kicker: Font {
        .system(size: 12, weight: .bold)
    }

    /// Stat value — ~18pt bold (humidity/wind/etc. numerals).
    static var statValue: Font {
        .system(size: 18, weight: .bold)
    }

    /// Body copy — ~15pt regular.
    static var body15: Font {
        .system(size: 15, weight: .regular)
    }
}

extension Text {
    /// Applies the full kicker treatment: 12pt bold + uppercased + tracking.
    /// Use on a `Text` so the uppercasing happens on the string content.
    func kicker() -> some View {
        self
            .textCase(.uppercase)
            .font(.kicker)
            .tracking(0.8)
    }
}

extension View {
    /// View-level kicker tracking helper for non-`Text` containers that still
    /// want the 12pt-bold + tracking treatment (uppercasing must be on `Text`).
    func kickerStyle() -> some View {
        self
            .font(.kicker)
            .tracking(0.8)
    }
}

// MARK: - Preview

#if DEBUG
#Preview("Typography") {
    VStack(alignment: .leading, spacing: 12) {
        Text(Temp.format(21, unit: "C"))
            .font(.displayTemp(64))
        Text("Feels like")
            .kicker()
        Text("64%")
            .font(.statValue)
        Text("Clear skies through the afternoon with a light breeze.")
            .font(.body15)
    }
    .foregroundStyle(Color.ink)
    .padding()
    .background(gradient(for: .clear))
}
#endif
