/* Selection (magic wand) — shared scope S */
import { S } from "./scope";

export function initSelection() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);


  /* =================== SELECTION (magic wand) =================== */
  S.selOverlay = document.createElement('canvas');
  S.selOverlay.id = 'sel-overlay';
  S.selOverlay.width = 1; S.selOverlay.height = 1;
  S.selOverlay.style.width = '100%';
  S.selOverlay.style.height = '100%';
  S.paper.appendChild(S.selOverlay);
  S.selCtx = S.selOverlay.getContext('2d') as any;
  S.ensureSelectionSurface = function ensureSelectionSurface() {
    if (
      S.selOverlay.width !== S.doc.wPx ||
      S.selOverlay.height !== S.doc.hPx
    ) {
      S.selOverlay.width = S.doc.wPx;
      S.selOverlay.height = S.doc.hPx;
      S.selCtx = S.selOverlay.getContext('2d') as any;
    }
  }
  S.selBar = $el('sel-bar');

  state.selection = null;   // { mask:Uint8Array, bbox:{x,y,w,h} }
  state.clipboard = null;   // { canvas, w, h }
  state.floating  = null;   // { canvas, x, y, w, h }
  S._selPendingBefore = null;   // full ImageData captured before a move-lift (for 1-step undo)

  S.computeMaskBBox = function computeMaskBBox(mask: any) {
    const w = S.doc.wPx, h = S.doc.hPx;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (mask[row + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  // Area (matched-pixel count) and centroid of a mask, scanned within its bbox.
  S.maskAreaCentroid = function maskAreaCentroid(mask: any, bbox: any) {
    const W = S.doc.wPx; let count = 0, sx = 0, sy = 0;
    for (let y = bbox.y; y < bbox.y + bbox.h; y++) {
      const row = y * W;
      for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
        if (mask[row + x]) { count++; sx += x; sy += y; }
      }
    }
    return { count, cx: count ? sx / count : bbox.x + bbox.w / 2, cy: count ? sy / count : bbox.y + bbox.h / 2 };
  }

  // Magic wand: sample the ACTIVE layer (image + strokes), grab the contiguous region.
  S.magicWandSelect = function magicWandSelect(p: any, tolerance: any) {
    S.ensureSelectionSurface();
    S.commitFloating();
    const l = S.activeLayer();
    if (!S._sampleCanvas) { S._sampleCanvas = document.createElement('canvas'); S._sampleCtx = S._sampleCanvas.getContext('2d', { willReadFrequently: true }); }
    if (S._sampleCanvas.width !== S.doc.wPx || S._sampleCanvas.height !== S.doc.hPx) { S._sampleCanvas.width = S.doc.wPx; S._sampleCanvas.height = S.doc.hPx; }
    S._sampleCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    if (l.imageCanvas && !l.imageBaked) S._sampleCtx.drawImage(l.imageCanvas, 0, 0);
    S._sampleCtx.drawImage(l.canvas, 0, 0);
    const sample = S._sampleCtx.getImageData(0, 0, S.doc.wPx, S.doc.hPx).data;
    const mask = S.computeFillMask(sample, p.x, p.y, tolerance);
    const bbox = S.computeMaskBBox(mask);
    if (!bbox) { S.clearSelection(); S.showHint('Nothing to select there'); return; }
    const ac = S.maskAreaCentroid(mask, bbox);
    const areaStr = S.formatArea(ac.count);
    state.selection = { mask, bbox, area: areaStr, centroid: { x: ac.cx, y: ac.cy } };
    S.drawSelectionOverlay();
    S.showSelBar();
    S.showHint('Selected · ' + areaStr + ' · Copy / Cut / Delete / Fill · drag to move · Done');
  }

  // Rasterize a freehand polygon (doc-coord points) into a selection mask.
  S.lassoToMask = function lassoToMask(points: any) {
    if (!S._sampleCanvas) { S._sampleCanvas = document.createElement('canvas'); S._sampleCtx = S._sampleCanvas.getContext('2d', { willReadFrequently: true }); }
    if (S._sampleCanvas.width !== S.doc.wPx || S._sampleCanvas.height !== S.doc.hPx) { S._sampleCanvas.width = S.doc.wPx; S._sampleCanvas.height = S.doc.hPx; }
    const cx = S._sampleCtx;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    cx.fillStyle = '#fff';
    cx.beginPath();
    cx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) cx.lineTo(points[i].x, points[i].y);
    cx.closePath();
    cx.fill();
    const d = cx.getImageData(0, 0, S.doc.wPx, S.doc.hPx).data;
    const mask = new Uint8Array(S.doc.wPx * S.doc.hPx);
    for (let i = 0; i < mask.length; i++) if (d[i * 4 + 3] > 128) mask[i] = 1;
    return mask;
  }

  S.drawLassoPath = function drawLassoPath() {
    S.selCtx.setTransform(1, 0, 0, 1, 0, 0);
    S.selCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    S.selOverlay.style.display = 'block';
    S.selOverlay.style.zIndex = (state.layers.length * 2 + 6).toString();
    S.selOverlay.classList.remove('pulse');
    const pts = state.lassoPoints;
    if (!pts || pts.length < 2) return;
    S.selCtx.strokeStyle = 'rgba(160,40,53,0.95)';
    S.selCtx.lineWidth = 2.5; S.selCtx.lineJoin = 'round'; S.selCtx.setLineDash([9, 6]);
    S.selCtx.beginPath();
    S.selCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) S.selCtx.lineTo(pts[i].x, pts[i].y);
    S.selCtx.stroke();
    S.selCtx.setLineDash([]);
  }

  S.finishLasso = function finishLasso() {
    const pts = state.lassoPoints || [];
    state.lassoPoints = null;
    if (pts.length < 3) { S.selOverlay.style.display = 'none'; return; }
    const mask = S.lassoToMask(pts);
    const bbox = S.computeMaskBBox(mask);
    if (!bbox) { S.selOverlay.style.display = 'none'; return; }
    const areaStr = S.formatArea(S.shoelaceArea(pts));
    let sx = 0, sy = 0; pts.forEach((p: any) => { sx += p.x; sy += p.y; });
    state.selection = { mask, bbox, area: areaStr, centroid: { x: sx / pts.length, y: sy / pts.length } };
    state.floating = null;
    S.drawSelectionOverlay();
    S.showSelBar();
    S.showHint('Lasso area: ' + areaStr + ' · Copy / Cut / Delete / Fill · Done');
  }

  S.drawSelectionOverlay = function drawSelectionOverlay() {
    S.ensureSelectionSurface();
    S.selCtx.setTransform(1, 0, 0, 1, 0, 0);
    S.selCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    S.selOverlay.style.zIndex = (state.layers.length * 2 + 6).toString();
    if (state.floating) {
      S.selOverlay.style.display = 'block';
      S.selOverlay.classList.remove('pulse');
      S.selCtx.drawImage(state.floating.canvas, state.floating.x, state.floating.y);
      S.selCtx.strokeStyle = 'rgba(160,40,53,0.95)';
      S.selCtx.lineWidth = 2.5; S.selCtx.setLineDash([11, 7]);
      S.selCtx.strokeRect(state.floating.x, state.floating.y, state.floating.w, state.floating.h);
      S.selCtx.setLineDash([]);
      return;
    }
    if (!state.selection) { S.selOverlay.style.display = 'none'; S.selOverlay.classList.remove('pulse'); return; }
    S.selOverlay.style.display = 'block';
    const { mask, bbox } = state.selection;
    const W = S.doc.wPx, H = S.doc.hPx;
    const img = S.selCtx.createImageData(bbox.w, bbox.h);
    const d = img.data;
    for (let y = 0; y < bbox.h; y++) {
      const gy = bbox.y + y;
      for (let x = 0; x < bbox.w; x++) {
        const gx = bbox.x + x;
        const gi = gy * W + gx;
        if (!mask[gi]) continue;
        const edge = gx === 0 || gx === W-1 || gy === 0 || gy === H-1 ||
                     !mask[gi-1] || !mask[gi+1] || !mask[gi-W] || !mask[gi+W];
        const o = (y * bbox.w + x) * 4;
        d[o] = 160; d[o+1] = 40; d[o+2] = 53;
        d[o+3] = edge ? 240 : 48;
      }
    }
    S.selCtx.putImageData(img, bbox.x, bbox.y);
    S.selOverlay.classList.add('pulse');

    // Lasso area label at the centroid
    if (state.selection.area && state.selection.centroid) {
      const c = state.selection.centroid;
      S.selCtx.font = '700 30px ui-monospace, monospace';
      S.selCtx.textAlign = 'center';
      S.selCtx.textBaseline = 'middle';
      const txt = state.selection.area;
      const tw = S.selCtx.measureText(txt).width;
      const bw = tw + 28, bh = 46;
      S.selCtx.fillStyle = 'rgba(20,20,22,0.9)';
      const rx = c.x - bw/2, ry = c.y - bh/2, r = 10;
      S.selCtx.beginPath();
      S.selCtx.moveTo(rx + r, ry);
      S.selCtx.arcTo(rx + bw, ry, rx + bw, ry + bh, r);
      S.selCtx.arcTo(rx + bw, ry + bh, rx, ry + bh, r);
      S.selCtx.arcTo(rx, ry + bh, rx, ry, r);
      S.selCtx.arcTo(rx, ry, rx + bw, ry, r);
      S.selCtx.closePath();
      S.selCtx.fill();
      S.selCtx.fillStyle = '#fff';
      S.selCtx.fillText(txt, c.x, c.y);
    }
  }

  S.clearSelection = function clearSelection() {
    state.selection = null;
    S.selOverlay.style.display = 'none';
    S.selOverlay.classList.remove('pulse');
    S.selBar.classList.remove('show');
  }

  S.showSelBar = function showSelBar() {
    S.selBar.classList.add('show');
    $el('sel-paste').disabled = !state.clipboard;
  }

  S.ensureBaked = function ensureBaked(l: any) {
    if (l.imageCanvas && !l.imageBaked && l.image) S.bakeImageLayer(l);
  }

  // Active-layer pixels within the mask → a bbox-sized canvas.
  S.maskedToCanvas = function maskedToCanvas(l: any, mask: any, bbox: any) {
    const c = document.createElement('canvas'); c.width = bbox.w; c.height = bbox.h;
    const region = l.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
    const rd = region.data, W = S.doc.wPx;
    for (let y = 0; y < bbox.h; y++) {
      for (let x = 0; x < bbox.w; x++) {
        if (!mask[(bbox.y + y) * W + (bbox.x + x)]) region.data[(y * bbox.w + x) * 4 + 3] = 0;
      }
    }
    (c.getContext('2d') as any).putImageData(region, 0, 0);
    return c;
  }

  S.clearMaskPixels = function clearMaskPixels(l: any, mask: any, bbox: any) {
    const region = l.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
    const d = region.data, W = S.doc.wPx;
    for (let y = 0; y < bbox.h; y++) {
      for (let x = 0; x < bbox.w; x++) {
        if (mask[(bbox.y + y) * W + (bbox.x + x)]) {
          const o = (y * bbox.w + x) * 4; d[o] = d[o+1] = d[o+2] = d[o+3] = 0;
        }
      }
    }
    l.ctx.putImageData(region, bbox.x, bbox.y);
  }

  S.selCopy = function selCopy() {
    if (!state.selection) return;
    const l = S.activeLayer(); S.ensureBaked(l);
    const { mask, bbox } = state.selection;
    state.clipboard = { canvas: S.maskedToCanvas(l, mask, bbox), w: bbox.w, h: bbox.h };
    $el('sel-paste').disabled = false;
    S.showHint('Copied');
  }

  S.selDelete = function selDelete() {
    if (!state.selection) return;
    const l = S.activeLayer(); S.ensureBaked(l);
    const { mask, bbox } = state.selection;
    S.clearMaskPixels(l, mask, bbox);
    S.saveSnapshot(l); S.renderLayers();
    S.clearSelection();
    S.showHint('Deleted');
  }

  S.selCut = function selCut() {
    if (!state.selection) return;
    const l = S.activeLayer(); S.ensureBaked(l);
    const { mask, bbox } = state.selection;
    state.clipboard = { canvas: S.maskedToCanvas(l, mask, bbox), w: bbox.w, h: bbox.h };
    S.clearMaskPixels(l, mask, bbox);
    S.saveSnapshot(l); S.renderLayers();
    S.clearSelection();
    S.showHint('Cut');
  }

  S.selPaste = function selPaste() {
    if (!state.clipboard) return;
    S.commitFloating();
    const cb = state.clipboard;
    const c = document.createElement('canvas'); c.width = cb.w; c.height = cb.h;
    (c.getContext('2d') as any).drawImage(cb.canvas, 0, 0);
    state.floating = { canvas: c, x: Math.round((S.doc.wPx - cb.w) / 2), y: Math.round((S.doc.hPx - cb.h) / 2), w: cb.w, h: cb.h };
    state.selection = null;
    S._selPendingBefore = null;   // paste adds pixels; commit will saveSnapshot
    S.drawSelectionOverlay();
    S.showSelBar();
    S.showHint('Drag to position · Done to place');
  }

  S.selDuplicate = function selDuplicate() {
    if (!state.selection) return;
    S.selCopy();
    S.selPaste();
  }

  // Fill the current selection with the active fill source (colour or image texture).
  S.selFill = function selFill() {
    if (!state.selection) return;
    const l = S.activeLayer(); S.ensureBaked(l);
    S.applyFill(l, state.selection.mask);
    S.saveSnapshot(l);
    S.renderLayers();
    S.drawSelectionOverlay();   // selection stays so you can try other textures
    S.showHint(state.fillStyle === 'image' && S.currentFillTexture() ? 'Filled with texture' : 'Filled');
  }

  // Lift the current selection into a floating layer for moving.
  S.floatSelection = function floatSelection() {
    if (!state.selection) return;
    const l = S.activeLayer(); S.ensureBaked(l);
    const { mask, bbox } = state.selection;
    S._selPendingBefore = l._cur
      ? new ImageData(new Uint8ClampedArray(l._cur.data), l._cur.width, l._cur.height)
      : l.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
    const c = S.maskedToCanvas(l, mask, bbox);
    S.clearMaskPixels(l, mask, bbox);   // lift (snapshot deferred to commit for a single undo step)
    state.floating = { canvas: c, x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h };
    state.selection = null;
    S.renderLayers();
    S.drawSelectionOverlay();
  }

  S.commitFloating = function commitFloating() {
    if (!state.floating) return;
    const l = S.activeLayer();
    l.ctx.drawImage(state.floating.canvas, state.floating.x, state.floating.y);
    if (S._selPendingBefore) {
      // single undo step spanning lift + move
      const after = l.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
      l.history.push({ x: 0, y: 0, before: S._selPendingBefore, after });
      l.redo = []; l._cur = after; S._capHistory(l); l._dirty = true; S.scheduleAutosave();
      S._selPendingBefore = null;
    } else {
      S.saveSnapshot(l);   // paste
    }
    state.floating = null;
    S.renderLayers();
    S.drawSelectionOverlay();
  }

  S.insideFloating = function insideFloating(p: any) {
    const f = state.floating; if (!f) return false;
    return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
  }
  S.maskAt = function maskAt(p: any) {
    const s = state.selection; if (!s) return false;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (x < 0 || y < 0 || x >= S.doc.wPx || y >= S.doc.hPx) return false;
    return !!s.mask[y * S.doc.wPx + x];
  }

  S.startFloatDrag = function startFloatDrag(e: any, p0: any) {
    S.paper.setPointerCapture && S.paper.setPointerCapture(e.pointerId);
    const f = state.floating; const sx = f.x, sy = f.y;
    let raf = false, last = p0;
    const mv = (ev: any) => {
      last = S.clientToCanvas(ev.clientX, ev.clientY);
      if (raf) return; raf = true;
      requestAnimationFrame(() => { raf = false; if (!state.floating) return;
        state.floating.x = Math.round(sx + (last.x - p0.x));
        state.floating.y = Math.round(sy + (last.y - p0.y));
        S.drawSelectionOverlay();
      });
    };
    const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); };
    document.addEventListener('pointermove', mv);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  S.selBar.querySelectorAll('button').forEach((b: any) => b.addEventListener('click', (e: any) => {
    e.stopPropagation();
    const a = b.dataset.act;
    if (a === 'copy') S.selCopy();
    else if (a === 'cut') S.selCut();
    else if (a === 'fill') S.selFill();
    else if (a === 'delete') S.selDelete();
    else if (a === 'duplicate') S.selDuplicate();
    else if (a === 'extrude') S.extrudeSelection();
    else if (a === 'paste') S.selPaste();
    else if (a === 'move') { if (state.selection) { S.floatSelection(); S.showHint('Drag to move · Done to place'); } }
    else if (a === 'deselect') { S.commitFloating(); S.clearSelection(); }
  }));

  /* =================== ERASABLE MEASUREMENTS =================== */
  // Per-measurement delete: click a label in the SVG overlay
  S.makeErasableMeasurements = function makeErasableMeasurements() {
    // Called from addMeasureSVG to wire up delete on the label rect
  }

  /* =================== NM LOGO LOAD FOR EXPORT =================== */
  S._nmLogoImg = null;
  S.getNmLogo = function getNmLogo() {
    if (S._nmLogoImg) return Promise.resolve(S._nmLogoImg);
    return new Promise((resolve: any) => {
      const logoEl = $el('logo');
      if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
        S._nmLogoImg = logoEl; resolve(S._nmLogoImg); return;
      }
      const img = new Image();
      img.onload = () => { S._nmLogoImg = img; resolve(img); };
      img.onerror = () => resolve(null);
      img.src = logoEl ? logoEl.src : '';
    });
  }

  document.addEventListener('click', (e: any) => {
    if (!e.target.closest('.popover') && !e.target.closest('#puck-color') && !e.target.closest('[data-tool="stencil"]')) {
      S.colorPopover.classList.remove('show');
      if (state.tool !== 'stencil') S.stencilPopover.classList.remove('show');
    }
  });
}
