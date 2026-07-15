/**
 * Canonical Sketchtrude project document types (schemaVersion CURRENT = 1).
 * Live engine state stays out of this tree — only serializable JSON data.
 */

import { CURRENT_PROJECT_SCHEMA_VERSION } from "./project-document-schema";

export { CURRENT_PROJECT_SCHEMA_VERSION };

export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type CanvasUnit = "mm" | "cm" | "m" | "in" | "ft";

export type CanvasBackground = {
  type: "color" | "transparent" | "image";
  value?: string;
  assetId?: string;
};

export type GridSettings = {
  show: boolean;
  type?: string;
  spacingMM?: number;
  subdivisions?: number;
  color?: string;
};

export type SnapSettings = {
  enabled: boolean;
  gridSnap?: boolean;
  objectSnap?: boolean;
  angleSnap?: boolean;
  angleIncrementDeg?: number;
  tolerancePx?: number;
};

export type PerspectiveAssistSettings = {
  enabled: boolean;
  vanishingPoints?: Vector3[];
  guideOpacity?: number;
};

export type DrawingAssistSettings = {
  ortho?: boolean;
  stabilize?: number;
  pressureSensitivity?: boolean;
};

/**
 * Layer kind in the hybrid scene graph.
 * sketch = fluid stroke container; object/architecture = selectable children;
 * reference/measurement/guide = specialized rows.
 */
export type ProjectLayerKind =
  | "sketch"
  | "object"
  | "architecture"
  | "reference"
  | "measurement"
  | "guide";

export type ProjectLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
  /** Hybrid layer kind — defaults to sketch when absent (legacy docs). */
  kind?: ProjectLayerKind;
  parentId?: string | null;
  /** Floor / artboard this layer belongs to. */
  floorId?: string | null;
  blendMode?: string;
  trace?: number;
  /** Cloud storage path for raster PNG (JSON-safe). */
  rasterPath?: string | null;
  metadata?: Record<string, unknown>;
};

export type ObjectTransform = {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
};

export type BaseProjectObject = {
  id: string;
  type: string;
  name: string;
  layerId: string;
  parentId?: string;
  visible: boolean;
  locked: boolean;
  transform: ObjectTransform;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type ImageObject = BaseProjectObject & {
  type: "image";
  resourceId: string;
};

export type WindowObject = BaseProjectObject & {
  type: "window";
  hostWallId: string;
  offsetAlongWall: number;
  sillHeight: number;
  width: number;
  height: number;
  materialIds?: {
    frame?: string;
    glass?: string;
  };
};

/** Flexible object union — full typed variants land as the engine migrates. */
export type ProjectObject = BaseProjectObject & Record<string, unknown>;

export type MaterialResource = {
  id: string;
  name: string;
  color?: string;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  textureId?: string;
  metadata?: Record<string, unknown>;
};

export type ImageResource = {
  id: string;
  storageKey: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  checksum?: string;
};

export type TextureResource = {
  id: string;
  storageKey: string;
  mimeType: string;
  width?: number;
  height?: number;
  byteSize?: number;
  checksum?: string;
  metadata?: Record<string, unknown>;
};

export type AssetSyncStatus = "local" | "uploading" | "uploaded" | "failed";

export type ProjectDocumentMetadata = {
  name: string;
  createdAt: string;
  updatedAt: string;
  applicationVersion: string;
};

export type ProjectDocumentCanvas = {
  width: number;
  height: number;
  unit: CanvasUnit;
  scale: number | null;
  background: CanvasBackground;
  /** Legacy dpi for raster round-trip. */
  dpi?: number;
  infiniteCanvas?: boolean;
};

export type ProjectDocumentViews = {
  activeMode: "2d" | "3d";
  twoD: {
    zoom: number;
    panX: number;
    panY: number;
    rotation: number;
    activeFloorId?: string;
  };
  threeD: {
    cameraPosition: Vector3;
    cameraTarget: Vector3;
    cameraUp: Vector3;
    projection: "perspective" | "orthographic";
    fieldOfView?: number;
    activeFloorId?: string;
  };
};

export type ProjectDocumentSettings = {
  grid: GridSettings;
  snapping: SnapSettings;
  perspectiveAssist: PerspectiveAssistSettings;
  drawingAssist: DrawingAssistSettings;
  /** Extra scale/display fields mirrored from legacy docs. */
  scaleUnit?: string;
  scaleLabel?: string | null;
  pxPerUnit?: number | null;
  wallsVisible?: boolean;
};

export type ProjectDocument = {
  schemaVersion: number;
  projectId: string;
  metadata: ProjectDocumentMetadata;
  canvas: ProjectDocumentCanvas;
  scene: {
    /** Ordered root layer ids (typically under the active floor). */
    rootLayerIds: string[];
    /** Ordered floor / artboard ids when using the hybrid layer engine. */
    rootFloorIds?: string[];
    layers: Record<string, ProjectLayer>;
    objects: Record<string, ProjectObject>;
  };
  resources: {
    materials: Record<string, MaterialResource>;
    images: Record<string, ImageResource>;
    textures: Record<string, TextureResource>;
  };
  views: ProjectDocumentViews;
  settings: ProjectDocumentSettings;
  relationships: {
    parentByObjectId: Record<string, string | null>;
    childrenByObjectId: Record<string, string[]>;
  };
  extensions?: Record<string, unknown>;
};

/**
 * Mirrors the current StudioDocument used by API routes / legacy engine
 * (`src/lib/projects/document.ts`). Kept here so the saving engine can
 * round-trip without importing route helpers.
 */
export type LegacyStudioLayerMeta = {
  name: string;
  visible: boolean;
  opacity: number;
  trace?: number;
  blendMode?: string;
  raster_path?: string | null;
  /** Runtime-only; stripped before cloud JSON storage. */
  raster?: Blob | null;
  blob?: Blob | null;
  [key: string]: unknown;
};

export type LegacyStudioDocument = {
  version: number;
  savedAt: number;
  doc: { wmm: number; hmm: number; dpi: number };
  infiniteCanvas?: boolean;
  autoExpandCanvas?: boolean;
  paperBg?: string;
  grid?: { show: boolean; type?: string; spacingMM?: number };
  activeLayer?: number;
  pxPerUnit?: number | null;
  scaleUnit?: string;
  scaleLabel?: string | null;
  measurements?: unknown[];
  walls?: unknown[];
  wallsVisible?: boolean;
  shapes?: unknown[];
  masses?: unknown[];
  massBaseAnchor?: unknown;
  layers: LegacyStudioLayerMeta[];
  [key: string]: unknown;
};

export const APPLICATION_VERSION = "0.1.0";

export type CreateEmptyProjectDocumentMeta = {
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  applicationVersion?: string;
  width?: number;
  height?: number;
  unit?: CanvasUnit;
  dpi?: number;
  infiniteCanvas?: boolean;
  paperBg?: string;
  scale?: number | null;
  scaleUnit?: string;
  scaleLabel?: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function createEmptyProjectDocument(
  projectId: string,
  meta: CreateEmptyProjectDocumentMeta = {},
): ProjectDocument {
  const createdAt = meta.createdAt ?? nowIso();
  const updatedAt = meta.updatedAt ?? createdAt;
  const width = meta.width ?? 420;
  const height = meta.height ?? 297;
  const dpi = meta.dpi ?? 150;
  const layerId = "layer-0";

  const layer: ProjectLayer = {
    id: layerId,
    name: "Sketch 01",
    visible: true,
    locked: false,
    opacity: 1,
    order: 0,
    kind: "sketch",
    floorId: "floor_default",
    blendMode: "source-over",
    trace: 0,
    rasterPath: null,
    metadata: {
      layerKind: "sketch",
      floorId: "floor_default",
      expanded: false,
    },
  };

  const paperBg = meta.paperBg ?? "#ffffff";

  const document: ProjectDocument = {
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    projectId,
    metadata: {
      name: meta.name ?? "Untitled",
      createdAt,
      updatedAt,
      applicationVersion: meta.applicationVersion ?? APPLICATION_VERSION,
    },
    canvas: {
      width,
      height,
      unit: meta.unit ?? "mm",
      scale: meta.scale ?? null,
      background: { type: "color", value: paperBg },
      dpi,
      infiniteCanvas: meta.infiniteCanvas ?? false,
    },
    scene: {
      rootLayerIds: [layerId],
      rootFloorIds: ["floor_default"],
      layers: { [layerId]: layer },
      objects: {},
    },
    resources: {
      materials: {},
      images: {},
      textures: {},
    },
    views: {
      activeMode: "2d",
      twoD: {
        zoom: 1,
        panX: 0,
        panY: 0,
        rotation: 0,
        activeFloorId: "floor_default",
      },
      threeD: {
        cameraPosition: { x: 0, y: 0, z: 10 },
        cameraTarget: { x: 0, y: 0, z: 0 },
        cameraUp: { x: 0, y: 1, z: 0 },
        projection: "perspective",
        fieldOfView: 50,
        activeFloorId: "floor_default",
      },
    },
    settings: {
      grid: { show: false, type: "ortho", spacingMM: 5 },
      snapping: { enabled: false },
      perspectiveAssist: { enabled: false },
      drawingAssist: {},
      scaleUnit: meta.scaleUnit ?? "cm",
      scaleLabel: meta.scaleLabel ?? null,
      pxPerUnit: null,
      wallsVisible: true,
    },
    relationships: {
      parentByObjectId: {},
      childrenByObjectId: {},
    },
    extensions: {},
  };

  const legacy: LegacyStudioDocument = {
    version: 1,
    savedAt: Date.now(),
    doc: { wmm: width, hmm: height, dpi },
    infiniteCanvas: meta.infiniteCanvas ?? false,
    autoExpandCanvas: false,
    paperBg,
    grid: { show: false, type: "ortho", spacingMM: 5 },
    activeLayer: 0,
    pxPerUnit: null,
    scaleUnit: meta.scaleUnit ?? "cm",
    scaleLabel: meta.scaleLabel ?? null,
    measurements: [],
    walls: [],
    wallsVisible: true,
    shapes: [],
    masses: [],
    layers: [
      {
        name: "Sketch 01",
        visible: true,
        opacity: 1,
        trace: 0,
        blendMode: "source-over",
        raster_path: null,
      },
    ],
  };

  document.extensions = { legacyStudio: legacy };
  return document;
}

const BLOB_LAYER_KEYS = new Set([
  "raster",
  "blob",
  "imageData",
  "bitmap",
  "canvas",
  "_dirty",
  "_canvas",
  "_ctx",
]);

/** Strip non-JSON / Blob fields from legacy layers for cloud storage. */
export function stripLegacyStudioBlobs(
  legacy: LegacyStudioDocument,
): LegacyStudioDocument {
  const layers = (legacy.layers ?? []).map((layer) => {
    const next: LegacyStudioLayerMeta = {
      name: typeof layer.name === "string" ? layer.name : "Layer",
      visible: layer.visible !== false,
      opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
    };
    if (typeof layer.trace === "number") next.trace = layer.trace;
    if (typeof layer.blendMode === "string") next.blendMode = layer.blendMode;
    if (layer.raster_path !== undefined) {
      next.raster_path = (layer.raster_path as string | null) ?? null;
    }
    for (const [key, value] of Object.entries(layer)) {
      if (BLOB_LAYER_KEYS.has(key)) continue;
      if (typeof Blob !== "undefined" && value instanceof Blob) continue;
      if (key === "name" || key === "visible" || key === "opacity") continue;
      if (key === "trace" || key === "blendMode" || key === "raster_path") continue;
      next[key] = value;
    }
    return next;
  });

  return { ...legacy, layers };
}

export function projectDocumentFromLegacyStudio(
  projectId: string,
  legacy: LegacyStudioDocument,
  meta?: CreateEmptyProjectDocumentMeta,
): ProjectDocument {
  // Keep layer blobs in memory so prepareDocumentForPersistence can upload them.
  // Call stripLegacyStudioBlobs only when writing JSON to disk/cloud.
  const legacyForScene = stripLegacyStudioBlobs(legacy);
  const createdAt = meta?.createdAt ?? nowIso();
  const updatedAt =
    meta?.updatedAt ??
    (legacy.savedAt ? new Date(legacy.savedAt).toISOString() : createdAt);

  const width = legacy.doc?.wmm ?? meta?.width ?? 420;
  const height = legacy.doc?.hmm ?? meta?.height ?? 297;
  const dpi = legacy.doc?.dpi ?? meta?.dpi ?? 150;
  const paperBg =
    (typeof legacy.paperBg === "string" ? legacy.paperBg : undefined) ??
    meta?.paperBg ??
    "#ffffff";

  const layers: Record<string, ProjectLayer> = {};
  const rootLayerIds: string[] = [];

  (legacyForScene.layers ?? []).forEach((layer, index) => {
    const id = `layer-${index}`;
    rootLayerIds.push(id);
    layers[id] = {
      id,
      name: layer.name || `Layer ${index + 1}`,
      visible: layer.visible !== false,
      locked: false,
      opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
      order: index,
      kind: "sketch",
      floorId: "floor_default",
      blendMode:
        typeof layer.blendMode === "string" ? layer.blendMode : "source-over",
      trace: typeof layer.trace === "number" ? layer.trace : 0,
      rasterPath: layer.raster_path ?? null,
      metadata: {
        layerKind: "sketch",
        floorId: "floor_default",
        expanded: false,
      },
    };
  });

  if (rootLayerIds.length === 0) {
    const id = "layer-0";
    rootLayerIds.push(id);
    layers[id] = {
      id,
      name: "Sketch 01",
      visible: true,
      locked: false,
      opacity: 1,
      order: 0,
      kind: "sketch",
      floorId: "floor_default",
      blendMode: "source-over",
      trace: 0,
      rasterPath: null,
      metadata: {
        layerKind: "sketch",
        floorId: "floor_default",
        expanded: false,
      },
    };
  }

  const grid = legacy.grid ?? { show: false };

  // Preserve original legacy (including Blobs) for the upload pipeline.
  const legacyStudio: LegacyStudioDocument = {
    ...legacy,
    layers: (legacy.layers ?? []).map((layer, index) => ({
      ...layer,
      name: typeof layer.name === "string" ? layer.name : `Layer ${index + 1}`,
      visible: layer.visible !== false,
      opacity: typeof layer.opacity === "number" ? layer.opacity : 1,
    })),
  };
  if (!legacyStudio.layers.length) {
    legacyStudio.layers = [
      {
        name: "Layer 1",
        visible: true,
        opacity: 1,
        trace: 0,
        blendMode: "source-over",
        raster_path: null,
      },
    ];
  }

  return {
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    projectId,
    metadata: {
      name: meta?.name ?? "Untitled",
      createdAt,
      updatedAt,
      applicationVersion: meta?.applicationVersion ?? APPLICATION_VERSION,
    },
    canvas: {
      width,
      height,
      unit: meta?.unit ?? "mm",
      scale: meta?.scale ?? null,
      background: { type: "color", value: paperBg },
      dpi,
      infiniteCanvas: Boolean(legacy.infiniteCanvas),
    },
    scene: {
      rootLayerIds,
      rootFloorIds: ["floor_default"],
      layers,
      objects: {},
    },
    resources: {
      materials: {},
      images: {},
      textures: {},
    },
    views: {
      activeMode: "2d",
      twoD: { zoom: 1, panX: 0, panY: 0, rotation: 0, activeFloorId: "floor_default" },
      threeD: {
        cameraPosition: { x: 0, y: 0, z: 10 },
        cameraTarget: { x: 0, y: 0, z: 0 },
        cameraUp: { x: 0, y: 1, z: 0 },
        projection: "perspective",
        fieldOfView: 50,
        activeFloorId: "floor_default",
      },
    },
    settings: {
      grid: {
        show: Boolean(grid.show),
        type: grid.type,
        spacingMM: grid.spacingMM,
      },
      snapping: { enabled: false },
      perspectiveAssist: { enabled: false },
      drawingAssist: {},
      scaleUnit: legacy.scaleUnit ?? meta?.scaleUnit ?? "cm",
      scaleLabel: legacy.scaleLabel ?? meta?.scaleLabel ?? null,
      pxPerUnit: legacy.pxPerUnit ?? null,
      wallsVisible: legacy.wallsVisible !== false,
    },
    relationships: {
      parentByObjectId: {},
      childrenByObjectId: {},
    },
    extensions: {
      legacyStudio,
    },
  };
}

export function legacyStudioFromProjectDocument(
  doc: ProjectDocument,
): LegacyStudioDocument {
  const stored = doc.extensions?.legacyStudio;
  if (stored && typeof stored === "object") {
    return stripLegacyStudioBlobs(stored as LegacyStudioDocument);
  }

  const layers: LegacyStudioLayerMeta[] = doc.scene.rootLayerIds.map(
    (id, index) => {
      const layer = doc.scene.layers[id];
      return {
        name: layer?.name ?? `Layer ${index + 1}`,
        visible: layer?.visible !== false,
        opacity: layer?.opacity ?? 1,
        trace: layer?.trace ?? 0,
        blendMode: layer?.blendMode ?? "source-over",
        raster_path: layer?.rasterPath ?? null,
      };
    },
  );

  return {
    version: 1,
    savedAt: Date.parse(doc.metadata.updatedAt) || Date.now(),
    doc: {
      wmm: doc.canvas.width,
      hmm: doc.canvas.height,
      dpi: doc.canvas.dpi ?? 150,
    },
    infiniteCanvas: Boolean(doc.canvas.infiniteCanvas),
    autoExpandCanvas: false,
    paperBg:
      doc.canvas.background.type === "color"
        ? doc.canvas.background.value
        : "#ffffff",
    grid: {
      show: doc.settings.grid.show,
      type: doc.settings.grid.type,
      spacingMM: doc.settings.grid.spacingMM,
    },
    activeLayer: 0,
    pxPerUnit: doc.settings.pxPerUnit ?? null,
    scaleUnit: doc.settings.scaleUnit ?? "cm",
    scaleLabel: doc.settings.scaleLabel ?? null,
    measurements: [],
    walls: [],
    wallsVisible: doc.settings.wallsVisible !== false,
    shapes: [],
    masses: [],
    layers,
  };
}
