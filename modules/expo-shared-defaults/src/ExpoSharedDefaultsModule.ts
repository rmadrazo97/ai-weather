// ExpoSharedDefaultsModule.ts
//
// Typed binding to the native ExpoSharedDefaults module.
// Counterpart: modules/expo-shared-defaults/ios/ExpoSharedDefaultsModule.swift
//
// This is the raw native module; prefer the named exports in
// modules/expo-shared-defaults/index.ts for app code.

import { requireOptionalNativeModule } from "expo";

export interface ExpoSharedDefaultsModule {
  /** The App Group id backing the shared suite (e.g. "group.com.myweatherai.app"). */
  readonly appGroup: string;
  /** Write a string into the App Group UserDefaults suite. */
  setItem(key: string, value: string): void;
  /** Read a string from the App Group UserDefaults suite (null if absent). */
  getItem(key: string): string | null;
  /** Remove a key from the App Group UserDefaults suite. */
  removeItem(key: string): void;
  /** Ask WidgetKit to rebuild all widget timelines. */
  reloadAllTimelines(): void;
}

// Native module name must match `Name("ExpoSharedDefaults")` in Swift.
// Optional: returns null in environments without the native module compiled in
// (e.g. Expo Go, Android), so importing this never throws at module load. The
// index.ts wrappers guard on null and no-op when it's absent.
export default requireOptionalNativeModule<ExpoSharedDefaultsModule>(
  "ExpoSharedDefaults"
);
