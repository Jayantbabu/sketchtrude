import { describe, expect, it } from "vitest";
import {
  rectContains,
  shouldReuseReferenceRender,
} from "../src/engine/rendering/reference-render-policy";

describe("reference render policy", () => {
  const rendered = { x: 0, y: 0, w: 1000, h: 800 };

  it("reuses an overscanned crop while the viewport stays inside it", () => {
    expect(rectContains(rendered, { x: 200, y: 150, w: 500, h: 400 })).toBe(true);
    expect(shouldReuseReferenceRender({
      renderedBox: rendered,
      visibleBox: { x: 200, y: 150, w: 500, h: 400 },
      renderedPixelsPerUnit: 2,
      targetPixelsPerUnit: 2,
    })).toBe(true);
  });

  it("requests another crop when panning outside the rendered area", () => {
    expect(shouldReuseReferenceRender({
      renderedBox: rendered,
      visibleBox: { x: 800, y: 150, w: 500, h: 400 },
      renderedPixelsPerUnit: 2,
      targetPixelsPerUnit: 2,
    })).toBe(false);
  });

  it("requests sharper pixels after a material zoom increase", () => {
    expect(shouldReuseReferenceRender({
      renderedBox: rendered,
      visibleBox: { x: 200, y: 150, w: 500, h: 400 },
      renderedPixelsPerUnit: 2,
      targetPixelsPerUnit: 3,
    })).toBe(false);
  });
});
