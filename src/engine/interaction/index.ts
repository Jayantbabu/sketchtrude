export type {
  BoundingBoxMode,
  MoveConstraintType,
  ObjectCapabilities,
  ResizeHandleMode,
  SceneObjectType,
} from "./object-capabilities";
export {
  ObjectCapabilityRegistry,
  capabilityRegistry,
  createCapabilityRegistry,
} from "./object-capabilities";

export type {
  ObjectTransform,
  SceneGraph,
  SceneInteractionEvent,
  SceneObject,
  SelectionChangedEvent,
  SelectionSource,
  SelectionState,
  Vector3,
} from "./selection-state";
export {
  createEmptySelectionState,
  createIdentityTransform,
  createSceneObjectId,
} from "./selection-state";

export {
  SelectionManager,
  createSelectionManager,
  type SelectionListener,
  type SelectionManagerOptions,
} from "./selection-manager";

export {
  ensureAllShapeIds,
  ensureShapeId,
  sceneTypeFromShapeKind,
  shapeToSceneObject,
  type LegacyShapeRecord,
} from "./legacy-shape-adapter";

export {
  ensureImageId,
  ensureSketchStrokeId,
  ensureStencilId,
  placedRecordToSceneObject,
  type LegacyPlacedRecord,
} from "./legacy-placed-adapter";

export {
  isSelectionOnlyEvent,
  selectionSourceToDirection,
  toSelectionSyncPayload,
  type SelectionSyncDirection,
  type SelectionSyncPayload,
} from "./selection-sync";
