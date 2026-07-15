/**
 * Studio engine entry — bundled to public/engine/studio.js (IIFE).
 */
import { S } from "./scope";
import { initDom } from "./dom";
import { initCores } from "./cores";
import { initState } from "./state-init";
import { initViewport } from "./viewport";
import { initLayers } from "./layers";
import { initStrokeInput } from "./stroke-input";
import { initMeasureStencils } from "./measure-stencils";
import { initToolUi } from "./tool-ui";
import { initSelectionChrome } from "./selection-chrome";
import { initFeatures } from "./features";
import { initMassing } from "./massing";
import { initShell } from "./shell";
import { initPersistence } from "./persistence";
import { initBootSequence } from "./boot-sequence";

export function boot() {
  initDom();
  initCores();

  initState();
  initViewport();
  initLayers();
  initStrokeInput();
  initMeasureStencils();
  initToolUi();
  initSelectionChrome();
  initFeatures();
  initMassing();
  initShell();
  initPersistence();
  initBootSequence();
}

// Auto-boot when the script loads in the iframe (HTML already mounted).
try {
  boot();
} catch (err) {
  console.error("SketchTrude engine boot failed:", err);
  try {
    if (typeof S.postEngineReady === "function") S.postEngineReady();
  } catch {
    /* ignore */
  }
}
