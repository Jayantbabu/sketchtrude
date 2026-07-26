import { defaultTransformSpace } from "./coordinates";
import { createFloorId, createLayerId, createObjectId } from "./ids";
import {
  defaultLayerName,
  getLayerCapabilities,
} from "./layer-capabilities";
import { createSnapEngine, type SnapEngine } from "./snap-engine";
import {
  createTransformEngine,
  type TransformEngine,
} from "./transform-engine";
import {
  createEmptyRelations,
  createIdentityTransform,
  type BlendMode,
  type FloorNode,
  type LayerEngineEvent,
  type LayerEngineSnapshot,
  type LayerKind,
  type LayerNode,
  type LayerPanelRow,
  type LegacyObjectRef,
  type ObjectTransform,
  type SceneObjectNode,
  type SceneObjectType,
  type TransformMode,
} from "./types";

export type LayerEngineListener = (event: LayerEngineEvent) => void;

export type CreateLayerOptions = {
  name?: string;
  layerKind?: LayerKind;
  floorId?: string;
  parentLayerId?: string | null;
  locked?: boolean;
  visible?: boolean;
  opacity?: number;
  blendMode?: BlendMode | string;
  insertAt?: number;
};

export type CreateObjectOptions = {
  type: SceneObjectType;
  name?: string;
  layerId: string;
  parentObjectId?: string | null;
  hostObjectId?: string | null;
  transform?: ObjectTransform;
  geometry?: Record<string, unknown>;
  style?: Record<string, unknown>;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  metadata?: Record<string, unknown>;
  legacyRef?: LegacyObjectRef;
};

export type LayerEngineOptions = {
  projectId?: string;
  snap?: SnapEngine;
  transform?: TransformEngine;
};

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Canonical hybrid layer engine.
 *
 * Owns floors → layers → objects hierarchy, layer panel projection,
 * and shared transform/snap engines. Selection stays in SelectionManager;
 * this engine emits selection-sync-needed when active layer changes.
 */
export class LayerEngine {
  private floors: Record<string, FloorNode> = {};
  private layers: Record<string, LayerNode> = {};
  private objects: Record<string, SceneObjectNode> = {};
  private rootFloorIds: string[] = [];
  private activeFloorId: string | null = null;
  private activeLayerId: string | null = null;
  private mutationVersion = 0;
  private _mainLayerId: string | null = null;
  private _sketchLayerId: string | null = null;
  private readonly listeners = new Set<LayerEngineListener>();
  readonly snap: SnapEngine;
  readonly transform: TransformEngine;

  constructor(options: LayerEngineOptions = {}) {
    this.snap = options.snap ?? createSnapEngine();
    this.transform =
      options.transform ?? createTransformEngine({ snap: this.snap });
  }

  /* ───────── lifecycle ───────── */

  subscribe(listener: LayerEngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getMutationVersion(): number {
    return this.mutationVersion;
  }

  snapshot(): LayerEngineSnapshot {
    return {
      floors: structuredClone(this.floors),
      layers: structuredClone(this.layers),
      objects: structuredClone(this.objects),
      rootFloorIds: [...this.rootFloorIds],
      activeFloorId: this.activeFloorId,
      activeLayerId: this.activeLayerId,
    };
  }

  loadSnapshot(snapshot: LayerEngineSnapshot): void {
    this.floors = structuredClone(snapshot.floors);
    this.layers = structuredClone(snapshot.layers);
    this.objects = structuredClone(snapshot.objects);
    this.rootFloorIds = [...snapshot.rootFloorIds];
    this.activeFloorId = snapshot.activeFloorId;
    this.activeLayerId = snapshot.activeLayerId;
    this.bump("scene-loaded");
  }

  /**
   * Figma-style default: Layer 1 (hosts walls/shapes as elements) + Sketch.
   */
  bootstrap(
    options: {
      floorName?: string;
      mainLayerName?: string;
      sketchLayerName?: string;
    } = {},
  ): { floorId: string; mainLayerId: string; sketchLayerId: string } {
    this.floors = {};
    this.layers = {};
    this.objects = {};
    this.rootFloorIds = [];
    this.activeFloorId = null;
    this.activeLayerId = null;

    const floorId = this.createFloor(options.floorName ?? "Canvas");
    const mainLayerId = this.createLayer({
      name: options.mainLayerName ?? "Layer 1",
      layerKind: "object",
      floorId,
    });
    const sketchLayerId = this.createLayer({
      name: options.sketchLayerName ?? "Sketch",
      layerKind: "sketch",
      floorId,
    });
    this.layers[mainLayerId]!.expanded = true;
    this._mainLayerId = mainLayerId;
    this._sketchLayerId = sketchLayerId;
    this.setActiveLayer(sketchLayerId);
    return { floorId, mainLayerId, sketchLayerId };
  }

  getMainLayerId(): string | null {
    if (this._mainLayerId && this.layers[this._mainLayerId]) return this._mainLayerId;
    const objectLayer = Object.values(this.layers).find((l) => l.layerKind === "object");
    if (objectLayer) return objectLayer.id;
    const floorId = this.rootFloorIds[0];
    if (!floorId) return null;
    return this.floors[floorId]?.layerIds[0] ?? null;
  }

  getSketchLayerId(): string | null {
    if (this._sketchLayerId && this.layers[this._sketchLayerId]) {
      return this._sketchLayerId;
    }
    return Object.values(this.layers).find((l) => l.layerKind === "sketch")?.id ?? null;
  }

  /**
   * Drawable (raster) layer ids in paint order — bottom of stack first.
   * Object-host layers like "Layer 1" are excluded; only sketch surfaces ink.
   */
  getRasterLayerIds(): string[] {
    const ids: string[] = [];
    const walk = (layerIds: string[]) => {
      for (const id of layerIds) {
        const layer = this.layers[id];
        if (!layer) continue;
        if (getLayerCapabilities(layer.layerKind).canDraw) ids.push(id);
        if (layer.childLayerIds.length) walk(layer.childLayerIds);
      }
    };
    for (const floorId of this.rootFloorIds) {
      const floor = this.floors[floorId];
      if (floor) walk(floor.layerIds);
    }
    return ids;
  }

  /**
   * Rebuild floors/layers from a flat legacy save list (raster rows only).
   * Always creates an object host "Layer 1", then one sketch layer per entry.
   * Returns engine ids aligned 1:1 with `legacyLayers` for surface allocation.
   */
  rebuildFromLegacyLayers(
    legacyLayers: Array<{
      name?: string;
      visible?: boolean;
      locked?: boolean;
      opacity?: number;
      blendMode?: string;
      trace?: number;
      raster_path?: string | null;
    }>,
    activeIndex = 0,
  ): string[] {
    this.floors = {};
    this.layers = {};
    this.objects = {};
    this.rootFloorIds = [];
    this.activeFloorId = null;
    this.activeLayerId = null;
    this._mainLayerId = null;
    this._sketchLayerId = null;

    const floorId = this.createFloor("Canvas");
    const mainLayerId = this.createLayer({
      name: "Layer 1",
      layerKind: "object",
      floorId,
    });
    this.layers[mainLayerId]!.expanded = true;
    this._mainLayerId = mainLayerId;

    const engineIds: string[] = [];
    const list = Array.isArray(legacyLayers) ? legacyLayers : [];
    for (let i = 0; i < list.length; i++) {
      const ld = list[i] ?? {};
      const id = this.createLayer({
        name: ld.name || `Layer ${i + 1}`,
        layerKind: "sketch",
        floorId,
        visible: ld.visible !== false,
        locked: ld.locked,
        opacity: typeof ld.opacity === "number" ? ld.opacity : 1,
        blendMode: ld.blendMode,
      });
      const layer = this.layers[id]!;
      if (typeof ld.trace === "number") layer.trace = ld.trace;
      layer.rasterPath = ld.raster_path ?? null;
      engineIds.push(id);
      if (i === 0) this._sketchLayerId = id;
    }

    if (engineIds.length === 0) {
      const sketchId = this.createLayer({
        name: "Sketch",
        layerKind: "sketch",
        floorId,
      });
      this._sketchLayerId = sketchId;
      this.setActiveLayer(sketchId);
      return [];
    }

    const clamped = Math.max(0, Math.min(activeIndex, engineIds.length - 1));
    this.setActiveLayer(engineIds[clamped]!);
    return engineIds;
  }

  /* ───────── floors ───────── */

  createFloor(name = "Floor", elevation = 0): string {
    const id = createFloorId();
    const order = this.rootFloorIds.length;
    this.floors[id] = {
      id,
      kind: "floor",
      name,
      visible: true,
      locked: false,
      opacity: 1,
      order,
      layerIds: [],
      elevation,
    };
    this.rootFloorIds.push(id);
    if (!this.activeFloorId) this.activeFloorId = id;
    this.emit({ type: "floor-changed", floorId: id });
    this.bump("floor-created");
    return id;
  }

  getFloor(floorId: string): FloorNode | null {
    return this.floors[floorId] ?? null;
  }

  getActiveFloorId(): string | null {
    return this.activeFloorId;
  }

  setActiveFloor(floorId: string): void {
    if (!this.floors[floorId]) return;
    this.activeFloorId = floorId;
    this.emit({ type: "floor-changed", floorId });
  }

  renameFloor(floorId: string, name: string): void {
    const floor = this.floors[floorId];
    if (!floor) return;
    floor.name = name.trim() || floor.name;
    this.emit({ type: "floor-changed", floorId });
    this.bump("floor-renamed");
  }

  /* ───────── layers ───────── */

  createLayer(options: CreateLayerOptions = {}): string {
    const layerKind = options.layerKind ?? "sketch";
    const caps = getLayerCapabilities(layerKind);
    const floorId =
      options.floorId ?? this.activeFloorId ?? this.rootFloorIds[0];
    if (!floorId || !this.floors[floorId]) {
      throw new Error("LayerEngine.createLayer: no floor available");
    }

    const parentLayerId = options.parentLayerId ?? null;
    if (parentLayerId && !this.layers[parentLayerId]) {
      throw new Error("LayerEngine.createLayer: parent layer not found");
    }

    const siblings = parentLayerId
      ? this.layers[parentLayerId]!.childLayerIds
      : this.floors[floorId]!.layerIds;

    const id = createLayerId();
    const index = siblings.length + 1;
    const layer: LayerNode = {
      id,
      kind: "layer",
      layerKind,
      name: options.name ?? defaultLayerName(layerKind, index),
      floorId,
      parentLayerId,
      visible: options.visible ?? true,
      locked: options.locked ?? caps.lockByDefault,
      opacity: options.opacity ?? 1,
      order: 0,
      blendMode: options.blendMode ?? "source-over",
      expanded: layerKind === "architecture" || layerKind === "object",
      trace: layerKind === "sketch" ? 0 : undefined,
      rasterPath: null,
      childLayerIds: [],
      objectIds: [],
    };

    this.layers[id] = layer;

    const insertAt =
      options.insertAt !== undefined
        ? Math.max(0, Math.min(options.insertAt, siblings.length))
        : siblings.length;
    siblings.splice(insertAt, 0, id);
    this.reindexLayerOrders(siblings);

    if (parentLayerId) {
      this.layers[parentLayerId]!.expanded = true;
    }

    if (!this.activeLayerId) this.activeLayerId = id;
    this.activeFloorId = floorId;
    this.emit({ type: "layer-created", layerId: id });
    this.bump("layer-created");
    return id;
  }

  getLayer(layerId: string): LayerNode | null {
    return this.layers[layerId] ?? null;
  }

  getActiveLayerId(): string | null {
    return this.activeLayerId;
  }

  setActiveLayer(layerId: string | null): void {
    if (layerId && !this.layers[layerId]) return;
    if (this.activeLayerId === layerId) return;
    this.activeLayerId = layerId;
    if (layerId) {
      this.activeFloorId = this.layers[layerId]!.floorId;
    }
    this.emit({ type: "active-layer-changed", layerId });
    this.emit({ type: "selection-sync-needed" });
  }

  renameLayer(layerId: string, name: string): void {
    const layer = this.layers[layerId];
    if (!layer || layer.locked) return;
    layer.name = name.trim() || layer.name;
    this.emit({ type: "layer-updated", layerId });
    this.bump("layer-renamed");
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.layers[layerId];
    if (!layer) return;
    layer.visible = visible;
    this.emit({ type: "layer-updated", layerId });
    this.bump("layer-visibility");
  }

  setLayerLocked(layerId: string, locked: boolean): void {
    const layer = this.layers[layerId];
    if (!layer) return;
    layer.locked = locked;
    this.emit({ type: "layer-updated", layerId });
    this.bump("layer-lock");
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this.layers[layerId];
    if (!layer) return;
    layer.opacity = clamp01(opacity);
    this.emit({ type: "layer-updated", layerId });
    this.bump("layer-opacity");
  }

  setLayerBlendMode(layerId: string, blendMode: string): void {
    const layer = this.layers[layerId];
    if (!layer) return;
    const caps = getLayerCapabilities(layer.layerKind);
    if (!caps.supportsBlendMode) return;
    layer.blendMode = blendMode;
    this.emit({ type: "layer-updated", layerId });
    this.bump("layer-blend");
  }

  setLayerExpanded(layerId: string, expanded: boolean): void {
    const layer = this.layers[layerId];
    if (!layer) return;
    layer.expanded = expanded;
    this.emit({ type: "layer-updated", layerId });
  }

  toggleLayerExpanded(layerId: string): void {
    const layer = this.layers[layerId];
    if (!layer) return;
    this.setLayerExpanded(layerId, !layer.expanded);
  }

  /** Reorder a layer among its siblings. */
  moveLayer(layerId: string, toIndex: number): void {
    const layer = this.layers[layerId];
    if (!layer) return;
    const siblings = this.siblingLayerIds(layer);
    const from = siblings.indexOf(layerId);
    if (from < 0) return;
    siblings.splice(from, 1);
    const insertAt = Math.max(0, Math.min(toIndex, siblings.length));
    siblings.splice(insertAt, 0, layerId);
    this.reindexLayerOrders(siblings);
    this.emit({ type: "layer-reordered", layerIds: [...siblings] });
    this.bump("layer-reordered");
  }

  duplicateLayer(layerId: string): string | null {
    const src = this.layers[layerId];
    if (!src) return null;
    const newId = this.createLayer({
      name: `${src.name} copy`,
      layerKind: src.layerKind,
      floorId: src.floorId,
      parentLayerId: src.parentLayerId,
      locked: src.locked,
      visible: src.visible,
      opacity: src.opacity,
      blendMode: src.blendMode,
    });
    const dst = this.layers[newId]!;
    dst.trace = src.trace;
    dst.rasterPath = src.rasterPath;

    // Deep-copy direct objects (not hosted children of other objects).
    for (const objectId of src.objectIds) {
      const obj = this.objects[objectId];
      if (!obj || obj.relations.hierarchyParentId) continue;
      this.duplicateObjectTree(objectId, newId, null);
    }
    return newId;
  }

  deleteLayers(layerIds: string[]): void {
    const toDelete = new Set<string>();
    const collect = (id: string) => {
      if (toDelete.has(id)) return;
      const layer = this.layers[id];
      if (!layer) return;
      toDelete.add(id);
      for (const child of layer.childLayerIds) collect(child);
    };
    for (const id of layerIds) collect(id);

    const objectIds: string[] = [];
    for (const id of toDelete) {
      const layer = this.layers[id];
      if (!layer) continue;
      objectIds.push(...this.collectObjectIdsOnLayer(id));
      this.detachLayerFromParent(layer);
      delete this.layers[id];
    }
    this.deleteObjects(objectIds, { skipLayerCleanup: true });

    if (this.activeLayerId && toDelete.has(this.activeLayerId)) {
      this.activeLayerId = this.firstDrawableLayerId();
      this.emit({
        type: "active-layer-changed",
        layerId: this.activeLayerId,
      });
    }

    this.emit({ type: "layer-deleted", layerIds: [...toDelete] });
    this.bump("layer-deleted");
  }

  getLayerCapabilities(layerId: string) {
    const layer = this.layers[layerId];
    if (!layer) return null;
    return getLayerCapabilities(layer.layerKind);
  }

  /* ───────── objects ───────── */

  createObject(options: CreateObjectOptions): string {
    const layer = this.layers[options.layerId];
    if (!layer) throw new Error("LayerEngine.createObject: layer not found");

    const caps = getLayerCapabilities(layer.layerKind);
    if (!caps.canHostObjects && options.type !== "sketch-stroke") {
      // Sketch layers may still store strokes internally.
      if (layer.layerKind !== "sketch") {
        throw new Error(
          `LayerEngine.createObject: layer kind "${layer.layerKind}" cannot host objects`,
        );
      }
    }

    const id = createObjectId(options.type);
    const stamp = nowIso();
    const hostObjectId = options.hostObjectId ?? null;
    const hierarchyParentId = options.parentObjectId ?? null;

    if (hierarchyParentId && !this.objects[hierarchyParentId]) {
      throw new Error("LayerEngine.createObject: parent object not found");
    }
    if (hostObjectId && !this.objects[hostObjectId]) {
      throw new Error("LayerEngine.createObject: host object not found");
    }

    const node: SceneObjectNode = {
      id,
      kind: options.type === "group" || options.type === "room" ? "group" : "object",
      type: options.type,
      name: options.name ?? defaultObjectName(options.type),
      layerId: options.layerId,
      floorId: layer.floorId,
      visible: options.visible ?? true,
      locked: options.locked ?? false,
      opacity: options.opacity ?? 1,
      order: 0,
      transform: options.transform
        ? cloneTransform(options.transform)
        : createIdentityTransform(),
      transformSpace: defaultTransformSpace(options.type, Boolean(hostObjectId)),
      relations: createEmptyRelations({
        hierarchyParentId,
        hostObjectId,
        floorId: layer.floorId,
        layerId: options.layerId,
      }),
      childIds: [],
      geometry: options.geometry ? { ...options.geometry } : undefined,
      style: options.style ? { ...options.style } : undefined,
      createdAt: stamp,
      updatedAt: stamp,
      metadata: options.metadata ? { ...options.metadata } : undefined,
      legacyRef: options.legacyRef ? { ...options.legacyRef } : undefined,
    };

    this.objects[id] = node;
    layer.expanded = true;

    if (hierarchyParentId) {
      this.objects[hierarchyParentId]!.childIds.push(id);
    } else {
      layer.objectIds.push(id);
      node.order = layer.objectIds.length - 1;
    }

    if (hostObjectId) {
      const host = this.objects[hostObjectId]!;
      if (!host.childIds.includes(id)) host.childIds.push(id);
    }

    this.emit({ type: "object-created", objectId: id });
    this.bump("object-created");
    return id;
  }

  getObject(objectId: string): SceneObjectNode | null {
    return this.objects[objectId] ?? null;
  }

  getObjects(): Record<string, SceneObjectNode> {
    return this.objects;
  }

  /**
   * Move an object under a new hierarchy parent (or back to the layer root).
   * Detaches from wherever it currently lives so it never appears in two places.
   */
  reparentObject(objectId: string, parentObjectId: string | null): boolean {
    const obj = this.objects[objectId];
    if (!obj) return false;
    const nextParentId = parentObjectId ?? null;
    if ((obj.relations.hierarchyParentId ?? null) === nextParentId) return false;
    if (nextParentId) {
      if (!this.objects[nextParentId]) return false;
      // Refuse cycles: the new parent must not sit inside this object.
      let walk: string | null | undefined = nextParentId;
      while (walk) {
        if (walk === objectId) return false;
        walk = this.objects[walk]?.relations.hierarchyParentId ?? null;
      }
    }

    const prevParentId = obj.relations.hierarchyParentId ?? null;
    this.detachObjectFromHierarchy(obj);
    if (prevParentId) {
      obj.relations.groupIds = (obj.relations.groupIds ?? []).filter(
        (id) => id !== prevParentId,
      );
    }

    obj.relations.hierarchyParentId = nextParentId;
    if (nextParentId) {
      const parent = this.objects[nextParentId]!;
      if (!parent.childIds.includes(objectId)) parent.childIds.push(objectId);
      if (parent.type === "group" || parent.type === "room") {
        obj.relations.groupIds = [...(obj.relations.groupIds ?? []), nextParentId];
      }
    } else {
      const layer = this.layers[obj.layerId];
      if (layer && !layer.objectIds.includes(objectId)) {
        layer.objectIds.push(objectId);
        obj.order = layer.objectIds.length - 1;
      }
    }

    obj.updatedAt = nowIso();
    this.emit({ type: "object-reparented", objectId });
    this.bump("object-reparented");
    return true;
  }

  /**
   * Repair containment so every object is listed exactly once: parented objects
   * live only in their parent's childIds, orphans fall back to the layer root.
   */
  normalizeObjectContainment(): void {
    for (const obj of Object.values(this.objects)) {
      const seen = new Set<string>();
      obj.childIds = obj.childIds.filter((id) => {
        const child = this.objects[id];
        if (!child || seen.has(id)) return false;
        seen.add(id);
        return (
          child.relations.hierarchyParentId === obj.id ||
          child.relations.hostObjectId === obj.id
        );
      });
    }
    for (const layer of Object.values(this.layers)) {
      const seen = new Set<string>();
      layer.objectIds = layer.objectIds.filter((id) => {
        const obj = this.objects[id];
        if (!obj || seen.has(id)) return false;
        seen.add(id);
        const parentId = obj.relations.hierarchyParentId;
        return !parentId || !this.objects[parentId];
      });
    }
    for (const obj of Object.values(this.objects)) {
      const parentId = obj.relations.hierarchyParentId;
      const parent = parentId ? this.objects[parentId] : null;
      if (parent) {
        if (!parent.childIds.includes(obj.id)) parent.childIds.push(obj.id);
        continue;
      }
      if (parentId && !parent) obj.relations.hierarchyParentId = null;
      const layer = this.layers[obj.layerId];
      if (layer && !layer.objectIds.includes(obj.id)) layer.objectIds.push(obj.id);
    }
  }

  renameObject(objectId: string, name: string): void {
    const obj = this.objects[objectId];
    if (!obj || obj.locked) return;
    obj.name = name.trim() || obj.name;
    obj.updatedAt = nowIso();
    this.emit({ type: "object-updated", objectId });
    this.bump("object-renamed");
  }

  setObjectVisibility(objectId: string, visible: boolean): void {
    const obj = this.objects[objectId];
    if (!obj) return;
    obj.visible = visible;
    obj.updatedAt = nowIso();
    this.emit({ type: "object-updated", objectId });
    this.bump("object-visibility");
  }

  setObjectLocked(objectId: string, locked: boolean): void {
    const obj = this.objects[objectId];
    if (!obj) return;
    obj.locked = locked;
    obj.updatedAt = nowIso();
    this.emit({ type: "object-updated", objectId });
    this.bump("object-lock");
  }

  setObjectOpacity(objectId: string, opacity: number): void {
    const obj = this.objects[objectId];
    if (!obj) return;
    obj.opacity = clamp01(opacity);
    obj.updatedAt = nowIso();
    this.emit({ type: "object-updated", objectId });
    this.bump("object-opacity");
  }

  applyObjectTransform(objectId: string, transform: ObjectTransform): void {
    const obj = this.objects[objectId];
    if (!obj || obj.locked) return;
    obj.transform = cloneTransform(transform);
    obj.updatedAt = nowIso();
    this.emit({ type: "object-updated", objectId });
    this.bump("object-transform");
  }

  patchObjectGeometry(
    objectId: string,
    patch: Record<string, unknown>,
  ): void {
    const obj = this.objects[objectId];
    if (!obj || obj.locked) return;
    obj.geometry = { ...(obj.geometry ?? {}), ...patch };
    obj.updatedAt = nowIso();
    this.emit({ type: "object-updated", objectId });
    this.bump("object-geometry");
  }

  /**
   * Group selected objects into a visual group.
   * Preserves world transforms and host constraints (doors stay on walls).
   */
  groupObjects(objectIds: string[], name = "Group"): string | null {
    const roots = objectIds
      .map((id) => this.objects[id])
      .filter((o): o is SceneObjectNode => Boolean(o));
    if (roots.length < 2) return null;

    const layerId = roots[0]!.layerId;
    if (!roots.every((o) => o.layerId === layerId)) {
      throw new Error("LayerEngine.groupObjects: objects must share a layer");
    }

    const groupId = this.createObject({
      type: "group",
      name,
      layerId,
      transform: createIdentityTransform(),
    });
    const group = this.objects[groupId]!;

    for (const obj of roots) {
      // Detach from layer root list / previous hierarchy parent.
      this.detachObjectFromHierarchy(obj);
      obj.relations.hierarchyParentId = groupId;
      obj.relations.groupIds = [...(obj.relations.groupIds ?? []), groupId];
      group.childIds.push(obj.id);
      obj.updatedAt = nowIso();
    }

    this.emit({ type: "object-updated", objectId: groupId });
    this.bump("objects-grouped");
    return groupId;
  }

  ungroup(groupId: string): string[] {
    const group = this.objects[groupId];
    if (!group || group.type !== "group") return [];
    const childIds = [...group.childIds];
    const layer = this.layers[group.layerId];
    if (!layer) return [];

    for (const childId of childIds) {
      const child = this.objects[childId];
      if (!child) continue;
      child.relations.hierarchyParentId = null;
      child.relations.groupIds = (child.relations.groupIds ?? []).filter(
        (id) => id !== groupId,
      );
      layer.objectIds.push(childId);
      child.updatedAt = nowIso();
    }

    group.childIds = [];
    this.deleteObjects([groupId]);
    return childIds;
  }

  deleteObjects(
    objectIds: string[],
    options: { skipLayerCleanup?: boolean } = {},
  ): void {
    const toDelete = new Set<string>();
    const collect = (id: string) => {
      if (toDelete.has(id)) return;
      const obj = this.objects[id];
      if (!obj) return;
      toDelete.add(id);
      for (const childId of obj.childIds) collect(childId);
      // Hosted openings go with their host unless separately kept.
      for (const [otherId, other] of Object.entries(this.objects)) {
        if (other.relations.hostObjectId === id) collect(otherId);
      }
    };
    for (const id of objectIds) collect(id);

    for (const id of toDelete) {
      const obj = this.objects[id];
      if (!obj) continue;
      if (!options.skipLayerCleanup) this.detachObjectFromHierarchy(obj);
      delete this.objects[id];
    }

    if (toDelete.size > 0) {
      this.emit({ type: "object-deleted", objectIds: [...toDelete] });
      this.bump("object-deleted");
    }
  }

  /* ───────── transform session helpers ───────── */

  beginTransform(
    objectIds: string[],
    mode: TransformMode,
  ): ReturnType<TransformEngine["begin"]> {
    const objects = objectIds
      .map((id) => this.objects[id])
      .filter((o): o is SceneObjectNode => Boolean(o) && !o.locked);
    return this.transform.begin(objects, mode);
  }

  updateTransform(delta: Parameters<TransformEngine["update"]>[1]): void {
    const results = this.transform.update(this.objects, delta);
    for (const result of results) {
      this.applyObjectTransform(result.objectId, result.transform);
      if (result.geometryPatch) {
        this.patchObjectGeometry(result.objectId, result.geometryPatch);
      }
    }
  }

  commitTransform(): void {
    const result = this.transform.commit();
    if (!result) return;
    this.emit({
      type: "transform-committed",
      objectIds: result.objectIds,
      mode: result.mode,
    });
    this.bump("transform-committed");
  }

  cancelTransform(): void {
    const session = this.transform.getSession();
    if (!session) return;
    for (const id of session.objectIds) {
      const start = session.startTransforms[id];
      if (start) this.applyObjectTransform(id, start);
    }
    this.transform.cancel();
  }

  /* ───────── panel projection ───────── */

  /**
   * Flatten the scene into layer-panel rows.
   * Same hierarchy as the scene model — not a UI-only tree.
   */
  getPanelRows(
    options: { includeObjects?: boolean; hideFloors?: boolean } = {},
  ): LayerPanelRow[] {
    const includeObjects = options.includeObjects ?? true;
    const hideFloors = options.hideFloors ?? true;
    const rows: LayerPanelRow[] = [];

    for (const floorId of this.rootFloorIds) {
      const floor = this.floors[floorId];
      if (!floor) continue;
      let layerDepth = 0;
      if (!hideFloors) {
        rows.push({
          id: floor.id,
          nodeKind: "floor",
          name: floor.name,
          depth: 0,
          visible: floor.visible,
          locked: floor.locked,
          opacity: floor.opacity,
          expanded: true,
          hasChildren: floor.layerIds.length > 0,
          parentId: null,
        });
        layerDepth = 1;
      }

      // Top → bottom in panel (reverse paint order)
      for (let i = floor.layerIds.length - 1; i >= 0; i--) {
        this.pushLayerRows(rows, floor.layerIds[i]!, layerDepth, includeObjects);
      }
    }
    return rows;
  }

  /* ───────── queries ───────── */

  isEffectivelyVisible(objectId: string): boolean {
    const obj = this.objects[objectId];
    if (!obj || !obj.visible) return false;
    const layer = this.layers[obj.layerId];
    if (!layer || !layer.visible) return false;
    const floor = this.floors[obj.floorId];
    if (!floor || !floor.visible) return false;
    if (obj.relations.hierarchyParentId) {
      return this.isEffectivelyVisible(obj.relations.hierarchyParentId);
    }
    return true;
  }

  isEffectivelyLocked(objectId: string): boolean {
    const obj = this.objects[objectId];
    if (!obj) return true;
    if (obj.locked) return true;
    const layer = this.layers[obj.layerId];
    if (layer?.locked) return true;
    const floor = this.floors[obj.floorId];
    if (floor?.locked) return true;
    return false;
  }

  /* ───────── internals ───────── */

  private pushLayerRows(
    rows: LayerPanelRow[],
    layerId: string,
    depth: number,
    includeObjects: boolean,
  ): void {
    const layer = this.layers[layerId];
    if (!layer) return;
    const caps = getLayerCapabilities(layer.layerKind);
    const showObjects =
      includeObjects && caps.showChildrenInPanel && layer.expanded;

    rows.push({
      id: layer.id,
      nodeKind: "layer",
      layerKind: layer.layerKind,
      name: layer.name,
      depth,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      expanded: layer.expanded,
      hasChildren:
        layer.childLayerIds.length > 0 ||
        (caps.showChildrenInPanel && layer.objectIds.length > 0),
      parentId: layer.parentLayerId ?? layer.floorId,
    });

    if (layer.expanded) {
      if (showObjects) {
        for (let i = layer.objectIds.length - 1; i >= 0; i--) {
          this.pushObjectRows(rows, layer.objectIds[i]!, depth + 1);
        }
      }
      for (const childId of layer.childLayerIds) {
        this.pushLayerRows(rows, childId, depth + 1, includeObjects);
      }
    }
  }

  private pushObjectRows(
    rows: LayerPanelRow[],
    objectId: string,
    depth: number,
  ): void {
    const obj = this.objects[objectId];
    if (!obj) return;
    // Hosted openings appear under their host, not as layer roots.
    if (obj.relations.hostObjectId && obj.relations.hierarchyParentId == null) {
      // Still listed if it is a direct layer object without hierarchy parent.
    }
    rows.push({
      id: obj.id,
      nodeKind: "object",
      objectType: obj.type,
      name: obj.name,
      depth,
      visible: obj.visible,
      locked: obj.locked,
      opacity: obj.opacity,
      expanded: false,
      hasChildren: obj.childIds.length > 0,
      parentId: obj.relations.hierarchyParentId ?? obj.layerId,
      legacyRef: obj.legacyRef ? { ...obj.legacyRef } : undefined,
    });
    for (const childId of obj.childIds) {
      this.pushObjectRows(rows, childId, depth + 1);
    }
  }

  private siblingLayerIds(layer: LayerNode): string[] {
    if (layer.parentLayerId) {
      return this.layers[layer.parentLayerId]!.childLayerIds;
    }
    return this.floors[layer.floorId]!.layerIds;
  }

  private reindexLayerOrders(ids: string[]): void {
    ids.forEach((id, index) => {
      const layer = this.layers[id];
      if (layer) layer.order = index;
    });
  }

  private detachLayerFromParent(layer: LayerNode): void {
    if (layer.parentLayerId) {
      const parent = this.layers[layer.parentLayerId];
      if (parent) {
        parent.childLayerIds = parent.childLayerIds.filter(
          (id) => id !== layer.id,
        );
        this.reindexLayerOrders(parent.childLayerIds);
      }
      return;
    }
    const floor = this.floors[layer.floorId];
    if (floor) {
      floor.layerIds = floor.layerIds.filter((id) => id !== layer.id);
      this.reindexLayerOrders(floor.layerIds);
    }
  }

  private detachObjectFromHierarchy(obj: SceneObjectNode): void {
    const parentId = obj.relations.hierarchyParentId;
    if (parentId) {
      const parent = this.objects[parentId];
      if (parent) {
        parent.childIds = parent.childIds.filter((id) => id !== obj.id);
      }
    } else {
      const layer = this.layers[obj.layerId];
      if (layer) {
        layer.objectIds = layer.objectIds.filter((id) => id !== obj.id);
      }
    }
    const hostId = obj.relations.hostObjectId;
    if (hostId && hostId !== parentId) {
      const host = this.objects[hostId];
      if (host) {
        host.childIds = host.childIds.filter((id) => id !== obj.id);
      }
    }
  }

  private collectObjectIdsOnLayer(layerId: string): string[] {
    return Object.values(this.objects)
      .filter((o) => o.layerId === layerId)
      .map((o) => o.id);
  }

  private duplicateObjectTree(
    objectId: string,
    targetLayerId: string,
    parentObjectId: string | null,
  ): string | null {
    const src = this.objects[objectId];
    if (!src) return null;
    const newId = this.createObject({
      type: src.type,
      name: src.name,
      layerId: targetLayerId,
      parentObjectId,
      hostObjectId: null,
      transform: cloneTransform(src.transform),
      geometry: src.geometry ? { ...src.geometry } : undefined,
      style: src.style ? { ...src.style } : undefined,
      visible: src.visible,
      locked: src.locked,
      opacity: src.opacity,
      metadata: src.metadata ? { ...src.metadata } : undefined,
      legacyRef: src.legacyRef ? { ...src.legacyRef } : undefined,
    });
    for (const childId of src.childIds) {
      const child = this.objects[childId];
      if (!child) continue;
      if (child.relations.hostObjectId === objectId) {
        const hostedId = this.duplicateObjectTree(
          childId,
          targetLayerId,
          newId,
        );
        if (hostedId) {
          this.objects[hostedId]!.relations.hostObjectId = newId;
          this.objects[hostedId]!.transformSpace = src.transformSpace;
        }
      } else if (child.relations.hierarchyParentId === objectId) {
        this.duplicateObjectTree(childId, targetLayerId, newId);
      }
    }
    return newId;
  }

  private firstDrawableLayerId(): string | null {
    for (const floorId of this.rootFloorIds) {
      const floor = this.floors[floorId];
      if (!floor) continue;
      const walk = (ids: string[]): string | null => {
        for (const id of ids) {
          const layer = this.layers[id];
          if (!layer) continue;
          if (getLayerCapabilities(layer.layerKind).canDraw) return id;
          const nested = walk(layer.childLayerIds);
          if (nested) return nested;
        }
        return null;
      };
      const found = walk(floor.layerIds);
      if (found) return found;
      if (floor.layerIds[0]) return floor.layerIds[0]!;
    }
    return null;
  }

  private emit(event: LayerEngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private bump(reason: string): void {
    this.mutationVersion += 1;
    this.emit({ type: "scene-changed", reason });
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function cloneTransform(t: ObjectTransform): ObjectTransform {
  return {
    position: { ...t.position },
    rotation: { ...t.rotation },
    scale: { ...t.scale },
  };
}

function defaultObjectName(type: SceneObjectType): string {
  const label = type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return label;
}

export function createLayerEngine(options?: LayerEngineOptions): LayerEngine {
  return new LayerEngine(options);
}
