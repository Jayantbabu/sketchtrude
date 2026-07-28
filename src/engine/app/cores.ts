/**
 * Wire TypeScript engine cores onto S (replaces window.Sketchtrude* bridges).
 */
import {
  ensureAllShapeIds,
  ensureShapeId,
  sceneTypeFromShapeKind,
  createSelectionManager,
  createCapabilityRegistry,
  createEmptySelectionState,
  createSceneObjectId,
  SelectionManager,
  ObjectCapabilityRegistry,
  capabilityRegistry,
} from "@/engine/interaction";
import {
  createLayerEngine,
  LayerEngine,
  getLayerCapabilities,
  getTransformCapabilities,
  getLayerTransformCapabilities,
} from "@/engine/layers";
import {
  applyBrushToCanvasContext,
  resolveStrokeParams,
  smoothPoint,
  stabilizePoint,
  BrushLibrary,
  createBrushLibrary,
  BUILTIN_BRUSH_PRESETS,
  BRUSH_CATEGORY_LABELS,
  BRUSH_FAMILIES,
  BRUSH_SUBFAMILIES,
} from "@/engine/brushes";
import * as helpers from "@/lib/studio-helpers";
import { S } from "./scope";

type BrushPreset = Record<string, unknown>;

let brushReady = false;
const brushWaiters: Array<() => void> = [];
const brushPresets: BrushPreset[] = [...(BUILTIN_BRUSH_PRESETS as unknown as BrushPreset[])];
const brushLabels: Record<string, string> = { ...(BRUSH_CATEGORY_LABELS as Record<string, string>) };
const brushFamilies: Record<string, string[]> = {
  ...(BRUSH_FAMILIES as unknown as Record<string, string[]>),
};
const brushSubfamilies: Record<string, string[]> = {
  ...(BRUSH_SUBFAMILIES as unknown as Record<string, string[]>),
};

function markBrushReady() {
  brushReady = true;
  for (const cb of brushWaiters.splice(0)) {
    try {
      cb();
    } catch (e) {
      console.warn(e);
    }
  }
}

async function loadBrushPresets() {
  // Presets are bundled with the engine so the UI and renderer can never drift
  // apart because of a stale public JSON file.
  markBrushReady();
}

function asLegacyBuiltinList() {
  return brushPresets.map((b) => ({ ...b }));
}

export function initCores() {
  const selectionManager = createSelectionManager({
    capabilities: capabilityRegistry,
  });

  S.__ix = {
    ObjectCapabilityRegistry,
    SelectionManager,
    capabilityRegistry,
    selectionManager,
    createSceneObjectId,
    createEmptySelectionState,
    ensureShapeId,
    ensureAllShapeIds,
    sceneTypeFromShapeKind,
    createCapabilityRegistry,
    ensureObjectId(record: { id?: string } | null, prefix?: string) {
      if (record && typeof record.id === "string" && record.id) return record.id;
      const id = createSceneObjectId(prefix || "obj");
      if (record) record.id = id;
      return id;
    },
  };

  S.__layersApi = {
    LayerEngine,
    createLayerEngine,
    getLayerCapabilities,
    getTransformCapabilities,
    getLayerTransformCapabilities,
  };

  S.brushes = {
    resolveStrokeParams,
    smoothPoint,
    stabilizePoint,
    applyBrushToCanvasContext,
    BrushLibrary,
    createBrushLibrary,
    asLegacyBuiltinList,
    whenReady(cb: () => void) {
      if (brushReady) cb();
      else brushWaiters.push(cb);
    },
    isReady: () => brushReady,
    loadPresets: loadBrushPresets,
    getFamilies: () => brushFamilies,
    getSubfamilies: () => brushSubfamilies,
    getCategoryLabels: () => brushLabels,
  };

  S.helpers = helpers;

  // Kick off preset load (non-blocking; whenReady waits).
  void loadBrushPresets();
}
