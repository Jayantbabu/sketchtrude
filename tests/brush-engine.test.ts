import { describe, expect, it } from "vitest";
import {
  BUILTIN_BRUSH_PRESETS,
  BRUSH_FAMILIES,
  BRUSH_SUBFAMILIES,
  createBrushLibrary,
  resolveStrokeParams,
  smoothPoint,
} from "@/engine/brushes";

describe("Brush library", () => {
  it("ships the recommended Phase 1+ built-in set", () => {
    expect(BUILTIN_BRUSH_PRESETS.length).toBeGreaterThanOrEqual(40);
    const ids = new Set(BUILTIN_BRUSH_PRESETS.map((b) => b.id));
    for (const id of [
      "pen",
      "tech-fine",
      "scalepen-medium",
      "pencil",
      "marker",
      "watercolour",
      "eraser",
      "smudge",
      "tex-concrete",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("groups by category and supports search", () => {
    const lib = createBrushLibrary();
    expect(lib.byCategory("technical").length).toBeGreaterThan(5);
    expect(lib.search("ScalePen").some((b) => b.id.startsWith("scalepen"))).toBe(
      true,
    );
  });

  it("exposes the six requested tool families and nested texture choices", () => {
    expect(Object.keys(BRUSH_FAMILIES)).toEqual([
      "pen",
      "pencil",
      "marker",
      "brush",
      "texture",
      "eraser",
    ]);
    for (const ids of Object.values(BRUSH_FAMILIES)) expect(ids).toHaveLength(5);
    expect(BRUSH_SUBFAMILIES["tex-material"]).toEqual([
      "tex-brick",
      "tex-concrete",
      "tex-wood",
      "tex-stone",
      "tex-tile",
    ]);
    expect(BRUSH_SUBFAMILIES["tex-foliage"]).toEqual([
      "tex-grass",
      "tex-leaves",
      "tex-shrubs",
      "tex-trees",
      "tex-ground-cover",
    ]);
  });
});

describe("resolveStrokeParams", () => {
  it("applies pressure to size and opacity", () => {
    const brush = BUILTIN_BRUSH_PRESETS.find((b) => b.id === "fountainpen")!;
    const soft = resolveStrokeParams(brush, 0.2, {
      color: "#000",
      size: brush.size,
      alpha: 1,
    });
    const hard = resolveStrokeParams(brush, 1, {
      color: "#000",
      size: brush.size,
      alpha: 1,
    });
    expect(hard.lineWidth).toBeGreaterThan(soft.lineWidth);
  });

  it("keeps Fine Pen nearly constant width (Trace-style fine marker)", () => {
    const brush = BUILTIN_BRUSH_PRESETS.find((b) => b.id === "pen")!;
    expect(brush.pressureSize).toBeLessThanOrEqual(0.2);
    const soft = resolveStrokeParams(brush, 0.15, {
      color: "#000",
      size: brush.size,
      alpha: 1,
    });
    const hard = resolveStrokeParams(brush, 1, {
      color: "#000",
      size: brush.size,
      alpha: 1,
    });
    // Soft press should still be most of the line weight (not brush-nib taper).
    expect(soft.lineWidth / hard.lineWidth).toBeGreaterThan(0.75);
  });

  it("uses multiply for markers and watercolor", () => {
    for (const id of ["marker", "marker-fine", "watercolour", "highlighter"]) {
      const brush = BUILTIN_BRUSH_PRESETS.find((b) => b.id === id)!;
      expect(brush.blend).toBe("multiply");
    }
  });

  it("includes Morpholio-style grease pencil and charcoal", () => {
    const ids = new Set(BUILTIN_BRUSH_PRESETS.map((b) => b.id));
    expect(ids.has("grease-pencil")).toBe(true);
    expect(ids.has("charcoal")).toBe(true);
  });

  it("converts scale-aware mm lineweight to document pixels", () => {
    const brush = BUILTIN_BRUSH_PRESETS.find((b) => b.id === "scalepen-medium")!;
    const params = resolveStrokeParams(brush, 0.5, {
      color: "#000",
      size: 99,
      alpha: 1,
      pxPerMm: 10,
      zoom: 1,
    });
    // 0.35mm * 10 px/mm ≈ 3.5
    expect(params.lineWidth).toBeGreaterThan(2);
    expect(params.lineWidth).toBeLessThan(6);
  });

  it("uses destination-out for erasers without stroke buffer", () => {
    const eraser = BUILTIN_BRUSH_PRESETS.find((b) => b.id === "eraser")!;
    const params = resolveStrokeParams(eraser, 0.5, {
      color: "#000",
      size: 24,
      alpha: 1,
    });
    expect(params.composite).toBe("destination-out");
    expect(params.useBuffer).toBe(false);
  });

  it("gives every visible preset a pressure response", () => {
    const visibleIds = [
      ...new Set([
        ...Object.values(BRUSH_FAMILIES).flat(),
        ...Object.values(BRUSH_SUBFAMILIES).flat(),
      ]),
    ];
    for (const id of visibleIds) {
      const brush = BUILTIN_BRUSH_PRESETS.find((item) => item.id === id)!;
      expect(brush, id).toBeTruthy();
      const soft = resolveStrokeParams(brush, 0.15, {
        color: "#000",
        size: brush.size,
        alpha: brush.opacity,
      });
      const hard = resolveStrokeParams(brush, 1, {
        color: "#000",
        size: brush.size,
        alpha: brush.opacity,
      });
      expect(
        hard.lineWidth !== soft.lineWidth || hard.alpha !== soft.alpha,
        `${id} should respond to pressure`,
      ).toBe(true);
    }
  });
});

describe("smoothPoint", () => {
  it("interpolates toward the next sample", () => {
    const next = smoothPoint({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.5);
    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(10);
  });
});
