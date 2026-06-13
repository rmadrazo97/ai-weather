// expo-shared-defaults
//
// Public API for the App Group UserDefaults bridge + WidgetKit reload.
// Native impl: modules/expo-shared-defaults/ios/ExpoSharedDefaultsModule.swift
// Snapshot serialization that uses these helpers lives in
// src/widgets/snapshot.ts (TS<->Swift WidgetSnapshot bridge).
//
// The native module is optional: it's only compiled into iOS dev/production
// builds. In Expo Go (and on Android) it's absent, so the binding is null and
// every helper below no-ops. The app's widget snapshots simply aren't written
// in those environments, which is correct — there's no widget host there.

import ExpoSharedDefaults from "./src/ExpoSharedDefaultsModule";

/** Whether the native App Group bridge is available (iOS dev/prod builds). */
export const isAvailable: boolean = ExpoSharedDefaults != null;

/** The App Group id backing the shared suite (empty when unavailable). */
export const appGroup: string = ExpoSharedDefaults?.appGroup ?? "";

/** Write a string into the App Group UserDefaults suite. */
export function setItem(key: string, value: string): void {
  ExpoSharedDefaults?.setItem(key, value);
}

/** Read a string from the App Group UserDefaults suite (null if absent). */
export function getItem(key: string): string | null {
  return ExpoSharedDefaults?.getItem(key) ?? null;
}

/** Remove a key from the App Group UserDefaults suite. */
export function removeItem(key: string): void {
  ExpoSharedDefaults?.removeItem(key);
}

/** Ask WidgetKit to rebuild all widget timelines. */
export function reloadAllTimelines(): void {
  ExpoSharedDefaults?.reloadAllTimelines();
}

export type { ExpoSharedDefaultsModule } from "./src/ExpoSharedDefaultsModule";
