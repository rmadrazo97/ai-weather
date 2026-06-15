/**
 * @bacons/apple-targets widget extension config.
 *
 * Read by `@bacons/apple-targets` (registered in app.json `plugins`) at
 * `expo prebuild` time to generate the WidgetKit app-extension target. The
 * plugin discovers this file via the `targets/<name>/expo-target.config.js`
 * convention; all Swift sources in this directory are compiled into the
 * extension.
 *
 * Counterparts:
 *   - App-side App Group entitlement: app.json -> ios.entitlements
 *     ("com.apple.security.application-groups"). Both sides MUST list the
 *     identical group id or UserDefaults(suiteName:) returns nil.
 *   - Shared UserDefaults suite + WidgetCenter reloads:
 *     modules/expo-shared-defaults (TS<->Swift bridge from the app).
 *
 * NOTE: `deploymentTarget` MUST stay at "16.4" (suite-wide floor). The plugin
 * defaults a new target to iOS 18.0, which would silently exclude iOS 16/17
 * devices. Any iOS 17-only WidgetKit API must be `#available(iOS 17, *)`-gated.
 *
 * Confirm the exact schema against the installed @bacons/apple-targets README
 * at install time — the API has changed across major versions.
 */
module.exports = (config) => ({
  type: "widget",
  name: "AI Weather",
  // Suite-wide floor. Do NOT let this diverge from the app's 16.4 or rise to
  // the apple-targets 18.0 default.
  deploymentTarget: "16.4",
  bundleIdentifier: "com.myweatherai.app.widgets",
  // App Group shared container — byte-identical to app.json ios.entitlements.
  entitlements: {
    "com.apple.security.application-groups": ["group.com.myweatherai.app"],
  },
  // Optional gallery/accent colors. Safe defaults; refine in later PRDs.
  colors: {
    $accent: "#0a84ff",
    $widgetBackground: "#fef5ea",
  },
});
