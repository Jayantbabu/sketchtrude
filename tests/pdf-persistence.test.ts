import { describe, expect, it } from "vitest";
import {
  clearMatchingPdfPixels,
  findDuplicateLegacyPdfRasterIndexes,
  pdfRasterContentSimilarity,
  shouldPaintPersistedLayerRaster,
} from "@/engine/app/persistence";

describe("PDF layer raster restoration", () => {
  it("skips legacy flattened PDF rasters when the live source restores", () => {
    expect(shouldPaintPersistedLayerRaster(true, true)).toBe(false);
  });

  it("paints drawing-only annotations alongside a restored live PDF", () => {
    expect(
      shouldPaintPersistedLayerRaster(true, true, "drawing-only"),
    ).toBe(true);
  });

  it("uses the persisted raster when the PDF source cannot be restored", () => {
    expect(shouldPaintPersistedLayerRaster(true, false)).toBe(true);
  });

  it("always paints ordinary non-PDF layer rasters", () => {
    expect(shouldPaintPersistedLayerRaster(false, false)).toBe(true);
  });

  it("detects an exact legacy PDF raster copied onto a sketch layer", async () => {
    const pdfPixels = new Blob(["flattened-pdf"], { type: "image/png" });
    const duplicates = await findDuplicateLegacyPdfRasterIndexes(
      [
        { raster_path: "layers/sketch.png" },
        { pdf: {}, raster_path: "layers/pdf.png" },
      ],
      [pdfPixels, pdfPixels],
    );

    expect([...duplicates]).toEqual([0]);
  });

  it("does not remove distinct sketch pixels or drawing-only PDF rasters", async () => {
    const duplicates = await findDuplicateLegacyPdfRasterIndexes(
      [
        { raster_path: "layers/sketch.png" },
        {
          pdf: { rasterMode: "drawing-only" },
          raster_path: "layers/pdf.png",
        },
      ],
      [
        new Blob(["sketch"], { type: "image/png" }),
        new Blob(["pdf"], { type: "image/png" }),
      ],
    );

    expect(duplicates.size).toBe(0);
  });

  it("recognizes PDF linework copied into a raster layer", () => {
    const reference = new Uint8ClampedArray(120 * 4);
    const candidate = new Uint8ClampedArray(120 * 4);
    for (let pixel = 0; pixel < 120; pixel++) {
      const offset = pixel * 4;
      reference.set([20, 20, 20, 255], offset);
      candidate.set([24, 24, 24, 255], offset);
    }

    expect(pdfRasterContentSimilarity(candidate, reference)).toBeGreaterThan(0.9);
    expect(clearMatchingPdfPixels(candidate, reference)).toBe(120);
    expect(candidate.every((value) => value === 0)).toBe(true);
  });

  it("does not classify unrelated sketch strokes as a PDF copy", () => {
    const reference = new Uint8ClampedArray(120 * 4);
    const candidate = new Uint8ClampedArray(120 * 4);
    for (let pixel = 0; pixel < 120; pixel++) {
      const offset = pixel * 4;
      reference.set([20, 20, 20, 255], offset);
      candidate.set([180, 180, 180, 255], offset);
    }

    expect(pdfRasterContentSimilarity(candidate, reference)).toBe(0);
  });
});
