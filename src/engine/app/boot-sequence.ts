/* Auto-converted from public/engine/app/12-boot.js — shared scope S */
import { S } from "./scope";

export function initBootSequence() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);


  /* =================== BOOT =================== */
  S.applyProjectConfig();
  S.loadStencils();
  S.loadHatches();
  S.loadFillTextures();
  S.loadBrushes();
  S.fitToScreen();
  S.bootDefaultLayers = function bootDefaultLayers() {
    if (S.layerEngine) {
      const boot = S.layerEngine.bootstrap({
        floorName: 'Canvas',
        mainLayerName: 'Layer 1',
        sketchLayerName: 'Sketch',
      });
      // Raster surfaces only for drawable layers (Sketch). Layer 1 hosts vector elements.
      for (const id of S.layerEngine.getRasterLayerIds()) {
        const meta = S.layerEngine.getLayer(id);
        S.allocateLayerSurface(id, meta ? meta.name : 'Layer');
      }
      S.syncStateLayersFromEngine();
      const sketchId = (boot && boot.sketchLayerId) ||
        (typeof S.layerEngine.getSketchLayerId === 'function' && S.layerEngine.getSketchLayerId());
      if (sketchId) {
        S.layerEngine.setActiveLayer(sketchId);
        S.syncStateLayersFromEngine();
      }
    } else {
      S.createLayer('Layer 1');
      S.createLayer('Sketch');
      state.activeLayer = 1;
    }
  }

  // Always announce ready so the parent never hangs on sketchtrude-engine-ready,
  // even if a later init step throws.
  try {
    S.bootDefaultLayers();
    S.updateLayerOrder();
    S.renderLayers();
    S.updateUI();
    S.renderSwatches();
    S.setActiveBrush(S.BUILTIN_BRUSHES.find((b: any) => b.id === 'pen') || S.BUILTIN_BRUSHES[0]);
    if (S.brushes) {
      S.brushes.whenReady(() => {
        try {
          S.syncBuiltinBrushesFromEngine();
          const pen = S.BUILTIN_BRUSHES.find((b: any) => b.id === 'pen') || S.BUILTIN_BRUSHES[0];
          if (pen && (!state.activeBrush || state.activeBrush.builtIn)) S.setActiveBrush(pen);
          if (typeof S.renderBrushList === 'function') S.renderBrushList();
        } catch (_) { /* brush library optional at boot */ }
      });
    }
    S.regroupRail();
    S.updatePreview();
    S.initWheelEvents();
    S.syncWheelFromColor(state.color);
    S.injectHatchTab();
    const _gc = $el('guide-canvas');
    if (_gc) { _gc.width = S.doc.wPx; _gc.height = S.doc.hPx; }
    (S.gridCanvas as any).width = S.doc.wPx; (S.gridCanvas as any).height = S.doc.hPx;
    S.drawDocGrid();
    if (state.guideType && state.guideType !== 'none' && typeof S.drawGuideGrid === 'function') S.drawGuideGrid();

    const ovfSym = $el('ovf-symmetry');
    if (ovfSym) ovfSym.addEventListener('click', () => { S.toggleSymmetry(); S.overflowPanel.classList.remove('show'); });

    S.updateScaleDisplay();
  } catch (bootErr) {
    console.error('Studio boot error:', bootErr);
  } finally {
    // Do NOT restoreSession() on boot — parent drives import / start-fresh after ready.
    S.postEngineReady();
  }

  setTimeout(() => {
    S.showHint('SketchTrude · 2-finger tap = undo · 3-finger tap = redo · UI hides while drawing');
  }, 600);

  setTimeout(() => S.scheduleThumbnail(), 1800);

  // PWA handled by Serwist in Next.js

}
