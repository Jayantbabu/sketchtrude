import { describe, expect, it } from "vitest";
import {
  calibrateFromReference,
  calibrationAnnotationMetrics,
  calibrationFromLegacy,
  createUnsetScaleCalibration,
  documentUnitsToMillimeters,
  hasCalibratedScale,
  millimetersToDocumentUnits,
  normalizeScaleCalibration,
  scaleDenominator,
  semanticToolRequiresScale,
} from "../src/lib/scale-system";

describe("canonical scale calibration", () => {
  it("keeps a new project explicitly unscaled", () => {
    const scale = createUnsetScaleCalibration();
    expect(scale.status).toBe("unset");
    expect(scale.mmPerDocumentUnit).toBeNull();
    expect(hasCalibratedScale(scale)).toBe(false);
  });

  it("calibrates document units from one known reference distance", () => {
    const scale = calibrateFromReference(500, 10, "m");
    expect(scale.mmPerDocumentUnit).toBe(20);
    expect(documentUnitsToMillimeters(250, scale)).toBe(5000);
    expect(millimetersToDocumentUnits(230, scale)).toBe(11.5);
  });

  it("handles imperial calibration without metre fallbacks", () => {
    const scale = calibrateFromReference(120, 10, "ft");
    expect(documentUnitsToMillimeters(120, scale)).toBeCloseTo(3048);
    expect(millimetersToDocumentUnits(304.8, scale)).toBeCloseTo(12);
  });

  it("migrates legacy px-per-unit values to canonical millimetres", () => {
    const scale = calibrationFromLegacy(12.5, "cm");
    expect(scale.mmPerDocumentUnit).toBe(0.8);
    expect(scale.displayUnit).toBe("cm");
    expect(normalizeScaleCalibration(null, 12.5, "cm")).toEqual(scale);
  });

  it("derives the paper scale label without making it authoritative", () => {
    const scale = calibrateFromReference(590.5, 10, "m");
    expect(scaleDenominator(scale, 2480, 420)).toBeCloseTo(100, 0);
  });

  it("requires calibration only for semantic wall creation", () => {
    expect(semanticToolRequiresScale("wall")).toBe(true);
    expect(semanticToolRequiresScale("pen")).toBe(false);
    expect(semanticToolRequiresScale("marker")).toBe(false);
    expect(semanticToolRequiresScale("ruler")).toBe(false);
  });

  it("keeps calibration guidance the same screen size at every zoom", () => {
    const zoomedOut = calibrationAnnotationMetrics(0.25);
    const zoomedIn = calibrationAnnotationMetrics(4);
    expect(zoomedOut.fontSize * 0.25).toBeCloseTo(20);
    expect(zoomedIn.fontSize * 4).toBeCloseTo(20);
    expect(zoomedOut.panelHeight * 0.25).toBeCloseTo(44);
    expect(zoomedIn.panelHeight * 4).toBeCloseTo(44);
    expect(zoomedOut.extensionLength * 0.25).toBeCloseTo(230);
    expect(zoomedIn.extensionLength * 4).toBeCloseTo(230);
  });
});
