// ---------------------------------------------------------------------------
// Local-first notifications — public surface.
//
//   deriveEvents(wx, now) -> DerivedEvent[]   (pure, see derive.ts)
//   ensurePermission() / schedule(events)     (side-effecting, see schedule.ts)
// ---------------------------------------------------------------------------

export { deriveEvents } from './derive';
export type { DerivedEvent } from './derive';
export { ensurePermission, schedule } from './schedule';
