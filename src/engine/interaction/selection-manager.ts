import {
  capabilityRegistry,
  type ObjectCapabilityRegistry,
} from "./object-capabilities";
import {
  createEmptySelectionState,
  type SelectionChangedEvent,
  type SelectionSource,
  type SelectionState,
} from "./selection-state";

export type SelectionListener = (event: SelectionChangedEvent) => void;

export type SelectionManagerOptions = {
  capabilities?: ObjectCapabilityRegistry;
  /** Returns true when the object may be selected (visible, not locked for canvas, etc.). */
  canSelect?: (objectId: string, source: SelectionSource) => boolean;
};

/**
 * Single global selection authority.
 * Selection-only changes must not mark the project dirty.
 */
export class SelectionManager {
  private state: SelectionState = createEmptySelectionState();
  private readonly listeners = new Set<SelectionListener>();
  private readonly capabilities: ObjectCapabilityRegistry;
  private readonly canSelect: (
    objectId: string,
    source: SelectionSource,
  ) => boolean;

  constructor(options: SelectionManagerOptions = {}) {
    this.capabilities = options.capabilities ?? capabilityRegistry;
    this.canSelect = options.canSelect ?? (() => true);
  }

  getState(): SelectionState {
    return { ...this.state, selectedIds: [...this.state.selectedIds] };
  }

  subscribe(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Replace selection with a single object (or clear if null). */
  select(
    objectId: string | null,
    source: SelectionSource = "programmatic",
  ): void {
    if (objectId == null) {
      this.clear(source);
      return;
    }
    if (!this.canSelect(objectId, source)) return;
    this.commit([objectId], objectId, source);
  }

  /** Shift-click / multi-select toggle. */
  toggle(objectId: string, source: SelectionSource = "canvas"): void {
    if (!this.canSelect(objectId, source)) return;
    const set = new Set(this.state.selectedIds);
    if (set.has(objectId)) {
      set.delete(objectId);
      const next = [...set];
      this.commit(next, next[next.length - 1] ?? null, source);
      return;
    }
    set.add(objectId);
    this.commit([...set], objectId, source);
  }

  /** Add without removing existing (marquee add mode). */
  add(objectIds: string[], source: SelectionSource = "canvas"): void {
    const set = new Set(this.state.selectedIds);
    let primary = this.state.primarySelectedId;
    for (const id of objectIds) {
      if (!this.canSelect(id, source)) continue;
      set.add(id);
      primary = id;
    }
    this.commit([...set], primary, source);
  }

  setMany(
    objectIds: string[],
    source: SelectionSource = "programmatic",
    primaryId?: string | null,
  ): void {
    const allowed = objectIds.filter((id) => this.canSelect(id, source));
    const primary =
      primaryId && allowed.includes(primaryId)
        ? primaryId
        : (allowed[allowed.length - 1] ?? null);
    this.commit(allowed, primary, source);
  }

  clear(source: SelectionSource = "programmatic"): void {
    this.commit([], null, source);
  }

  setHovered(objectId: string | null): void {
    if (this.state.hoveredId === objectId) return;
    this.state = { ...this.state, hoveredId: objectId };
  }

  setIsolationRoot(objectId: string | null): void {
    this.state = { ...this.state, isolationRootId: objectId };
  }

  setEditingPath(objectId: string | null): void {
    this.state = { ...this.state, editingPathId: objectId };
  }

  setFocusedLayer(layerId: string | null): void {
    this.state = { ...this.state, focusedLayerId: layerId };
  }

  isSelected(objectId: string): boolean {
    return this.state.selectedIds.includes(objectId);
  }

  /** Capability helper used by interaction code. */
  isSelectableType(type: string): boolean {
    return this.capabilities.get(type).selectable;
  }

  private commit(
    selectedIds: string[],
    primarySelectedId: string | null,
    source: SelectionSource,
  ): void {
    const same =
      this.state.primarySelectedId === primarySelectedId &&
      this.state.selectionSource === source &&
      this.state.selectedIds.length === selectedIds.length &&
      this.state.selectedIds.every((id, i) => id === selectedIds[i]);
    if (same) return;

    this.state = {
      ...this.state,
      selectedIds,
      primarySelectedId,
      selectionSource: source,
    };

    const event: SelectionChangedEvent = {
      type: "selection-changed",
      selectedIds: [...selectedIds],
      primarySelectedId,
      source,
    };
    for (const listener of this.listeners) listener(event);
  }
}

export function createSelectionManager(
  options?: SelectionManagerOptions,
): SelectionManager {
  return new SelectionManager(options);
}
