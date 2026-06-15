// ---------------------------------------------------------------------------
// RefreshIntent.swift — interactive "Refresh Weather" button (PRD polish, iOS 17+).
//
// An `AppIntent` driven by a widget `Button(intent:)`. Tapping it forces the
// system to rebuild every widget timeline so the Large view re-renders with the
// latest pushed snapshot (or a fresh on-demand fetch). No parameters, no UI.
//
// FULLY GATED on iOS 17: `Button(intent:)` and interactive-widget `AppIntent`
// execution are iOS 17 APIs. The suite floor is 16.4 (PRD 00 FR-5), so the
// caller in LargeWidgetView wraps the button in `if #available(iOS 17.0, *)`
// and iOS 16 simply never shows the control. This file compiles against the
// iOS 17 SDK paths only and is unreachable on 16.x.
//
// Behaviour note: `reloadAllTimelines()` requests a refresh; WidgetKit still
// applies its own budget/coalescing, so this is best-effort, not a guaranteed
// instant network fetch. That is the documented platform behaviour.
// ---------------------------------------------------------------------------

import AppIntents
import WidgetKit

@available(iOS 17.0, *)
struct RefreshIntent: AppIntent {
    static var title: LocalizedStringResource = "Refresh Weather"

    /// Asks WidgetKit to rebuild every timeline. The provider then re-emits the
    /// latest snapshot (and, for configured non-active cities, may re-fetch).
    func perform() async throws -> some IntentResult {
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
