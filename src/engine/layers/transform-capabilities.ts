import type { SceneObjectType, TransformCapabilities } from "./types";

const VISUAL: TransformCapabilities = {
  movable: true,
  rotatable: true,
  scalable: true,
  resizable: true,
  editableGeometry: false,
  preserveAspectRatio: false,
  resizeMode: "free",
  flipable: true,
};

const PROPORTIONAL: TransformCapabilities = {
  ...VISUAL,
  preserveAspectRatio: true,
  resizable: true,
  scalable: true,
  resizeMode: "free",
};

const ARCH_RESIZE: TransformCapabilities = {
  movable: true,
  rotatable: true,
  scalable: false,
  resizable: true,
  editableGeometry: true,
  resizeMode: "endpoints",
  flipable: false,
};

const HOSTED_OPENING: TransformCapabilities = {
  movable: true,
  rotatable: false,
  scalable: false,
  resizable: true,
  editableGeometry: false,
  constrainedToParent: true,
  allowedAxes: ["x"],
  resizeMode: "host-constrained",
};

const MEASUREMENT: TransformCapabilities = {
  movable: true,
  rotatable: false,
  scalable: false,
  resizable: false,
  editableGeometry: true,
  resizeMode: "endpoints",
};

const GUIDE: TransformCapabilities = {
  movable: true,
  rotatable: false,
  scalable: false,
  resizable: false,
  editableGeometry: true,
};

const BY_TYPE: Partial<Record<SceneObjectType, TransformCapabilities>> = {
  "sketch-stroke": {
    movable: true,
    rotatable: true,
    scalable: true,
    resizable: false,
    editableGeometry: false,
    preserveAspectRatio: true,
    flipable: true,
  },
  shape: {
    ...VISUAL,
    editableGeometry: true,
    resizeMode: "width-height",
  },
  line: {
    movable: true,
    rotatable: true,
    scalable: false,
    resizable: true,
    editableGeometry: true,
    resizeMode: "endpoints",
  },
  stencil: { ...PROPORTIONAL, mirrorable: true },
  image: { ...PROPORTIONAL, cropable: true, flipable: true },
  text: {
    movable: true,
    rotatable: true,
    scalable: true,
    resizable: true,
    editableGeometry: true,
    resizeMode: "width-height",
  },
  region: {
    ...VISUAL,
    editableGeometry: true,
    resizeMode: "free",
  },
  group: {
    movable: true,
    rotatable: true,
    scalable: true,
    resizable: true,
    editableGeometry: false,
    preserveAspectRatio: false,
    resizeMode: "free",
  },
  wall: { ...ARCH_RESIZE, resizeMode: "endpoints" },
  "floor-slab": {
    movable: true,
    rotatable: true,
    scalable: false,
    resizable: true,
    editableGeometry: true,
    resizeMode: "free",
  },
  ceiling: {
    movable: true,
    rotatable: false,
    scalable: false,
    resizable: true,
    editableGeometry: true,
    resizeMode: "free",
  },
  roof: {
    movable: true,
    rotatable: true,
    scalable: false,
    resizable: true,
    editableGeometry: true,
    resizeMode: "free",
  },
  door: HOSTED_OPENING,
  window: HOSTED_OPENING,
  column: {
    movable: true,
    rotatable: true,
    scalable: false,
    resizable: true,
    editableGeometry: false,
    resizeMode: "width-height",
  },
  stair: {
    movable: true,
    rotatable: true,
    scalable: false,
    resizable: true,
    editableGeometry: true,
    resizeMode: "free",
  },
  room: {
    movable: true,
    rotatable: false,
    scalable: false,
    resizable: true,
    editableGeometry: true,
    resizeMode: "free",
  },
  furniture: { ...PROPORTIONAL, resizeMode: "width-height" },
  fixture: { ...PROPORTIONAL },
  light: {
    movable: true,
    rotatable: true,
    scalable: false,
    resizable: false,
    editableGeometry: false,
  },
  measurement: MEASUREMENT,
  mass: {
    movable: true,
    rotatable: true,
    scalable: true,
    resizable: true,
    editableGeometry: true,
    resizeMode: "face-extrusion",
  },
  "mass-face": {
    movable: false,
    rotatable: false,
    scalable: false,
    resizable: true,
    editableGeometry: true,
    constrainedToParent: true,
    resizeMode: "face-extrusion",
  },
  guide: GUIDE,
  "vanishing-point": GUIDE,
  "construction-line": GUIDE,
};

const LAYER_WHOLE: TransformCapabilities = {
  movable: true,
  rotatable: true,
  scalable: true,
  resizable: false,
  editableGeometry: false,
  preserveAspectRatio: true,
  flipable: true,
};

export function getTransformCapabilities(
  type: SceneObjectType | string,
): TransformCapabilities {
  const caps = BY_TYPE[type as SceneObjectType];
  if (caps) return { ...caps };
  return {
    movable: true,
    rotatable: true,
    scalable: true,
    resizable: true,
    editableGeometry: false,
    resizeMode: "free",
  };
}

/** Whole-layer transform (sketch / reference raster planes). */
export function getLayerTransformCapabilities(): TransformCapabilities {
  return { ...LAYER_WHOLE };
}

/**
 * Scale multiplies the whole object (visual).
 * Resize changes semantic dimensions (architectural).
 */
export function prefersResizeOverScale(type: SceneObjectType | string): boolean {
  const caps = getTransformCapabilities(type);
  return caps.resizable && !caps.scalable;
}
