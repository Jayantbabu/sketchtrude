import type { SceneObjectType } from "./object-capabilities";
import {
  createIdentityTransform,
  createSceneObjectId,
  type SceneObject,
} from "./selection-state";

/** Map legacy shape.kind → SceneObjectType. */
export function sceneTypeFromShapeKind(kind: string): SceneObjectType {
  if (kind === "line") return "line";
  if (kind === "stencil") return "stencil";
  return "shape";
}

export type LegacyShapeRecord = {
  id?: string;
  kind: string;
  pts?: Array<{ x: number; y: number }>;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  closed?: boolean;
  stroke?: string;
  width?: number;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  [key: string]: unknown;
};

/** Ensure a legacy shape has a stable id (mutates in place). */
export function ensureShapeId(shape: LegacyShapeRecord): string {
  if (typeof shape.id === "string" && shape.id.length > 0) return shape.id;
  shape.id = createSceneObjectId("shape");
  return shape.id;
}

export function shapeToSceneObject(
  shape: LegacyShapeRecord,
  zIndex: number,
  layerId = "layer-active",
): SceneObject {
  const id = ensureShapeId(shape);
  const now = new Date().toISOString();
  let x = 0;
  let y = 0;
  if (typeof shape.cx === "number" && typeof shape.cy === "number") {
    x = shape.cx;
    y = shape.cy;
  } else if (Array.isArray(shape.pts) && shape.pts.length) {
    x = shape.pts.reduce((s, p) => s + p.x, 0) / shape.pts.length;
    y = shape.pts.reduce((s, p) => s + p.y, 0) / shape.pts.length;
  } else if (typeof shape.x === "number" && typeof shape.y === "number") {
    x = shape.x;
    y = shape.y;
  }

  return {
    id,
    type: sceneTypeFromShapeKind(shape.kind),
    name: shape.name || defaultShapeName(shape.kind, zIndex),
    parentId: null,
    childIds: [],
    layerId,
    visible: shape.visible !== false,
    locked: !!shape.locked,
    opacity: typeof shape.opacity === "number" ? shape.opacity : 1,
    transform: createIdentityTransform(x, y, 0),
    geometry: {
      kind: shape.kind,
      pts: shape.pts,
      cx: shape.cx,
      cy: shape.cy,
      rx: shape.rx,
      ry: shape.ry,
      closed: shape.closed,
    },
    style: {
      stroke: shape.stroke,
      width: shape.width,
    },
    zIndex,
    createdAt: now,
    updatedAt: now,
    metadata: { legacyIndex: zIndex },
  };
}

function defaultShapeName(kind: string, index: number): string {
  const n = String(index + 1).padStart(2, "0");
  if (kind === "rect") return `Rectangle ${n}`;
  if (kind === "ellipse" || kind === "circle") return `Ellipse ${n}`;
  if (kind === "polygon") return `Polygon ${n}`;
  if (kind === "line") return `Line ${n}`;
  return `Shape ${n}`;
}

export function ensureAllShapeIds(shapes: LegacyShapeRecord[]): string[] {
  return shapes.map((shape) => ensureShapeId(shape));
}
