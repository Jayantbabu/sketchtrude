import { z } from "zod";

export const CURRENT_PROJECT_SCHEMA_VERSION = 1;

const vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const canvasBackgroundSchema = z.object({
  type: z.enum(["color", "transparent", "image"]),
  value: z.string().optional(),
  assetId: z.string().optional(),
});

const gridSettingsSchema = z
  .object({
    show: z.boolean(),
    type: z.string().optional(),
    spacingMM: z.number().optional(),
    subdivisions: z.number().optional(),
    color: z.string().optional(),
  })
  .passthrough();

const snapSettingsSchema = z
  .object({
    enabled: z.boolean(),
    gridSnap: z.boolean().optional(),
    objectSnap: z.boolean().optional(),
    angleSnap: z.boolean().optional(),
    angleIncrementDeg: z.number().optional(),
    tolerancePx: z.number().optional(),
  })
  .passthrough();

const perspectiveAssistSchema = z
  .object({
    enabled: z.boolean(),
    vanishingPoints: z.array(vector3Schema).optional(),
    guideOpacity: z.number().optional(),
  })
  .passthrough();

const drawingAssistSchema = z
  .object({
    ortho: z.boolean().optional(),
    stabilize: z.number().optional(),
    pressureSensitivity: z.boolean().optional(),
  })
  .passthrough();

/** Layers / objects remain flexible during the legacy transition. */
const projectLayerSchema = z.record(z.string(), z.unknown());
const projectObjectSchema = z.record(z.string(), z.unknown());

export const projectDocumentSchema = z.object({
  schemaVersion: z.number().int().positive(),
  projectId: z.string().min(1),
  metadata: z.object({
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    applicationVersion: z.string(),
  }),
  canvas: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(["mm", "cm", "m", "in", "ft"]),
    scale: z.number().nullish(),
    background: canvasBackgroundSchema,
    dpi: z.number().optional(),
    infiniteCanvas: z.boolean().optional(),
  }),
  scene: z.object({
    rootLayerIds: z.array(z.string()),
    layers: z.record(z.string(), projectLayerSchema),
    objects: z.record(z.string(), projectObjectSchema),
  }),
  resources: z.object({
    materials: z.record(z.string(), z.record(z.string(), z.unknown())),
    images: z.record(z.string(), z.record(z.string(), z.unknown())),
    textures: z.record(z.string(), z.record(z.string(), z.unknown())),
  }),
  views: z.object({
    activeMode: z.enum(["2d", "3d"]),
    twoD: z.object({
      zoom: z.number(),
      panX: z.number(),
      panY: z.number(),
      rotation: z.number(),
      activeFloorId: z.string().optional(),
    }),
    threeD: z.object({
      cameraPosition: vector3Schema,
      cameraTarget: vector3Schema,
      cameraUp: vector3Schema,
      projection: z.enum(["perspective", "orthographic"]),
      fieldOfView: z.number().optional(),
      activeFloorId: z.string().optional(),
    }),
  }),
  settings: z.object({
    grid: gridSettingsSchema,
    snapping: snapSettingsSchema,
    perspectiveAssist: perspectiveAssistSchema,
    drawingAssist: drawingAssistSchema,
    scaleUnit: z.string().optional(),
    scaleLabel: z.string().nullable().optional(),
    pxPerUnit: z.number().nullable().optional(),
    wallsVisible: z.boolean().optional(),
  }),
  relationships: z.object({
    parentByObjectId: z.record(z.string(), z.string().nullable()),
    childrenByObjectId: z.record(z.string(), z.array(z.string())),
  }),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

export type ProjectDocumentParsed = z.infer<typeof projectDocumentSchema>;
