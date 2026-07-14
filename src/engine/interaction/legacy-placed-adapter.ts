import {
  createIdentityTransform,
  createSceneObjectId,
  type SceneObject,
} from "./selection-state";
import type { SceneObjectType } from "./object-capabilities";

export type LegacyPlacedRecord = {
  id?: string;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  [key: string]: unknown;
};

function ensureTypedId(
  record: LegacyPlacedRecord,
  prefix: string,
): string {
  if (typeof record.id === "string" && record.id.length > 0) return record.id;
  record.id = createSceneObjectId(prefix);
  return record.id;
}

export function ensureStencilId(record: LegacyPlacedRecord): string {
  return ensureTypedId(record, "stencil");
}

export function ensureImageId(record: LegacyPlacedRecord): string {
  return ensureTypedId(record, "image");
}

export function ensureSketchStrokeId(record: LegacyPlacedRecord): string {
  return ensureTypedId(record, "sketch");
}

export function placedRecordToSceneObject(
  record: LegacyPlacedRecord,
  type: Extract<
    SceneObjectType,
    "stencil" | "image" | "sketch-stroke"
  >,
  zIndex: number,
  layerId = "layer-active",
): SceneObject {
  const prefix =
    type === "stencil" ? "stencil" : type === "image" ? "image" : "sketch";
  const id = ensureTypedId(record, prefix);
  const now = new Date().toISOString();
  return {
    id,
    type,
    name: record.name || `${type} ${String(zIndex + 1).padStart(2, "0")}`,
    parentId: null,
    childIds: [],
    layerId,
    visible: record.visible !== false,
    locked: !!record.locked,
    opacity: typeof record.opacity === "number" ? record.opacity : 1,
    transform: createIdentityTransform(record.x || 0, record.y || 0, 0),
    geometry: {
      width: record.width,
      height: record.height,
      rotation: record.rotation,
    },
    zIndex,
    createdAt: now,
    updatedAt: now,
  };
}
