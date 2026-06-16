// ---------------------------------------------------------------------------
// Gradients.swift — per-condition background gradients (SwiftUI port)
//
// COUNTERPART: src/utils/colors.ts `GRADIENTS`. The 8×5 hex stops and the
// shared [0, 0.2, 0.45, 0.7, 1] locations are transcribed VERBATIM from that
// file; the direction matches App.tsx:265-266 (start {0.8,0} → end {0.2,1}).
// If a stop changes in colors.ts, change it here too. See PRD 02 (US-001).
//
// The mapping is a `switch` with NO `default` clause: SwiftUI exhaustiveness
// checking turns a missing Condition into a COMPILE-TIME error (FR-7), so a
// condition can never silently render a blank background.
// ---------------------------------------------------------------------------

import SwiftUI

/// Shared stop locations for every condition (src/utils/colors.ts `locations`).
private let gradientLocations: [CGFloat] = [0, 0.2, 0.45, 0.7, 1]

/// Gradient direction, verbatim from App.tsx:265-266.
private let gradientStart = UnitPoint(x: 0.8, y: 0)
private let gradientEnd = UnitPoint(x: 0.2, y: 1)

/// Builds a 5-stop `LinearGradient` from 5 hex colors at the shared locations.
private func linearGradient(_ hexes: [Color]) -> LinearGradient {
    let stops = zip(hexes, gradientLocations).map { Gradient.Stop(color: $0, location: $1) }
    return LinearGradient(stops: stops, startPoint: gradientStart, endPoint: gradientEnd)
}

/// The same warm per-condition `LinearGradient` the app's hero uses.
///
/// No `default` clause — all 8 cases are explicit so a new `Condition` fails
/// the build until it gets a gradient (FR-7). Stops sourced from
/// `src/utils/colors.ts` `GRADIENTS` (PRD 02 transcription table).
func gradient(for cond: Condition) -> LinearGradient {
    switch cond {
    case .clear:
        return linearGradient([
            Color(hex: 0xffe6bf),
            Color(hex: 0xffd6a6),
            Color(hex: 0xfef5ea),
            Color(hex: 0xffc790),
            Color(hex: 0xfbecda),
        ])
    case .partly:
        return linearGradient([
            Color(hex: 0xfae3c4),
            Color(hex: 0xf0d7b8),
            Color(hex: 0xf8f2e9),
            Color(hex: 0xe3cfae),
            Color(hex: 0xf3e8d8),
        ])
    case .cloud:
        return linearGradient([
            Color(hex: 0xe4def0),
            Color(hex: 0xd6d3e6),
            Color(hex: 0xf3f1f8),
            Color(hex: 0xc8cfe0),
            Color(hex: 0xe9e7f1),
        ])
    case .rain:
        return linearGradient([
            Color(hex: 0xcfe1f4),
            Color(hex: 0xb6cfec),
            Color(hex: 0xeef5fc),
            Color(hex: 0xa3c0e6),
            Color(hex: 0xe0ecf8),
        ])
    case .night:
        return linearGradient([
            Color(hex: 0xd2d4f2),
            Color(hex: 0xc4c4ea),
            Color(hex: 0xeeecf8),
            Color(hex: 0xbcbfe4),
            Color(hex: 0xdddaf0),
        ])
    case .snow:
        return linearGradient([
            Color(hex: 0xe3f0fa),
            Color(hex: 0xd4e7f6),
            Color(hex: 0xf7fbfe),
            Color(hex: 0xc9e0f2),
            Color(hex: 0xecf4fb),
        ])
    case .fog:
        return linearGradient([
            Color(hex: 0xe8e4dd),
            Color(hex: 0xddd8d0),
            Color(hex: 0xf5f3ef),
            Color(hex: 0xd2cdc4),
            Color(hex: 0xece9e3),
        ])
    case .storm:
        return linearGradient([
            Color(hex: 0xc3cada),
            Color(hex: 0xb2bccf),
            Color(hex: 0xe3e7ef),
            Color(hex: 0xa5b1c8),
            Color(hex: 0xd3d9e5),
        ])
    }
}

// MARK: - Preview

#if DEBUG
#Preview("Gradient gallery") {
    ScrollView {
        VStack(spacing: 8) {
            ForEach(Condition.allCases, id: \.self) { cond in
                gradient(for: cond)
                    .frame(height: 60)
                    .overlay(
                        Text(cond.rawValue)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.ink)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding()
    }
}
#endif
