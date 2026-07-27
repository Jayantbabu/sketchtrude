import { describe, expect, it, vi } from "vitest";
import { prepareDocumentForPersistence } from "@/features/projects/application/project-save-controller";
import {
  createEmptyProjectDocument,
  projectDocumentFromLegacyStudio,
} from "@/features/projects/domain/project-document";
import type { LegacyStudioDocument } from "@/features/projects/domain/project-document";

describe("prepareDocumentForPersistence", () => {
  it("re-uploads layer rasters when a fresh blob is present even if raster_path exists", async () => {
    const doc = createEmptyProjectDocument("proj-persist");
    const legacy = doc.extensions!.legacyStudio as LegacyStudioDocument;
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], {
      type: "image/png",
    });
    legacy.layers = [
      {
        name: "Sketch",
        visible: true,
        opacity: 1,
        raster_path: "user/proj/layers/0.png",
        blob,
      },
    ];

    const upload = vi.fn(async (_pid: string, layerId: string) => {
      return `user/proj/layers/${layerId}-new.png`;
    });

    const prepared = await prepareDocumentForPersistence(
      "proj-persist",
      doc,
      upload,
    );
    const out = prepared.extensions!.legacyStudio as LegacyStudioDocument;

    expect(upload).toHaveBeenCalledTimes(1);
    expect(out.layers[0]?.raster_path).toBe(
      "user/proj/layers/layer-0-new.png",
    );
    expect(out.layers[0]?.blob).toBeUndefined();
  });

  it("keeps existing raster_path when no blob is provided", async () => {
    const doc = createEmptyProjectDocument("proj-persist-2");
    const legacy = doc.extensions!.legacyStudio as LegacyStudioDocument;
    legacy.layers = [
      {
        name: "Sketch",
        visible: true,
        opacity: 1,
        raster_path: "user/proj/layers/0.png",
      },
    ];

    const upload = vi.fn(async () => "should-not-run.png");
    const prepared = await prepareDocumentForPersistence(
      "proj-persist-2",
      doc,
      upload,
    );
    const out = prepared.extensions!.legacyStudio as LegacyStudioDocument;

    expect(upload).not.toHaveBeenCalled();
    expect(out.layers[0]?.raster_path).toBe("user/proj/layers/0.png");
  });

  it("preserves PDF reference metadata while stripping the local source blob", async () => {
    const doc = createEmptyProjectDocument("proj-pdf");
    const legacy = doc.extensions!.legacyStudio as LegacyStudioDocument;
    const pdfBlob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    legacy.layers = [{
      name: "Plan p1",
      visible: true,
      opacity: 1,
      raster_path: "user/proj/layers/0.png",
      pdfBlob,
      pdf: {
        storagePath: "user/proj/pdf/source.pdf",
        originalName: "source.pdf",
        byteSize: pdfBlob.size,
        pageNumber: 1,
        pageWidth: 612,
        pageHeight: 792,
        transform: { x: 500, y: 400, w: 900, h: 1164, rotation: 0 },
        opacity: 0.8,
        rasterMode: "drawing-only",
      },
    }];

    const prepared = await prepareDocumentForPersistence("proj-pdf", doc);
    const layer = (prepared.extensions!.legacyStudio as LegacyStudioDocument).layers[0];

    expect(layer?.pdfBlob).toBeUndefined();
    expect((layer?.pdf as { storagePath?: string })?.storagePath)
      .toBe("user/proj/pdf/source.pdf");
    expect((layer?.pdf as { rasterMode?: string })?.rasterMode)
      .toBe("drawing-only");
  });

  it("keeps uploaded rasters attached to stable layer ids after reordering", async () => {
    const sketchBlob = new Blob(["sketch"], { type: "image/png" });
    const pdfBlob = new Blob(["pdf"], { type: "image/png" });
    const doc = projectDocumentFromLegacyStudio("proj-reorder", {
      version: 1,
      savedAt: Date.now(),
      doc: { wmm: 420, hmm: 297, dpi: 150 },
      layers: [
        {
          layer_id: "sketch-layer",
          name: "Sketch",
          visible: true,
          opacity: 1,
          blob: sketchBlob,
        },
        {
          layer_id: "pdf-layer",
          name: "PDF",
          visible: true,
          opacity: 1,
          blob: pdfBlob,
        },
      ],
    });
    doc.scene.rootLayerIds = ["pdf-layer", "sketch-layer"];
    const upload = vi.fn(async (_projectId: string, layerId: string) =>
      `user/proj/layers/${layerId}.png`);

    const prepared = await prepareDocumentForPersistence(
      "proj-reorder",
      doc,
      upload,
    );

    expect(upload.mock.calls.map((call) => call[1])).toEqual([
      "sketch-layer",
      "pdf-layer",
    ]);
    expect(prepared.scene.layers["sketch-layer"]?.rasterPath)
      .toBe("user/proj/layers/sketch-layer.png");
    expect(prepared.scene.layers["pdf-layer"]?.rasterPath)
      .toBe("user/proj/layers/pdf-layer.png");
  });
});
