import {
  rotateTransformZ,
  scaleTransform,
  translateTransform,
} from "./coordinates";
import {
  getTransformCapabilities,
  prefersResizeOverScale,
} from "./transform-capabilities";
import type {
  ObjectTransform,
  SceneObjectNode,
  TransformCapabilities,
  TransformMode,
  Vector3,
} from "./types";
import type { SnapEngine } from "./snap-engine";

export type TransformSession = {
  mode: TransformMode;
  objectIds: string[];
  startTransforms: Record<string, ObjectTransform>;
  pivot: Vector3;
  preserveAspectRatio: boolean;
};

export type TransformApplyResult = {
  objectId: string;
  transform: ObjectTransform;
  /** Semantic dimension patch for resize (walls, doors, etc.). */
  geometryPatch?: Record<string, unknown>;
};

export type TransformEngineOptions = {
  snap?: SnapEngine;
};

/**
 * One shared transform engine. Capabilities come from the object type —
 * never assume every selection gets the same handles.
 */
export class TransformEngine {
  private session: TransformSession | null = null;
  private readonly snap: SnapEngine | null;

  constructor(options: TransformEngineOptions = {}) {
    this.snap = options.snap ?? null;
  }

  getCapabilities(object: SceneObjectNode): TransformCapabilities {
    return getTransformCapabilities(object.type);
  }

  prefersResize(object: SceneObjectNode): boolean {
    return prefersResizeOverScale(object.type);
  }

  begin(
    objects: SceneObjectNode[],
    mode: TransformMode,
    options: { preserveAspectRatio?: boolean; pivot?: Vector3 } = {},
  ): TransformSession | null {
    if (objects.length === 0) return null;

    for (const obj of objects) {
      const caps = this.getCapabilities(obj);
      if (mode === "move" && !caps.movable) return null;
      if (mode === "rotate" && !caps.rotatable) return null;
      if (mode === "scale" && !caps.scalable) return null;
      if (mode === "resize" && !caps.resizable) return null;
      if (mode === "edit-geometry" && !caps.editableGeometry) return null;
    }

    const startTransforms: Record<string, ObjectTransform> = {};
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const obj of objects) {
      startTransforms[obj.id] = cloneTransform(obj.transform);
      sx += obj.transform.position.x;
      sy += obj.transform.position.y;
      sz += obj.transform.position.z;
    }
    const n = objects.length;
    const pivot = options.pivot ?? { x: sx / n, y: sy / n, z: sz / n };
    const preserveAspectRatio =
      options.preserveAspectRatio ??
      objects.every((o) => this.getCapabilities(o).preserveAspectRatio);

    this.session = {
      mode,
      objectIds: objects.map((o) => o.id),
      startTransforms,
      pivot,
      preserveAspectRatio: Boolean(preserveAspectRatio),
    };
    return this.session;
  }

  getSession(): TransformSession | null {
    return this.session
      ? {
          ...this.session,
          objectIds: [...this.session.objectIds],
          startTransforms: { ...this.session.startTransforms },
        }
      : null;
  }

  update(
    objectsById: Record<string, SceneObjectNode>,
    delta: {
      translation?: Vector3;
      rotationDeg?: number;
      scaleFactor?: Vector3;
      /** Absolute resize target size (semantic width/height/length). */
      resize?: Record<string, number>;
    },
  ): TransformApplyResult[] {
    if (!this.session) return [];
    const results: TransformApplyResult[] = [];

    for (const id of this.session.objectIds) {
      const obj = objectsById[id];
      const start = this.session.startTransforms[id];
      if (!obj || !start) continue;
      const caps = this.getCapabilities(obj);

      if (this.session.mode === "move" && delta.translation) {
        let next = delta.translation;
        if (this.snap) {
          const target = {
            x: start.position.x + next.x,
            y: start.position.y + next.y,
            z: start.position.z + next.z,
          };
          const snapped = this.snap.resolve(target, this.session.objectIds);
          next = {
            x: snapped.x - start.position.x,
            y: snapped.y - start.position.y,
            z: snapped.z - start.position.z,
          };
        }
        if (caps.constrainedToParent && caps.allowedAxes) {
          next = constrainAxes(next, caps.allowedAxes);
        }
        results.push({
          objectId: id,
          transform: translateTransform(start, next),
        });
        continue;
      }

      if (this.session.mode === "rotate" && delta.rotationDeg !== undefined) {
        results.push({
          objectId: id,
          transform: rotateTransformZ(start, delta.rotationDeg),
        });
        continue;
      }

      if (this.session.mode === "scale" && delta.scaleFactor) {
        const factor = this.session.preserveAspectRatio
          ? {
              x: delta.scaleFactor.x,
              y: delta.scaleFactor.x,
              z: delta.scaleFactor.x,
            }
          : delta.scaleFactor;
        results.push({
          objectId: id,
          transform: scaleTransform(start, factor, this.session.preserveAspectRatio),
        });
        continue;
      }

      if (this.session.mode === "resize" && delta.resize) {
        // Resize keeps scale at 1 and patches semantic geometry.
        results.push({
          objectId: id,
          transform: { ...start },
          geometryPatch: { ...delta.resize },
        });
      }
    }

    return results;
  }

  commit(): { objectIds: string[]; mode: TransformMode } | null {
    if (!this.session) return null;
    const result = {
      objectIds: [...this.session.objectIds],
      mode: this.session.mode,
    };
    this.session = null;
    return result;
  }

  cancel(): void {
    this.session = null;
  }
}

function cloneTransform(t: ObjectTransform): ObjectTransform {
  return {
    position: { ...t.position },
    rotation: { ...t.rotation },
    scale: { ...t.scale },
  };
}

function constrainAxes(
  delta: Vector3,
  axes: Array<"x" | "y" | "z">,
): Vector3 {
  return {
    x: axes.includes("x") ? delta.x : 0,
    y: axes.includes("y") ? delta.y : 0,
    z: axes.includes("z") ? delta.z : 0,
  };
}

export function createTransformEngine(
  options?: TransformEngineOptions,
): TransformEngine {
  return new TransformEngine(options);
}
