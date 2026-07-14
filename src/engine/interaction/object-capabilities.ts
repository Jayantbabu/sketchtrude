/**
 * Object capabilities drive selection handles and contextual actions.
 * Do not branch on object.type for interaction behavior — query this registry.
 */

export type BoundingBoxMode =
  | "axis-aligned"
  | "oriented"
  | "path-bounds"
  | "face-bounds"
  | "none";

export type ResizeHandleMode =
  | "corners"
  | "corners-and-edges"
  | "axis"
  | "custom"
  | "none";

export type MoveConstraintType =
  | "free"
  | "along-host-wall"
  | "horizontal"
  | "vertical"
  | "axis";

export type SceneObjectType =
  | "group"
  | "sketch-stroke"
  | "line"
  | "shape"
  | "stencil"
  | "region"
  | "wall"
  | "floor"
  | "roof"
  | "door"
  | "window"
  | "image"
  | "measurement"
  | "mass"
  | "mass-face"
  | "light"
  | "guide";

export type ObjectCapabilities = {
  selectable: boolean;
  movable: boolean;
  deletable: boolean;
  renamable: boolean;
  reorderable: boolean;
  groupable: boolean;
  resizable: boolean;
  scalable: boolean;
  rotatable: boolean;
  supportsFill: boolean;
  supportsStroke: boolean;
  supportsOpacity: boolean;
  supportsMaterial: boolean;
  supportsChildren: boolean;
  selectableChildren: boolean;
  constrainedToParent: boolean;
  moveConstraint?: MoveConstraintType;
  boundingBoxMode: BoundingBoxMode;
  resizeHandleMode: ResizeHandleMode;
};

const DEFAULT_CAPABILITIES: ObjectCapabilities = {
  selectable: true,
  movable: true,
  deletable: true,
  renamable: true,
  reorderable: true,
  groupable: true,
  resizable: true,
  scalable: true,
  rotatable: true,
  supportsFill: false,
  supportsStroke: false,
  supportsOpacity: true,
  supportsMaterial: false,
  supportsChildren: false,
  selectableChildren: false,
  constrainedToParent: false,
  boundingBoxMode: "axis-aligned",
  resizeHandleMode: "corners",
};

/** Phase 2B registrations — shapes / stencils / images / sketches first. */
const REGISTRY: Record<string, ObjectCapabilities> = {
  shape: {
    ...DEFAULT_CAPABILITIES,
    supportsFill: true,
    supportsStroke: true,
    boundingBoxMode: "oriented",
    resizeHandleMode: "corners-and-edges",
  },
  line: {
    ...DEFAULT_CAPABILITIES,
    supportsFill: false,
    supportsStroke: true,
    resizable: true,
    scalable: false,
    boundingBoxMode: "path-bounds",
    resizeHandleMode: "custom",
  },
  "sketch-stroke": {
    ...DEFAULT_CAPABILITIES,
    supportsFill: false,
    supportsStroke: true,
    resizable: false,
    scalable: true,
    rotatable: true,
    boundingBoxMode: "path-bounds",
    resizeHandleMode: "none",
  },
  stencil: {
    ...DEFAULT_CAPABILITIES,
    supportsFill: true,
    supportsStroke: false,
    boundingBoxMode: "oriented",
    resizeHandleMode: "corners-and-edges",
  },
  image: {
    ...DEFAULT_CAPABILITIES,
    supportsFill: false,
    supportsStroke: false,
    supportsOpacity: true,
    boundingBoxMode: "oriented",
    resizeHandleMode: "corners-and-edges",
  },
  // Registered early so architectural objects can opt in later without schema churn.
  wall: {
    ...DEFAULT_CAPABILITIES,
    scalable: false,
    supportsFill: true,
    supportsStroke: true,
    supportsMaterial: true,
    supportsChildren: true,
    selectableChildren: true,
    boundingBoxMode: "oriented",
    resizeHandleMode: "custom",
  },
  window: {
    ...DEFAULT_CAPABILITIES,
    reorderable: false,
    groupable: false,
    scalable: false,
    rotatable: false,
    supportsMaterial: true,
    constrainedToParent: true,
    moveConstraint: "along-host-wall",
    boundingBoxMode: "oriented",
    resizeHandleMode: "custom",
  },
  door: {
    ...DEFAULT_CAPABILITIES,
    reorderable: false,
    groupable: false,
    scalable: false,
    rotatable: false,
    supportsMaterial: true,
    constrainedToParent: true,
    moveConstraint: "along-host-wall",
    boundingBoxMode: "oriented",
    resizeHandleMode: "custom",
  },
  group: {
    ...DEFAULT_CAPABILITIES,
    supportsChildren: true,
    selectableChildren: true,
    boundingBoxMode: "oriented",
    resizeHandleMode: "corners-and-edges",
  },
  measurement: {
    ...DEFAULT_CAPABILITIES,
    groupable: true,
    scalable: false,
    supportsFill: false,
    supportsStroke: true,
    boundingBoxMode: "axis-aligned",
    resizeHandleMode: "custom",
  },
  floor: {
    ...DEFAULT_CAPABILITIES,
    supportsChildren: true,
    selectableChildren: true,
    supportsMaterial: true,
    boundingBoxMode: "axis-aligned",
    resizeHandleMode: "none",
  },
  mass: {
    ...DEFAULT_CAPABILITIES,
    supportsMaterial: true,
    supportsChildren: true,
    selectableChildren: true,
    boundingBoxMode: "oriented",
    resizeHandleMode: "custom",
  },
  "mass-face": {
    ...DEFAULT_CAPABILITIES,
    reorderable: false,
    groupable: false,
    movable: false,
    constrainedToParent: true,
    boundingBoxMode: "face-bounds",
    resizeHandleMode: "custom",
  },
  region: {
    ...DEFAULT_CAPABILITIES,
    supportsFill: true,
    supportsStroke: true,
    boundingBoxMode: "oriented",
    resizeHandleMode: "custom",
  },
  guide: {
    ...DEFAULT_CAPABILITIES,
    deletable: true,
    groupable: false,
    resizable: false,
    scalable: false,
    boundingBoxMode: "none",
    resizeHandleMode: "none",
  },
  light: {
    ...DEFAULT_CAPABILITIES,
    supportsMaterial: false,
    boundingBoxMode: "axis-aligned",
    resizeHandleMode: "none",
  },
  roof: {
    ...DEFAULT_CAPABILITIES,
    supportsMaterial: true,
    boundingBoxMode: "oriented",
    resizeHandleMode: "custom",
  },
};

export class ObjectCapabilityRegistry {
  private readonly map: Map<string, ObjectCapabilities>;

  constructor(seed: Record<string, ObjectCapabilities> = REGISTRY) {
    this.map = new Map(Object.entries(seed));
  }

  get(type: string): ObjectCapabilities {
    return this.map.get(type) ?? { ...DEFAULT_CAPABILITIES, selectable: false };
  }

  register(type: string, capabilities: ObjectCapabilities): void {
    this.map.set(type, capabilities);
  }

  has(type: string): boolean {
    return this.map.has(type);
  }
}

export const capabilityRegistry = new ObjectCapabilityRegistry();

export function createCapabilityRegistry(
  seed?: Record<string, ObjectCapabilities>,
): ObjectCapabilityRegistry {
  return new ObjectCapabilityRegistry(seed ?? REGISTRY);
}
