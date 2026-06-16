// ---------------------------------------------------------------------------
// WidgetSupport.swift — shared view helpers for the home-screen families.
//
// COUNTERPART: drives the same WidgetSnapshot the TS writer (src/widgets/
// snapshot.ts) produces; reads only NAMED decoded fields (PRD 01 #5/#6).
//
// Owns the cross-family pieces that SmallWidgetView / MediumWidgetView /
// LargeWidgetView all reuse: the iOS-17-gated container background + content
// inset (FR-7), the stale badge, the no-data "Open AI Weather" empty state
// (US-006), the coarse time-of-day bucket derived from `sun` (US-003, NO
// clock), and the combined "city, temp, condition" VoiceOver label (US-007).
//
// EMPTY-STATE CONTRACT: the provider substitutes `SnapshotStore.placeholder`
// for a missing snapshot, so a view cannot tell "no data" from "Madrid sample"
// by inspecting fields. The Integrate phase routes the no-data path through the
// reserved sentinel city id `WidgetEmpty.sentinelCityId`; `entry.isEmptyState`
// reads that. Until then previews exercise both branches explicitly.
// ---------------------------------------------------------------------------

import SwiftUI
import WidgetKit

// MARK: - Empty-state sentinel

/// Reserved markers for the no-data / never-opened state (US-006). The
/// Integrate phase builds an entry whose `snapshot.city.id` is the sentinel id
/// when the App Group container has no usable snapshot; views key the empty
/// branch off it so they never render Madrid sample data as if it were live.
enum WidgetEmpty {
    /// City id the provider stamps onto the no-data entry. Not a real city.
    static let sentinelCityId = "wxai.empty"
    static let prompt = "Open AI Weather to set up"
}

extension WeatherEntry {
    /// True when this entry is the reserved no-data placeholder (US-006), so the
    /// family renders the "Open AI Weather" prompt instead of sample zeros.
    var isEmptyState: Bool { snapshot.city.id == WidgetEmpty.sentinelCityId }
}

// MARK: - Coarse time-of-day (Large header) — derived from `sun`, NEVER a clock

/// Coarse bucket for the Large header. Derived ONLY from `sun.isNight` /
/// `sun.sunPct`; the snapshot carries no wall-clock time, so no `H:MM AM/PM`
/// string is ever produced (US-003 / Non-Goal). Four bands: night + early/mid/
/// late day, finalized per PRD Open Question.
enum TimeOfDay {
    case night, earlyDay, midDay, lateDay

    init(sun: WidgetSnapshot.SunInfo) {
        if sun.isNight {
            self = .night
        } else if sun.sunPct < 0.34 {
            self = .earlyDay
        } else if sun.sunPct < 0.67 {
            self = .midDay
        } else {
            self = .lateDay
        }
    }

    /// Verbatim display label (suite Non-Goal: no widget-side localization).
    var label: String {
        switch self {
        case .night:    return "Tonight"
        case .earlyDay: return "This morning"
        case .midDay:   return "This afternoon"
        case .lateDay:  return "This evening"
        }
    }
}

// MARK: - Accessibility label

/// The combined "city, temp, condition" VoiceOver string every family exposes
/// via `accessibilityElement(children: .combine)` (US-007). Reads the spelled
/// "degrees" rather than the `°` glyph so VoiceOver announces it cleanly.
func a11yLabel(for snapshot: WidgetSnapshot) -> String {
    let degrees = snapshot.unit == "F"
        ? Int((Double(snapshot.current.temp) * 9 / 5 + 32).rounded())
        : snapshot.current.temp
    return "\(snapshot.city.name), \(degrees) degrees, \(snapshot.current.label)"
}

// MARK: - Stale badge

/// Subtle "stale data" indicator shown when `entry.isStale` (US-001). A small
/// muted clock glyph in the corner — non-intrusive, hidden from VoiceOver
/// (the freshness caveat isn't part of the "city, temp, condition" announce).
struct StaleBadge: View {
    var body: some View {
        Image(systemName: "clock.arrow.circlepath")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Color.muted)
            .accessibilityHidden(true)
    }
}

// MARK: - No-data / empty state (US-006)

/// The "Open AI Weather to set up" view shared by all three families. Inherits
/// the neutral `.clear` gradient and stays accessible (VoiceOver reads the
/// prompt). Used when the App Group container has no usable snapshot, or a
/// decode failed (corrupt / future schemaVersion) and was routed here.
struct WidgetEmptyStateView: View {
    var body: some View {
        VStack(spacing: 8) {
            WeatherGlyph(cond: .partly, size: 30, weight: .regular)
                .foregroundStyle(Color.muted)
                .accessibilityHidden(true)
            Text("AI Weather")
                .kicker()
                .foregroundStyle(Color.ink)
            Text(WidgetEmpty.prompt)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.muted)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
        .widgetContainer(gradient: gradient(for: .clear))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(WidgetEmpty.prompt)
    }
}

// MARK: - Container background + inset (iOS 17 gate, FR-7)

extension View {
    /// Paints the condition gradient as the widget container background and
    /// applies a consistent inset. On iOS 17+ uses `.containerBackground(for:)`
    /// (the system also reserves content margins); on the 16.4 floor the
    /// gradient is laid behind a fixed-inset padding instead. `ViewThatFits`
    /// (16+) handles the rest of the resilient layout (FR-7).
    @ViewBuilder
    func widgetContainer<G: ShapeStyle>(gradient: G, inset: CGFloat = 16) -> some View {
        if #available(iOS 17, *) {
            self.containerBackground(gradient, for: .widget)
        } else {
            self
                .padding(inset)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(gradient)
        }
    }
}

// MARK: - Preview harness (DEBUG only)

#if DEBUG
/// Approximate home-screen widget point sizes (iPhone, ~390pt class) used to
/// validate layout in plain SwiftUI previews. The Widget/WidgetBundle that
/// hosts these views with real `.systemSmall/.systemMedium/.systemLarge`
/// sizing is authored in the Integrate phase; here we frame to representative
/// sizes so the canvas catches clipping at the real point sizes (FR-4).
enum WidgetPreviewFamily {
    case small, medium, large
    var size: CGSize {
        switch self {
        case .small:  return CGSize(width: 170, height: 170)
        case .medium: return CGSize(width: 364, height: 170)
        case .large:  return CGSize(width: 364, height: 382)
        }
    }
}

/// Lays the provided widget views out at their real point size, clipped to the
/// widget corner radius, so the canvas exercises clipping/Dynamic-Type exactly
/// as WidgetKit would. `containerBackground(for:.widget)` is a no-op outside a
/// widget host, so we apply the gradient behind the clip for visual parity.
struct WidgetPreviewGrid: View {
    let family: WidgetPreviewFamily
    let views: [AnyView]

    init(family: WidgetPreviewFamily, @WidgetPreviewBuilder _ content: () -> [AnyView]) {
        self.family = family
        self.views = content()
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                ForEach(Array(views.enumerated()), id: \.offset) { _, view in
                    view
                        .frame(width: family.size.width, height: family.size.height)
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .stroke(Color.hair, lineWidth: 1)
                        )
                }
            }
            .padding()
        }
    }
}

@resultBuilder
enum WidgetPreviewBuilder {
    static func buildBlock(_ components: AnyView...) -> [AnyView] { components }
}
#endif
