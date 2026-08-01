/**
 * Sketchtrude hybrid scene graph — layer & object model.
 *
 * Hierarchy:
 *   Project → Floor / Artboard → Layer → Object → Child object
 *
 * Sketch layers stay fluid (strokes inside one row).
 * Architectural / object layers keep individually editable nodes.
 */

export type Vector2 = { x: number; y: number };
export type Vector3 = { x: number; y: number; z: number };
export type Point3D = Vector3;

/** Four levels of the hybrid scene graph. */
export type SceneNodeKind = "floor" | "layer" | "object" | "group";

/**
 * Layer kinds control panel behavior and default capabilities.
 * Do not collapse these into a single raster-or-object model.
 */
export type LayerKind =
  | "sketch"
  | "object"
  | "architecture"
  | "reference"
  | "measurement"
  | "guide";

export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";

export type TransformMode =
  | "select"
  | "move"
  | "rotate"
  | "scale"
  | "resize"
  | "edit-geometry"
  | "push-pull";

export type ResizeMode =
  | "free"
  | "width-height"
  | "endpoints"
  | "host-constrained"
  | "face-extrusion";

export type CoordinateSpace =
  | "world"
  | "parent-local"
  | "floor-local"
  | "wall-local"
  | "object-local"
  | "screen";

export type BoundingBoxStyle =
  | "standard"
  | "path-bounds"
  | "semantic"
  | "gizmo-3d"
  | "none";

export type SnapType =
  | "grid"
  | "endpoint"
  | "midpoint"
  | "edge"
  | "center"
  | "intersection"
  | "parallel"
  | "perpendicular"
  | "alignment"
  | "wall-axis"
  | "floor-boundary"
  | "object-bounds"
  | "perspective-guide";

/** Separate relationships — do not overload one parentId. */
export type SceneObjectRelations = {
  hierarchyParentId?: string | null;
  hostObjectId?: string | null;
  floorId?: string | null;
  layerId?: string | null;
  groupIds?: string[];
  sourceObjectId?: string | null;
  derivedObjectIds?: string[];
};

export type ObjectTransform = {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
};

export type TransformCapabilities = {
  movable: boolean;
  rotatable: boolean;
  scalable: boolean;
  resizable: boolean;
  editableGeometry: boolean;
  preserveAspectRatio?: boolean;
  constrainedToParent?: boolean;
  allowedAxes?: Array<"x" | "y" | "z">;
  resizeMode?: ResizeMode;
  flipable?: boolean;
  cropable?: boolean;
  mirrorable?: boolean;
};

export type LayerCapabilities = {
  canDraw: boolean;
  canHostObjects: boolean;
  showChildrenInPanel: boolean;
  lockByDefault: boolean;
  exportByDefault: boolean;
  supportsBlendMode: boolean;
  supportsOpacity: boolean;
  supportsMerge: boolean;
  supportsRasterize: boolean;
  supportsTransformWholeLayer: boolean;
  defaultObjectSelectable: boolean;
};

export type FloorNode = {
  id: string;
  kind: "floor";
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
  /** Root layer ids belonging to this floor / artboard. */
  layerIds: string[];
  elevation?: number;
  metadata?: Record<string, unknown>;
};

export type LayerNode = {
  id: string;
  kind: "layer";
  layerKind: LayerKind;
  name: string;
  floorId: string;
  /** Optional nesting under another layer (e.g. Walls under Architecture). */
  parentLayerId?: string | null;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
  blendMode: BlendMode | string;
  expanded: boolean;
  /** Trace / onion-skin strength (0–1), sketch layers. */
  trace?: number;
  /** Cloud or local raster backing for sketch/reference pixels. */
  rasterPath?: string | null;
  /** Child layer ids when this row is a folder-like container. */
  childLayerIds: string[];
  /** Object ids directly owned by this layer (not nested under other objects). */
  objectIds: string[];
  metadata?: Record<string, unknown>;
};

/** Bridge from LayerEngine objects back to legacy `state.shapes` / `state.walls`. */
export type LegacyObjectRef =
  | { kind: "shape"; id: string }
  | { kind: "wall"; id: string }
  | { kind: "wall-room"; id: string }
  | { kind: "wall-face"; wallId: string; seg: number };

export type SceneObjectType =
  | "group"
  | "sketch-stroke"
  | "line"
  | "shape"
  | "stencil"
  | "region"
  | "text"
  | "wall"
  | "floor-slab"
  | "ceiling"
  | "roof"
  | "door"
  | "window"
  | "column"
  | "stair"
  | "room"
  | "image"
  | "measurement"
  | "mass"
  | "mass-face"
  | "light"
  | "fixture"
  | "furniture"
  | "guide"
  | "vanishing-point"
  | "construction-line";

export type SceneObjectNode = {
  id: string;
  kind: "object" | "group";
  type: SceneObjectType;
  name: string;
  layerId: string;
  floorId: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
  transform: ObjectTransform;
  /** Coordinate space this transform is expressed in. */
  transformSpace: CoordinateSpace;
  relations: SceneObjectRelations;
  childIds: string[];
  geometry?: Record<string, unknown>;
  style?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
  /** Links this engine object to a legacy wall/shape entity. */
  legacyRef?: LegacyObjectRef;
};

export type LayerPanelRow = {
  id: string;
  nodeKind: "floor" | "layer" | "object";
  layerKind?: LayerKind;
  objectType?: SceneObjectType;
  name: string;
  depth: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  expanded: boolean;
  hasChildren: boolean;
  parentId: string | null;
  legacyRef?: LegacyObjectRef;
};

export type SnapResult = {
  type: SnapType;
  targetObjectId?: string;
  point: Point3D;
  distance: number;
  guide?: {
    axis?: "x" | "y" | "z";
    from?: Point3D;
    to?: Point3D;
  };
};

export type LayerEngineEvent =
  | { type: "scene-changed"; reason: string }
  | { type: "layer-created"; layerId: string }
  | { type: "layer-updated"; layerId: string }
  | { type: "layer-deleted"; layerIds: string[] }
  | { type: "layer-reordered"; layerIds: string[] }
  | { type: "object-created"; objectId: string }
  | { type: "object-updated"; objectId: string }
  | { type: "object-deleted"; objectIds: string[] }
  | { type: "object-reparented"; objectId: string }
  | { type: "floor-changed"; floorId: string }
  | { type: "active-layer-changed"; layerId: string | null }
  | { type: "transform-committed"; objectIds: string[]; mode: TransformMode }
  | { type: "selection-sync-needed" };

export type LayerEngineSnapshot = {
  floors: Record<string, FloorNode>;
  layers: Record<string, LayerNode>;
  objects: Record<string, SceneObjectNode>;
  rootFloorIds: string[];
  activeFloorId: string | null;
  activeLayerId: string | null;
};

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

export function createEmptyRelations(
  partial: Partial<SceneObjectRelations> = {},
): SceneObjectRelations {
  return {
    hierarchyParentId: partial.hierarchyParentId ?? null,
    hostObjectId: partial.hostObjectId ?? null,
    floorId: partial.floorId ?? null,
    layerId: partial.layerId ?? null,
    groupIds: partial.groupIds ? [...partial.groupIds] : [],
    sourceObjectId: partial.sourceObjectId ?? null,
    derivedObjectIds: partial.derivedObjectIds
      ? [...partial.derivedObjectIds]
      : [],
  };
}
