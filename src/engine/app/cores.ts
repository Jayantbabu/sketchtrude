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
} from "@/engine/brushes";
import * as helpers from "@/lib/studio-helpers";
import { S } from "./scope";

type BrushPreset = Record<string, unknown>;

let brushReady = false;
const brushWaiters: Array<() => void> = [];
let brushPresets: BrushPreset[] = [...(BUILTIN_BRUSH_PRESETS as unknown as BrushPreset[])];
let brushLabels: Record<string, string> = { ...(BRUSH_CATEGORY_LABELS as Record<string, string>) };
let brushFamilies: Record<string, string[]> = {
  ...(BRUSH_FAMILIES as unknown as Record<string, string[]>),
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
  try {
    const res = await fetch("/engine/brush-presets.json", {
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error("brush presets missing");
    const data = await res.json();
    brushPresets = data.presets || brushPresets;
    brushLabels = data.labels || brushLabels;
    brushFamilies = data.families || brushFamilies;
  } catch (err) {
    console.warn("Brush presets failed to load; using built-in fallback", err);
  } finally {
    markBrushReady();
  }
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
    getCategoryLabels: () => brushLabels,
  };

  S.helpers = helpers;

  // Kick off preset load (non-blocking; whenReady waits).
  void loadBrushPresets();
}
