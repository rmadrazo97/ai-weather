// ---------------------------------------------------------------------------
// WeatherEntry.swift — the single TimelineEntry shared by every widget family.
//
// COUNTERPART: src/widgets/snapshot.ts (TS writer) → WidgetSnapshot.swift reader.
// PRD 03 (Timeline Provider). One entry type feeds Small/Medium/Large +
// accessory (Circular/Rectangular/Inline) views (PRD 02).
//
// Each entry carries an already-projected `snapshot`: the provider advances
// `current.temp/cond/pop` and slices `hourly` so the view that renders this
// entry shows the correct hour without any further time math. Glyph/gradient
// and night are derived from `snapshot.current.cond` ONLY — `cond` already
// encodes night (ported wmoInfo: !isDay && code<=3 → .night), so there is no
// separate isNight axis to drift.
// ---------------------------------------------------------------------------

import WidgetKit
import Foundation

struct WeatherEntry: TimelineEntry {
    /// When WidgetKit should display this entry. Computed from the projected
    /// hour's machine-readable `ts` (+ snapshot tzOffsetMinutes), never from
    /// the display label `h` ("Now"/"3PM").
    let date: Date

    /// The snapshot to render, already advanced to `date`'s hour.
    let snapshot: WidgetSnapshot

    /// True when this entry was built from data older than the staleness gate
    /// (or from a snapshot whose `staleAt` was set). Drives the subtle in-widget
    /// stale indicator. PRD 01 owns the snapshot fields; this PRD owns the flag.
    let isStale: Bool

    /// Smart-Stack rotation hint, ranked by condition severity (storm/rain high).
    let relevance: TimelineEntryRelevance?

    /// The projected condition for this entry (== `snapshot.current.cond`).
    /// Views read glyph/gradient/night from here; exposed for convenience.
    var cond: Condition { snapshot.current.cond }
}
