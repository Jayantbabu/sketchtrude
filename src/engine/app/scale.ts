import { S } from "./scope";
import {
  createUnsetScaleCalibration,
  documentUnitsToMillimeters,
  hasCalibratedScale,
  millimetersToDocumentUnits,
  normalizeScaleCalibration,
  pixelsPerLegacyUnit,
  scaleDenominator,
  type ScaleCalibration,
} from "../../lib/scale-system";

export function initScaleSystem() {
  const state = S.state;

  S.setScaleCalibration = function setScaleCalibration(
    value: Partial<ScaleCalibration> | null,
    legacyPxPerUnit?: number | null,
    legacyUnit?: string | null,
  ) {
    state.scaleCalibration = normalizeScaleCalibration(
      value,
      legacyPxPerUnit,
      legacyUnit,
    );
    // Compatibility aliases for older saves only. Runtime geometry uses the
    // canonical mmPerDocumentUnit value above.
    state.pxPerUnit = pixelsPerLegacyUnit(state.scaleCalibration);
    state.scaleUnit = state.scaleCalibration.displayUnit;
    return state.scaleCalibration;
  };

  S.clearScaleCalibration = function clearScaleCalibration() {
    S.setScaleCalibration(createUnsetScaleCalibration());
  };

  S.hasCalibratedScale = function hasScale() {
    return hasCalibratedScale(state.scaleCalibration);
  };

  S.docUnitsToMM = function docUnitsToMM(value: number) {
    return documentUnitsToMillimeters(value, state.scaleCalibration);
  };

  S.mmToDocUnits = function mmToDocUnits(value: number) {
    return millimetersToDocumentUnits(value, state.scaleCalibration);
  };

  S.scaleDenominator = function currentScaleDenominator() {
    return scaleDenominator(
      state.scaleCalibration,
      S.doc.wPx,
      S.doc.wMM,
    );
  };

  S.serializeScaleCalibration = function serializeScaleCalibration() {
    return {
      ...state.scaleCalibration,
      reference: state.scaleCalibration.reference
        ? { ...state.scaleCalibration.reference }
        : null,
    };
  };

  S.setScaleCalibration(null, state.pxPerUnit, state.scaleUnit);
}
