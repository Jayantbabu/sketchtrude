import type { SceneObjectType } from "./object-capabilities";

export type SelectionSource =
  | "canvas"
  | "layer-panel"
  | "keyboard"
  | "programmatic";

export type SelectionState = {
  selectedIds: string[];
  primarySelectedId: string | null;
  hoveredId: string | null;
  /** Active layer for drawing / panel focus (shared with LayerEngine). */
  focusedLayerId: string | null;
  /**
   * Object currently being edited in-place (group enter, path edit, etc.).
   * Escape exits this context before clearing selection.
   */
  activeEditContextId: string | null;
  /** Sub-element within the primary selection (face, vertex, opening, …). */
  selectedSubElementId: string | null;
  selectionSource: SelectionSource;
  isolationRootId: string | null;
  /** @deprecated Prefer activeEditContextId — kept for Phase 2B callers. */
  editingPathId: string | null;
  selectedFaceId: string | null;
};

export type SelectionChangedEvent = {
  type: "selection-changed";
  selectedIds: string[];
  primarySelectedId: string | null;
  source: SelectionSource;
};

export type SceneInteractionEvent =
  | SelectionChangedEvent
  | { type: "object-renamed"; objectId: string }
  | { type: "object-reparented"; objectId: string }
  | { type: "object-reordered"; objectId: string }
  | { type: "visibility-changed"; objectId: string }
  | { type: "lock-changed"; objectId: string }
  | { type: "transform-committed"; objectIds: string[] }
  | { type: "object-deleted"; objectIds: string[] };

export type Vector3 = { x: number; y: number; z: number };

export type ObjectTransform = {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
};

export type SceneObject = {
  id: string;
  type: SceneObjectType;
  name: string;
  parentId: string | null;
  childIds: string[];
  layerId: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  transform: ObjectTransform;
  geometry?: Record<string, unknown>;
  style?: Record<string, unknown>;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type SceneGraph = {
  rootIds: string[];
  objectsById: Record<string, SceneObject>;
};

export function createEmptySelectionState(): SelectionState {
  return {
    selectedIds: [],
    primarySelectedId: null,
    hoveredId: null,
    focusedLayerId: null,
    activeEditContextId: null,
    selectedSubElementId: null,
    selectionSource: "programmatic",
    isolationRootId: null,
    editingPathId: null,
    selectedFaceId: null,
  };
}

export function createIdentityTransform(
  x = 0,
  y = 0,
  z = 0,
): ObjectTransform {
  return {
    position: { x, y, z },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

export function createSceneObjectId(prefix = "obj"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
