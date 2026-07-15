/**
 * Sketchtrude Layer Engine — public API.
 *
 * Hybrid scene graph: floors → layers → objects, with one shared
 * transform/snap engine and object-specific capabilities.
 */

export type {
  BlendMode,
  BoundingBoxStyle,
  CoordinateSpace,
  FloorNode,
  LayerCapabilities,
  LayerEngineEvent,
  LayerEngineSnapshot,
  LayerKind,
  LayerNode,
  LayerPanelRow,
  ObjectTransform,
  Point3D,
  ResizeMode,
  SceneNodeKind,
  SceneObjectNode,
  SceneObjectRelations,
  SceneObjectType,
  SnapResult,
  SnapType,
  TransformCapabilities,
  TransformMode,
  Vector2,
  Vector3,
} from "./types";

export {
  createEmptyRelations,
  createIdentityTransform,
} from "./types";

export {
  createFloorId,
  createLayerEngineId,
  createLayerId,
  createObjectId,
} from "./ids";

export {
  defaultLayerName,
  getLayerCapabilities,
} from "./layer-capabilities";

export {
  getLayerTransformCapabilities,
  getTransformCapabilities,
  prefersResizeOverScale,
} from "./transform-capabilities";

export {
  applyMat3ToPoint,
  defaultTransformSpace,
  identityMat3,
  invertMat3,
  mat3FromTransform,
  multiplyMat3,
  rotateTransformZ,
  scaleTransform,
  transformFromMat3,
  translateTransform,
  type Mat3,
} from "./coordinates";

export {
  SnapEngine,
  createSnapEngine,
  type SnapEngineOptions,
  type SnapTarget,
} from "./snap-engine";

export {
  TransformEngine,
  createTransformEngine,
  type TransformApplyResult,
  type TransformEngineOptions,
  type TransformSession,
} from "./transform-engine";

export {
  LayerEngine,
  createLayerEngine,
  type CreateLayerOptions,
  type CreateObjectOptions,
  type LayerEngineListener,
  type LayerEngineOptions,
} from "./layer-engine";

export {
  applySnapshotToProjectDocument,
  hydrateLayerEngineFromDocument,
  projectDocumentToSnapshot,
  syncEngineToProjectDocument,
} from "./document-bridge";
