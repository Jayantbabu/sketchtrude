/* Auto-converted from public/engine/app/03-layers.js — shared scope S */
import { S } from "./scope";
import { capHistory } from "./history";

export function initLayers() {
  const state = S.state;
  S.capHistory = capHistory;

  /* =================== LAYERS =================== */
  S.createLayer = function createLayer(name: any, opts: any) {
    opts = opts || {};
    const layerKind = opts.layerKind || 'sketch';
    let engineId = null;
    if (S.layerEngine) {
      if (!S.layerEngine.rootFloorIds.length) {
        S.layerEngine.createFloor('Ground Floor');
      }
      engineId = S.layerEngine.createLayer({
        name: name || undefined,
        layerKind,
        floorId: opts.floorId,
        parentLayerId: opts.parentLayerId || null,
        locked: opts.locked,
        visible: opts.visible,
        opacity: opts.opacity,
        blendMode: opts.blendMode,
        insertAt: opts.insertAt,
      });
      S.layerEngine.setActiveLayer(engineId);
    }
    const displayName =
      name ||
      (S.layerEngine && engineId && S.layerEngine.getLayer(engineId)?.name) ||
      `Layer ${String(state.layers.length + 1).padStart(2, '0')}`;
    const layer = engineId
      ? S.allocateLayerSurface(engineId, displayName)
      : S.allocateLayerSurface('legacy_' + S.layerIdCounter, displayName);
    if (!engineId) {
      // No LayerEngine — keep prior array behaviour.
      state.layers.push(layer);
      state.activeLayer = state.layers.length - 1;
    } else {
      S.syncStateLayersFromEngine();
    }
    S.updateLayerOrder();
    S.renderLayers();
    return layer;
  }

  // Import an image as a new layer.
  S.importImageAsLayer = function importImageAsLayer(file: any, replaceLayer: any) {
    // If we're replacing an existing image in a layer, pick that target
    if (!replaceLayer && state.replaceImageInLayer) {
      replaceLayer = state.replaceImageInLayer;
      state.replaceImageInLayer = null;
    }
    const reader = new FileReader();
    reader.onload = (ev: any) => {
      const dataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        const targetLayer = replaceLayer || S.createLayer(file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Image');
        // Fit image inside the document while preserving aspect.
        const aspect = img.naturalWidth / img.naturalHeight;
        let w, h;
        if (S.doc.wPx / S.doc.hPx > aspect) {
          h = S.doc.hPx * 0.9;
          w = h * aspect;
        } else {
          w = S.doc.wPx * 0.9;
          h = w / aspect;
        }
        targetLayer.image = img;
        targetLayer.imageSource = dataUrl;
        targetLayer.imageTransform = {
          x: S.doc.wPx / 2,
          y: S.doc.hPx / 2,
          w, h,
          rotation: 0,
        };
        targetLayer.imageOpacity = 1.0;
        targetLayer.imageCrop = null;
        targetLayer.imageBaked = false;
        S.renderImageCanvas(targetLayer);
        state.activeLayer = state.layers.indexOf(targetLayer);
        S.updateLayerOrder();
        S.renderLayers();
        S.updateUI();
        S.showHint('Image imported as layer · drag to move, corners to scale, top handle to rotate');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  // Redraw a layer's image canvas with its current transform + crop.
  // A downscaled copy of the source used for fast live preview while moving/
  // scaling (resampling the full-res original every frame is what made it lag).
  // Full-res original is still used when baking for final quality.
  S.workingImage = function workingImage(layer: any) {
    if (layer.imageCrop) return layer.image;   // crop path needs original coords
    const src = layer.image;
    const long = Math.max(src.naturalWidth, src.naturalHeight);
    const cap = 2200;
    if (long <= cap) return src;
    if (layer._imgWork && layer._imgWorkFor === src) return layer._imgWork;
    const s = cap / long;
    const wc = document.createElement('canvas');
    wc.width = Math.max(1, Math.round(src.naturalWidth * s));
    wc.height = Math.max(1, Math.round(src.naturalHeight * s));
    (wc.getContext('2d') as any).drawImage(src, 0, 0, wc.width, wc.height);
    layer._imgWork = wc; layer._imgWorkFor = src;
    return wc;
  }

  S.renderImageCanvas = function renderImageCanvas(layer: any) {
    const ctx = layer.imageCtx;
    ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    if (!layer.image || layer.imageBaked) return;
    const t = layer.imageTransform;
    ctx.save();
    ctx.globalAlpha = layer.imageOpacity;
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation * Math.PI / 180);
    const useImg = layer.imageManipulating ? S.workingImage(layer) : layer.image;
    let sx = 0, sy = 0, sw = useImg.naturalWidth || useImg.width, sh = useImg.naturalHeight || useImg.height;
    if (layer.imageCrop) {
      sx = layer.imageCrop.x; sy = layer.imageCrop.y;
      sw = layer.imageCrop.w; sh = layer.imageCrop.h;
    }
    ctx.drawImage(useImg, sx, sy, sw, sh, -t.w/2, -t.h/2, t.w, t.h);
    ctx.restore();
  }

  // Bake the image into the drawing canvas, freeing the image for normal draw/erase.
  S.bakeImageLayer = function bakeImageLayer(layer: any) {
    if (!layer.image || layer.imageBaked) return;
    layer.ctx.save();
    layer.ctx.globalAlpha = layer.imageOpacity;
    layer.ctx.drawImage(layer.imageCanvas, 0, 0);
    layer.ctx.restore();
    (layer.imageCanvas.getContext('2d') as any).clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    layer.imageBaked = true;
    layer.image = null; // free reference; source kept in case we want re-import
    S.saveSnapshot(layer);
    S.hideImageOverlay();
    S.renderLayers();
    S.updateUI();
  }

  S.updateLayerOrder = function updateLayerOrder() {
    state.layers.forEach((l: any, i: any) => {
      // image canvas sits just below the drawing canvas for the same layer
      if (l.imageCanvas) {
        l.imageCanvas.style.zIndex = (i * 2 + 2).toString();
        l.imageCanvas.style.opacity = l.visible ? 1 : 0;
        l.imageCanvas.style.pointerEvents = 'none';
      }
      l.canvas.style.zIndex = (i * 2 + 3).toString();
      l.canvas.style.opacity = l.visible ? l.opacity : 0;
      // Mix-blend-mode on the draw canvas implements layer blend modes
      l.canvas.style.mixBlendMode = (l.blendMode && l.blendMode !== 'source-over') ? l.blendMode : '';
      if (l.trace > 0) {
        l.canvas.style.filter = `sepia(${l.trace * 0.4}) saturate(${1 + l.trace * 0.5}) hue-rotate(-10deg)`;
      } else {
        l.canvas.style.filter = '';
      }
      // pointer events on active drawing canvas only when in draw mode and the layer has no unbaked image
      const hasUnbakedImage = l.image && !l.imageBaked;
      l.canvas.style.pointerEvents = (i === state.activeLayer && state.mode === 'draw' && !hasUnbakedImage) ? 'auto' : 'none';
    });
    S.rulerOverlay.style.zIndex = '999';
    // pointer-events: all set in CSS; individual non-interactive elements get pointer-events:none explicitly
    // Refresh image overlay visibility for active layer
    S.refreshImageOverlay();
  }

  S.activeLayer = function activeLayer() { return state.layers[state.activeLayer]; }

  // Undo/redo lives here (initLayers). See ./history.ts for HistoryEntry + thin
  // helpers (capHistory); full undo stays interleaved with layer ops for now.
  // Undo model: each history entry is a region diff { x, y, before, after }.
  // Strokes capture only their bounding box (cheap). Rare ops (fill, layer ops,
  // resize, image bake) capture the full canvas. layer._cur caches the current
  // full pixels so full-canvas ops can record their "before" without a second read.
  S._capHistory = function _capHistory(layer: any) {
    const minSteps = 40;
    let budget = 220 * 1024 * 1024;  // ~220MB of undo per layer
    let total = 0;
    for (let i = layer.history.length - 1; i >= 0; i--) {
      const e = layer.history[i];
      total += (e.before ? e.before.data.length : 0) + (e.after ? e.after.data.length : 0);
      if (total > budget && layer.history.length > minSteps) { layer.history.splice(0, i + 1); break; }
    }
  }
  S._blitRegion = function _blitRegion(full: any, region: any, x: any, y: any) {
    if (!full || !region) return;
    const fw = full.width, fh = full.height, rw = region.width, rh = region.height;
    const srcX = Math.max(0, -x), srcY = Math.max(0, -y);
    const dstX = Math.max(0, x), dstY = Math.max(0, y);
    const copyW = Math.min(rw - srcX, fw - dstX);
    const copyH = Math.min(rh - srcY, fh - dstY);
    if (copyW <= 0 || copyH <= 0) return;
    for (let row = 0; row < copyH; row++) {
      const dst = ((dstY + row) * fw + dstX) * 4;
      const src = ((srcY + row) * rw + srcX) * 4;
      full.data.set(region.data.subarray(src, src + copyW * 4), dst);
    }
  }
  // Slice a w×h region out of a full ImageData into a new ImageData.
  S._extractRegion = function _extractRegion(full: any, x: any, y: any, w: any, h: any) {
    const out = new ImageData(w, h);
    if (!full) return out;
    const fw = full.width, fh = full.height;
    const srcX = Math.max(0, x), srcY = Math.max(0, y);
    const dstX = Math.max(0, -x), dstY = Math.max(0, -y);
    const copyW = Math.min(w - dstX, fw - srcX);
    const copyH = Math.min(h - dstY, fh - srcY);
    if (copyW <= 0 || copyH <= 0) return out;
    for (let row = 0; row < copyH; row++) {
      const src = ((srcY + row) * fw + srcX) * 4;
      const dst = ((dstY + row) * w + dstX) * 4;
      out.data.set(full.data.subarray(src, src + copyW * 4), dst);
    }
    return out;
  }
  // Clamp a stroke's bounding box to canvas bounds, padded by the brush width.
  S._bboxRect = function _bboxRect(bb: any) {
    if (!bb) return null;
    const pad = Math.ceil(bb.maxW) + 4;
    const x = Math.max(0, Math.floor(bb.minX - pad));
    const y = Math.max(0, Math.floor(bb.minY - pad));
    const w = Math.min(S.doc.wPx - x, Math.ceil(bb.maxX + pad) - x);
    const h = Math.min(S.doc.hPx - y, Math.ceil(bb.maxY + pad) - y);
    if (w <= 0 || h <= 0) return null;
    return { x, y, w, h };
  }

  // Full-canvas snapshot — used by rare, large operations.
  S.saveSnapshot = function saveSnapshot(layer: any) {
    try {
      const after = layer.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
      const before = layer._cur || after;
      layer.history.push({ x: 0, y: 0, before, after });
      layer.redo = [];
      layer._cur = after;
      S._capHistory(layer);
      layer._dirty = true;
      S.scheduleAutosave();
    } catch (e) { console.warn(e); }
  }

  // Region snapshot — used by strokes. before/after are already-captured regions.
  S.pushRegionSnapshot = function pushRegionSnapshot(layer: any, x: any, y: any, before: any, after: any) {
    try {
      layer.history.push({ x, y, before, after });
      layer.redo = [];
      if (!layer._cur || layer._cur.width !== S.doc.wPx || layer._cur.height !== S.doc.hPx) layer._cur = layer.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
      else S._blitRegion(layer._cur, after, x, y);
      S._capHistory(layer);
      layer._dirty = true;
      S.scheduleAutosave();
    } catch (e) { console.warn(e); }
  }

  // ---- vector-entity undo (walls, openings, rooms, dimensions) ----
  // Rides the active layer's history so it interleaves correctly with raster strokes.
  S.vectorSnapshot = function vectorSnapshot() {
    return {
      walls: JSON.parse(JSON.stringify(state.walls || [])),
      wallRooms: JSON.parse(JSON.stringify(state.wallRooms || [])),
      shapes: JSON.parse(JSON.stringify(state.shapes || [])),
      measurements: JSON.parse(JSON.stringify(state.measurements || [])),
    };
  }
  S.applyVectorSnapshot = function applyVectorSnapshot(s: any) {
    state.walls = JSON.parse(JSON.stringify(s.walls || []));
    state.wallRooms = JSON.parse(JSON.stringify(s.wallRooms || []));
    state.shapes = JSON.parse(JSON.stringify(s.shapes || []));
    S.ensureAllShapeIds(state.shapes);
    state.measurements = JSON.parse(JSON.stringify(s.measurements || []));
    state.sel = null; state.selOpening2D = null;
    S.syncSelectionManagerFromLegacy('programmatic');
    if (typeof S.showSelectBar === 'function') S.showSelectBar(null);
    if (typeof S.showOpeningPalette === 'function') S.showOpeningPalette(state.tool === 'opening');
    if (typeof S.reconcileWallRooms === 'function') S.reconcileWallRooms();
    if (typeof S.refreshMeasurements === 'function') S.refreshMeasurements();
    if (typeof S.syncWallsToMasses === 'function') S.syncWallsToMasses();
    if (typeof S.syncSceneObjectsToEngine === 'function') S.syncSceneObjectsToEngine();
    if (typeof S.renderSchedule === 'function') S.renderSchedule();
  }
  S._lastVecPush = 0;
  S.recordVec = function recordVec(before: any, coalesce: any) {
    const l = S.activeLayer(); if (!l) return;
    const after = S.vectorSnapshot();
    const now = Date.now();
    const top = l.history[l.history.length - 1];
    // coalesce only a burst of property edits (e.g. typing a thickness) into one undo step
    if (coalesce && top && top.vector && (now - S._lastVecPush) < 800) {
      top.vector.after = after;
    } else {
      l.history.push({ vector: { before, after } });
      l.redo = [];
      S._capHistory(l);
    }
    S._lastVecPush = now;
    l._dirty = true; S.scheduleAutosave();
  }

  S.undo = function undo() {
    if (S.massing.active) { S.massUndo(); return; }
    const l = S.activeLayer();
    if (!l.history.length) return;
    const e = l.history.pop();
    if (e.vector) { S.applyVectorSnapshot(e.vector.before); l.redo.push(e); l._dirty = true; S.scheduleAutosave(); return; }
    l.ctx.putImageData(e.before, e.x, e.y);
    l.redo.push(e);
    if (l._cur) S._blitRegion(l._cur, e.before, e.x, e.y);
    l._dirty = true; S.scheduleAutosave();
    S.renderLayers();
  }

  S.redo = function redo() {
    if (S.massing.active) { S.massRedo(); return; }
    const l = S.activeLayer();
    if (!l.redo.length) return;
    const e = l.redo.pop();
    if (e.vector) { S.applyVectorSnapshot(e.vector.after); l.history.push(e); l._dirty = true; S.scheduleAutosave(); return; }
    l.ctx.putImageData(e.after, e.x, e.y);
    l.history.push(e);
    if (l._cur) S._blitRegion(l._cur, e.after, e.x, e.y);
    l._dirty = true; S.scheduleAutosave();
    S.renderLayers();
  }

  S.clearActive = function clearActive() {
    const l = S.activeLayer();
    l.ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    S.saveSnapshot(l);
    S.renderLayers();
  }

  S.setWallsVisible = function setWallsVisible(visible: any) {
    state.wallsVisible = !!visible;
    if (!state.wallsVisible) {
      if (state.sel && (state.sel.type === 'wall' || state.sel.type === 'opening')) {
        state.sel = null;
        if (typeof S.showSelectBar === 'function') S.showSelectBar(null);
      }
      state.selOpening2D = null;
      if (typeof S.showOpeningPalette === 'function') S.showOpeningPalette(false);
      // Clear legacy baked centerlines so hiding walls doesn't leave a thin ghost stroke.
      if (typeof S.eraseWallRasterInk === 'function') {
        (state.walls || []).forEach((w: any) => S.eraseWallRasterInk(w));
      }
    }
    S.refreshMeasurements();
    S.renderLayers();
    S.scheduleAutosave();
  }

  S.renderLayers = function renderLayers() {
    S.layersList.innerHTML = '';
    const lcEl = document.getElementById('layer-count') as any;
    if (lcEl) lcEl.textContent = state.layers.length;

    // Figma-style hierarchy from LayerEngine (Layer 1 elements + Sketch — no floor / Walls VEC)
    if (S.layerEngine) {
      const rows = S.layerEngine.getPanelRows({ includeObjects: true, hideFloors: true });
      const activeId = S.layerEngine.getActiveLayerId();
      const paintIds = S.layerEngine.getRasterLayerIds();
      const multi = state._panelMultiSelect || new Set();
      const selectedObjId = state._panelSelectedObjectId;

      for (const row of rows) {
        if (row.nodeKind === 'floor') continue;

        if (row.nodeKind === 'object') {
          const isSel = multi.has(row.id) || row.id === selectedObjId;
          const div = document.createElement('div');
          div.className = 'layer-card layer-card-object' + (isSel ? ' active-layer' : '') + (row.visible ? '' : ' layer-hidden');
          div.style.paddingLeft = (12 + row.depth * 12) + 'px';
          const typeLabel = (row.objectType || 'object').toUpperCase();
          div.innerHTML = `
            <div class="layer-thumb layer-thumb-vector" aria-hidden="true">
              <svg viewBox="0 0 42 30" width="42" height="30"><rect width="42" height="30" fill="#f7f5f2"/><rect x="8" y="8" width="26" height="14" fill="none" stroke="#1c1a18" stroke-width="1.5"/></svg>
            </div>
            <div class="layer-info">
              <div class="layer-name" data-oid="${row.id}">${S.escapeHtml(row.name)}</div>
              <div class="layer-meta">${typeLabel}${row.locked ? ' · LOCK' : ''}</div>
            </div>
            <div class="layer-actions">
              <button class="layer-act ${row.visible ? 'on' : 'off'}" data-action="obj-vis" data-id="${row.id}" title="Visibility">
                ${row.visible
                  ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
                  : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'}
              </button>
              <button class="layer-act" data-action="obj-menu" data-id="${row.id}" title="Element options">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
              </button>
            </div>`;
          div.addEventListener('click', (e: any) => {
            if (e.target.closest('.layer-act') || e.target.classList.contains('layer-name')) return;
            S.selectSceneObjectFromPanel(row.id, { additive: e.shiftKey || e.metaKey || e.ctrlKey });
            S.renderLayers();
          });
          const nameEl: any = div.querySelector('.layer-name');
          nameEl.addEventListener('dblclick', (e: any) => {
            e.stopPropagation();
            nameEl.contentEditable = 'true';
            nameEl.focus();
          });
          nameEl.addEventListener('blur', () => {
            const next = nameEl.textContent.trim() || row.name;
            S.layerEngine.renameObject(row.id, next);
            const ref = row.legacyRef || (S.layerEngine.getObject(row.id) || {}).legacyRef;
            if (ref && ref.kind === 'shape') {
              const sh = (state.shapes || []).find((s: any) => s.id === ref.id);
              if (sh) sh.name = next;
            }
            if (ref && (ref.kind === 'wall' || ref.kind === 'wall-face')) {
              const wid = ref.kind === 'wall' ? ref.id : ref.wallId;
              const w = (state.walls || []).find((x: any) => x.id === wid);
              if (w && ref.kind === 'wall') w.name = next;
            }
            nameEl.contentEditable = 'false';
            S.renderLayers();
          });
          nameEl.addEventListener('keydown', (e: any) => {
            if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
          });
          div.querySelectorAll('.layer-act').forEach((btn: any) => {
            btn.addEventListener('click', (e: any) => {
              e.stopPropagation();
              const action = btn.dataset.action;
              const id = btn.dataset.id;
              if (action === 'obj-vis') {
                const obj = S.layerEngine.getObject(id);
                const next = !(obj && obj.visible);
                S.layerEngine.setObjectVisibility(id, next);
                const ref = obj && obj.legacyRef;
                if (ref && ref.kind === 'shape') {
                  const sh = (state.shapes || []).find((s: any) => s && s.id === ref.id);
                  if (sh) sh.visible = next;
                }
                if (ref && ref.kind === 'wall') {
                  // Room / whole-wall toggle
                  const w = (state.walls || []).find((x: any) => x && x.id === ref.id);
                  if (w) {
                    w.visible = next;
                    if (!next && typeof S.eraseWallRasterInk === 'function') {
                      S.eraseWallRasterInk(w);
                    }
                  }
                }
                if (ref && ref.kind === 'wall-room') {
                  // Room walls inherit through the hierarchy; also clear their raster ink.
                  const room = (state.wallRooms || []).find((r: any) => r && r.id === ref.id);
                  if (room && !next && typeof S.eraseWallRasterInk === 'function') {
                    (room.wallIds || []).forEach((wid: string) => {
                      const w = (state.walls || []).find((x: any) => x && x.id === wid);
                      if (w) S.eraseWallRasterInk(w);
                    });
                  }
                }
                // wall-face: LayerEngine visibility alone drives per-segment hide
                // (do NOT flip the whole wall.visible — that hid the entire room).
                if (ref && (ref.kind === 'wall' || ref.kind === 'wall-face' || ref.kind === 'wall-room')
                  && typeof S.syncWallsToMasses === 'function') {
                  S.syncWallsToMasses();
                }
                S.renderLayers();
                S.refreshMeasurements();
                S.scheduleAutosave();
                return;
              }
              if (action === 'obj-menu') {
                S.openElementMenu(id, btn);
              }
            });
          });
          S.layersList.appendChild(div);
          continue;
        }

        // layer row (Layer 1 / Sketch / user layers)
        const meta = S.layerEngine.getLayer(row.id);
        const surf = S.surfaceByEngineId(row.id);
        const idx = surf ? state.layers.indexOf(surf) : -1;
        const hasUnbakedImage = surf && surf.image && !surf.imageBaked;
        const pad = 10 + row.depth * 12;
        const kindLabel = row.layerKind === 'object' ? 'LAYER' : (row.layerKind || 'layer').toUpperCase();
        const div = document.createElement('div');
        div.className = 'layer-card' + (row.id === activeId ? ' active-layer' : '') + (row.visible ? '' : ' layer-hidden');
        div.style.paddingLeft = pad + 'px';
        const expandBtn = row.hasChildren
          ? `<button class="layer-act" data-action="expand" data-id="${row.id}" title="Expand">${row.expanded ? '▾' : '▸'}</button>`
          : `<span style="width:28px;flex-shrink:0"></span>`;
        const thumbHtml = surf
          ? '<canvas width="42" height="30"></canvas>'
          : '<div class="layer-thumb-vector" style="width:42px;height:30px;display:flex;align-items:center;justify-content:center;background:#f4f2ef;border-radius:4px;font-size:9px;color:#888;">OBJ</div>';
        div.innerHTML = `
          ${expandBtn}
          <div class="layer-thumb">${thumbHtml}</div>
          <div class="layer-info">
            <div class="layer-name" data-id="${row.id}">${S.escapeHtml(row.name)}${hasUnbakedImage ? '<span class="img-badge">IMG</span>' : ''}</div>
            <div class="layer-meta">${Math.round(row.opacity * 100)}% · ${kindLabel}${row.locked ? ' · LOCK' : ''}${meta && meta.trace > 0 ? ' · TRACE' : ''}</div>
          </div>
          <div class="layer-actions">
            <button class="layer-act ${row.visible ? 'on' : 'off'}" data-action="vis" data-id="${row.id}" title="Visibility">
              ${row.visible
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'}
            </button>
            <button class="layer-act ${row.locked ? 'on' : 'off'}" data-action="lock" data-id="${row.id}" title="Lock">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
            </button>
            ${surf ? `<button class="layer-act" data-action="menu" data-idx="${idx}" title="Layer options">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
            </button>` : ''}
            <button class="layer-act" data-action="del" data-id="${row.id}" ${(paintIds.length <= 1 && surf) || row.layerKind === 'object' ? 'style="opacity:.2;pointer-events:none"' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>`;

        if (surf) {
          const thumb: any = div.querySelector('canvas');
          if (thumb) {
            const tctx: any = thumb.getContext('2d') as any;
            if (surf.imageCanvas) tctx.drawImage(surf.imageCanvas, 0, 0, 42, 30);
            tctx.drawImage(surf.canvas, 0, 0, 42, 30);
          }
        }

        div.addEventListener('click', (e: any) => {
          if (e.target.closest('.layer-act') || e.target.classList.contains('layer-name')) return;
          // Object host layers (Layer 1) have no raster — expand/collapse only; keep Sketch as draw target.
          if (!surf && row.layerKind === 'object') {
            S.layerEngine.setLayerExpanded(row.id, true);
            S.renderLayers();
            return;
          }
          S.layerEngine.setActiveLayer(row.id);
          if (surf) S.ensureRasterSurface(row.id);
          S.syncStateLayersFromEngine();
          S.updateLayerOrder(); S.renderLayers(); S.updateUI();
        });

        const nameEl: any = div.querySelector('.layer-name');
        nameEl.addEventListener('dblclick', () => {
          nameEl.contentEditable = 'true';
          nameEl.focus();
          const range = document.createRange();
          range.selectNodeContents(nameEl);
          const sel: any = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        });
        nameEl.addEventListener('blur', () => {
          const next = nameEl.textContent.trim() || 'Layer';
          S.layerEngine.renameLayer(row.id, next);
          if (surf) surf.name = next;
          nameEl.contentEditable = 'false';
          S.renderLayers();
        });
        nameEl.addEventListener('keydown', (e: any) => {
          if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
        });

        div.querySelectorAll('.layer-act').forEach((btn: any) => {
          btn.addEventListener('click', (e: any) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (action === 'expand') {
              S.layerEngine.toggleLayerExpanded(id);
              S.renderLayers();
              return;
            }
            if (action === 'vis') {
              const layer = S.layerEngine.getLayer(id);
              S.layerEngine.setLayerVisibility(id, !(layer && layer.visible));
              S.syncStateLayersFromEngine();
            } else if (action === 'lock') {
              const layer = S.layerEngine.getLayer(id);
              S.layerEngine.setLayerLocked(id, !(layer && layer.locked));
              S.syncStateLayersFromEngine();
            } else if (action === 'menu') {
              const menuIdx = parseInt(btn.dataset.idx, 10);
              if (!Number.isNaN(menuIdx) && menuIdx >= 0) S.openLayerMenu(menuIdx, btn);
              return;
            } else if (action === 'del') {
              const layer = S.layerEngine.getLayer(id);
              const nm = (layer && layer.name) || 'Layer';
              if (!confirm('Delete layer "' + nm + '"? This cannot be undone.')) return;
              S.disposeLayerSurface(id);
              S.layerEngine.deleteLayers([id]);
              for (const [eid] of [...S.layerSurfaces.keys()]) {
                if (!S.layerEngine.getLayer(eid)) S.disposeLayerSurface(eid);
              }
              S.syncStateLayersFromEngine();
            }
            S.updateLayerOrder(); S.renderLayers(); S.updateUI();
          });
        });

        S.layersList.appendChild(div);
      }
      return;
    }

    // Fallback: flat list without LayerEngine
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const l = state.layers[i];
      const div = document.createElement('div');
      div.className = 'layer-card' + (i === state.activeLayer ? ' active-layer' : '');
      const hasUnbakedImage = l.image && !l.imageBaked;
      div.innerHTML = `
        <div class="layer-thumb"><canvas width="42" height="30"></canvas></div>
        <div class="layer-info">
          <div class="layer-name" data-idx="${i}">${S.escapeHtml(l.name)}${hasUnbakedImage ? '<span class="img-badge">IMG</span>' : ''}</div>
          <div class="layer-meta">${Math.round(l.opacity*100)}% · ${l.visible ? 'VISIBLE' : 'HIDDEN'}</div>
        </div>
        <div class="layer-actions">
          <button class="layer-act ${l.visible ? 'on' : 'off'}" data-action="vis" data-idx="${i}">👁</button>
          <button class="layer-act" data-action="menu" data-idx="${i}">⋯</button>
          <button class="layer-act" data-action="del" data-idx="${i}">🗑</button>
        </div>`;
      const thumb: any = div.querySelector('canvas');
      const tctx: any = thumb.getContext('2d') as any;
      if (l.imageCanvas) tctx.drawImage(l.imageCanvas, 0, 0, 42, 30);
      tctx.drawImage(l.canvas, 0, 0, 42, 30);
      div.addEventListener('click', (e: any) => {
        if (e.target.closest('.layer-act')) return;
        state.activeLayer = i;
        S.updateLayerOrder(); S.renderLayers(); S.updateUI();
      });
      S.layersList.appendChild(div);
    }
  }

  S.escapeHtml = function escapeHtml(s: any) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* =================================================================
     LAYER OPERATIONS — duplicate, flip (mirror), merge, clear,
     and free transform (move/scale/rotate) via the image overlay.
     ================================================================= */
  S.layerCompositeToCtx = function layerCompositeToCtx(src: any, ctx: any) {
    if (src.imageCanvas && !src.imageBaked) ctx.drawImage(src.imageCanvas, 0, 0);
    ctx.drawImage(src.canvas, 0, 0);
  }

  S.moveLayer = function moveLayer(idx: any, dir: any) {
    // dir +1 = up the stack (toward top of panel / higher z), -1 = down.
    const j = idx + dir;
    if (j < 0 || j >= state.layers.length) return;
    const layer = state.layers[idx];
    if (S.layerEngine && layer.engineId) {
      const meta = S.layerEngine.getLayer(layer.engineId);
      if (meta) {
        const siblings = meta.parentLayerId
          ? S.layerEngine.layers[meta.parentLayerId].childLayerIds
          : S.layerEngine.floors[meta.floorId].layerIds;
        const from = siblings.indexOf(layer.engineId);
        const to = from + dir;
        if (from >= 0 && to >= 0 && to < siblings.length) {
          S.layerEngine.moveLayer(layer.engineId, to);
          S.layerEngine.setActiveLayer(layer.engineId);
          S.syncStateLayersFromEngine();
          S.updateLayerOrder();
          S.renderLayers();
          return;
        }
      }
    }
    const [l] = state.layers.splice(idx, 1);
    state.layers.splice(j, 0, l);
    state.activeLayer = j;
    S.updateLayerOrder();
    S.renderLayers();
  }

  S.duplicateLayer = function duplicateLayer(idx: any) {
    const src = state.layers[idx];
    const nl = S.createLayer((src.name || 'Layer') + ' copy', {
      layerKind: (S.layerEngine && src.engineId && S.layerEngine.getLayer(src.engineId)?.layerKind) || 'sketch',
    });
    S.layerCompositeToCtx(src, nl.ctx);
    nl.opacity = src.opacity; nl.trace = src.trace;
    nl.blendMode = src.blendMode; nl.visible = src.visible;
    if (S.layerEngine && nl.engineId) {
      S.layerEngine.setLayerOpacity(nl.engineId, nl.opacity);
      S.layerEngine.setLayerVisibility(nl.engineId, nl.visible);
      S.layerEngine.setLayerBlendMode(nl.engineId, nl.blendMode);
      const meta = S.layerEngine.getLayer(nl.engineId);
      if (meta) meta.trace = nl.trace;
      // Place copy above source in engine sibling list when possible.
      if (src.engineId) {
        const srcMeta = S.layerEngine.getLayer(src.engineId);
        if (srcMeta) {
          const siblings = srcMeta.parentLayerId
            ? S.layerEngine.layers[srcMeta.parentLayerId].childLayerIds
            : S.layerEngine.floors[srcMeta.floorId].layerIds;
          const srcPos = siblings.indexOf(src.engineId);
          const copyPos = siblings.indexOf(nl.engineId);
          if (srcPos >= 0 && copyPos >= 0) {
            siblings.splice(copyPos, 1);
            siblings.splice(srcPos + 1, 0, nl.engineId);
            siblings.forEach((sid: any, i: any) => { if (S.layerEngine.layers[sid]) S.layerEngine.layers[sid].order = i; });
          }
        }
      }
      S.syncStateLayersFromEngine();
    } else {
      state.layers.pop();
      state.layers.splice(idx + 1, 0, nl);
      state.activeLayer = idx + 1;
    }
    S.saveSnapshot(nl);
    S.updateLayerOrder(); S.renderLayers(); S.updateUI();
    S.showHint('Layer duplicated');
  }

  S.flipLayer = function flipLayer(idx: any, horizontal: any) {
    const l = state.layers[idx];
    if (l.image && !l.imageBaked) S.bakeImageLayer(l);
    const tmp = document.createElement('canvas');
    tmp.width = S.doc.wPx; tmp.height = S.doc.hPx;
    (tmp.getContext('2d') as any).drawImage(l.canvas, 0, 0);
    l.ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    l.ctx.save();
    if (horizontal) { l.ctx.translate(S.doc.wPx, 0); l.ctx.scale(-1, 1); }
    else { l.ctx.translate(0, S.doc.hPx); l.ctx.scale(1, -1); }
    l.ctx.drawImage(tmp, 0, 0);
    l.ctx.restore();
    S.saveSnapshot(l);
    S.renderLayers();
    S.showHint(horizontal ? 'Layer mirrored horizontally' : 'Layer mirrored vertically');
  }

  S.mergeDownLayer = function mergeDownLayer(idx: any) {
    if (idx === 0) { S.showHint('Nothing below to merge into'); return; }
    const top = state.layers[idx], below = state.layers[idx - 1];
    if (top.image && !top.imageBaked) S.bakeImageLayer(top);
    if (below.image && !below.imageBaked) S.bakeImageLayer(below);
    below.ctx.save();
    below.ctx.globalAlpha = top.visible ? top.opacity : 0;
    below.ctx.drawImage(top.canvas, 0, 0);
    below.ctx.restore();
    const topEngineId = top.engineId;
    S.disposeLayerSurface(topEngineId || '');
    if (top.canvas && top.canvas.parentNode) top.canvas.remove();
    if (top.imageCanvas && top.imageCanvas.parentNode) top.imageCanvas.remove();
    if (S.layerEngine && topEngineId) {
      S.layerEngine.deleteLayers([topEngineId]);
      if (below.engineId) S.layerEngine.setActiveLayer(below.engineId);
      S.syncStateLayersFromEngine();
    } else {
      state.layers.splice(idx, 1);
      state.activeLayer = idx - 1;
    }
    S.saveSnapshot(below);
    S.updateLayerOrder(); S.renderLayers(); S.updateUI();
    S.showHint('Merged down');
  }

  S.clearLayer = function clearLayer(idx: any) {
    const l = state.layers[idx];
    if (!l) return;
    l.ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    if (l.imageCanvas) (l.imageCtx as any).clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    l.image = null; l.imageBaked = false; l.imageTransform = null;
    l._savedBlob = null;   // force re-encode — do not reuse pre-clear PNG
    l._rasterPath = null;  // force cloud re-upload on next parent save
    S.hideImageOverlay();
    S.saveSnapshot(l);
    S.scheduleAutosave();
    S.saveDoc();             // persist cleared pixels to IDB immediately
    S.renderLayers(); S.updateUI();
    S.showHint('Layer cleared');
  }

  // Free transform: turn the layer's pixels into a transformable image and
  // reuse the existing move/scale/rotate overlay. "Apply" bakes it back.
  S.transformLayer = function transformLayer(idx: any) {
    const l = state.layers[idx];
    const caps = (S.__layersApi && S.__layersApi.getLayerTransformCapabilities)
      ? S.__layersApi.getLayerTransformCapabilities()
      : { scalable: true, rotatable: true, movable: true };
    if (!caps.movable && !caps.scalable && !caps.rotatable) {
      S.showHint('This layer type does not support free transform');
      return;
    }
    state.activeLayer = idx;
    if (S.layerEngine && l.engineId) S.layerEngine.setActiveLayer(l.engineId);
    if (l.image && !l.imageBaked) S.bakeImageLayer(l);
    const dataUrl = l.canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      l.ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      l.image = img;
      l.imageSource = dataUrl;
      l.imageTransform = { x: S.doc.wPx / 2, y: S.doc.hPx / 2, w: S.doc.wPx, h: S.doc.hPx, rotation: 0 };
      l.imageOpacity = 1; l.imageCrop = null; l.imageBaked = false;
      S.renderImageCanvas(l);
      S.updateLayerOrder(); S.renderLayers(); S.updateUI();
      S.refreshImageOverlay();
      S.showHint('Transform · drag to move · corners to scale · top handle to rotate · Apply to commit');
    };
    img.src = dataUrl;
  }

  /* ---- Layer options menu ---- */
  S.layerMenuEl = null;
  S._placeFixedMenu = function _placeFixedMenu(menu: any, anchor: any, preferredWidth: any) {
    const mw = preferredWidth || 220;
    menu.style.visibility = 'hidden';
    menu.style.left = '0px';
    menu.style.top = '0px';
    const place = () => {
      const r = anchor && anchor.getBoundingClientRect
        ? anchor.getBoundingClientRect()
        : { left: 8, right: 8 + mw, top: 8, bottom: 40, width: 0, height: 0 };
      const degenerated = !r.width && !r.height;
      let left = degenerated ? 8 : (r.right - mw);
      if (left < 8) left = 8;
      if (left + mw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - mw - 8);
      let top = degenerated ? 48 : (r.bottom + 4);
      const mh = menu.offsetHeight || 240;
      if (top + mh > window.innerHeight - 8) top = Math.max(8, (degenerated ? 48 : r.top) - mh - 4);
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      menu.style.visibility = 'visible';
    };
    requestAnimationFrame(place);
  }
  S.openLayerMenu = function openLayerMenu(idx: any, anchor: any) {
    S.closeLayerMenu();
    const items = [
      { label: 'Move up', fn: () => S.moveLayer(idx, +1), disabled: idx === state.layers.length - 1 },
      { label: 'Move down', fn: () => S.moveLayer(idx, -1), disabled: idx === 0 },
      { label: 'Duplicate', fn: () => S.duplicateLayer(idx) },
      { label: 'Transform (move / scale / rotate)', fn: () => S.transformLayer(idx) },
      { label: 'Mirror horizontal', fn: () => S.flipLayer(idx, true) },
      { label: 'Mirror vertical', fn: () => S.flipLayer(idx, false) },
      { label: 'Merge down', fn: () => S.mergeDownLayer(idx), disabled: idx === 0 },
      { label: 'Clear', fn: () => S.clearLayer(idx) },
    ];
    const menu = document.createElement('div');
    menu.className = 'layer-menu';
    items.forEach((it: any) => {
      const b = document.createElement('button');
      b.className = 'layer-menu-item' + (it.disabled ? ' disabled' : '');
      b.textContent = it.label;
      if (!it.disabled) b.addEventListener('click', (e: any) => { e.stopPropagation(); S.closeLayerMenu(); it.fn(); });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    S.layerMenuEl = menu;
    S._placeFixedMenu(menu, anchor, 210);
    setTimeout(() => document.addEventListener('pointerdown', S.closeLayerMenuOnOutside, true), 0);
  }
  S.openElementMenu = function openElementMenu(objectId: any, anchor: any) {
    S.closeLayerMenu();
    S.selectSceneObjectFromPanel(objectId, { additive: false });
    const multi = [...(state._panelMultiSelect || new Set())];
    const items = [
      { label: 'Move', fn: () => S.beginVecXform('move') },
      { label: 'Scale', fn: () => S.beginVecXform('scale') },
      { label: 'Rotate', fn: () => S.beginVecXform('rotate') },
      { label: 'Add background image…', fn: () => S.addBackgroundImageToSelection() },
      {
        label: multi.length >= 2 ? 'Group selection…' : 'Group (select 2+ with Shift)',
        fn: () => S.groupSelectedElements(),
        disabled: multi.length < 2,
      },
      { label: 'Delete', fn: () => S.deleteSelectedElement() },
    ];
    const menu = document.createElement('div');
    menu.className = 'layer-menu';
    items.forEach((it: any) => {
      const b = document.createElement('button');
      b.className = 'layer-menu-item' + (it.disabled ? ' disabled' : '');
      b.textContent = it.label;
      if (!it.disabled) b.addEventListener('click', (e: any) => { e.stopPropagation(); S.closeLayerMenu(); it.fn(); });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    S.layerMenuEl = menu;
    S._placeFixedMenu(menu, anchor, 220);
    setTimeout(() => document.addEventListener('pointerdown', S.closeLayerMenuOnOutside, true), 0);
  }

  S.groupSelectedElements = function groupSelectedElements() {
    if (!S.layerEngine) return;
    const ids = [...(state._panelMultiSelect || new Set())];
    if (ids.length < 2) { S.showHint('Shift-click 2+ elements to group'); return; }
    const name = prompt('Group name', 'Room 1');
    if (name == null) return;
    try {
      const gid = S.layerEngine.groupObjects(ids, name.trim() || 'Group');
      if (gid) {
        state._panelSelectedObjectId = gid;
        state._panelMultiSelect = new Set([gid]);
        S.renderLayers();
        S.showHint('Grouped as ' + (name.trim() || 'Group'));
      }
    } catch (err: any) {
      S.showHint((err && err.message) || 'Could not group');
    }
  }

  S.deleteSelectedElement = function deleteSelectedElement() {
    const sel: any = state.sel;
    if (sel && sel.type === 'wall') {
      S.deleteWall(sel.wi);
      S.syncSceneObjectsToEngine();
      S.renderLayers();
      if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
      return;
    }
    if (sel && sel.type === 'shape') {
      const __b = S.vectorSnapshot();
      state.shapes.splice(sel.idx, 1);
      state.sel = null;
      S.syncSelectionManagerFromLegacy('programmatic');
      S.showSelectBar(null);
      S.syncSceneObjectsToEngine();
      S.refreshMeasurements();
      S.recordVec(__b);
      S.scheduleAutosave();
      S.renderLayers();
      if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
      return;
    }
    if (S.layerEngine && state._panelSelectedObjectId) {
      const obj = S.layerEngine.getObject(state._panelSelectedObjectId);
      if (!obj) return;
      const ref = obj.legacyRef;
      if (ref && ref.kind === 'shape') {
        const idx = (state.shapes || []).findIndex((s: any) => s && s.id === ref.id);
        if (idx >= 0) {
          state.sel = { type: 'shape', idx, id: ref.id };
          S.deleteSelectedElement();
          return;
        }
      }
      if (ref && ref.kind === 'wall') {
        const wi = (state.walls || []).findIndex((w: any) => w && w.id === ref.id);
        if (wi >= 0) {
          S.deleteWall(wi);
          S.syncSceneObjectsToEngine();
          S.renderLayers();
          return;
        }
      }
      if (ref && ref.kind === 'wall-room') {
        const room = (state.wallRooms || []).find((r: any) => r && r.id === ref.id);
        const ids = room ? (room.wallIds || []).slice() : [];
        ids.forEach((wid: string) => {
          const wi = (state.walls || []).findIndex((w: any) => w && w.id === wid);
          if (wi >= 0) S.deleteWall(wi);
        });
        state._panelSelectedObjectId = null;
        S.syncSceneObjectsToEngine();
        S.renderLayers();
        return;
      }
      if (ref && ref.kind === 'wall-face') {
        S.showHint('Hide this wall with the eye icon, or delete the Room to remove all walls');
        return;
      }
      if ((obj.type === 'group' || obj.type === 'room') && !obj.legacyRef) {
        S.layerEngine.deleteObjects([obj.id]);
        state._panelSelectedObjectId = null;
        S.renderLayers();
      }
    }
  }

  /* ── Vector element transform (move / scale / rotate) ── */
  S.getSelectedVecEntity = function getSelectedVecEntity() {
    const sel: any = state.sel || (state.vecXform && state.vecXform.sel) || null;
    if (!sel) return null;
    if (sel.type === 'wall') {
      let wi = typeof sel.wi === 'number' ? sel.wi : -1;
      if (wi < 0 && sel.id) wi = (state.walls || []).findIndex((w: any) => w && w.id === sel.id);
      if (wi >= 0 && state.walls[wi]) {
        const ent: any = { kind: 'wall', wall: state.walls[wi], wi };
        if (typeof sel.seg === 'number') ent.seg = sel.seg;
        return ent;
      }
    }
    if (sel.type === 'shape') {
      let idx = typeof sel.idx === 'number' ? sel.idx : -1;
      if (idx < 0 && sel.id) idx = (state.shapes || []).findIndex((s: any) => s && s.id === sel.id);
      if (idx >= 0 && state.shapes[idx]) return { kind: 'shape', shape: state.shapes[idx], idx };
    }
    return null;
  }

  /** Write one segment's endpoints back into a wall polyline (keeps closed-loop seal). */
  S.applyWallSegmentGeom = function applyWallSegmentGeom(wall: any, seg: any, a: any, b: any) {
    if (!wall || typeof seg !== 'number') return;
    const pts = (wall.pts || []).map((p: any) => ({ x: p.x, y: p.y }));
    const n = pts.length;
    if (seg < 0 || seg + 1 >= n) return;
    const closed = n > 2 && pts[0].x === pts[n - 1].x && pts[0].y === pts[n - 1].y;
    pts[seg] = { x: a.x, y: a.y };
    pts[seg + 1] = { x: b.x, y: b.y };
    if (closed) {
      if (seg === 0) pts[n - 1] = { x: a.x, y: a.y };
      if (seg + 1 === n - 1) {
        pts[0] = { x: b.x, y: b.y };
        pts[n - 1] = { x: b.x, y: b.y };
      }
    }
    wall.pts = pts;
  };

  /** Erase previously baked raster ink for a vector shape so transforms don't leave ghosts. */
  S.eraseShapeRasterInk = function eraseShapeRasterInk(shape: any, geom: any) {
    if (!shape) return;
    const layers = state.layers || [];
    const width = Math.max(2, (shape.width || 2) + 4);
    const g = geom || shape;
    layers.forEach((layer: any) => {
      if (!layer || !layer.ctx) return;
      const ctx = layer.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#000';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (shape.kind === 'ellipse' || (g.rx != null && g.ry != null)) {
        const cx = g.cx, cy = g.cy, rx = g.rx, ry = g.ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        const pts = g.pts || shape.pts || [];
        if (pts.length < 2) { ctx.restore(); return; }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (shape.closed || shape.kind === 'rect') {
          ctx.closePath();
          ctx.fill();
        }
        ctx.stroke();
      }
      ctx.restore();
      if (typeof S.saveSnapshot === 'function') S.saveSnapshot(layer);
    });
  };

  /** Erase baked wall centerline ink (legacy commit used to stroke onto the sketch canvas). */
  S.eraseWallRasterInk = function eraseWallRasterInk(wall: any, geom: any) {
    if (!wall) return;
    const pts = (geom && geom.pts) || wall.pts || [];
    if (pts.length < 2) return;
    const width = Math.max(6, (state.size || 2) + 6);
    (state.layers || []).forEach((layer: any) => {
      if (!layer || !layer.ctx) return;
      const ctx = layer.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
      if (typeof S.saveSnapshot === 'function') S.saveSnapshot(layer);
    });
  };
  S.entityCentroid = function entityCentroid(ent: any) {
    if (!ent) return { x: 0, y: 0 };
    if (ent.kind === 'wall') {
      const pts = ent.wall.pts || [];
      if (typeof ent.seg === 'number' && pts[ent.seg] && pts[ent.seg + 1]) {
        const a = pts[ent.seg], b = pts[ent.seg + 1];
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
      if (!pts.length) return { x: 0, y: 0 };
      let sx = 0, sy = 0;
      pts.forEach((p: any) => { sx += p.x; sy += p.y; });
      return { x: sx / pts.length, y: sy / pts.length };
    }
    const sh = ent.shape;
    if (sh.kind === 'ellipse') return { x: sh.cx, y: sh.cy };
    const pts = sh.pts || [];
    if (!pts.length) return { x: 0, y: 0 };
    let sx = 0, sy = 0;
    pts.forEach((p: any) => { sx += p.x; sy += p.y; });
    return { x: sx / pts.length, y: sy / pts.length };
  }
  S.snapshotEntityGeom = function snapshotEntityGeom(ent: any) {
    if (ent.kind === 'wall') {
      const pts = (ent.wall.pts || []).map((p: any) => ({ x: p.x, y: p.y }));
      // Legacy polylines only — 2-pt walls fall through to the whole-wall branch below
      if (pts.length > 2 && typeof ent.seg === 'number' && pts[ent.seg] && pts[ent.seg + 1]) {
        return {
          mode: 'segment',
          seg: ent.seg,
          a: { x: pts[ent.seg].x, y: pts[ent.seg].y },
          b: { x: pts[ent.seg + 1].x, y: pts[ent.seg + 1].y },
        };
      }
      // Independent Keyplan walls are 2-pt segments — treat whole wall as one segment
      if (pts.length >= 2) {
        return {
          mode: 'segment',
          seg: 0,
          a: { x: pts[0].x, y: pts[0].y },
          b: { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y },
          pts,
          bulge: ent.wall.bulge || 0,
          // Neighbours sharing each end, so the room stretches with the wall.
          links: typeof S.captureWallJunctionLinks === 'function'
            ? S.captureWallJunctionLinks(ent.wall)
            : null,
        };
      }
      return { pts };
    }
    const sh = ent.shape;
    if (sh.kind === 'ellipse') return { cx: sh.cx, cy: sh.cy, rx: sh.rx, ry: sh.ry };
    return { pts: (sh.pts || []).map((p: any) => ({ x: p.x, y: p.y })) };
  }
  S.applyEntityGeom = function applyEntityGeom(ent: any, geom: any) {
    if (ent.kind === 'wall') {
      if (geom && geom.mode === 'segment' && typeof geom.seg === 'number' && geom.a && geom.b) {
        S.applyWallSegmentGeom(ent.wall, geom.seg, geom.a, geom.b);
        return;
      }
      ent.wall.pts = geom.pts.map((p: any) => ({ x: p.x, y: p.y }));
      return;
    }
    const sh = ent.shape;
    if (sh.kind === 'ellipse') {
      sh.cx = geom.cx; sh.cy = geom.cy; sh.rx = geom.rx; sh.ry = geom.ry;
    } else {
      sh.pts = geom.pts.map((p: any) => ({ x: p.x, y: p.y }));
    }
  }
  S.beginVecXform = function beginVecXform(mode: any) {
    const ent = S.getSelectedVecEntity();
    if (!ent) { S.showHint('Select a wall or shape first'); return; }
    const selSnapshot = state.sel
      ? { ...state.sel }
      : (ent.kind === 'shape'
        ? { type: 'shape', idx: ent.idx, id: ent.shape && ent.shape.id }
        : { type: 'wall', wi: ent.wi, id: ent.wall && ent.wall.id, seg: typeof ent.seg === 'number' ? ent.seg : null });
    const base = S.snapshotEntityGeom(ent);
    state.vecXform = {
      mode,
      origin: S.entityCentroid(ent),
      base,
      start: null,
      before: null,
      sel: selSnapshot,
      inkCleared: false,
      seg: typeof ent.seg === 'number' ? ent.seg : null,
    };
    // Switch to select without wiping the active shape/wall selection
    if (state.tool !== 'select' && typeof S.setTool === 'function') {
      state._preserveSelOnSetTool = true;
      S.setTool('select');
      state._preserveSelOnSetTool = false;
      state.sel = selSnapshot;
    } else {
      state.sel = selSnapshot;
    }
    // Drop any previously baked raster ink so the old outline/fill doesn't ghost.
    if (ent.kind === 'shape') {
      S.eraseShapeRasterInk(ent.shape, base);
      state.vecXform.inkCleared = true;
      if (typeof S.renderLayers === 'function') S.renderLayers();
    } else if (ent.kind === 'wall') {
      S.eraseWallRasterInk(ent.wall, base);
      state.vecXform.inkCleared = true;
      if (typeof S.renderLayers === 'function') S.renderLayers();
    }
    const labels: Record<string, string> = {
      move: 'Drag to move',
      scale: ent.kind === 'wall' ? 'Drag from the wall end you want to resize' : 'Drag to scale',
      rotate: 'Drag to rotate',
    };
    S.showHint((labels[mode] || 'Transform') + ' · Esc to cancel');
    S.showSelectBar(ent.kind === 'wall' ? 'wall' : 'shape');
    if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
  }
  S.cancelVecXform = function cancelVecXform() {
    state.vecXform = null;
    if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
  }
  S.applyVecXformAt = function applyVecXformAt(p: any) {
    const xf = state.vecXform;
    if (!xf || !xf.start) return;
    const ent = S.getSelectedVecEntity();
    if (!ent) return;
    // Clear baked raster ghost once at the start of the drag (original ink footprint).
    if (!xf.inkCleared) {
      if (ent.kind === 'shape') S.eraseShapeRasterInk(ent.shape, xf.base);
      else if (ent.kind === 'wall') S.eraseWallRasterInk(ent.wall, xf.base);
      xf.inkCleared = true;
    }
    const o = xf.origin;
    const base = xf.base;
    const segMode = ent.kind === 'wall' && base && base.mode === 'segment' && typeof base.seg === 'number';

    const mapSeg = (xa: any, ya: any, xb: any, yb: any) => {
      S.applyEntityGeom(ent, {
        mode: 'segment',
        seg: base.seg,
        a: { x: xa, y: ya },
        b: { x: xb, y: yb },
      });
    };

    if (xf.mode === 'move') {
      const dx = p.x - xf.start.x, dy = p.y - xf.start.y;
      if (ent.kind === 'wall' && typeof S.applyWallNormalMove === 'function') {
        const ba = (base.mode === 'segment' && base.a) ? base.a : (base.pts && base.pts[0]);
        const bb = (base.mode === 'segment' && base.b) ? base.b : (base.pts && base.pts[base.pts.length - 1]);
        if (ba && bb) S.applyWallNormalMove(ent.wall, ba, bb, dx, dy, base.links);
      } else if (segMode) {
        mapSeg(base.a.x + dx, base.a.y + dy, base.b.x + dx, base.b.y + dy);
      } else if (ent.kind === 'wall' || (ent.shape && ent.shape.kind !== 'ellipse')) {
        S.applyEntityGeom(ent, {
          pts: base.pts.map((q: any) => ({ x: q.x + dx, y: q.y + dy })),
        });
      } else {
        S.applyEntityGeom(ent, { cx: base.cx + dx, cy: base.cy + dy, rx: base.rx, ry: base.ry });
      }
    } else if (xf.mode === 'scale') {
      if (ent.kind === 'wall' && typeof S.applyWallTangentScale === 'function') {
        const ba = (base.mode === 'segment' && base.a) ? base.a : (base.pts && base.pts[0]);
        const bb = (base.mode === 'segment' && base.b) ? base.b : (base.pts && base.pts[base.pts.length - 1]);
        if (ba && bb) S.applyWallTangentScale(ent.wall, ba, bb, o, xf.start, p, base.links);
      } else {
        const d0 = Math.hypot(xf.start.x - o.x, xf.start.y - o.y) || 1;
        const d1 = Math.hypot(p.x - o.x, p.y - o.y);
        const s = Math.max(0.05, d1 / d0);
        if (segMode) {
          mapSeg(
            o.x + (base.a.x - o.x) * s,
            o.y + (base.a.y - o.y) * s,
            o.x + (base.b.x - o.x) * s,
            o.y + (base.b.y - o.y) * s,
          );
        } else if (ent.kind === 'wall' || (ent.shape && ent.shape.kind !== 'ellipse')) {
          S.applyEntityGeom(ent, {
            pts: base.pts.map((q: any) => ({
              x: o.x + (q.x - o.x) * s,
              y: o.y + (q.y - o.y) * s,
            })),
          });
        } else {
          S.applyEntityGeom(ent, { cx: base.cx, cy: base.cy, rx: base.rx * s, ry: base.ry * s });
        }
      }
    } else if (xf.mode === 'rotate') {
      if (ent.kind === 'wall' && ent.wall && ent.wall.roomId) {
        S.showHint('Rotate disabled for room walls — move or scale instead');
        return;
      }
      const a0 = Math.atan2(xf.start.y - o.y, xf.start.x - o.x);
      const a1 = Math.atan2(p.y - o.y, p.x - o.x);
      const da = a1 - a0;
      const cos = Math.cos(da), sin = Math.sin(da);
      const rot = (q: any) => {
        const dx = q.x - o.x, dy = q.y - o.y;
        return { x: o.x + dx * cos - dy * sin, y: o.y + dx * sin + dy * cos };
      };
      if (segMode) {
        const na = rot(base.a), nb = rot(base.b);
        mapSeg(na.x, na.y, nb.x, nb.y);
      } else if (ent.kind === 'wall' || (ent.shape && ent.shape.kind !== 'ellipse')) {
        S.applyEntityGeom(ent, {
          pts: base.pts.map((q: any) => rot(q)),
        });
      } else {
        S.applyEntityGeom(ent, { cx: base.cx, cy: base.cy, rx: base.rx, ry: base.ry });
        S.showHint('Rotate works on rectangles / polygons / walls');
      }
    }
    if (ent.kind === 'wall') {
      S.syncWallsToMasses();
      // Keep room membership live but leave the panel rebuild to drag end.
      if (typeof S.reconcileWallRooms === 'function') S.reconcileWallRooms({ skipLayerSync: true });
    }
    S.refreshMeasurements();
  }
  S.addBackgroundImageToSelection = function addBackgroundImageToSelection() {
    const ent = S.getSelectedVecEntity();
    if (!ent) { S.showHint('Select a wall or shape first'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev: any) => {
        const dataUrl = ev.target.result;
        const img = new Image();
        img.onload = () => {
          const __b = S.vectorSnapshot();
          if (ent.kind === 'shape') {
            ent.shape.bgImage = dataUrl;
            ent.shape._bgImg = img;
          } else {
            ent.wall.bgImage = dataUrl;
            ent.wall._bgImg = img;
          }
          S.recordVec(__b);
          S.scheduleAutosave();
          S.refreshMeasurements();
          S.showHint('Background image added — use Move / Scale / Rotate to transform');
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
    input.click();
  }

  S.closeLayerMenu = function closeLayerMenu() {
    if (S.layerMenuEl) { S.layerMenuEl.remove(); S.layerMenuEl = null; }
    document.removeEventListener('pointerdown', S.closeLayerMenuOnOutside, true);
  }
  S.closeLayerMenuOnOutside = function closeLayerMenuOnOutside(e: any) {
    if (S.layerMenuEl && !S.layerMenuEl.contains(e.target)) S.closeLayerMenu();
  }
  S.clientToCanvas = function clientToCanvas(clientX: any, clientY: any) {
    const rect = S.paper.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * S.doc.wPx;
    const y = ((clientY - rect.top) / rect.height) * S.doc.hPx;
    return { x, y };
  }


}
