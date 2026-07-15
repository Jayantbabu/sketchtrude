/* Auto-converted from public/engine/app/02-viewport.js — shared scope S */
import { S } from "./scope";

export function initViewport() {
  const state = S.state;

  /* =================== DOM =================== */
  S.paper = document.getElementById('paper') as any;
  S.stage = document.getElementById('canvas-stage') as any;
  S.area = document.getElementById('canvas-area') as any;
  S.bgImg = document.getElementById('bg-image') as any;
  S.layersList = document.getElementById('layers-list') as any;
  S.rulerOverlay = document.getElementById('ruler-overlay') as any;
  S.colorPopover = document.getElementById('color-popover') as any;
  S.stencilPopover = document.getElementById('stencil-popover') as any;
  S.hintEl = document.getElementById('hint') as any;
  S.fileInputImportImage = document.getElementById('file-import-image') as any;
  S.fileInputStencil = document.getElementById('file-stencil') as any;
  // Hidden input for importing custom hatch images
  S.fileInputHatch = document.createElement('input');
  S.fileInputHatch.type = 'file';
  S.fileInputHatch.accept = 'image/png,image/jpeg,image/svg+xml,image/webp';
  S.fileInputHatch.multiple = true;
  S.fileInputHatch.style.display = 'none';
  document.body.appendChild(S.fileInputHatch);
  S.fileInputHatch.addEventListener('change', (e: any) => {
    Array.from(e.target.files).forEach(S.addCustomHatchFromFile);
    e.target.value = '';
  });
  S.scalePrompt = document.getElementById('scale-prompt') as any;
  S.imgOverlay = document.getElementById('img-overlay') as any;

  /* =================== TRANSFORMS =================== */
  S.applyStageTransform = function applyStageTransform() {
    S.stage.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
    S.paper.style.transform = `translate(-50%, -50%) scale(${state.zoom * state.baseZoom})`;
    (document.getElementById('zoom-level') as any).textContent = Math.round(state.zoom * 100) + '%';
    S.refreshMeasurements();
  }

  S.fitToScreen = function fitToScreen() {
    const areaRect = S.area.getBoundingClientRect();
    const padding = 60;
    const aw = areaRect.width - padding * 2;
    const ah = areaRect.height - padding * 2;
    const aspect = S.doc.wPx / S.doc.hPx;
    let w, h;
    if (aw / ah > aspect) {
      h = ah; w = h * aspect;
    } else {
      w = aw; h = w / aspect;
    }
    S.paper.style.width = S.doc.wPx + 'px';
    S.paper.style.height = S.doc.hPx + 'px';
    state.baseZoom = w / S.doc.wPx;
    state.zoom = 1;
    state.panX = 0; state.panY = 0;
    S.applyStageTransform();
  }

  /* =================================================================
     CANVAS SIZE — resize the document, preserving artwork
     ================================================================= */
  S.resizeDocument = function resizeDocument(newWmm: any, newHmm: any, newDpi: any) {
    const oldW = S.doc.wPx, oldH = S.doc.hPx;
    S.doc.wMM = newWmm; S.doc.hMM = newHmm; S.doc.dpi = newDpi;
    S.doc.wPx = Math.round(S.doc.wMM / 25.4 * S.doc.dpi);
    S.doc.hPx = Math.round(S.doc.hMM / 25.4 * S.doc.dpi);

    // Resize every layer's canvases, scaling existing content to the new size.
    state.layers.forEach((layer: any) => {
      ['canvas', 'imageCanvas'].forEach((key: any) => {
        const src = layer[key];
        if (!src) return;
        const tmp = document.createElement('canvas');
        tmp.width = oldW; tmp.height = oldH;
        (tmp.getContext('2d') as any).drawImage(src, 0, 0);
        src.width = S.doc.wPx; src.height = S.doc.hPx;
        const ctx = (key === 'canvas') ? layer.ctx : layer.imageCtx;
        ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
        ctx.drawImage(tmp, 0, 0, oldW, oldH, 0, 0, S.doc.wPx, S.doc.hPx);
      });
      // Reset history (snapshots are old-size ImageData)
      layer.history = [];
      layer.redo = [];
    });

    // Resize helper canvases
    S.strokeCanvas.width = S.doc.wPx; S.strokeCanvas.height = S.doc.hPx;
    const gc = document.getElementById('guide-canvas') as any;
    gc.width = S.doc.wPx; gc.height = S.doc.hPx;

    // Update document info panel
    const fmt = S.paperFormatName(newWmm, newHmm);
    document.querySelectorAll('.layer-props-title').forEach(() => {});
    const infoRows = document.querySelectorAll('#layers-panel [style*="justify-content:space-between"]');
    // Update the Document section values directly
    S.updateDocInfo(fmt);

    S.fitToScreen();
    S.drawDocGrid();
    if (typeof S.drawGuides === 'function') S.drawGuides();
    state.layers.forEach((l: any) => S.saveSnapshot(l));
    S.renderLayers();
  }

  /* Expand canvas for infinite-scroll drawing (Morpholio Trace style). */
  S.expandDocumentPixels = function expandDocumentPixels(addLeft: any, addTop: any, addRight: any, addBottom: any) {
    if (!addLeft && !addTop && !addRight && !addBottom) return;
    const oldW = S.doc.wPx, oldH = S.doc.hPx;
    const newW = oldW + addLeft + addRight;
    const newH = oldH + addTop + addBottom;
    if (newW > 24000 || newH > 24000) return;

    const shiftLayerCanvases = (layer: any) => {
      ['canvas', 'imageCanvas'].forEach((key: any) => {
        const src = layer[key];
        if (!src) return;
        const tmp = document.createElement('canvas');
        tmp.width = oldW; tmp.height = oldH;
        (tmp.getContext('2d') as any).drawImage(src, 0, 0);
        src.width = newW; src.height = newH;
        const ctx = (key === 'canvas') ? layer.ctx : layer.imageCtx;
        ctx.clearRect(0, 0, newW, newH);
        ctx.drawImage(tmp, addLeft, addTop);
      });
      layer.history = [];
      layer.redo = [];
      S.saveSnapshot(layer);
    };

    state.layers.forEach(shiftLayerCanvases);
    S.strokeCanvas.width = newW; S.strokeCanvas.height = newH;
    const gc = document.getElementById('guide-canvas') as any;
    if (gc) { gc.width = newW; gc.height = newH; }
    if (S.gridCanvas) { S.gridCanvas.width = newW; S.gridCanvas.height = newH; }

    S.doc.wPx = newW;
    S.doc.hPx = newH;
    // Keep mm-per-pixel constant so scale/measurements stay accurate after expansion
    if ((state.infiniteCanvas || state.autoExpandCanvas) && oldW > 0 && oldH > 0) {
      const mmPerPxW = S.doc.wMM / oldW;
      const mmPerPxH = S.doc.hMM / oldH;
      S.doc.wMM = newW * mmPerPxW;
      S.doc.hMM = newH * mmPerPxH;
      S.updateDocInfo(S.paperFormatName(S.doc.wMM, S.doc.hMM));
    }
    S.paper.style.width = S.doc.wPx + 'px';
    S.paper.style.height = S.doc.hPx + 'px';

    state.vanishingPoints.forEach((vp: any) => { vp.x += addLeft; vp.y += addTop; });
    state.measurements.forEach((m: any) => {
      if (m.x1 != null) { m.x1 += addLeft; m.y1 += addTop; }
      if (m.x2 != null) { m.x2 += addLeft; m.y2 += addTop; }
      if (m.points) m.points.forEach((p: any) => { p.x += addLeft; p.y += addTop; });
    });
    state.walls.forEach((w: any) => { if (w.pts) w.pts.forEach((p: any) => { p.x += addLeft; p.y += addTop; }); });
    state.shapes.forEach((s: any) => {
      if (s.pts) s.pts.forEach((p: any) => { p.x += addLeft; p.y += addTop; });
      if (s.x != null) s.x += addLeft;
      if (s.y != null) s.y += addTop;
      if (s.cx != null) { s.cx += addLeft; s.cy += addTop; }
    });
    if (S.massing.baseAnchor) { S.massing.baseAnchor.px += addLeft; S.massing.baseAnchor.py += addTop; }

    S.drawDocGrid();
    if (typeof S.drawGuides === 'function') S.drawGuides();
    S.refreshMeasurements();
    S.renderLayers();
  }

  S.CANVAS_EXPAND_PX = 900;
  S.CANVAS_EXPAND_THRESHOLD = 140;

  S.maybeExpandCanvas = function maybeExpandCanvas(_x: any, _y: any) {
    // Phase 1: never auto-expand — infinite canvas is a large fixed world.
  }

  S.releaseTransientInput = function releaseTransientInput() {
    state.drawing = false;
    state.isPanning = false;
    state.lineDrag = null;
    if (typeof S.massing !== 'undefined') S.massing.dragging = null;
    document.body.classList.remove('nm-drawing');
    S.activePointers.forEach((_: any, id: any) => {
      try { if (S.paper.hasPointerCapture(id)) S.paper.releasePointerCapture(id); } catch (_) {}
      try { if (S.area.hasPointerCapture(id)) S.area.releasePointerCapture(id); } catch (_) {}
      try { if (S.massingCanvas && S.massingCanvas.hasPointerCapture(id)) S.massingCanvas.releasePointerCapture(id); } catch (_) {}
    });
    S.activePointers.clear();
    state.pinchStart = null;
  }

  S.dismissSketchOverlays = function dismissSketchOverlays() {
    S.showWall2dPalette(false);
    S.showOpeningPalette(false);
    if (state.polyActive) {
      state.polyPoints = [];
      state.polyActive = false;
      const ph = document.getElementById('poly-hint') as any;
      if (ph) ph.style.display = 'none';
    }
    S.closeGroupFlyout();
    if (S._brushFlyout) S._brushFlyout.style.display = 'none';
    const selBar = document.getElementById('sel-bar') as any;
    if (S.selBar) S.selBar.classList.remove('show');
  }

  S.paperFormatName = function paperFormatName(w: any, h: any) {
    const sizes: Record<string, string> = { '420x297':'A3', '297x210':'A4', '594x420':'A2', '841x594':'A1',
                    '279x216':'Letter', '432x279':'Tabloid' };
    const key = `${Math.round(w)}x${Math.round(h)}`;
    const rev = `${Math.round(h)}x${Math.round(w)}`;
    const name = sizes[key] || sizes[rev];
    const orient = w >= h ? 'Landscape' : 'Portrait';
    return name ? `${name} ${orient}` : `Custom`;
  }

  S.updateDocInfo = function updateDocInfo(fmt: any) {
    const panel = document.getElementById('layers-panel') as any;
    const rows = panel.querySelectorAll('div[style*="space-between"]');
    rows.forEach((row: any) => {
      const label = row.firstElementChild ? row.firstElementChild.textContent.trim() : '';
      const val = row.lastElementChild;
      if (!val) return;
      if (label === 'Format') val.textContent = fmt;
      else if (label === 'Size') val.textContent = `${S.doc.wMM} × ${S.doc.hMM} mm`;
      else if (label === 'DPI') val.textContent = String(S.doc.dpi);
    });
  }

  // Canvas size dialog
  S.canvasSizeDialog = document.getElementById('canvas-size-dialog') as any;
  S._modalScrim = null;
  S.ensureModalScrim = function ensureModalScrim() {
    if (S._modalScrim) return S._modalScrim;
    S._modalScrim = document.createElement('div');
    S._modalScrim.id = 'modal-scrim';
    S._modalScrim.addEventListener('click', () => S.closeCanvasSizeDialog());
    document.body.appendChild(S._modalScrim);
    return S._modalScrim;
  }
  S.closeCanvasSizeDialog = function closeCanvasSizeDialog() {
    S.canvasSizeDialog.classList.remove('show');
    S.canvasSizeDialog.style.display = 'none';
    if (S._modalScrim) S._modalScrim.style.display = 'none';
  }
  S.openCanvasSize = function openCanvasSize() {
    S.releaseTransientInput();
    S.dismissSketchOverlays();
    if (typeof (window as any)._closeMassMenus === 'function') (window as any)._closeMassMenus();
    (document.getElementById('cs-w') as any).value = S.doc.wMM;
    (document.getElementById('cs-h') as any).value = S.doc.hMM;
    (document.getElementById('cs-dpi') as any).value = S.doc.dpi;
    S.ensureModalScrim().style.display = 'block';
    S.canvasSizeDialog.style.display = 'block';
    S.canvasSizeDialog.classList.add('show');
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = S.canvasSizeDialog.offsetWidth || 280;
    S.canvasSizeDialog.style.left = Math.max(12, (vw - w) / 2) + 'px';
    S.canvasSizeDialog.style.top = Math.max(72, Math.min(vh * 0.12, 120)) + 'px';
    S.syncCsPresets();
  }
  if (S.canvasSizeDialog) {
    S.canvasSizeDialog.addEventListener('pointerdown', (e: any) => e.stopPropagation());
    S.canvasSizeDialog.addEventListener('click', (e: any) => e.stopPropagation());
  }
  document.querySelectorAll('#canvas-size-dialog .cs-preset').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      (document.getElementById('cs-w') as any).value = btn.dataset.w;
      (document.getElementById('cs-h') as any).value = btn.dataset.h;
      S.syncCsPresets();
    });
  });
  S.syncCsPresets = function syncCsPresets() {
    const w = (document.getElementById('cs-w') as any).value, h = (document.getElementById('cs-h') as any).value;
    document.querySelectorAll('#canvas-size-dialog .cs-preset').forEach((b: any) =>
      b.classList.toggle('active', b.dataset.w === w && b.dataset.h === h));
  };
  (document.getElementById('cs-w') as any).addEventListener('input', S.syncCsPresets);
  (document.getElementById('cs-h') as any).addEventListener('input', S.syncCsPresets);
  (document.getElementById('cs-orient') as any).addEventListener('click', () => {
    const w = document.getElementById('cs-w') as any, h = document.getElementById('cs-h') as any;
    const tmp = w.value; w.value = h.value; h.value = tmp;
    S.syncCsPresets();
  });
  (document.getElementById('cs-cancel') as any).addEventListener('click', () => {
    S.closeCanvasSizeDialog();
  });
  (document.getElementById('cs-apply') as any).addEventListener('click', () => {
    const w = Math.max(50, Math.min(2000, parseInt((document.getElementById('cs-w') as any).value) || 420));
    const h = Math.max(50, Math.min(2000, parseInt((document.getElementById('cs-h') as any).value) || 297));
    const dpi = parseInt((document.getElementById('cs-dpi') as any).value) || 150;
    S.closeCanvasSizeDialog();
    S.resizeDocument(w, h, dpi);
    S.showHint(`Canvas resized to ${w} × ${h} mm @ ${dpi} DPI`);
  });


}
