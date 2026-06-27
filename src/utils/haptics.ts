// ---------------------------------------------------------------------------
// Tiny safe wrapper around expo-haptics.
//
// Haptics are a nicety, never a requirement: on devices/simulators without a
// Taptic Engine the native promise can reject. Every call swallows errors so a
// missing haptic motor never bubbles up into the UI.
// ---------------------------------------------------------------------------

import * as Haptics from 'expo-haptics';

// A medium tap — used for deliberate actions like opening a context menu.
export function tapHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

// A light selection tick — used when moving between/selecting items.
export function selectHaptic(): void {
  Haptics.selectionAsync().catch(() => {});
}
