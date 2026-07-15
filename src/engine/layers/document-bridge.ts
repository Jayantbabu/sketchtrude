import type {
  ObjectTransform as DocTransform,
  ProjectDocument,
  ProjectLayer,
  ProjectObject,
  Vector3,
} from "@/features/projects/domain/project-document";
import type { LayerEngine } from "./layer-engine";
import type {
  FloorNode,
  LayerEngineSnapshot,
  LayerKind,
  LayerNode,
  ObjectTransform,
  SceneObjectNode,
  SceneObjectType,
} from "./types";
import { createEmptyRelations, createIdentityTransform } from "./types";

const LAYER_KIND_META = "layerKind";
const EXPANDED_META = "expanded";
const PARENT_LAYER_META = "parentLayerId";
const FLOOR_ID_META = "floorId";
const CHILD_LAYER_IDS_META = "childLayerIds";

/**
 * Hydrate a LayerEngine from a ProjectDocument scene.
 * Floors are reconstructed from layer metadata when present; otherwise
 * a single "Ground Floor" wraps all root layers.
 */
export function hydrateLayerEngineFromDocument(
  engine: LayerEngine,
  doc: ProjectDocument,
): void {
  const snapshot = projectDocumentToSnapshot(doc);
  engine.loadSnapshot(snapshot);
}

export function projectDocumentToSnapshot(
  doc: ProjectDocument,
): LayerEngineSnapshot {
  const floors: Record<string, FloorNode> = {};
  const layers: Record<string, LayerNode> = {};
  const objects: Record<string, SceneObjectNode> = {};

  const floorIdFromMeta = readStringMeta(
    Object.values(doc.scene.layers)[0]?.metadata,
    FLOOR_ID_META,
  );
  const defaultFloorId = floorIdFromMeta ?? "floor_default";

  if (!floors[defaultFloorId]) {
    floors[defaultFloorId] = {
      id: defaultFloorId,
      kind: "floor",
      name: "Ground Floor",
      visible: true,
      locked: false,
      opacity: 1,
      order: 0,
      layerIds: [],
      elevation: 0,
    };
  }

  // Collect all floor ids referenced by layers.
  for (const layer of Object.values(doc.scene.layers)) {
    const floorId =
      readStringMeta(layer.metadata, FLOOR_ID_META) ?? defaultFloorId;
    if (!floors[floorId]) {
      floors[floorId] = {
        id: floorId,
        kind: "floor",
        name: floorId === defaultFloorId ? "Ground Floor" : floorId,
        visible: true,
        locked: false,
        opacity: 1,
        order: Object.keys(floors).length,
        layerIds: [],
        elevation: 0,
      };
    }
  }

  const rootFloorIds = Object.keys(floors).sort(
    (a, b) => (floors[a]!.order ?? 0) - (floors[b]!.order ?? 0),
  );

  for (const id of doc.scene.rootLayerIds) {
    const src = doc.scene.layers[id];
    if (!src) continue;
    const floorId =
      src.floorId ??
      readStringMeta(src.metadata, FLOOR_ID_META) ??
      defaultFloorId;
    const parentLayerId =
      readStringMeta(src.metadata, PARENT_LAYER_META) ??
      src.parentId ??
      null;
    const layerKind = parseLayerKind(
      src.kind ?? readStringMeta(src.metadata, LAYER_KIND_META),
    );
    const childLayerIds = readStringArrayMeta(
      src.metadata,
      CHILD_LAYER_IDS_META,
    );

    layers[id] = {
      id,
      kind: "layer",
      layerKind,
      name: src.name,
      floorId,
      parentLayerId,
      visible: src.visible !== false,
      locked: Boolean(src.locked),
      opacity: typeof src.opacity === "number" ? src.opacity : 1,
      order: src.order ?? 0,
      blendMode: src.blendMode ?? "source-over",
      expanded: readBoolMeta(src.metadata, EXPANDED_META, layerKind !== "sketch"),
      trace: src.trace,
      rasterPath: src.rasterPath ?? null,
      childLayerIds: [...childLayerIds],
      objectIds: [],
      metadata: src.metadata ? { ...src.metadata } : undefined,
    };
  }

  // Also include non-root layers referenced as children.
  for (const [id, src] of Object.entries(doc.scene.layers)) {
    if (layers[id]) continue;
    const floorId =
      src.floorId ??
      readStringMeta(src.metadata, FLOOR_ID_META) ??
      defaultFloorId;
    const parentLayerId =
      readStringMeta(src.metadata, PARENT_LAYER_META) ??
      src.parentId ??
      null;
    const layerKind = parseLayerKind(
      src.kind ?? readStringMeta(src.metadata, LAYER_KIND_META),
    );
    layers[id] = {
      id,
      kind: "layer",
      layerKind,
      name: src.name,
      floorId,
      parentLayerId,
      visible: src.visible !== false,
      locked: Boolean(src.locked),
      opacity: typeof src.opacity === "number" ? src.opacity : 1,
      order: src.order ?? 0,
      blendMode: src.blendMode ?? "source-over",
      expanded: readBoolMeta(src.metadata, EXPANDED_META, true),
      trace: src.trace,
      rasterPath: src.rasterPath ?? null,
      childLayerIds: readStringArrayMeta(src.metadata, CHILD_LAYER_IDS_META),
      objectIds: [],
      metadata: src.metadata ? { ...src.metadata } : undefined,
    };
  }

  // Build floor.layerIds / parent.childLayerIds from parent pointers.
  for (const floor of Object.values(floors)) floor.layerIds = [];
  for (const layer of Object.values(layers)) layer.childLayerIds = [];

  const sortedLayers = Object.values(layers).sort((a, b) => a.order - b.order);
  for (const layer of sortedLayers) {
    if (layer.parentLayerId && layers[layer.parentLayerId]) {
      layers[layer.parentLayerId]!.childLayerIds.push(layer.id);
    } else if (floors[layer.floorId]) {
      floors[layer.floorId]!.layerIds.push(layer.id);
    }
  }

  for (const [id, src] of Object.entries(doc.scene.objects)) {
    const layerId = String(src.layerId ?? "");
    const layer = layers[layerId];
    const floorId = layer?.floorId ?? defaultFloorId;
    const type = (src.type as SceneObjectType) || "shape";
    const hierarchyParentId =
      (src.parentId as string | undefined) ??
      doc.relationships.parentByObjectId[id] ??
      null;
    const hostObjectId =
      typeof src.hostWallId === "string"
        ? src.hostWallId
        : typeof src.hostObjectId === "string"
          ? src.hostObjectId
          : null;

    const node: SceneObjectNode = {
      id,
      kind: type === "group" ? "group" : "object",
      type,
      name: String(src.name ?? type),
      layerId,
      floorId,
      visible: src.visible !== false,
      locked: Boolean(src.locked),
      opacity: typeof src.opacity === "number" ? Number(src.opacity) : 1,
      order: 0,
      transform: toEngineTransform(src.transform),
      transformSpace: "world",
      relations: createEmptyRelations({
        hierarchyParentId,
        hostObjectId,
        floorId,
        layerId,
      }),
      childIds: [...(doc.relationships.childrenByObjectId[id] ?? [])],
      geometry:
        src.geometry && typeof src.geometry === "object"
          ? { ...(src.geometry as Record<string, unknown>) }
          : undefined,
      style:
        src.style && typeof src.style === "object"
          ? { ...(src.style as Record<string, unknown>) }
          : undefined,
      createdAt: String(src.createdAt ?? new Date().toISOString()),
      updatedAt: String(src.updatedAt ?? new Date().toISOString()),
      metadata:
        src.metadata && typeof src.metadata === "object"
          ? { ...(src.metadata as Record<string, unknown>) }
          : undefined,
    };
    objects[id] = node;
  }

  // Attach root objects to layers.
  for (const obj of Object.values(objects)) {
    if (obj.relations.hierarchyParentId) continue;
    const layer = layers[obj.layerId];
    if (layer && !layer.objectIds.includes(obj.id)) {
      layer.objectIds.push(obj.id);
    }
  }

  // Ensure childIds are consistent from hierarchy parents.
  for (const obj of Object.values(objects)) obj.childIds = [];
  for (const obj of Object.values(objects)) {
    const parentId = obj.relations.hierarchyParentId;
    if (parentId && objects[parentId]) {
      objects[parentId]!.childIds.push(obj.id);
    } else if (obj.relations.hostObjectId && objects[obj.relations.hostObjectId]) {
      const host = objects[obj.relations.hostObjectId]!;
      if (!host.childIds.includes(obj.id)) host.childIds.push(obj.id);
    }
  }

  const activeFloorId =
    doc.views.twoD.activeFloorId ?? rootFloorIds[0] ?? null;
  const activeLayerId =
    doc.scene.rootLayerIds.find((id) => layers[id]) ??
    Object.keys(layers)[0] ??
    null;

  return {
    floors,
    layers,
    objects,
    rootFloorIds,
    activeFloorId,
    activeLayerId,
  };
}

/**
 * Write engine state into a ProjectDocument scene (mutates a shallow copy).
 * Preserves resources, views, settings, extensions outside the scene graph.
 */
export function applySnapshotToProjectDocument(
  doc: ProjectDocument,
  snapshot: LayerEngineSnapshot,
): ProjectDocument {
  const layers: Record<string, ProjectLayer> = {};
  const objects: Record<string, ProjectObject> = {};
  const parentByObjectId: Record<string, string | null> = {};
  const childrenByObjectId: Record<string, string[]> = {};
  const rootLayerIds: string[] = [];

  for (const floorId of snapshot.rootFloorIds) {
    const floor = snapshot.floors[floorId];
    if (!floor) continue;
    for (const layerId of floor.layerIds) {
      rootLayerIds.push(layerId);
      collectLayerTree(layerId, snapshot, layers);
    }
  }

  // Include any orphan layers.
  for (const layerId of Object.keys(snapshot.layers)) {
    if (!layers[layerId]) collectLayerTree(layerId, snapshot, layers);
  }

  for (const [id, obj] of Object.entries(snapshot.objects)) {
    objects[id] = sceneObjectToProjectObject(obj);
    parentByObjectId[id] = obj.relations.hierarchyParentId ?? null;
    childrenByObjectId[id] = [...obj.childIds];
  }

  return {
    ...doc,
    scene: {
      rootLayerIds,
      rootFloorIds: [...snapshot.rootFloorIds],
      layers,
      objects,
    },
    relationships: {
      parentByObjectId,
      childrenByObjectId,
    },
    views: {
      ...doc.views,
      twoD: {
        ...doc.views.twoD,
        activeFloorId: snapshot.activeFloorId ?? undefined,
      },
      threeD: {
        ...doc.views.threeD,
        activeFloorId: snapshot.activeFloorId ?? undefined,
      },
    },
    metadata: {
      ...doc.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function syncEngineToProjectDocument(
  engine: LayerEngine,
  doc: ProjectDocument,
): ProjectDocument {
  return applySnapshotToProjectDocument(doc, engine.snapshot());
}

function collectLayerTree(
  layerId: string,
  snapshot: LayerEngineSnapshot,
  out: Record<string, ProjectLayer>,
): void {
  const layer = snapshot.layers[layerId];
  if (!layer || out[layerId]) return;
  out[layerId] = layerNodeToProjectLayer(layer);
  for (const childId of layer.childLayerIds) {
    collectLayerTree(childId, snapshot, out);
  }
}

function layerNodeToProjectLayer(layer: LayerNode): ProjectLayer {
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    order: layer.order,
    kind: layer.layerKind,
    floorId: layer.floorId,
    parentId: layer.parentLayerId ?? null,
    blendMode: layer.blendMode,
    trace: layer.trace,
    rasterPath: layer.rasterPath ?? null,
    metadata: {
      ...(layer.metadata ?? {}),
      [LAYER_KIND_META]: layer.layerKind,
      [EXPANDED_META]: layer.expanded,
      [PARENT_LAYER_META]: layer.parentLayerId ?? null,
      [FLOOR_ID_META]: layer.floorId,
      [CHILD_LAYER_IDS_META]: [...layer.childLayerIds],
    },
  };
}

function sceneObjectToProjectObject(obj: SceneObjectNode): ProjectObject {
  const base: ProjectObject = {
    id: obj.id,
    type: obj.type,
    name: obj.name,
    layerId: obj.layerId,
    parentId: obj.relations.hierarchyParentId ?? undefined,
    visible: obj.visible,
    locked: obj.locked,
    transform: toDocTransform(obj.transform),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    metadata: {
      ...(obj.metadata ?? {}),
      opacity: obj.opacity,
      floorId: obj.floorId,
      transformSpace: obj.transformSpace,
      hostObjectId: obj.relations.hostObjectId,
      groupIds: obj.relations.groupIds,
      sourceObjectId: obj.relations.sourceObjectId,
      derivedObjectIds: obj.relations.derivedObjectIds,
    },
  };
  if (obj.geometry) base.geometry = obj.geometry;
  if (obj.style) base.style = obj.style;
  if (obj.relations.hostObjectId && obj.type === "window") {
    base.hostWallId = obj.relations.hostObjectId;
  }
  if (obj.relations.hostObjectId && obj.type === "door") {
    base.hostWallId = obj.relations.hostObjectId;
  }
  return base;
}

function toEngineTransform(t: DocTransform | undefined): ObjectTransform {
  if (!t) return createIdentityTransform();
  return {
    position: vec(t.position),
    rotation: vec(t.rotation),
    scale: vec(t.scale),
  };
}

function toDocTransform(t: ObjectTransform): DocTransform {
  return {
    position: vec(t.position),
    rotation: vec(t.rotation),
    scale: vec(t.scale),
  };
}

function vec(v: Vector3 | undefined): Vector3 {
  return {
    x: v?.x ?? 0,
    y: v?.y ?? 0,
    z: v?.z ?? 0,
  };
}

function parseLayerKind(value: string | null | undefined): LayerKind {
  switch (value) {
    case "sketch":
    case "object":
    case "architecture":
    case "reference":
    case "measurement":
    case "guide":
      return value;
    default:
      return "sketch";
  }
}

function readStringMeta(
  meta: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = meta?.[key];
  return typeof value === "string" ? value : null;
}

function readBoolMeta(
  meta: Record<string, unknown> | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const value = meta?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function readStringArrayMeta(
  meta: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const value = meta?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
