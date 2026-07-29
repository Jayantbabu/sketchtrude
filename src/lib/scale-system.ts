export const SCALE_UNITS = ["mm", "cm", "m", "in", "ft"] as const;
export type ScaleUnit = (typeof SCALE_UNITS)[number];
export type ScaleStatus = "unset" | "calibrated";

export type ScaleCalibration = {
  version: 1;
  status: ScaleStatus;
  mmPerDocumentUnit: number | null;
  method: "reference-line" | null;
  displayUnit: ScaleUnit;
  reference: {
    documentDistance: number;
    realDistance: number;
    unit: ScaleUnit;
  } | null;
};

const UNIT_MM: Record<ScaleUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export function millimetersPerUnit(unit: string): number {
  return UNIT_MM[unit as ScaleUnit] ?? 1;
}

export function createUnsetScaleCalibration(
  displayUnit: ScaleUnit = "cm",
): ScaleCalibration {
  return {
    version: 1,
    status: "unset",
    mmPerDocumentUnit: null,
    method: null,
    displayUnit,
    reference: null,
  };
}

export function calibrateFromReference(
  documentDistance: number,
  realDistance: number,
  unit: ScaleUnit,
): ScaleCalibration {
  if (!Number.isFinite(documentDistance) || documentDistance <= 0) {
    throw new Error("Reference line must have a positive document length");
  }
  if (!Number.isFinite(realDistance) || realDistance <= 0) {
    throw new Error("Real-world reference length must be positive");
  }
  return {
    version: 1,
    status: "calibrated",
    mmPerDocumentUnit:
      (realDistance * millimetersPerUnit(unit)) / documentDistance,
    method: "reference-line",
    displayUnit: unit,
    reference: { documentDistance, realDistance, unit },
  };
}

export function calibrationFromLegacy(
  pxPerUnit: number | null | undefined,
  unit: string | null | undefined,
): ScaleCalibration {
  if (!pxPerUnit || pxPerUnit <= 0) return createUnsetScaleCalibration();
  const displayUnit = SCALE_UNITS.includes(unit as ScaleUnit)
    ? (unit as ScaleUnit)
    : "cm";
  return {
    version: 1,
    status: "calibrated",
    mmPerDocumentUnit: millimetersPerUnit(displayUnit) / pxPerUnit,
    method: "reference-line",
    displayUnit,
    reference: null,
  };
}

export function normalizeScaleCalibration(
  value: Partial<ScaleCalibration> | null | undefined,
  legacyPxPerUnit?: number | null,
  legacyUnit?: string | null,
): ScaleCalibration {
  if (
    value?.status === "calibrated" &&
    Number.isFinite(value.mmPerDocumentUnit) &&
    Number(value.mmPerDocumentUnit) > 0
  ) {
    const displayUnit = SCALE_UNITS.includes(value.displayUnit as ScaleUnit)
      ? (value.displayUnit as ScaleUnit)
      : "cm";
    return {
      version: 1,
      status: "calibrated",
      mmPerDocumentUnit: Number(value.mmPerDocumentUnit),
      method: "reference-line",
      displayUnit,
      reference: value.reference ?? null,
    };
  }
  return calibrationFromLegacy(legacyPxPerUnit, legacyUnit);
}

export function hasCalibratedScale(
  calibration: ScaleCalibration | null | undefined,
): boolean {
  return (
    calibration?.status === "calibrated" &&
    Number.isFinite(calibration.mmPerDocumentUnit) &&
    Number(calibration.mmPerDocumentUnit) > 0
  );
}

export function documentUnitsToMillimeters(
  documentUnits: number,
  calibration: ScaleCalibration,
): number | null {
  if (!hasCalibratedScale(calibration)) return null;
  return documentUnits * Number(calibration.mmPerDocumentUnit);
}

export function millimetersToDocumentUnits(
  millimeters: number,
  calibration: ScaleCalibration,
): number | null {
  if (!hasCalibratedScale(calibration)) return null;
  return millimeters / Number(calibration.mmPerDocumentUnit);
}

export function pixelsPerLegacyUnit(calibration: ScaleCalibration): number | null {
  if (!hasCalibratedScale(calibration)) return null;
  return millimetersPerUnit(calibration.displayUnit) /
    Number(calibration.mmPerDocumentUnit);
}

export function scaleDenominator(
  calibration: ScaleCalibration,
  documentWidth: number,
  paperWidthMm: number,
): number | null {
  if (!hasCalibratedScale(calibration) || paperWidthMm <= 0) return null;
  const documentUnitsPerPaperMm = documentWidth / paperWidthMm;
  return Number(calibration.mmPerDocumentUnit) * documentUnitsPerPaperMm;
}

export function semanticToolRequiresScale(tool: string): boolean {
  return tool === "wall";
}

export function calibrationAnnotationMetrics(viewScale: number) {
  const scale = Math.max(0.01, viewScale);
  return {
    extensionLength: 230 / scale,
    labelOffset: 52 / scale,
    tickLength: 14 / scale,
    endpointRadius: 8 / scale,
    extensionStrokeWidth: 1.5 / scale,
    dimensionStrokeWidth: 2 / scale,
    tickStrokeWidth: 2.5 / scale,
    panelHeight: 44 / scale,
    panelRadius: 8 / scale,
    fontSize: 20 / scale,
    labelBaselineOffset: 7 / scale,
    minimumPanelWidth: 160 / scale,
    panelHorizontalPadding: 36 / scale,
    estimatedCharacterWidth: 13 / scale,
    viewportMargin: 36,
  };
}
