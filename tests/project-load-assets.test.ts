import { describe, expect, it } from "vitest";
import { mergeTransientLayerAssetUrls } from "@/features/projects/application/project-load-controller";
import {
  createEmptyProjectDocument,
  type LegacyStudioDocument,
} from "@/features/projects/domain/project-document";

function withPdfLayer(url?: string) {
  const document = createEmptyProjectDocument("project-pdf");
  const legacy = document.extensions!.legacyStudio as LegacyStudioDocument;
  legacy.layers[0] = {
    ...legacy.layers[0]!,
    layer_id: "pdf-reference",
    layerKind: "reference",
    locked: true,
    pdf: {
      storagePath: "user/project-pdf/pdf/source.pdf",
      originalName: "source.pdf",
      byteSize: 1024,
      pageNumber: 1,
      pageWidth: 612,
      pageHeight: 792,
      transform: { x: 100, y: 100, w: 200, h: 260, rotation: 0 },
      opacity: 1,
    },
    ...(url ? { pdf_url: url } : {}),
  };
  return document;
}

describe("local project asset hydration", () => {
  it("borrows a fresh PDF URL without replacing local layer state", () => {
    const local = withPdfLayer();
    const localLegacy = local.extensions!.legacyStudio as LegacyStudioDocument;
    localLegacy.layers[0]!.visible = false;
    const cloud = withPdfLayer("https://signed.example/source.pdf");

    const merged = mergeTransientLayerAssetUrls(local, cloud);
    const mergedLayer = (
      merged.extensions!.legacyStudio as LegacyStudioDocument
    ).layers[0]!;

    expect(mergedLayer.pdf_url).toBe("https://signed.example/source.pdf");
    expect(mergedLayer.visible).toBe(false);
    expect(localLegacy.layers[0]!.pdf_url).toBeUndefined();
  });

  it("does not attach a URL for a different stored source", () => {
    const local = withPdfLayer();
    const cloud = withPdfLayer("https://signed.example/other.pdf");
    const cloudLayer = (
      cloud.extensions!.legacyStudio as LegacyStudioDocument
    ).layers[0]!;
    (cloudLayer.pdf as { storagePath: string }).storagePath =
      "user/project-pdf/pdf/other.pdf";

    expect(
      (
        mergeTransientLayerAssetUrls(local, cloud).extensions!
          .legacyStudio as LegacyStudioDocument
      ).layers[0]!.pdf_url,
    ).toBeUndefined();
  });
});
