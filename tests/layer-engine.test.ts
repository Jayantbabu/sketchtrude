import { describe, expect, it } from "vitest";
import {
  createLayerEngine,
  createSnapEngine,
  hydrateLayerEngineFromDocument,
  syncEngineToProjectDocument,
} from "../src/engine/layers";
import { createEmptyProjectDocument } from "../src/features/projects/domain/project-document";
import { createSelectionManager } from "../src/engine/interaction/selection-manager";
import {
  getLayerCapabilities,
  getTransformCapabilities,
} from "../src/engine/layers";

describe("Layer capabilities", () => {
  it("marks sketch as drawable and architecture as object-hosting", () => {
    const sketch = getLayerCapabilities("sketch");
    const arch = getLayerCapabilities("architecture");
    expect(sketch.canDraw).toBe(true);
    expect(sketch.canHostObjects).toBe(false);
    expect(arch.canDraw).toBe(false);
    expect(arch.canHostObjects).toBe(true);
  });

  it("gives walls length-constrained resize, not free scale", () => {
    const wall = getTransformCapabilities("wall");
    expect(wall.scalable).toBe(false);
    expect(wall.resizable).toBe(true);
    expect(wall.resizeMode).toBe("endpoints");
  });

  it("gives doors host-constrained resize", () => {
    const door = getTransformCapabilities("door");
    expect(door.resizeMode).toBe("host-constrained");
  });
});

describe("LayerEngine", () => {
  it("bootstraps Figma-style Layer 1 + Sketch", () => {
    const engine = createLayerEngine();
    const boot = engine.bootstrap({ floorName: "Canvas" });
    const snap = engine.snapshot();

    expect(snap.rootFloorIds).toHaveLength(1);
    expect(snap.floors[snap.rootFloorIds[0]!]?.name).toBe("Canvas");
    expect(boot.mainLayerId).toBeTruthy();
    expect(boot.sketchLayerId).toBeTruthy();

    const kinds = Object.values(snap.layers).map((l) => l.layerKind);
    expect(kinds).toContain("sketch");
    expect(kinds).toContain("object");
    expect(Object.values(snap.layers).find((l) => l.name === "Layer 1")?.layerKind).toBe(
      "object",
    );
    expect(Object.values(snap.layers).find((l) => l.name === "Sketch")?.layerKind).toBe(
      "sketch",
    );
    expect(engine.getActiveLayerId()).toBe(boot.sketchLayerId);
    expect(engine.getRasterLayerIds()).toEqual([boot.sketchLayerId]);
  });

  it("rebuilds raster layers from a legacy flat list", () => {
    const engine = createLayerEngine();
    const ids = engine.rebuildFromLegacyLayers(
      [
        {
          layer_id: "stable-ink-layer",
          name: "Ink",
          opacity: 0.8,
          raster_path: "a.png",
        },
        { layer_id: "stable-color-layer", name: "Color", visible: false },
      ],
      1,
    );

    expect(ids).toEqual(["stable-ink-layer", "stable-color-layer"]);
    expect(engine.getMainLayerId()).toBeTruthy();
    expect(engine.getLayer(engine.getMainLayerId()!)?.layerKind).toBe("object");
    expect(engine.getRasterLayerIds()).toEqual(ids);
    expect(engine.getLayer(ids[0]!)?.name).toBe("Ink");
    expect(engine.getLayer(ids[0]!)?.rasterPath).toBe("a.png");
    expect(engine.getLayer(ids[1]!)?.visible).toBe(false);
    expect(engine.getActiveLayerId()).toBe(ids[1]);
  });

  it("rebuilds a locked reference surface below the active sketch layer", () => {
    const engine = createLayerEngine();
    const ids = engine.rebuildFromLegacyLayers(
      [
        {
          layer_id: "source-layer",
          name: "PDF - Site plan",
          layerKind: "reference",
          locked: true,
        },
        {
          layer_id: "sketch-layer",
          name: "Sketch",
          layerKind: "sketch",
        },
      ],
      1,
    );

    expect(engine.getRasterLayerIds()).toEqual(ids);
    expect(engine.getLayer(ids[0]!)?.layerKind).toBe("reference");
    expect(engine.getLayer(ids[0]!)?.locked).toBe(true);
    expect(engine.getLayerCapabilities(ids[0]!)?.canDraw).toBe(false);
    expect(engine.getActiveLayerId()).toBe(ids[1]);
    expect(engine.getSketchLayerId()).toBe(ids[1]);
  });

  it("projects Layer 1 elements without a floor row by default", () => {
    const engine = createLayerEngine();
    engine.bootstrap();
    const mainId = engine.getMainLayerId()!;
    engine.setLayerExpanded(mainId, true);

    const wallId = engine.createObject({
      type: "wall",
      name: "Wall 01",
      layerId: mainId,
      geometry: { length: 4000, thickness: 200 },
    });
    engine.createObject({
      type: "shape",
      name: "Rectangle 1",
      layerId: mainId,
    });
    engine.createObject({
      type: "door",
      name: "Door 01",
      layerId: mainId,
      parentObjectId: wallId,
      hostObjectId: wallId,
      geometry: { width: 900 },
    });

    const rows = engine.getPanelRows();
    const names = rows.map((r) => r.name);
    expect(names).not.toContain("Canvas");
    expect(names).toContain("Layer 1");
    expect(names).toContain("Sketch");
    expect(names).toContain("Wall 01");
    expect(names).toContain("Rectangle 1");
    expect(names).toContain("Door 01");

    const doorRow = rows.find((r) => r.name === "Door 01");
    const wallRow = rows.find((r) => r.name === "Wall 01");
    expect(doorRow!.depth).toBeGreaterThan(wallRow!.depth);
  });

  it("preserves host constraints when grouping", () => {
    const engine = createLayerEngine();
    engine.bootstrap();
    const mainId = engine.getMainLayerId()!;
    const wallId = engine.createObject({
      type: "wall",
      name: "Wall 01",
      layerId: mainId,
    });
    const doorId = engine.createObject({
      type: "door",
      name: "Door 01",
      layerId: mainId,
      parentObjectId: wallId,
      hostObjectId: wallId,
    });
    const furnitureLayer = engine.createLayer({
      name: "Furniture",
      layerKind: "object",
    });
    const groupId = engine.groupObjects([wallId], "Should fail size");
    expect(groupId).toBeNull();

    const sofaId = engine.createObject({
      type: "furniture",
      name: "Sofa",
      layerId: furnitureLayer,
    });
    const tableId = engine.createObject({
      type: "furniture",
      name: "Table",
      layerId: furnitureLayer,
    });
    const layoutId = engine.groupObjects([sofaId, tableId], "Living Room");
    expect(layoutId).toBeTruthy();

    expect(engine.getObject(doorId)?.relations.hostObjectId).toBe(wallId);
  });

  it("moves hosted openings with their wall on delete", () => {
    const engine = createLayerEngine();
    engine.bootstrap();
    const mainId = engine.getMainLayerId()!;
    const wallId = engine.createObject({
      type: "wall",
      name: "Wall 01",
      layerId: mainId,
    });
    const doorId = engine.createObject({
      type: "door",
      name: "Door 01",
      layerId: mainId,
      hostObjectId: wallId,
    });
    engine.deleteObjects([wallId]);
    expect(engine.getObject(wallId)).toBeNull();
    expect(engine.getObject(doorId)).toBeNull();
  });

  it("applies move transforms through the shared transform engine", () => {
    const engine = createLayerEngine({
      snap: createSnapEngine({ enabled: false }),
    });
    engine.bootstrap();
    const objects = engine.getMainLayerId()!;
    const shapeId = engine.createObject({
      type: "shape",
      name: "Rect",
      layerId: objects,
      transform: {
        position: { x: 10, y: 20, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });

    expect(engine.beginTransform([shapeId], "move")).toBeTruthy();
    engine.updateTransform({ translation: { x: 5, y: -2, z: 0 } });
    engine.commitTransform();

    const moved = engine.getObject(shapeId)!;
    expect(moved.transform.position.x).toBe(15);
    expect(moved.transform.position.y).toBe(18);
  });

  it("rejects free scale sessions for walls", () => {
    const engine = createLayerEngine();
    engine.bootstrap();
    const mainId = engine.getMainLayerId()!;
    const wallId = engine.createObject({
      type: "wall",
      name: "Wall 01",
      layerId: mainId,
    });
    expect(engine.beginTransform([wallId], "scale")).toBeNull();
    expect(engine.beginTransform([wallId], "resize")).toBeTruthy();
    engine.cancelTransform();
  });

  it("reorders, duplicates, and deletes layers", () => {
    const engine = createLayerEngine();
    engine.bootstrap();
    const floorId = engine.getActiveFloorId()!;
    const a = engine.createLayer({ name: "A", layerKind: "sketch", floorId });
    const b = engine.createLayer({ name: "B", layerKind: "sketch", floorId });
    engine.moveLayer(b, 0);
    const rootIds = engine.snapshot().floors[floorId]!.layerIds;
    expect(rootIds.indexOf(b)).toBeLessThan(rootIds.indexOf(a));

    const copyId = engine.duplicateLayer(a)!;
    expect(engine.getLayer(copyId)?.name).toBe("A copy");

    engine.deleteLayers([copyId]);
    expect(engine.getLayer(copyId)).toBeNull();
  });
});

describe("SnapEngine", () => {
  it("returns structured snap results for grid and objects", () => {
    const snap = createSnapEngine({
      enabled: true,
      tolerancePx: 10,
      gridSpacing: 10,
      gridSnap: true,
      objectSnap: true,
    });
    snap.setTargets([
      {
        type: "endpoint",
        point: { x: 100, y: 50, z: 0 },
        objectId: "wall_1",
      },
    ]);

    const hit = snap.snap({ x: 102, y: 51, z: 0 });
    expect(hit?.type).toBe("endpoint");
    expect(hit?.targetObjectId).toBe("wall_1");
    expect(hit?.point).toEqual({ x: 100, y: 50, z: 0 });

    snap.clearTargets();
    const gridHit = snap.snap({ x: 12, y: 3, z: 0 });
    expect(gridHit?.type).toBe("grid");
    expect(gridHit?.point).toEqual({ x: 10, y: 0, z: 0 });
  });
});

describe("Document bridge", () => {
  it("round-trips engine state through ProjectDocument", () => {
    const engine = createLayerEngine();
    engine.bootstrap();
    const mainId = engine.getMainLayerId()!;
    engine.createObject({
      type: "wall",
      name: "Wall 01",
      layerId: mainId,
      geometry: { length: 4000 },
    });

    const base = createEmptyProjectDocument("proj-layer");
    const synced = syncEngineToProjectDocument(engine, base);
    expect(synced.scene.rootFloorIds?.length).toBeGreaterThan(0);
    expect(Object.keys(synced.scene.objects).length).toBe(1);

    const mainLayer = Object.values(synced.scene.layers).find(
      (l) => l.name === "Layer 1",
    );
    expect(mainLayer?.kind).toBe("object");

    const restored = createLayerEngine();
    hydrateLayerEngineFromDocument(restored, synced);
    const restoredWall = Object.values(restored.snapshot().objects).find(
      (o) => o.name === "Wall 01",
    );
    expect(restoredWall?.geometry).toMatchObject({ length: 4000 });
    expect(restored.getPanelRows().some((r) => r.name === "Layer 1")).toBe(true);
  });
});

describe("Selection + layer focus", () => {
  it("shares focused layer and escape exits edit context first", () => {
    const engine = createLayerEngine();
    engine.bootstrap();
    const selection = createSelectionManager();

    const layerId = engine.getActiveLayerId();
    selection.setFocusedLayer(layerId);
    expect(selection.getState().focusedLayerId).toBe(layerId);

    selection.select("wall_1", "layer-panel");
    selection.setActiveEditContext("wall_1");
    expect(selection.handleEscape("keyboard")).toBe(true);
    expect(selection.getState().activeEditContextId).toBeNull();
    expect(selection.getState().selectedIds).toEqual(["wall_1"]);
    expect(selection.handleEscape("keyboard")).toBe(true);
    expect(selection.getState().selectedIds).toEqual([]);
  });
});
