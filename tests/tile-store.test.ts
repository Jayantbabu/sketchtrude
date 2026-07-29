import { describe, expect, it } from "vitest";
import { tileKey, tilesForRect } from "@/engine/rendering/tile-store";
import { VectorStrokeStore } from "@/engine/rendering/vector-stroke-store";

describe("hybrid tile addressing", () => {
  it("returns only tiles intersecting a bounded stroke", () => {
    expect(tilesForRect({ x: 500, y: 500, w: 30, h: 30 }, 4000, 3000)).toEqual([
      {
        key: "0:0",
        column: 0,
        row: 0,
        x: 0,
        y: 0,
        width: 512,
        height: 512,
      },
      {
        key: "1:0",
        column: 1,
        row: 0,
        x: 512,
        y: 0,
        width: 512,
        height: 512,
      },
      {
        key: "0:1",
        column: 0,
        row: 1,
        x: 0,
        y: 512,
        width: 512,
        height: 512,
      },
      {
        key: "1:1",
        column: 1,
        row: 1,
        x: 512,
        y: 512,
        width: 512,
        height: 512,
      },
    ]);
  });

  it("clips edge tiles to the document", () => {
    const [tile] = tilesForRect({ x: 1024, y: 512, w: 200, h: 200 }, 1100, 600);
    expect(tile).toMatchObject({ key: tileKey(2, 1), width: 76, height: 88 });
  });

  it("does not allocate coordinates outside the document", () => {
    expect(tilesForRect({ x: -100, y: -100, w: 50, h: 50 }, 1000, 1000)).toEqual([]);
  });
});

describe("vector stroke spatial index", () => {
  it("serializes pressure-aware geometry and indexes touched tiles", () => {
    const store = new VectorStrokeStore(512);
    const stroke = store.add({
      brushId: "technical-pen",
      color: "#111111",
      opacity: 0.8,
      blendMode: "source-over",
      start: { x: 490, y: 20 },
      segments: [{ cx: 510, cy: 25, mx: 540, my: 30, width: 3, pressure: 0.7 }],
      bounds: { x: 487, y: 17, w: 56, h: 16 },
    });

    expect(store.inTile(0, 0)).toContainEqual(stroke);
    expect(store.inTile(1, 0)).toContainEqual(stroke);
    expect(VectorStrokeStore.fromSnapshot(store.serialize()).all()).toEqual([stroke]);
  });

  it("removes strokes from both storage and spatial indexes", () => {
    const store = new VectorStrokeStore();
    const stroke = store.add({
      brushId: "marker",
      color: "#ff0000",
      opacity: 1,
      blendMode: "multiply",
      start: { x: 10, y: 10 },
      segments: [{ cx: 20, cy: 20, mx: 30, my: 30, width: 8 }],
      bounds: { x: 5, y: 5, w: 40, h: 40 },
    });
    expect(store.remove(stroke.id)).toEqual(stroke);
    expect(store.inTile(0, 0)).toEqual([]);
  });
});
