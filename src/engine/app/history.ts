/**
 * History type helpers. Undo/redo implementation lives in layers.ts (initLayers)
 * because it is interleaved with layer ops — do not move that logic here yet.
 */
export type { HistoryEntry } from "./types";
import type { HistoryEntry } from "./types";

/** Cap a history/redo stack by entry count (simple helper; layers use budget-based _capHistory). */
export function capHistory(arr: HistoryEntry[], max = 40): void {
  while (arr.length > max) arr.shift();
}
