/**
 * Canvas ↔ layer-panel selection synchronization contract.
 * Selection-only updates must never dirty autosave / mark the project dirty.
 */

import type { SelectionChangedEvent, SelectionSource } from "./selection-state";

export type SelectionSyncDirection = "canvas-to-layer" | "layer-to-canvas";

export type SelectionSyncPayload = {
  direction: SelectionSyncDirection;
  event: SelectionChangedEvent;
  /** Always true for selection-only traffic. */
  selectionOnly: true;
};

export function selectionSourceToDirection(
  source: SelectionSource,
): SelectionSyncDirection | null {
  if (source === "canvas") return "canvas-to-layer";
  if (source === "layer-panel") return "layer-to-canvas";
  return null;
}

export function toSelectionSyncPayload(
  event: SelectionChangedEvent,
): SelectionSyncPayload | null {
  const direction = selectionSourceToDirection(event.source);
  if (!direction) return null;
  return {
    direction,
    event,
    selectionOnly: true,
  };
}

/** Helper for dirty-trackers — selection changes never dirty the document. */
export function isSelectionOnlyEvent(
  event: { type: string } | null | undefined,
): boolean {
  return !!event && event.type === "selection-changed";
}
