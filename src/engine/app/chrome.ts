/* Chrome / HUD controls — shared scope S */
import { S } from "./scope";

export function initChrome() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);

  /* =================== PUCK CONTROLS =================== */
  $el('puck-size-slider').addEventListener('input', (e: any) => {
    state.size = parseFloat(e.target.value);
    $el('puck-size-val').textContent = state.size;
    S.updatePreview();
  });
  $el('puck-alpha-slider').addEventListener('input', (e: any) => {
    state.alpha = parseInt(e.target.value) / 100;
    $el('puck-alpha-val').textContent = e.target.value;
    S.updatePreview();
  });
  $el('puck-stab-slider').addEventListener('input', (e: any) => {
    state.stabilizer = parseInt(e.target.value) / 100;
    $el('puck-stab-val').textContent = e.target.value;
  });

  S.updatePreview = function updatePreview() {
    const svg = $el('puck-preview-svg');
    svg.innerHTML = '';
    const svgns = 'http://www.w3.org/2000/svg';
    const path = document.createElementNS(svgns, 'path');
    let d = 'M 2 10';
    for (let i = 0; i < 6; i++) {
      const x = 2 + i * 5;
      const y = 10 + Math.sin(i * 0.9) * 4;
      d += ` L ${x} ${y}`;
    }
    path.setAttribute('d', d);
    path.setAttribute('stroke', state.color);
    path.setAttribute('stroke-width', String(Math.max(1, Math.min(8, state.size * 0.4))));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', String(state.alpha));
    svg.appendChild(path);
  }

  /* =================== LAYER PANEL CONTROLS =================== */
  S.syncActivePanelControls = function syncActivePanelControls() {
    const sizeRow = $el('shape-size-row');
    const sizeInp = $el('shape-size');
    const sizeVal = $el('shape-size-val');
    const sel: any = state.sel;
    const panelObj = S.layerEngine && state._panelSelectedObjectId
      ? S.layerEngine.getObject(state._panelSelectedObjectId)
      : null;
    const shapeSel = sel && sel.type === 'shape' ? state.shapes[sel.idx]
      : (panelObj && panelObj.legacyRef && panelObj.legacyRef.kind === 'shape'
        ? (state.shapes || []).find((s: any) => s && s.id === panelObj.legacyRef.id)
        : null);
    if (sizeRow) sizeRow.style.display = shapeSel ? 'flex' : 'none';
    if (shapeSel) {
      const op = typeof shapeSel.opacity === 'number' ? shapeSel.opacity
        : (panelObj && typeof panelObj.opacity === 'number' ? panelObj.opacity : 1);
      $el('layer-opacity').value = Math.round(op * 100);
      $el('layer-opacity-val').textContent = Math.round(op * 100) + '%';
      if (sizeInp) sizeInp.value = '100';
      if (sizeVal) sizeVal.textContent = '100%';
    }
  };

  $el('layer-opacity').addEventListener('input', (e: any) => {
    const v = parseInt(e.target.value) / 100;
    const sel: any = state.sel;
    const panelObj = S.layerEngine && state._panelSelectedObjectId
      ? S.layerEngine.getObject(state._panelSelectedObjectId)
      : null;
    // Prefer selected shape / panel object opacity when an object is active.
    if (sel && sel.type === 'shape' && state.shapes[sel.idx]) {
      state.shapes[sel.idx].opacity = v;
      if (panelObj && panelObj.legacyRef && panelObj.legacyRef.kind === 'shape') {
        S.layerEngine.setObjectOpacity(panelObj.id, v);
      } else if (state.shapes[sel.idx].id && typeof S.findEngineObjectByLegacy === 'function') {
        const eng = S.findEngineObjectByLegacy((r: any) => r.kind === 'shape' && r.id === state.shapes[sel.idx].id);
        if (eng) S.layerEngine.setObjectOpacity(eng.id, v);
      }
      $el('layer-opacity-val').textContent = e.target.value + '%';
      S.refreshMeasurements();
      S.scheduleAutosave();
      return;
    }
    if (panelObj && panelObj.legacyRef && panelObj.legacyRef.kind === 'shape') {
      S.layerEngine.setObjectOpacity(panelObj.id, v);
      const sh = (state.shapes || []).find((s: any) => s && s.id === panelObj.legacyRef.id);
      if (sh) sh.opacity = v;
      $el('layer-opacity-val').textContent = e.target.value + '%';
      S.refreshMeasurements();
      S.scheduleAutosave();
      return;
    }
    const l = S.activeLayer();
    if (!l) return;
    l.opacity = v;
    if (S.layerEngine && l.engineId) S.layerEngine.setLayerOpacity(l.engineId, v);
    S.updateLayerOrder();
    $el('layer-opacity-val').textContent = e.target.value + '%';
    S.renderLayers();
  });

  const shapeSizeEl = $el('shape-size');
  if (shapeSizeEl) {
    shapeSizeEl.addEventListener('input', (e: any) => {
      const pct = parseInt(e.target.value, 10);
      $el('shape-size-val').textContent = pct + '%';
      const sel: any = state.sel;
      let sh: any = sel && sel.type === 'shape' ? state.shapes[sel.idx] : null;
      if (!sh && S.layerEngine && state._panelSelectedObjectId) {
        const obj = S.layerEngine.getObject(state._panelSelectedObjectId);
        if (obj && obj.legacyRef && obj.legacyRef.kind === 'shape') {
          sh = (state.shapes || []).find((s: any) => s && s.id === obj.legacyRef.id) || null;
          if (sh) {
            const idx = state.shapes.indexOf(sh);
            state.sel = { type: 'shape', idx, id: sh.id };
          }
        }
      }
      if (!sh) return;
      const factor = pct / 100;
      if (!sh._sizeBase) {
        if (sh.kind === 'ellipse') {
          sh._sizeBase = { rx: sh.rx, ry: sh.ry, cx: sh.cx, cy: sh.cy };
        } else if (sh.pts) {
          const cx = sh.pts.reduce((a: any, p: any) => a + p.x, 0) / sh.pts.length;
          const cy = sh.pts.reduce((a: any, p: any) => a + p.y, 0) / sh.pts.length;
          sh._sizeBase = { pts: sh.pts.map((p: any) => ({ x: p.x, y: p.y })), cx, cy };
        }
      }
      const base: any = sh._sizeBase;
      if (!base) return;
      const __b = S.vectorSnapshot();
      if (sh.kind === 'ellipse') {
        sh.rx = base.rx * factor;
        sh.ry = base.ry * factor;
      } else if (base.pts) {
        sh.pts = base.pts.map((p: any) => ({
          x: base.cx + (p.x - base.cx) * factor,
          y: base.cy + (p.y - base.cy) * factor,
        }));
      }
      S.refreshMeasurements();
      S.recordVec(__b, true);
      S.scheduleAutosave();
    });
    shapeSizeEl.addEventListener('change', () => {
      const sel: any = state.sel;
      const sh = sel && sel.type === 'shape' ? state.shapes[sel.idx] : null;
      if (sh) delete sh._sizeBase;
      shapeSizeEl.value = '100';
      $el('shape-size-val').textContent = '100%';
    });
  }
  $el('layer-trace').addEventListener('input', (e: any) => {
    const v = parseInt(e.target.value) / 100;
    const l = S.activeLayer();
    if (!l) return;
    l.trace = v;
    if (S.layerEngine && l.engineId) {
      const meta = S.layerEngine.getLayer(l.engineId);
      if (meta) meta.trace = v;
    }
    S.updateLayerOrder();
    $el('layer-trace-val').textContent = e.target.value + '%';
    S.renderLayers();
  });
  $el('layer-blend').addEventListener('change', (e: any) => {
    const l = S.activeLayer();
    if (!l) return;
    l.blendMode = e.target.value;
    if (S.layerEngine && l.engineId) S.layerEngine.setLayerBlendMode(l.engineId, e.target.value);
    S.updateLayerOrder();
    S.renderLayers();
  });

  /* =================== TOP ACTIONS =================== */
  $el('btn-undo').addEventListener('click', S.undo);
  // --- Pencil-only mode: reject finger/palm on the drawing surfaces *while the pen is down*
  // (that's when a palm yanks the stroke). When no pen is touching, finger gestures —
  // 2-finger undo, 3-finger redo, pinch pan/zoom — pass through untouched. ---
  S.stylusOnly = localStorage.getItem('nm-stylus-only') === '1';
  S._penDown = 0;
  document.addEventListener('pointerdown', (e: any) => { if (e.pointerType === 'pen') S._penDown++; }, true);
  document.addEventListener('pointerup',   (e: any) => { if (e.pointerType === 'pen') S._penDown = Math.max(0, S._penDown - 1); }, true);
  document.addEventListener('pointercancel', (e: any) => { if (e.pointerType === 'pen') S._penDown = Math.max(0, S._penDown - 1); }, true);
  S.updateStylusBtn = function updateStylusBtn() { const b = $el('btn-stylus'); if (b) b.classList.toggle('active', S.stylusOnly); }
  S._stylusGuard = function _stylusGuard(e: any) {
    if (!S.stylusOnly || e.pointerType !== 'touch' || S._penDown === 0) return;   // no pen down → let finger gestures through
    const t = e.target;
    if (t && t.closest && t.closest('#paper, #massing-canvas, #fe-canvas')) { e.stopPropagation(); e.preventDefault(); }
  };
  ['pointerdown', 'pointermove', 'pointerup'].forEach((ev: any) => document.addEventListener(ev, S._stylusGuard, true));
  $el('btn-stylus').addEventListener('click', () => {
    S.stylusOnly = !S.stylusOnly;
    localStorage.setItem('nm-stylus-only', S.stylusOnly ? '1' : '0');
    S.updateStylusBtn();
    S.showHint(S.stylusOnly ? 'Pencil-only ON — palm ignored while drawing · 2-finger undo still works' : 'Pencil-only OFF — touch enabled');
  });
  S.updateStylusBtn();
  $el('btn-redo').addEventListener('click', S.redo);
  $el('btn-grid').addEventListener('click', () => {
    // Toggle the grid; if turning on, also default to square if currently off
    state.showGrid = !state.showGrid;
    if (state.showGrid && state.gridType === 'off') state.gridType = 'square';
    S.drawDocGrid();
  });

  /* =================================================================
     DOCUMENT GRID — canvas-rendered, supports architectural styles
     ================================================================= */
  S.gridCanvas = $el('grid-canvas');
  S.gridCtx = (S.gridCanvas as any).getContext('2d') as any;

  // Grid cell size: millimetres on the sheet → document pixels.
  // Predictable regardless of drawing scale (a 20mm grid is 20mm on paper).
  S.mmToDocPx = function mmToDocPx(mm: any) {
    return mm / 25.4 * S.doc.dpi;
  }

  S.drawDocGrid = function drawDocGrid() {
    (S.gridCanvas as any).width = S.doc.wPx;
    (S.gridCanvas as any).height = S.doc.hPx;
    const show = state.showGrid && state.gridType !== 'off';
    (S.gridCanvas as any).style.display = show ? 'block' : 'none';
    if (!show) return;

    const ctx: any = S.gridCtx;
    ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    const op = state.gridOpacity;
    let spacing = Math.max(8, S.mmToDocPx(state.gridSpacingMM));
    // Line widths scaled to document resolution (so they survive the display downscale)
    const minorW = Math.max(1.5, S.doc.wPx / 1400);
    const majorW = minorW * 2.2;
    const minorColor = `rgba(40,70,140,${op * 0.5})`;
    const majorColor = `rgba(40,70,140,${op})`;

    if (state.gridType === 'square') {
      ctx.strokeStyle = majorColor;
      ctx.lineWidth = minorW;
      for (let x = 0; x <= S.doc.wPx; x += spacing) S.line(ctx, x, 0, x, S.doc.hPx);
      for (let y = 0; y <= S.doc.hPx; y += spacing) S.line(ctx, 0, y, S.doc.wPx, y);
    } else if (state.gridType === 'arch') {
      // Minor lines, with every Nth line major (heavier) — classic drafting grid
      const major = state.gridMajor;
      let i = 0;
      for (let x = 0; x <= S.doc.wPx; x += spacing, i++) {
        ctx.strokeStyle = (i % major === 0) ? majorColor : minorColor;
        ctx.lineWidth = (i % major === 0) ? majorW : minorW;
        S.line(ctx, x, 0, x, S.doc.hPx);
      }
      i = 0;
      for (let y = 0; y <= S.doc.hPx; y += spacing, i++) {
        ctx.strokeStyle = (i % major === 0) ? majorColor : minorColor;
        ctx.lineWidth = (i % major === 0) ? majorW : minorW;
        S.line(ctx, 0, y, S.doc.wPx, y);
      }
    } else if (state.gridType === 'dot') {
      ctx.fillStyle = majorColor;
      const r = Math.max(1.2, minorW);
      for (let x = spacing / 2; x < S.doc.wPx; x += spacing) {
        for (let y = spacing / 2; y < S.doc.hPx; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (state.gridType === 'column') {
      // Structural column grid: heavy lines at MAJOR spacing only, with
      // bubble labels A,B,C across the top and 1,2,3 down the left.
      const colSpacing = spacing * state.gridMajor;
      ctx.strokeStyle = majorColor;
      ctx.lineWidth = majorW;
      ctx.setLineDash([majorW * 3, majorW * 2]);
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let ci = 0;
      for (let x = colSpacing; x < S.doc.wPx; x += colSpacing, ci++) {
        S.line(ctx, x, 0, x, S.doc.hPx);
        S.gridBubble(ctx, x, colSpacing * 0.35, letters[ci % 26], majorColor);
      }
      let ri = 0;
      for (let y = colSpacing; y < S.doc.hPx; y += colSpacing, ri++) {
        S.line(ctx, 0, y, S.doc.wPx, y);
        S.gridBubble(ctx, colSpacing * 0.35, y, String(ri + 1), majorColor);
      }
      ctx.setLineDash([]);
    }
  }

  S.line = function line(ctx: any, x1: any, y1: any, x2: any, y2: any) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  S.gridBubble = function gridBubble(ctx: any, cx: any, cy: any, label: any, color: any) {
    const r = Math.max(28, S.doc.wPx / 70);
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, S.doc.wPx / 900);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `700 ${r * 1.1}px Archivo, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);
    ctx.restore();
  }

  // Grid popover wiring — portal to body + pin top-right near the overflow menu.
  // Inside #canvas-area (overflow:hidden, left:70px/bottom:80px) it was easy to miss
  // and could sit under other chrome.
  S.gridPopover = $el('grid-popover');
  S.positionGridPopover = function positionGridPopover() {
    if (!S.gridPopover) return;
    if (S.gridPopover.parentElement !== document.body) {
      document.body.appendChild(S.gridPopover);
    }
    S.gridPopover.style.position = 'fixed';
    S.gridPopover.style.left = 'auto';
    S.gridPopover.style.right = '12px';
    S.gridPopover.style.top = '52px';
    S.gridPopover.style.bottom = 'auto';
    S.gridPopover.style.zIndex = '2200';
  };
  $el('ovf-grid').addEventListener('click', (e: any) => {
    e.stopPropagation();
    S.positionGridPopover();
    S.gridPopover.classList.add('show');
    if (S.overflowPanel) S.overflowPanel.classList.remove('show');
    S.syncGridUI();
    if (typeof S.syncOverflowStates === 'function') S.syncOverflowStates();
  }, true);

  S.syncGridUI = function syncGridUI() {
    $all('#grid-popover [data-grid]').forEach((b: any) =>
      b.classList.toggle('active', b.dataset.grid === (state.showGrid ? state.gridType : 'off')));
    $el('grid-spacing').value = state.gridSpacingMM;
    $el('grid-spacing-v').textContent = state.gridSpacingMM + 'mm';
    $el('grid-major').value = state.gridMajor;
    $el('grid-major-v').textContent = '×' + state.gridMajor;
    $el('grid-opacity').value = Math.round(state.gridOpacity * 100);
    $el('grid-opacity-v').textContent = Math.round(state.gridOpacity * 100) + '%';
    $el('grid-major-row').style.display =
      (state.gridType === 'arch' || state.gridType === 'column') ? 'flex' : 'none';
  };

  $all('#grid-popover [data-grid]').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.grid;
      if (g === 'off') { state.showGrid = false; }
      else { state.showGrid = true; state.gridType = g; }
      S.syncGridUI();
      S.drawDocGrid();
      if (typeof S.syncOverflowStates === 'function') S.syncOverflowStates();
      if (typeof S.scheduleAutosave === 'function') S.scheduleAutosave();
    });
  });
  $el('grid-spacing').addEventListener('input', (e: any) => {
    state.gridSpacingMM = parseInt(e.target.value);
    $el('grid-spacing-v').textContent = state.gridSpacingMM + 'mm';
    // Turning the spacing knob implies the user wants a visible grid.
    if (!state.showGrid || state.gridType === 'off') {
      state.showGrid = true;
      if (state.gridType === 'off') state.gridType = 'square';
      S.syncGridUI();
      if (typeof S.syncOverflowStates === 'function') S.syncOverflowStates();
    }
    S.drawDocGrid();
    if (typeof S.scheduleAutosave === 'function') S.scheduleAutosave();
  });
  $el('grid-major').addEventListener('input', (e: any) => {
    state.gridMajor = parseInt(e.target.value);
    $el('grid-major-v').textContent = '×' + state.gridMajor;
    S.drawDocGrid();
  });
  $el('grid-opacity').addEventListener('input', (e: any) => {
    state.gridOpacity = parseInt(e.target.value) / 100;
    $el('grid-opacity-v').textContent = e.target.value + '%';
    S.drawDocGrid();
  });
  S.snapToggleEl = $el('snap-toggle');
  if (S.snapToggleEl) S.snapToggleEl.addEventListener('change', (e: any) => {
    state.snapEnabled = e.target.checked;
    S.showHint(state.snapEnabled ? 'Snap on · vertices stick to corners & grid' : 'Snap off');
  });
  $el('btn-scale').addEventListener('click', S.startScale);
  $el('btn-measures').addEventListener('click', () => {
    state.showMeasurements = !state.showMeasurements;
    const btn = $el('btn-measures');
    btn.style.background = state.showMeasurements ? '' : 'var(--ink)';
    btn.style.color = state.showMeasurements ? '' : 'var(--paper)';
    S.refreshMeasurements();
    S.showHint(state.showMeasurements ? 'Measurements visible' : 'Measurements hidden');
  });
  $el('btn-clear-measures').addEventListener('click', () => {
    if (state.measurements.length === 0) {
      S.showHint('No measurements to clear');
      return;
    }
    if (confirm(`Clear all ${state.measurements.length} measurement${state.measurements.length === 1 ? '' : 's'}?`)) {
      state.measurements = [];
      S.refreshMeasurements();
      S.showHint('Measurements cleared');
    }
  });
  $el('btn-import-image').addEventListener('click', () => S.fileInputImportImage.click());
  $el('btn-add-image-layer').addEventListener('click', () => S.fileInputImportImage.click());
  $el('btn-add-layer').addEventListener('click', () => S.createLayer(undefined, { layerKind: 'sketch' }));

  S.fileInputImportImage.addEventListener('change', (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    S.importImageAsLayer(file);
    e.target.value = '';
  });

  $el('btn-export').addEventListener('click', async () => {
    const out = document.createElement('canvas');
    out.width = S.doc.wPx; out.height = S.doc.hPx;
    const octx = out.getContext('2d') as any;
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, S.doc.wPx, S.doc.hPx);
    state.layers.forEach((l: any) => {
      if (!l.visible) return;
      if (l.imageCanvas && !l.imageBaked) {
        octx.globalAlpha = l.opacity;
        octx.drawImage(l.imageCanvas, 0, 0);
      }
      octx.globalAlpha = l.opacity;
      octx.drawImage(l.canvas, 0, 0);
    });
    octx.globalAlpha = 1;

    // SketchTrude wordmark + date/time stamp — bottom left
    try {
      const margin = Math.round(S.doc.wPx * 0.018);
      const fs = Math.max(11, Math.round(S.doc.wPx * 0.0072));
      const now = new Date();
      const pad = (n: any) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const stampText = ['SketchTrude', dateStr, timeStr].join('    ·    ');

      octx.save();
      octx.font = `600 ${fs}px 'JetBrains Mono', ui-monospace, monospace`;
      octx.textAlign = 'left';
      octx.textBaseline = 'alphabetic';
      octx.fillStyle = 'rgba(10,10,10,0.62)';
      octx.fillText(stampText, margin, S.doc.hPx - margin);
      octx.restore();
    } catch(e) { /* continue without stamp */ }

    out.toBlob((blob: any) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `SketchTrude-${new Date().toISOString().slice(0,10)}.png`;
      a.click();
    }, 'image/png');
    S.showHint('Exported · SketchTrude · date');
  });

  /* =================== ZOOM CONTROLS =================== */
  S.updateZoomDisplay = function updateZoomDisplay() {
    const el = $el('zoom-level');
    if (!el) return;
    if (typeof S.massing !== 'undefined' && S.massing.active) {
      el.textContent = Math.round(S.massing.cam.scale) + '%';
    } else {
      el.textContent = Math.round(state.zoom * 100) + '%';
    }
  }

  S.handleZoomIn = function handleZoomIn() {
    if (S.massing.active) {
      S.massing.cam.scale = Math.max(6, Math.min(160, S.massing.cam.scale * 1.08));
      S.renderMassing();
      S.updateZoomDisplay();
      return;
    }
    state.zoom = ((window as any).StudioHelpers ? (window as any).StudioHelpers.zoomIn(state.zoom) : Math.min(8, state.zoom * 1.25));
    S.applyStageTransform();
  }

  S.handleZoomOut = function handleZoomOut() {
    if (S.massing.active) {
      S.massing.cam.scale = Math.max(6, Math.min(160, S.massing.cam.scale / 1.08));
      S.renderMassing();
      S.updateZoomDisplay();
      return;
    }
    state.zoom = ((window as any).StudioHelpers ? (window as any).StudioHelpers.zoomOut(state.zoom) : Math.max(0.2, state.zoom / 1.25));
    S.applyStageTransform();
  }

  S.handleZoomFit = function handleZoomFit() {
    if (S.massing.active) {
      S.massing.panX = 0;
      S.massing.panY = 0;
      const r = S.area.getBoundingClientRect();
      S.massing.cam.scale = Math.min(r.width, r.height) / 26;
      S.renderMassing();
      S.updateZoomDisplay();
      return;
    }
    S.fitToScreen();
  };

  $el('zoom-in').addEventListener('click', S.handleZoomIn);
  $el('zoom-out').addEventListener('click', S.handleZoomOut);
  $el('zoom-fit').addEventListener('click', S.handleZoomFit);

  /* =================== HINTS =================== */
  let hintTimer: any;
  S.showHint = function showHint(msg: any) {
    S.hintEl.textContent = msg;
    S.hintEl.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => S.hintEl.classList.remove('show'), 3000);
  }

  /* =================================================================
     ERROR BOUNDARY — one thrown error must never leave the canvas
     stuck mid-stroke. Catch, recover transient state, keep drawing alive.
     ================================================================= */
  S._lastErrToast = 0;
  S.recoverFromError = function recoverFromError(where: any, err: any) {
    console.error('[SketchTrude] recovered from error in', where, err);
    try {
      // Reset anything that could wedge the draw loop
      state.drawing = false;
      if (state.usingBuffer) {
        state.usingBuffer = false;
        if (typeof S.strokeCtx !== 'undefined') { S.strokeCtx.setTransform(1,0,0,1,0,0); S.strokeCtx.clearRect(0, 0, S.strokeCanvas.width, S.strokeCanvas.height); }
        if (typeof S.strokeCanvas !== 'undefined') { S.strokeCanvas.style.opacity = '0'; S.strokeCanvas.style.mixBlendMode = 'normal'; }
      }
      if (typeof S.massing !== 'undefined') S.massing.dragging = null;
      document.body.classList.remove('nm-drawing');
    } catch (_) { /* never throw from the handler */ }
    // Throttle the toast so a repeating error doesn't spam
    if (Date.now() - S._lastErrToast > 4000) {
      S._lastErrToast = Date.now();
      S.showHint('Something hiccuped — your work is safe. Carry on.');
    }
  }
  window.addEventListener('error', (e: any) => S.recoverFromError('window.error', e.error || e.message));
  window.addEventListener('unhandledrejection', (e: any) => S.recoverFromError('promise', e.reason));

  S.updateUI = function updateUI() {
    const l = S.activeLayer();
    $el('layer-opacity').value = Math.round(l.opacity * 100);
    $el('layer-opacity-val').textContent = Math.round(l.opacity * 100) + '%';
    $el('layer-trace').value = Math.round(l.trace * 100);
    $el('layer-trace-val').textContent = Math.round(l.trace * 100) + '%';
    S.refreshImageOverlay();
    S.refreshImageProps();
  }

  /* =================== IMAGE LAYER: PROPERTIES PANEL =================== */
  S.imageProps = $el('image-props');

  S.refreshImageProps = function refreshImageProps() {
    const l = S.activeLayer();
    const hasUnbaked = l && l.image && !l.imageBaked;
    S.imageProps.style.display = hasUnbaked ? 'block' : 'none';
    if (!hasUnbaked) return;
    const t = l.imageTransform;
    $el('img-x').value = Math.round(S.pxToMm(t.x));
    $el('img-y').value = Math.round(S.pxToMm(t.y));
    $el('img-w').value = Math.round(S.pxToMm(t.w));
    $el('img-h').value = Math.round(S.pxToMm(t.h));
    $el('img-rot').value = Math.round(t.rotation);
    $el('img-opacity').value = Math.round(l.imageOpacity * 100);
    $el('img-crop-toggle').classList.toggle('active', state.cropMode);
  }

  S.pxToMm = function pxToMm(px: any) { return px / S.doc.wPx * S.doc.wMM; }
  S.mmToPx = function mmToPx(mm: any) { return mm / S.doc.wMM * S.doc.wPx; }

  // Property input bindings
  S.bindImageInput = function bindImageInput(id: any, fn: any) {
    const el = $el(id);
    el.addEventListener('change', () => {
      const l = S.activeLayer();
      if (!l.image || l.imageBaked) return;
      fn(l, parseFloat(el.value));
      S.renderImageCanvas(l);
      S.refreshImageOverlay();
      S.renderLayers();
      l._dirty = true;
      l._savedBlob = null;
      S.scheduleAutosave();
    });
  }
  S.bindImageInput('img-x', (l: any, v: any) => l.imageTransform.x = S.mmToPx(v));
  S.bindImageInput('img-y', (l: any, v: any) => l.imageTransform.y = S.mmToPx(v));
  S.bindImageInput('img-w', (l: any, v: any) => l.imageTransform.w = Math.max(10, S.mmToPx(v)));
  S.bindImageInput('img-h', (l: any, v: any) => l.imageTransform.h = Math.max(10, S.mmToPx(v)));
  S.bindImageInput('img-rot', (l: any, v: any) => l.imageTransform.rotation = v);
  S.bindImageInput('img-opacity', (l: any, v: any) => l.imageOpacity = Math.max(0, Math.min(100, v)) / 100);

  $el('img-reset').addEventListener('click', () => {
    const l = S.activeLayer();
    if (!l.image || l.imageBaked) return;
    const aspect = l.pdf
      ? l.pdf.pageWidth / l.pdf.pageHeight
      : l.image.naturalWidth / l.image.naturalHeight;
    let w, h;
    if (S.doc.wPx / S.doc.hPx > aspect) {
      h = S.doc.hPx * 0.9; w = h * aspect;
    } else {
      w = S.doc.wPx * 0.9; h = w / aspect;
    }
    l.imageTransform = { x: S.doc.wPx/2, y: S.doc.hPx/2, w, h, rotation: 0 };
    l.imageOpacity = 1;
    l.imageCrop = null;
    S.renderImageCanvas(l);
    S.refreshImageOverlay();
    S.refreshImageProps();
    l._dirty = true;
    l._savedBlob = null;
    S.scheduleAutosave();
  });

  $el('img-apply').addEventListener('click', () => {
    const l = S.activeLayer();
    if (!l.image || l.imageBaked) return;
    S.bakeImageLayer(l);
    S.showHint('Image flattened · paint and erase work normally now');
  });

  $el('img-replace').addEventListener('click', () => {
    state.replaceImageInLayer = S.activeLayer();
    S.fileInputImportImage.click();
  });

  $el('img-scale-ref').addEventListener('click', () => {
    const l = S.activeLayer();
    if (!l.image || !l.imageTransform) return;
    // Use the current image width as the reference
    const wPx = l.imageTransform.w;
    // Ask the user the real-world width
    state.pendingScaleStart = { x: l.imageTransform.x - wPx/2, y: l.imageTransform.y };
    state.pendingScaleEnd = { x: l.imageTransform.x + wPx/2, y: l.imageTransform.y };
    state.pendingScale = false;
    state.measurePreview = { x1: state.pendingScaleStart.x, y1: state.pendingScaleStart.y, x2: state.pendingScaleEnd.x, y2: state.pendingScaleEnd.y };
    S.refreshMeasurements();
    S.openScaleApply();
    S.showHint('Enter the real-world width of this image, then Apply');
  });

  $el('img-crop-toggle').addEventListener('click', () => {
    state.cropMode = !state.cropMode;
    $el('img-crop-toggle').classList.toggle('active', state.cropMode);
    S.refreshImageOverlay();
    if (state.cropMode) S.showHint('Crop mode · drag corners on the image to crop');
  });

  // Augment importImageAsLayer for replace flow via state
  // (state.replaceImageInLayer is checked inside importImageAsLayer below)

  /* =================== IMAGE LAYER: TRANSFORM OVERLAY =================== */
  S.hideImageOverlay = function hideImageOverlay() {
    S.imgOverlay.style.display = 'none';
    S.imgOverlay.classList.remove('active-overlay');
    S.imgOverlay.innerHTML = '';
  }

  S.refreshImageOverlay = function refreshImageOverlay() {
    const l = S.activeLayer();
    if (!l || !l.image || l.imageBaked) { S.hideImageOverlay(); return; }
    S.drawImageOverlay(l);
  }

  S.drawImageOverlay = function drawImageOverlay(layer: any) {
    const t = layer.imageTransform;
    S.imgOverlay.style.display = 'block';
    S.imgOverlay.classList.add('active-overlay');
    S.imgOverlay.setAttribute('viewBox', `0 0 ${S.doc.wPx} ${S.doc.hPx}`);
    S.imgOverlay.innerHTML = '';

    const svgns = 'http://www.w3.org/2000/svg';
    const group = document.createElementNS(svgns, 'g');
    // rotate around image center
    group.setAttribute('transform', `translate(${t.x} ${t.y}) rotate(${t.rotation})`);
    S.imgOverlay.appendChild(group);

    // Frame
    const frame = document.createElementNS(svgns, 'rect');
    frame.setAttribute('x', String(-t.w/2));
    frame.setAttribute('y', String(-t.h/2));
    frame.setAttribute('width', String(t.w));
    frame.setAttribute('height', String(t.h));
    frame.setAttribute('class', 'img-frame' + (state.cropMode ? ' cropping' : ''));
    group.appendChild(frame);

    // Handles size in doc px (will look scaled by zoom but acceptable)
    const handleR = Math.max(14, 30 / (state.zoom * state.baseZoom));
    const handles = [
      { x: -t.w/2, y: -t.h/2, role: 'corner-tl' },
      { x:  t.w/2, y: -t.h/2, role: 'corner-tr' },
      { x: -t.w/2, y:  t.h/2, role: 'corner-bl' },
      { x:  t.w/2, y:  t.h/2, role: 'corner-br' },
    ];
    handles.forEach((h: any) => {
      const c = document.createElementNS(svgns, 'circle');
      c.setAttribute('cx', String(h.x));
      c.setAttribute('cy', String(h.y));
      c.setAttribute('r', String(handleR));
      c.setAttribute('class', 'img-handle ' + h.role);
      c.dataset.role = h.role;
      group.appendChild(c);
    });
    // Rotate handle line + circle (above the top middle, or below if no room)
    const rotateDist = Math.max(50, 100 / (state.zoom * state.baseZoom));
    // If image top is too close to top of doc, put the rotate handle below instead.
    const topInDoc = t.y - t.h/2;
    const placeBelow = topInDoc < rotateDist + handleR + 20;
    const rotateY = placeBelow ? (t.h/2 + rotateDist) : (-t.h/2 - rotateDist);
    const lineY1 = placeBelow ? t.h/2 : -t.h/2;
    const rline = document.createElementNS(svgns, 'line');
    rline.setAttribute('x1', String(0));
    rline.setAttribute('y1', String(lineY1));
    rline.setAttribute('x2', String(0));
    rline.setAttribute('y2', String(rotateY));
    rline.setAttribute('class', 'img-rotate-line');
    group.appendChild(rline);
    const rc = document.createElementNS(svgns, 'circle');
    rc.setAttribute('cx', String(0));
    rc.setAttribute('cy', String(rotateY));
    rc.setAttribute('r', String(handleR));
    rc.setAttribute('class', 'img-handle rotate');
    rc.dataset.role = 'rotate';
    group.appendChild(rc);

    // Wire pointer events
    S.attachImageOverlayHandlers(layer);
  }

  S.attachImageOverlayHandlers = function attachImageOverlayHandlers(layer: any) {
    const elements = S.imgOverlay.querySelectorAll('.img-frame, .img-handle');
    elements.forEach((el: any) => {
      el.addEventListener('pointerdown', (e: any) => {
        e.stopPropagation();
        e.preventDefault();
        const role = el.dataset.role || 'move';
        S.startImageManipulation(layer, role, e);
      });
    });
  }

  S.startImageManipulation = function startImageManipulation(layer: any, role: any, e: any) {
    S.imgOverlay.setPointerCapture && S.imgOverlay.setPointerCapture(e.pointerId);
    const start = S.clientToCanvas(e.clientX, e.clientY);
    const t0 = { ...layer.imageTransform };
    layer.imageManipulating = true;   // use fast downscaled preview during the drag
    let rafPending = false, lastEv = e;

    const apply = () => {
      rafPending = false;
      const ev = lastEv;
      const p = S.clientToCanvas(ev.clientX, ev.clientY);
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      if (role === 'move') {
        layer.imageTransform.x = t0.x + dx;
        layer.imageTransform.y = t0.y + dy;
      } else if (role === 'rotate') {
        const a = Math.atan2(p.y - t0.y, p.x - t0.x) * 180 / Math.PI + 90;
        let next = a;
        if (ev.shiftKey) next = Math.round(next / 15) * 15;
        layer.imageTransform.rotation = next;
      } else if (role.startsWith('corner')) {
        const r = -t0.rotation * Math.PI / 180;
        const lx = (p.x - t0.x) * Math.cos(r) - (p.y - t0.y) * Math.sin(r);
        const ly = (p.x - t0.x) * Math.sin(r) + (p.y - t0.y) * Math.cos(r);
        const sx = role.endsWith('tr') || role.endsWith('br') ? 1 : -1;
        const sy = role.endsWith('bl') || role.endsWith('br') ? 1 : -1;
        let newW = Math.max(10, lx * sx * 2);
        let newH = Math.max(10, ly * sy * 2);
        if (!ev.altKey) {
          const rw = newW / t0.w, rh = newH / t0.h;
          const scale = Math.max(rw, rh);
          newW = t0.w * scale;
          newH = t0.h * scale;
        }
        layer.imageTransform.w = newW;
        layer.imageTransform.h = newH;
      }
      S.renderImageCanvas(layer);
      S.drawImageOverlay(layer);
      S.refreshImageProps();
    };

    const onMove = (ev: any) => {
      lastEv = ev;
      if (rafPending) return;       // coalesce the flood of pointer events to one redraw/frame
      rafPending = true;
      requestAnimationFrame(apply);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      layer.imageManipulating = false;
      S.renderImageCanvas(layer);     // final full-resolution redraw
      S.drawImageOverlay(layer);
      layer._dirty = true;
      layer._savedBlob = null;
      S.scheduleAutosave();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }
}
