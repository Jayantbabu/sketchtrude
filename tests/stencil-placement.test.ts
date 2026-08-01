import { describe, expect, it } from "vitest";
import { createPlacedStencilShape } from "@/engine/app/stencils";

describe("selectable stencil placement", () => {
  it("creates a closed semantic rectangle instead of flattening raster ink", () => {
    const stencil = createPlacedStencilShape({
      x: 100,
      y: 200,
      width: 80,
      height: 40,
      name: "Chair",
      dataUrl: "data:image/png;base64,chair",
      opacity: 0.75,
    });

    expect(stencil.kind).toBe("stencil");
    expect(stencil.closed).toBe(true);
    expect(stencil.pts).toEqual([
      { x: 60, y: 180 },
      { x: 140, y: 180 },
      { x: 140, y: 220 },
      { x: 60, y: 220 },
    ]);
    expect(stencil.bgImage).toBe("data:image/png;base64,chair");
    expect(stencil.opacity).toBe(0.75);
  });

  it("stores rotation in the transformable corner geometry", () => {
    const stencil = createPlacedStencilShape({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      rotationDeg: 90,
      name: "North arrow",
      dataUrl: "data:image/png;base64,north",
    });

    expect(stencil.pts[0].x).toBeCloseTo(20);
    expect(stencil.pts[0].y).toBeCloseTo(-50);
    expect(stencil.pts[2].x).toBeCloseTo(-20);
    expect(stencil.pts[2].y).toBeCloseTo(50);
  });
});
