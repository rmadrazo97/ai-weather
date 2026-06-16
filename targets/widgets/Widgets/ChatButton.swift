// ---------------------------------------------------------------------------
// ChatButton.swift — quick-access "Ask the AI" button for the home widgets.
//
// Wraps a `Link` to `aiweather://chat` (WidgetDeepLink.chatURL), which App.tsx
// routes to the chat sheet. `Link` registers a SECOND tap target within the
// widget, which WidgetKit supports ONLY on systemMedium / systemLarge — NOT
// systemSmall or the accessory (lock-screen) families, which allow a single
// whole-widget `widgetURL` tap. So this button is used by MediumWidgetView and
// LargeWidgetView only; the constrained families keep their city `widgetURL`.
// ---------------------------------------------------------------------------

import SwiftUI
import WidgetKit

struct WidgetChatButton: View {
    /// Diameter of the circular tap target.
    var size: CGFloat = 26

    var body: some View {
        Link(destination: WidgetDeepLink.chatURL) {
            Image(systemName: "message.fill")
                .font(.system(size: size * 0.5, weight: .semibold))
                .foregroundStyle(Color.ink)
                .frame(width: size, height: size)
                .background(Circle().fill(Color.ink.opacity(0.08)))
                .overlay(Circle().stroke(Color.hair, lineWidth: 0.5))
        }
        .accessibilityLabel("Ask the AI about the weather")
    }
}
