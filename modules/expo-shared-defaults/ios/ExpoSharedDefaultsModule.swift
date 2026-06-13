// ExpoSharedDefaultsModule.swift
//
// Mandatory app -> widget bridge. Writes to the App Group UserDefaults suite
// "group.com.myweatherai.app" and triggers WidgetKit timeline reloads.
//
// We do NOT use react-native-userdefaults because it cannot call
// WidgetCenter.shared.reloadAllTimelines() — the widget would never refresh
// after the app updates the shared snapshot.
//
// Counterparts:
//   - TS wrapper / public API:
//       modules/expo-shared-defaults/src/ExpoSharedDefaultsModule.ts
//       modules/expo-shared-defaults/index.ts
//   - Widget read side: targets/widgets/ reads the same suite via
//       UserDefaults(suiteName: "group.com.myweatherai.app").
//   - Snapshot keys (schemaVersion 1): wxai.widget.active,
//       wxai.widget.snapshot.<cityId>, wxai.widget.index, wxai.widget.unit.

import ExpoModulesCore
import WidgetKit

private let kSuiteName = "group.com.myweatherai.app"

public class ExpoSharedDefaultsModule: Module {
  // Shared App Group suite. nil only if the App Group entitlement is missing
  // from the app target (see app.json ios.entitlements).
  private var defaults: UserDefaults? {
    UserDefaults(suiteName: kSuiteName)
  }

  public func definition() -> ModuleDefinition {
    Name("ExpoSharedDefaults")

    // The App Group id, exposed so JS can assert it matches the native suite.
    Constant("appGroup") {
      kSuiteName
    }

    Function("setItem") { (key: String, value: String) -> Void in
      self.defaults?.set(value, forKey: key)
    }

    Function("getItem") { (key: String) -> String? in
      self.defaults?.string(forKey: key)
    }

    Function("removeItem") { (key: String) -> Void in
      self.defaults?.removeObject(forKey: key)
    }

    // Ask WidgetKit to rebuild all timelines after a snapshot write.
    Function("reloadAllTimelines") { () -> Void in
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
