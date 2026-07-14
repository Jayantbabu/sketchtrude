import { describe, expect, it, vi } from "vitest";
import {
  capabilityRegistry,
  createCapabilityRegistry,
  createEmptySelectionState,
  createSceneObjectId,
  createSelectionManager,
  ensureAllShapeIds,
  ensureShapeId,
  isSelectionOnlyEvent,
  sceneTypeFromShapeKind,
  shapeToSceneObject,
  toSelectionSyncPayload,
  type LegacyShapeRecord,
} from "@/engine/interaction";

describe("ObjectCapabilityRegistry", () => {
  it("registers Phase 2B object types as selectable", () => {
    for (const type of ["shape", "stencil", "image", "sketch-stroke", "line"]) {
      expect(capabilityRegistry.has(type)).toBe(true);
      expect(capabilityRegistry.get(type).selectable).toBe(true);
    }
  });

  it("returns non-selectable defaults for unknown types", () => {
    const caps = capabilityRegistry.get("unknown-widget");
    expect(caps.selectable).toBe(false);
  });

  it("exposes capability-driven handles for shapes", () => {
    const shape = capabilityRegistry.get("shape");
    expect(shape.movable).toBe(true);
    expect(shape.resizable).toBe(true);
    expect(shape.supportsFill).toBe(true);
    expect(shape.boundingBoxMode).toBe("oriented");
  });

  it("allows custom registration", () => {
    const reg = createCapabilityRegistry();
    reg.register("custom", {
      ...capabilityRegistry.get("shape"),
      movable: false,
    });
    expect(reg.get("custom").movable).toBe(false);
  });
});

describe("SelectionManager", () => {
  it("starts empty", () => {
    const mgr = createSelectionManager();
    expect(mgr.getState()).toMatchObject(createEmptySelectionState());
  });

  it("selects a single object and notifies listeners", () => {
    const mgr = createSelectionManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.select("shape_1", "canvas");
    expect(mgr.getState().selectedIds).toEqual(["shape_1"]);
    expect(mgr.getState().primarySelectedId).toBe("shape_1");
    expect(mgr.getState().selectionSource).toBe("canvas");
    expect(listener).toHaveBeenCalledWith({
      type: "selection-changed",
      selectedIds: ["shape_1"],
      primarySelectedId: "shape_1",
      source: "canvas",
    });
  });

  it("toggles multi-select without duplicates", () => {
    const mgr = createSelectionManager();
    mgr.select("a", "canvas");
    mgr.toggle("b", "canvas");
    expect(mgr.getState().selectedIds).toEqual(["a", "b"]);
    mgr.toggle("a", "canvas");
    expect(mgr.getState().selectedIds).toEqual(["b"]);
    expect(mgr.getState().primarySelectedId).toBe("b");
  });

  it("clears selection", () => {
    const mgr = createSelectionManager();
    mgr.select("a", "canvas");
    mgr.clear("keyboard");
    expect(mgr.getState().selectedIds).toEqual([]);
    expect(mgr.getState().primarySelectedId).toBeNull();
    expect(mgr.getState().selectionSource).toBe("keyboard");
  });

  it("respects canSelect gate (locked from canvas)", () => {
    const locked = new Set(["locked_1"]);
    const mgr = createSelectionManager({
      canSelect: (id, source) => {
        if (source === "canvas" && locked.has(id)) return false;
        return true;
      },
    });
    mgr.select("locked_1", "canvas");
    expect(mgr.getState().selectedIds).toEqual([]);
    mgr.select("locked_1", "layer-panel");
    expect(mgr.getState().selectedIds).toEqual(["locked_1"]);
  });

  it("does not re-emit identical selection", () => {
    const mgr = createSelectionManager();
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.select("a", "canvas");
    mgr.select("a", "canvas");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("stable shape IDs", () => {
  it("mints an id when missing", () => {
    const shape: LegacyShapeRecord = { kind: "rect", pts: [] };
    const id = ensureShapeId(shape);
    expect(id).toMatch(/^shape_/);
    expect(shape.id).toBe(id);
  });

  it("preserves existing ids", () => {
    const shape: LegacyShapeRecord = { id: "shape_keep", kind: "ellipse" };
    expect(ensureShapeId(shape)).toBe("shape_keep");
  });

  it("assigns ids to every shape in a list", () => {
    const shapes: LegacyShapeRecord[] = [
      { kind: "rect" },
      { id: "shape_existing", kind: "ellipse" },
    ];
    const ids = ensureAllShapeIds(shapes);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe("shape_existing");
    expect(shapes[0].id).toBe(ids[0]);
  });

  it("maps shapes into scene objects", () => {
    const shape: LegacyShapeRecord = {
      kind: "ellipse",
      cx: 10,
      cy: 20,
      rx: 5,
      ry: 5,
      stroke: "#000",
      width: 2,
    };
    const obj = shapeToSceneObject(shape, 0);
    expect(obj.type).toBe("shape");
    expect(obj.id).toBe(shape.id);
    expect(obj.transform.position).toEqual({ x: 10, y: 20, z: 0 });
    expect(sceneTypeFromShapeKind("line")).toBe("line");
  });

  it("createSceneObjectId returns unique-ish values", () => {
    const a = createSceneObjectId("obj");
    const b = createSceneObjectId("obj");
    expect(a).not.toBe(b);
  });
});

describe("selection sync contract", () => {
  it("marks selection-changed as selection-only", () => {
    expect(isSelectionOnlyEvent({ type: "selection-changed" })).toBe(true);
    expect(isSelectionOnlyEvent({ type: "transform-committed" })).toBe(false);
  });

  it("maps canvas source to canvas-to-layer sync", () => {
    const payload = toSelectionSyncPayload({
      type: "selection-changed",
      selectedIds: ["shape_1"],
      primarySelectedId: "shape_1",
      source: "canvas",
    });
    expect(payload).toEqual({
      direction: "canvas-to-layer",
      selectionOnly: true,
      event: {
        type: "selection-changed",
        selectedIds: ["shape_1"],
        primarySelectedId: "shape_1",
        source: "canvas",
      },
    });
  });

  it("maps layer-panel source to layer-to-canvas sync", () => {
    const payload = toSelectionSyncPayload({
      type: "selection-changed",
      selectedIds: ["shape_2"],
      primarySelectedId: "shape_2",
      source: "layer-panel",
    });
    expect(payload?.direction).toBe("layer-to-canvas");
    expect(payload?.selectionOnly).toBe(true);
  });

  it("returns null for programmatic sources (no panel sync)", () => {
    expect(
      toSelectionSyncPayload({
        type: "selection-changed",
        selectedIds: [],
        primarySelectedId: null,
        source: "programmatic",
      }),
    ).toBeNull();
  });
});
