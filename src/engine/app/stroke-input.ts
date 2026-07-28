/* Auto-converted from public/engine/app/04-stroke-input.js — shared scope S */
import { S } from "./scope";

export function initStrokeInput() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);


  // ─── STROKE BUFFER ───────────────────────────────────────────────
  // Freehand strokes render here at FULL opacity, so overlapping segments
  // (especially the clustered points at stroke start) never accumulate
  // alpha into a dark blob. On lift, the whole buffer is composited onto
  // the active layer once, at the target opacity + blend mode.
  S.strokeCanvas = document.createElement('canvas');
  S.strokeCanvas.width = S.doc.wPx;
  S.strokeCanvas.height = S.doc.hPx;
  S.strokeCanvas.id = 'stroke-buffer';
  S.strokeCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0;will-change:opacity;';
  S.strokeCtx = S.strokeCanvas.getContext('2d') as any;
  S.paper.appendChild(S.strokeCanvas);
  // Persistent full-resolution canvas for replaying the committed stroke — reused
  // each lift instead of allocating a large canvas per stroke (less GC, smoother).
  S.replayCanvas = document.createElement('canvas');
  S.replayCtx = S.replayCanvas.getContext('2d') as any;

  S.strokeTarget = function strokeTarget() {
    return state.usingBuffer ? S.strokeCtx : S.activeLayer().ctx;
  }


  S.pressureFor = function pressureFor(e: any) {
    if (e.pointerType === 'pen' && e.pressure > 0) return e.pressure;
    if (e.pointerType === 'touch') return 0.55;
    return 0.5;
  }

  S.isProceduralBrush = function isProceduralBrush(brush: any) {
    return !!(brush && brush.tipType === 'texture' && brush.textureMode);
  };

  S.stampSoftEraser = function stampSoftEraser(
    ctx: CanvasRenderingContext2D,
    brush: any,
    x: number,
    y: number,
    pressure: number,
  ) {
    const p = Math.max(0.05, Math.min(1, pressure));
    const radius = Math.max(2, state.size * (1 - (brush.pressureSize || 0) + (brush.pressureSize || 0) * p) * 0.5);
    const strength = Math.max(0.06, Math.min(1, state.alpha * (0.2 + p * 0.8)));
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
    gradient.addColorStop(Math.max(0.05, brush.hardness || 0.25), `rgba(0,0,0,${strength * 0.82})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  };

  S.stampProceduralTexture = function stampProceduralTexture(
    ctx: CanvasRenderingContext2D,
    brush: any,
    x: number,
    y: number,
    pressure: number,
    angle = 0,
  ) {
    const p = Math.max(0.05, Math.min(1, pressure));
    const size = Math.max(2, state.size * (1 - (brush.pressureSize || 0) + (brush.pressureSize || 0) * p));
    const alpha = Math.max(0.025, Math.min(1,
      state.alpha * (brush.flow || 1) *
      (1 - (brush.pressureOpacity || 0) + (brush.pressureOpacity || 0) * p),
    ));
    const mode = brush.textureMode;
    const random = (amount: number) => (Math.random() - 0.5) * amount;
    const count = Math.max(2, Math.round(2 + p * 7));
    ctx.save();
    ctx.globalCompositeOperation = brush.kind === 'erase' ? 'destination-out' : (brush.blend || 'source-over');
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = state.color;
    ctx.fillStyle = state.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const line = (a: number, length: number, width = Math.max(0.45, size * 0.055), ox = 0, oy = 0) => {
      const dx = Math.cos(a) * length * 0.5;
      const dy = Math.sin(a) * length * 0.5;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x + ox - dx, y + oy - dy);
      ctx.lineTo(x + ox + dx, y + oy + dy);
      ctx.stroke();
    };
    const dot = (dx: number, dy: number, radius: number) => {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, Math.max(0.35, radius), 0, Math.PI * 2);
      ctx.fill();
    };

    if (mode === 'hatching' || mode === 'crosshatching') {
      const hatchAngle = -Math.PI / 4;
      for (let i = -1; i <= 1; i++) line(hatchAngle, size * 1.35, undefined, i * size * 0.24, i * size * 0.24);
      if (mode === 'crosshatching') {
        for (let i = -1; i <= 1; i++) line(Math.PI / 4, size * 1.35, undefined, i * size * 0.24, -i * size * 0.24);
      }
    } else if (mode === 'stippling' || mode === 'concrete' || mode === 'texture-eraser') {
      for (let i = 0; i < count * (mode === 'concrete' ? 2 : 1); i++) {
        dot(random(size), random(size), size * (0.025 + Math.random() * (mode === 'concrete' ? 0.055 : 0.09)) * (0.6 + p));
      }
      if (mode === 'concrete' && p > 0.45) {
        line(random(Math.PI), size * 0.7, Math.max(0.35, size * 0.025), random(size * 0.25), random(size * 0.25));
      }
    } else if (mode === 'brick') {
      const w = size * 1.05, h = size * 0.48;
      ctx.lineWidth = Math.max(0.5, size * 0.045);
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.beginPath();
      ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y);
      ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y);
      ctx.moveTo(x - w * 0.25, y); ctx.lineTo(x - w * 0.25, y + h / 2);
      ctx.moveTo(x + w * 0.25, y); ctx.lineTo(x + w * 0.25, y + h / 2);
      ctx.stroke();
    } else if (mode === 'tile') {
      const side = size * 0.78;
      ctx.lineWidth = Math.max(0.55, size * 0.045);
      ctx.strokeRect(x - side / 2, y - side / 2, side, side);
      ctx.strokeRect(x - side * 0.12, y - side * 0.12, side * 0.24, side * 0.24);
    } else if (mode === 'wood') {
      ctx.lineWidth = Math.max(0.45, size * 0.04);
      for (let i = -2; i <= 2; i++) {
        const oy = i * size * 0.16 + random(size * 0.05);
        ctx.beginPath();
        ctx.moveTo(x - size * 0.65, y + oy);
        ctx.bezierCurveTo(x - size * 0.2, y + oy - size * 0.12, x + size * 0.2, y + oy + size * 0.12, x + size * 0.65, y + oy);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(x, y, size * 0.12, size * 0.07, angle, 0, Math.PI * 2); ctx.stroke();
    } else if (mode === 'stone') {
      ctx.lineWidth = Math.max(0.5, size * 0.045);
      for (let n = 0; n < Math.max(2, Math.round(count / 2)); n++) {
        const cx = x + random(size * 0.75), cy = y + random(size * 0.65);
        const r = size * (0.12 + Math.random() * 0.13);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const px = cx + Math.cos(a) * r * (0.75 + Math.random() * 0.35);
          const py = cy + Math.sin(a) * r * (0.75 + Math.random() * 0.35);
          if (!k) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
      }
    } else if (mode === 'grass') {
      ctx.lineWidth = Math.max(0.45, size * 0.035);
      for (let i = 0; i < count; i++) {
        const bx = x + random(size * 0.8), by = y + size * 0.42 + random(size * 0.18);
        ctx.beginPath(); ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + random(size * 0.25), by - size * 0.42, bx + random(size * 0.32), by - size * (0.55 + Math.random() * 0.35));
        ctx.stroke();
      }
    } else if (mode === 'leaves') {
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.ellipse(x + random(size * 0.8), y + random(size * 0.7), size * 0.13, size * 0.055, random(Math.PI), 0, Math.PI * 2);
        if (p > 0.6) ctx.fill(); else ctx.stroke();
      }
    } else if (mode === 'shrubs') {
      ctx.lineWidth = Math.max(0.45, size * 0.035);
      for (let i = 0; i < count; i++) {
        const r = size * (0.12 + Math.random() * 0.13);
        ctx.beginPath(); ctx.arc(x + random(size * 0.7), y + random(size * 0.55), r, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (mode === 'trees') {
      ctx.lineWidth = Math.max(0.65, size * 0.045);
      line(Math.PI / 2, size * 0.82, Math.max(0.8, size * 0.08), 0, size * 0.28);
      for (let i = 0; i < count; i++) dot(random(size * 0.65), -size * 0.16 + random(size * 0.45), size * (0.11 + Math.random() * 0.1));
    } else if (mode === 'ground-cover') {
      ctx.lineWidth = Math.max(0.4, size * 0.035);
      for (let i = 0; i < count; i++) {
        const cx = x + random(size), cy = y + random(size * 0.6);
        ctx.beginPath(); ctx.arc(cx, cy, size * (0.06 + Math.random() * 0.08), Math.PI, Math.PI * 2); ctx.stroke();
      }
    } else if (mode === 'colored-pencil') {
      ctx.lineWidth = Math.max(0.35, size * 0.08);
      for (let i = 0; i < count; i++) line(angle + random(0.18), size * (0.35 + Math.random() * 0.5), undefined, random(size * 0.35), random(size * 0.35));
    } else if (mode === 'dry-marker' || mode === 'dry-brush') {
      ctx.lineCap = 'butt';
      const strands = mode === 'dry-brush' ? count + 3 : count;
      for (let i = 0; i < strands; i++) {
        if (Math.random() > 0.35 + p * 0.55) continue;
        line(angle, size * (0.35 + Math.random() * 0.75), Math.max(0.5, size * (mode === 'dry-brush' ? 0.035 : 0.075)), random(size * 0.3), random(size * 0.65));
      }
    }
    ctx.restore();
  };

  S.eraseRecordedStrokeAt = function eraseRecordedStrokeAt(layer: any, x: number, y: number, radius: number) {
    for (let i = layer.history.length - 1; i >= 0; i--) {
      const entry = layer.history[i];
      if (!entry || entry.vector || !entry.before || !entry.after) continue;
      const lx = Math.round(x - entry.x), ly = Math.round(y - entry.y);
      if (lx < -radius || ly < -radius || lx >= entry.after.width + radius || ly >= entry.after.height + radius) continue;
      let hit = false;
      for (let oy = -radius; oy <= radius && !hit; oy += Math.max(1, Math.round(radius / 4))) {
        for (let ox = -radius; ox <= radius; ox += Math.max(1, Math.round(radius / 4))) {
          const px = lx + ox, py = ly + oy;
          if (px < 0 || py < 0 || px >= entry.after.width || py >= entry.after.height) continue;
          const idx = (py * entry.after.width + px) * 4;
          if (entry.after.data[idx + 3] > entry.before.data[idx + 3] + 4) { hit = true; break; }
        }
      }
      if (!hit) continue;
      const current = layer.ctx.getImageData(entry.x, entry.y, entry.after.width, entry.after.height);
      layer.ctx.putImageData(entry.before, entry.x, entry.y);
      const after = layer.ctx.getImageData(entry.x, entry.y, entry.after.width, entry.after.height);
      S.pushRegionSnapshot(layer, entry.x, entry.y, current, after);
      S.renderLayers();
      S.showHint('Stroke erased');
      return true;
    }
    S.showHint('No stroke found');
    return false;
  };

  S.eraseRasterObjectAt = function eraseRasterObjectAt(layer: any, x: number, y: number, radius: number) {
    const image = layer.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
    const width = image.width, height = image.height, data = image.data;
    let sx = Math.max(0, Math.min(width - 1, Math.round(x)));
    let sy = Math.max(0, Math.min(height - 1, Math.round(y)));
    if (data[(sy * width + sx) * 4 + 3] < 8) {
      let found = false;
      for (let r = 1; r <= radius && !found; r++) {
        for (let oy = -r; oy <= r && !found; oy++) for (let ox = -r; ox <= r; ox++) {
          const px = sx + ox, py = sy + oy;
          if (px >= 0 && py >= 0 && px < width && py < height && data[(py * width + px) * 4 + 3] >= 8) {
            sx = px; sy = py; found = true; break;
          }
        }
      }
      if (!found) { S.showHint('No object found'); return false; }
    }
    const seen = new Uint8Array(width * height);
    const queue: number[] = [sy * width + sx];
    seen[queue[0]] = 1;
    let minX = sx, minY = sy, maxX = sx, maxY = sy;
    for (let head = 0; head < queue.length; head++) {
      const pos = queue[head], px = pos % width, py = Math.floor(pos / width);
      data[pos * 4 + 3] = 0;
      minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
      const neighbours = [pos - 1, pos + 1, pos - width, pos + width];
      for (const next of neighbours) {
        if (next < 0 || next >= seen.length || seen[next]) continue;
        const nx = next % width, ny = Math.floor(next / width);
        if (Math.abs(nx - px) + Math.abs(ny - py) !== 1 || data[next * 4 + 3] < 8) continue;
        seen[next] = 1; queue.push(next);
      }
    }
    const bx = minX, by = minY, bw = maxX - minX + 1, bh = maxY - minY + 1;
    const before = layer._cur ? S._extractRegion(layer._cur, bx, by, bw, bh) : layer.ctx.getImageData(bx, by, bw, bh);
    layer.ctx.putImageData(image, 0, 0);
    const after = layer.ctx.getImageData(bx, by, bw, bh);
    S.pushRegionSnapshot(layer, bx, by, before, after);
    S.renderLayers();
    S.showHint('Object erased');
    return true;
  };

  S.activePointers = new Map<any, any>(); // for pinch detection

  S.paper.addEventListener('pointerdown', (e: any) => {
    // Dismiss the Fill·Extrude chip on any fresh interaction (a polygon-closing
    // tap re-shows it later in this same handler, so order is safe).
    if (typeof S.hideShapeChip === 'function') S.hideShapeChip();
    // track for pinch
    S.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // ─── Touch gesture tracking (2-finger undo, 3-finger redo) ──────
    if (e.pointerType === 'touch') {
      S.gestureState.touchTimes.set(e.pointerId, Date.now());
      S.gestureState.peakCount = Math.max(S.gestureState.peakCount, S.gestureState.touchTimes.size);
    }

    // ─── Auto-hide UI when stylus or finger starts drawing ──────────
    if ((e.pointerType === 'pen' || e.pointerType === 'mouse') &&
        state.mode === 'draw' &&
        !['hand','ruler','area','wall','opening','select','offset','fill','stencil','brushes','wand','lasso'].includes(state.tool)) {
      S.uiHide();
    }

    // Navigate mode or hand tool, or pinch zoom (always allow 2-finger zoom in draw mode)
    if (state.mode === 'navigate' || state.tool === 'hand' || S.activePointers.size > 1) {
      // A second finger arrived mid-stroke → abort the nascent stroke so a 2-/3-finger
      // gesture doesn't commit a stray (often empty) stroke that swallows the undo.
      if (S.activePointers.size > 1 && state.drawing) {
        state.drawing = false;
        if (typeof S.strokeCanvas !== 'undefined' && S.strokeCanvas) {
          S.strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
          S.strokeCtx.clearRect(0, 0, S.strokeCanvas.width, S.strokeCanvas.height);
          S.strokeCanvas.style.opacity = '0';
        }
        state.strokeSegs = [];
      }
      S.paper.setPointerCapture(e.pointerId);
      if (S.activePointers.size === 2) {
        const pts: any[] = Array.from(S.activePointers.values());
        state.pinchStart = {
          dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
          zoom: state.zoom,
          midX: (pts[0].x + pts[1].x) / 2,
          midY: (pts[0].y + pts[1].y) / 2,
          panX: state.panX, panY: state.panY,
        };
      } else {
        state.isPanning = true;
        state.panStartX = e.clientX - state.panX;
        state.panStartY = e.clientY - state.panY;
      }
      return;
    }

    if (state.tool === 'stencil') {
      S.placeStencil(S.clientToCanvas(e.clientX, e.clientY));
      return;
    }

    // Area / polygon: click-to-add vertices. Wall: drag-and-draw (Keyplan style).
    if (state.tool === 'area' || (state.tool as any) === 'line') {
      e.preventDefault();
      const p = S.clientToCanvas(e.clientX, e.clientY);
      state._lastPolyClient = { x: e.clientX, y: e.clientY };
      state.smoothedX = p.x;
      state.smoothedY = p.y;
      // Manual double-tap detection (dblclick is unreliable on touch/Pencil)
      const now = Date.now();
      if (state._lastAreaTap &&
          now - state._lastAreaTap.time < 350 &&
          Math.hypot(e.clientX - state._lastAreaTap.x, e.clientY - state._lastAreaTap.y) < 24) {
        const enough = (state.tool as any) === 'line' ? state.polyPoints.length >= 2 : state.polyPoints.length >= 3;
        if (state.polyActive && enough) {
          state._lastAreaTap = null;
          S.finishPoly();
          return;
        }
      }
      state._lastAreaTap = { time: now, x: e.clientX, y: e.clientY };
      S.addPolyVertex(p);
      return;
    }

    if (state.tool === 'wall') {
      e.preventDefault();
      const p = S.clientToCanvas(e.clientX, e.clientY);
      S.beginWallDrag(p, e.shiftKey);
      S.paper.setPointerCapture && S.paper.setPointerCapture(e.pointerId);
      const mv = (ev: any) => {
        S.updateWallDrag(S.clientToCanvas(ev.clientX, ev.clientY), ev.shiftKey);
      };
      const up = () => {
        document.removeEventListener('pointermove', mv);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        S.endWallDrag();
      };
      document.addEventListener('pointermove', mv);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
      return;
    }

    // Offset tool — tap a room to offset its boundary
    if (state.tool === 'offset') {
      e.preventDefault();
      const p = S.clientToCanvas(e.clientX, e.clientY);
      const t = S.offsetTargetAt(p);
      if (t) {
        state.offset = { type: t.type, idx: t.idx, mm: (state.offset && state.offset.mm) || 100, dir: (state.offset && state.offset.dir) || -1 };
        S.showOffsetBar(true); S.refreshMeasurements();
        S.showHint('Selected — set distance, In/Out, then Apply');
      } else {
        state.offset = null; S.showOffsetBar(false); S.refreshMeasurements();
        S.showHint('Tap a room or a shape to offset its boundary');
      }
      return;
    }

    // Select / edit entities (walls, doors, windows, rooms, dimensions)
    if (state.tool === 'select') {
      e.preventDefault();
      const p = S.clientToCanvas(e.clientX, e.clientY);
      // Bulge handle drag for curved walls
      if (typeof S.bulgeHandleHit === 'function') {
        const bh = S.bulgeHandleHit(p);
        if (bh) {
          S.beginBulgeDrag(bh.wi);
          S.paper.setPointerCapture && S.paper.setPointerCapture(e.pointerId);
          const mv = (ev: any) => S.applyBulgeDragAt(S.clientToCanvas(ev.clientX, ev.clientY));
          const up = () => {
            document.removeEventListener('pointermove', mv);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
            S.endBulgeDrag();
          };
          document.addEventListener('pointermove', mv);
          document.addEventListener('pointerup', up);
          document.addEventListener('pointercancel', up);
          return;
        }
      }
      // Active move/scale/rotate session for selected wall or shape
      if (state.vecXform && state.vecXform.mode) {
        const ent = S.getSelectedVecEntity();
        if (ent) {
          state.vecXform.start = { x: p.x, y: p.y };
          state.vecXform.origin = S.entityCentroid(ent);
          state.vecXform.base = S.snapshotEntityGeom(ent);
          state.vecXform.before = S.vectorSnapshot();
          S.paper.setPointerCapture && S.paper.setPointerCapture(e.pointerId);
          const mv = (ev: any) => {
            S.applyVecXformAt(S.clientToCanvas(ev.clientX, ev.clientY));
          };
          const up = () => {
            document.removeEventListener('pointermove', mv);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
            if (state.vecXform && state.vecXform.before) {
              S.recordVec(state.vecXform.before);
              S.scheduleAutosave();
            }
            S.syncSceneObjectsToEngine();
            S.renderLayers();
            state.vecXform = null;
            if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
            S.showHint('Transform applied');
          };
          document.addEventListener('pointermove', mv);
          document.addEventListener('pointerup', up);
          document.addEventListener('pointercancel', up);
          return;
        }
      }
      S.selectEntityAt(p);
      // Highlight matching layer-panel element
      if (S.layerEngine && state.sel) {
        if (state.sel.type === 'shape' && state.sel.id) {
          const obj = S.findEngineObjectByLegacy((r: any) => r.kind === 'shape' && r.id === state.sel.id);
          if (obj) {
            state._panelSelectedObjectId = obj.id;
            state._panelMultiSelect = new Set([obj.id]);
            S.renderLayers();
          }
        } else if (state.sel.type === 'wall' && state.walls[state.sel.wi]) {
          S.ensureWallId(state.walls[state.sel.wi]);
          const wid = state.walls[state.sel.wi].id;
          const seg = state.sel.seg;
          const obj = S.findEngineObjectByLegacy((r: any) =>
            (r.kind === 'wall-face' && r.wallId === wid && (seg == null || r.seg === seg)) ||
            (r.kind === 'wall' && r.id === wid)
          );
          if (obj) {
            state._panelSelectedObjectId = obj.id;
            state._panelMultiSelect = new Set([obj.id]);
            S.renderLayers();
          }
        }
      }
      return;
    }

    // Door / Window tool
    if (state.tool === 'opening') {
      e.preventDefault();
      const p = S.clientToCanvas(e.clientX, e.clientY);
      const hit = S.openingHitTest2D(p);
      if (hit) {
        state.selOpening2D = hit;
        state._draggingOpening = true;
        state._slideBefore = S.vectorSnapshot(); state._slideMoved = false;
        S.updateOpeningPalette();
        S.refreshMeasurements();
      } else {
        S.placeOpening2D(p);
      }
      return;
    }

    // Magic wand selection
    if (state.tool === 'wand') {
      e.preventDefault();
      const p = S.clientToCanvas(e.clientX, e.clientY);
      if (state.floating && S.insideFloating(p)) { S.startFloatDrag(e, p); return; }
      if (state.selection && S.maskAt(p)) { S.floatSelection(); S.startFloatDrag(e, p); return; }
      if (state.floating) { S.commitFloating(); }   // tapped outside floating → place it
      const tol = parseInt($el('fill-tolerance').value) * 3;
      S.magicWandSelect(p, tol);
      return;
    }

    // Lasso selection (freehand) + area
    if (state.tool === 'lasso') {
      e.preventDefault();
      S.commitFloating(); S.clearSelection();
      const p = S.clientToCanvas(e.clientX, e.clientY);
      state.lassoPoints = [p];
      S.paper.setPointerCapture && S.paper.setPointerCapture(e.pointerId);
      let raf = false;
      const mv = (ev: any) => {
        const q = S.clientToCanvas(ev.clientX, ev.clientY);
        state.lassoPoints.push(q);
        if (raf) return; raf = true;
        requestAnimationFrame(() => { raf = false; S.drawLassoPath(); });
      };
      const up = () => {
        document.removeEventListener('pointermove', mv);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        S.finishLasso();
      };
      document.addEventListener('pointermove', mv);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
      return;
    }

    // Eyedropper — pick colour from the canvas composite
    if (state.eyedropperActive) {
      e.preventDefault();
      const p = S.clientToCanvas(e.clientX, e.clientY);
      const x = Math.round(p.x), y = Math.round(p.y);
      // Composite all visible layers to sample
      const tmp = document.createElement('canvas');
      tmp.width = S.doc.wPx; tmp.height = S.doc.hPx;
      const tctx = tmp.getContext('2d') as any;
      tctx.fillStyle = '#ffffff'; tctx.fillRect(0, 0, S.doc.wPx, S.doc.hPx);
      state.layers.forEach((l: any) => {
        if (!l.visible) return;
        if (l.imageCanvas && !l.imageBaked) tctx.drawImage(l.imageCanvas, 0, 0);
        tctx.globalAlpha = l.opacity;
        tctx.drawImage(l.canvas, 0, 0);
      });
      tctx.globalAlpha = 1;
      const [r, g, b] = tctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + [r,g,b].map((v: any) => v.toString(16).padStart(2,'0')).join('');
      S.setColor(hex);
      state.eyedropperActive = false;
      document.body.style.cursor = '';
      S.showHint(`Picked: ${hex.toUpperCase()}`);
      return;
    }

    // Flood fill
    if (state.tool === 'fill') {
      e.preventDefault();
      const p = S.clientToCanvas(e.clientX, e.clientY);
      const l = S.activeLayer();
      const tolerance = parseInt($el('fill-tolerance').value) * 3;
      const expand = parseInt($el('fill-expand').value) || 0;
      const sampleAll = $el('fill-sample-all').checked;
      S.showHint('Filling…');
      setTimeout(() => {
        const sample = S.sampleData(sampleAll);
        let mask = S.computeFillMask(sample, p.x, p.y, tolerance);
        const shrinkEl = $el('fill-shrink');
        const shrink = shrinkEl ? parseInt(shrinkEl.value, 10) : 2;
        if (shrink > 0) mask = S.shrinkMask(mask, shrink);
        else if (expand) mask = S.expandMask(mask, expand);
        S.applyFill(l, mask);
        S.saveSnapshot(l);
        S.renderLayers();
        S.showHint('Fill complete');
      }, 10);
      return;
    }
    S.paper.setPointerCapture(e.pointerId);
    const p = S.clientToCanvas(e.clientX, e.clientY);

    if (S.measureDeleteAt(e.clientX, e.clientY)) return;

    state.drawing = true;
    state.lastX = p.x; state.lastY = p.y;
    state.startX = p.x; state.startY = p.y;
    state.lastStampX = p.x; state.lastStampY = p.y;
    state.stampAccum = 0;
    state.snapActive = false;
    state.snapAnchor = { x: p.x, y: p.y };
    // Seed stabilizer at touch point so first stroke segment isn't pulled from origin
    state.smoothedX = p.x;
    state.smoothedY = p.y;
    state.velocity = 0;
    state.strokeAge = 0;
    const l = S.activeLayer();
    const pointerBrush = S.activeBrush();

    if (S.isDrawTool(state.tool) && pointerBrush?.eraserMode === 'stroke') {
      state.drawing = false;
      S.eraseRecordedStrokeAt(l, p.x, p.y, Math.max(3, Math.round(state.size * 0.5)));
      return;
    }
    if (S.isDrawTool(state.tool) && pointerBrush?.eraserMode === 'object') {
      state.drawing = false;
      if (typeof S.selectEntityAt === 'function' && S.selectEntityAt(p) && state.sel) {
        S.deleteSelectedElement();
        S.showHint('Object erased');
      } else {
        S.eraseRasterObjectAt(l, p.x, p.y, Math.max(4, Math.round(state.size * 0.5)));
      }
      return;
    }

    if (state.tool === 'ruler') {
      // In chain mode, snap start to previous measurement endpoint
      const startX = (state.dimChainMode && state.dimChainEnd) ? state.dimChainEnd.x : p.x;
      const startY = (state.dimChainMode && state.dimChainEnd) ? state.dimChainEnd.y : p.y;
      state.measurePreview = { x1: startX, y1: startY, x2: p.x, y2: p.y };
      return;
    }

    if (['rect', 'circle'].includes(state.tool)) {
      state._shapeEnd = null;
      state.snapshot = l.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
      return;
    }

    // Set up stroke path — NO initial dot drawn here.
    // The first pointermove event draws the actual opening segment with real pressure,
    // so the stroke start matches the brush opacity exactly.
    const brush = pointerBrush;

    // Decide whether to use the full-opacity stroke buffer.
    // Texture brushes and the eraser draw directly to the layer.
    state.usingBuffer = (brush.kind !== 'erase' && !S.isProceduralBrush(brush) && !(brush.tipType === 'texture' && brush.tipImage));
    if (state.usingBuffer) {
      // Render the LIVE stroke to a display-resolution buffer (cheap to fill and
      // composite each frame), then replay at full resolution once on lift. This
      // keeps drawing smooth on large/high-DPI canvases while staying crisp.
      const dpr = window.devicePixelRatio || 1;
      // Live preview renders at display resolution; the committed stroke is always
      // replayed at full resolution, so we can cap the live buffer to bound per-frame
      // cost. Cap the longest side to ~1600px — biggest win on large/high-DPI canvases.
      const longSide = Math.max(S.doc.wPx, S.doc.hPx);
      const sizeCap = Math.min(1, 1600 / longSide);
      const previewScale = Math.max(0.2, Math.min(state.baseZoom * state.zoom * dpr, sizeCap));
      state.bufScale = previewScale;
      const bw = Math.max(1, Math.round(S.doc.wPx * previewScale));
      const bh = Math.max(1, Math.round(S.doc.hPx * previewScale));
      if (S.strokeCanvas.width !== bw || S.strokeCanvas.height !== bh) {
        S.strokeCanvas.width = bw; S.strokeCanvas.height = bh;
      } else {
        S.strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
        S.strokeCtx.clearRect(0, 0, bw, bh);
      }
      // Draw in document coordinates; the transform scales into the small buffer.
      S.strokeCtx.setTransform(previewScale, 0, 0, previewScale, 0, 0);
      // Capture geometry for the full-res replay on commit.
      state.strokeSegs = [];
      state.strokeStart = { x: p.x, y: p.y };
      state.strokeColor = state.color;
      const activeZ = state.activeLayer * 2 + 3;
      S.strokeCanvas.style.zIndex = (activeZ + 1).toString();
      S.strokeCanvas.style.opacity = state.alpha;
      S.strokeCanvas.style.mixBlendMode = (brush.blend && brush.blend !== 'source-over') ? brush.blend : 'normal';
    }

    const tgt = S.strokeTarget();
    state.strokeBBox = { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y, maxW: state.size };
    if (brush.id === 'eraser-soft') {
      S.stampSoftEraser(l.ctx, brush, p.x, p.y, S.pressureFor(e));
    } else if (S.isProceduralBrush(brush)) {
      S.stampProceduralTexture(l.ctx, brush, p.x, p.y, S.pressureFor(e), 0);
    } else if (brush.tipType === 'texture' && brush.tipImage) {
      S.stampTexture(l.ctx, brush, p.x, p.y, S.pressureFor(e));
    } else {
      S.configurePen(tgt, S.pressureFor(e), brush, state.usingBuffer);
      tgt.beginPath();
      tgt.moveTo(p.x, p.y);
      // Do NOT stroke here — avoids dark round-cap dot at touch-down pressure.
    }
  });

  S.paper.addEventListener('pointermove', (e: any) => {
    if (state._draggingOpening && state.selOpening2D) {
      S.slideOpening2D(state.selOpening2D, S.clientToCanvas(e.clientX, e.clientY));
      state._slideMoved = true;
      return;
    }
    if (S.activePointers.has(e.pointerId)) {
      S.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch zoom — always immediate, no coalescing needed
    if ((state.pinchStart as any) && S.activePointers.size === 2) {
      const pts: any[] = Array.from(S.activePointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      state.zoom = Math.max(0.2, Math.min(8, (state.pinchStart as any).zoom * (dist / (state.pinchStart as any).dist)));
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      state.panX = (state.pinchStart as any).panX + (midX - (state.pinchStart as any).midX);
      state.panY = (state.pinchStart as any).panY + (midY - (state.pinchStart as any).midY);
      S.applyStageTransform();
      return;
    }

    if (state.isPanning) {
      state.panX = e.clientX - state.panStartX;
      state.panY = e.clientY - state.panStartY;
      S.applyStageTransform();
      return;
    }

    if (state.lineDrag && (state.lineDrag as any).pointerId === e.pointerId) {
      const p = S.clientToCanvas(e.clientX, e.clientY);
      let x2 = p.x, y2 = p.y;
      if (e.shiftKey) {
        const sn = S.snapToOrtho(x2, y2, (state.lineDrag as any).x1, (state.lineDrag as any).y1);
        x2 = sn.x; y2 = sn.y;
        $el('snap-badge').classList.add('show');
      } else {
        $el('snap-badge').classList.remove('show');
      }
      (state.lineDrag as any).x2 = x2;
      (state.lineDrag as any).y2 = y2;
      state.measurePreview = { x1: (state.lineDrag as any).x1, y1: (state.lineDrag as any).y1, x2, y2 };
      S.refreshMeasurements();
      return;
    }

    if (e.pointerType === 'pen') {
      $el('pressure-val').textContent = (e.pressure * 100).toFixed(0) + '%';
    }

    if (!state.drawing) return;
    const l = S.activeLayer();

    // Ruler and shape tools — process main event only (need immediacy for live preview)
    const mainP = S.clientToCanvas(e.clientX, e.clientY);

    if (state.tool === 'ruler') {
      state.measurePreview.x2 = mainP.x;
      state.measurePreview.y2 = mainP.y;
      S.refreshMeasurements();
      return;
    }

    if (['rect', 'circle'].includes(state.tool)) {
      let tp = { ...mainP };
      if (e.shiftKey) {
        if ((state.tool as any) === 'line') {
          const sn = S.snapToOrtho(tp.x, tp.y, state.startX, state.startY);
          tp.x = sn.x; tp.y = sn.y;
        } else if (state.tool === 'rect') {
          const dx = tp.x - state.startX, dy = tp.y - state.startY;
          const s = Math.sign(dx) * Math.max(Math.abs(dx), Math.abs(dy));
          tp.x = state.startX + s; tp.y = state.startY + Math.sign(dy) * Math.abs(s);
        }
        $el('snap-badge').classList.add('show');
      } else {
        $el('snap-badge').classList.remove('show');
      }
      state._shapeEnd = { x: tp.x, y: tp.y };
      l.ctx.putImageData(state.snapshot, 0, 0);
      // Shapes always draw a clean ink stroke — never inherit the eraser or a
      // previous brush's blend mode (which would erase or composite oddly).
      l.ctx.globalCompositeOperation = 'source-over';
      l.ctx.globalAlpha = state.alpha;
      l.ctx.strokeStyle = state.color;
      l.ctx.lineWidth = Math.max(0.5, state.size);
      l.ctx.lineCap = 'round';
      l.ctx.lineJoin = 'round';
      l.ctx.beginPath();
      if ((state.tool as any) === 'line') {
        l.ctx.moveTo(state.startX, state.startY);
        l.ctx.lineTo(tp.x, tp.y);
        l.ctx.stroke();
      } else if (state.tool === 'rect') {
        l.ctx.strokeRect(state.startX, state.startY, tp.x - state.startX, tp.y - state.startY);
      } else if (state.tool === 'circle') {
        const dx = tp.x - state.startX, dy = tp.y - state.startY;
        const r = Math.sqrt(dx * dx + dy * dy);
        l.ctx.arc(state.startX, state.startY, r, 0, Math.PI * 2);
        l.ctx.stroke();
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────────
    // FREEHAND DRAWING — process ALL coalesced events (240Hz on Pencil)
    // Then add predicted events at reduced opacity for zero-lag feel
    // ─────────────────────────────────────────────────────────────────
    const coalescedEvents = (e.getCoalescedEvents)
      ? e.getCoalescedEvents()
      : [e];

    const brush = S.activeBrush();
    // l is already declared above for ruler/shapes — no need to redeclare

    function drawFreehandPoint(ce: any, isPredicted: any) {
      let p = S.clientToCanvas(ce.clientX, ce.clientY);
      const pr = isPredicted ? (S.pressureFor(ce) * 0.85) : S.pressureFor(ce);

      // Ortho snap
      if (e.shiftKey && S.isDrawTool(state.tool)) {
        p = S.applyOrthoSnap(p, e);
      } else if (state.snapActive && !e.shiftKey) {
        state.snapActive = false;
        state.snapAnchor = null;
        $el('snap-badge').classList.remove('show');
      }

      // Stabilizer EMA — at 0 use raw coords (no offset drift)
      if (state.stabilizer > 0) {
        const s = state.stabilizer;
        state.smoothedX = p.x + s * (state.smoothedX - p.x);
        state.smoothedY = p.y + s * (state.smoothedY - p.y);
        p = { x: state.smoothedX, y: state.smoothedY };
      } else {
        state.smoothedX = p.x;
        state.smoothedY = p.y;
      }

      S.maybeExpandCanvas(p.x, p.y);

      // Velocity-based width — fast strokes are thinner (like real media)
      const dx = p.x - state.lastX, dy = p.y - state.lastY;
      const segDist = Math.sqrt(dx*dx + dy*dy);
      // EMA of velocity for smooth transition (in doc px per event — rough proxy)
      state.velocity = state.velocity * 0.72 + segDist * 0.28;
      // velocity multiplier: fast (>8px) = 0.7× width, slow (≤1px) = 1.0× width
      const velMul = Math.max(0.65, Math.min(1.0, 1.0 - (state.velocity - 1) * 0.04));

      // Apple Pencil tilt — altitude close to 0 = flat/broad, close to π/2 = upright/fine
      // altitudeAngle: 0 = flat, π/2 = upright. More tilt → larger effective size
      let tiltMul = 1.0;
      if (ce.altitudeAngle !== undefined && ce.altitudeAngle < Math.PI / 2) {
        const flatness = 1 - ce.altitudeAngle / (Math.PI / 2); // 0 upright, 1 flat
        tiltMul = 1 + flatness * 0.6; // flat pencil = up to 1.6× wider
      }

      // Taper factor — stroke naturally thins at its ends
      // This is a simple time-based taper using stroke progress
      state.strokeAge = (state.strokeAge || 0) + 1;
      const taperIn  = Math.min(1, state.strokeAge / 8);   // ramp up over 8 samples
      const taperPr  = pr * taperIn;

      if (brush.id === 'eraser-soft') {
        const effSize = Math.max(2, state.size * (1 - (brush.pressureSize || 0) + (brush.pressureSize || 0) * taperPr));
        S.stampSoftEraser(l.ctx, brush, p.x, p.y, taperPr);
        const bb = state.strokeBBox;
        if (bb) {
          bb.minX = Math.min(bb.minX, p.x); bb.minY = Math.min(bb.minY, p.y);
          bb.maxX = Math.max(bb.maxX, p.x); bb.maxY = Math.max(bb.maxY, p.y);
          bb.maxW = Math.max(bb.maxW, effSize);
        }
        state.lastX = p.x; state.lastY = p.y;
      } else if (S.isProceduralBrush(brush)) {
        const effSize = Math.max(2, state.size * (1 - (brush.pressureSize || 0) + (brush.pressureSize || 0) * taperPr));
        const step = Math.max(1, (brush.spacing || 0.2) * effSize);
        state.stampAccum += segDist;
        if (state.stampAccum >= step) {
          S.stampProceduralTexture(l.ctx, brush, p.x, p.y, taperPr, Math.atan2(dy, dx));
          state.stampAccum %= step;
        }
        const bb = state.strokeBBox;
        if (bb) {
          bb.minX = Math.min(bb.minX, p.x); bb.minY = Math.min(bb.minY, p.y);
          bb.maxX = Math.max(bb.maxX, p.x); bb.maxY = Math.max(bb.maxY, p.y);
          bb.maxW = Math.max(bb.maxW, effSize * 1.5);
        }
        state.lastX = p.x; state.lastY = p.y;
      } else if (brush.tipType === 'texture' && brush.tipImage) {
        const effSize = Math.max(1, brush.size * (1 - brush.pressureSize + brush.pressureSize * taperPr) * velMul * tiltMul);
        const step = Math.max(0.5, brush.spacing * effSize);
        state.stampAccum += segDist;
        let placed = 0;
        while (state.stampAccum >= step && placed < 500) {
          const overshoot = state.stampAccum - step;
          const t = (segDist - overshoot) / Math.max(segDist, 0.001);
          const sx = state.lastStampX + dx * t;
          const sy = state.lastStampY + dy * t;
          const savedSize = brush.size;
          brush.size *= velMul * tiltMul;
          S.stampTexture(l.ctx, brush, sx, sy, taperPr);
          brush.size = savedSize;
          state.lastStampX = sx; state.lastStampY = sy;
          state.stampAccum = overshoot;
          placed++;
        }
        state.lastX = p.x; state.lastY = p.y;
      } else {
        // Render to the stroke buffer (full opacity) or layer (eraser).
        const tgt = S.strokeTarget();
        S.configurePen(tgt, taperPr, brush, state.usingBuffer);
        tgt.lineWidth = Math.max(0.3, tgt.lineWidth * velMul * tiltMul);
        const mx = (state.lastX + p.x) / 2;
        const my = (state.lastY + p.y) / 2;
        tgt.quadraticCurveTo(state.lastX, state.lastY, mx, my);
        tgt.stroke();
        if (state.symmetryAxis === 'vertical') {
          const cx = S.doc.wPx / 2;
          const mir = (x: any) => 2 * cx - x;
          tgt.beginPath();
          tgt.moveTo(mir(state.lastX), state.lastY);
          tgt.quadraticCurveTo(mir(state.lastX), state.lastY, mir(mx), my);
          tgt.stroke();
        } else if (state.symmetryAxis === 'horizontal') {
          const cy = S.doc.hPx / 2;
          const mirY = (y: any) => 2 * cy - y;
          tgt.beginPath();
          tgt.moveTo(state.lastX, mirY(state.lastY));
          tgt.quadraticCurveTo(state.lastX, mirY(state.lastY), mx, mirY(my));
          tgt.stroke();
        }
        tgt.beginPath();
        tgt.moveTo(mx, my);
        // Grow the stroke bounding box (used for region-based undo).
        const bb = state.strokeBBox;
        if (bb) {
          const hw = tgt.lineWidth;
          bb.minX = Math.min(bb.minX, state.lastX, mx) ;
          bb.minY = Math.min(bb.minY, state.lastY, my);
          bb.maxX = Math.max(bb.maxX, state.lastX, mx);
          bb.maxY = Math.max(bb.maxY, state.lastY, my);
          bb.maxW = Math.max(bb.maxW, hw);
        }
        // Record geometry so we can replay this stroke crisply at full resolution
        // when the pen lifts (the live buffer is only display resolution).
        if (state.usingBuffer) {
          state.strokeSegs.push({ cx: state.lastX, cy: state.lastY, mx, my, w: tgt.lineWidth });
        }
        state.lastX = p.x;
        state.lastY = p.y;
      }
    }

    // Draw coalesced (actual) events
    for (const ce of coalescedEvents) drawFreehandPoint(ce, false);

    // Predicted events are disabled while using the stroke buffer (they would
    // persist in the buffer without being corrected). Coalesced 240Hz sampling
    // already keeps strokes responsive.
    if (e.getPredictedEvents && brush.tipType !== 'texture' && !state.usingBuffer) {
      const predicted = e.getPredictedEvents();
      for (const pe of predicted) drawFreehandPoint(pe, true);
    }

    // Update brush cursor ring position (main event coords in screen space)
    S.updateBrushCursor(e, brush);
  });


  // ─────────────────────────────────────────────────────────────────
  // TOUCH GESTURE STATE — 2-finger tap = undo, 3-finger tap = redo
  // ─────────────────────────────────────────────────────────────────
  S.gestureState = {
    touchTimes: new Map(),  // pointerId → timestamp of touchstart
    peakCount: 0,
  };

  S.showGestureFlash = function showGestureFlash() {
    const el = document.createElement('div');
    el.className = 'gesture-flash';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  // ─────────────────────────────────────────────────────────────────
  // AUTO-HIDE STATE
  // ─────────────────────────────────────────────────────────────────
  S._hideTimer = null;
  S.uiHide = function uiHide() {
    clearTimeout(S._hideTimer);
    document.body.classList.add('nm-drawing');
  }
  S.uiShow = function uiShow(delay: any = 700) {
    clearTimeout(S._hideTimer);
    S._hideTimer = setTimeout(() => document.body.classList.remove('nm-drawing'), delay);
  }

  // ─────────────────────────────────────────────────────────────────
  // DEFERRED SNAPSHOT — never blocks the draw frame
  // ─────────────────────────────────────────────────────────────────
  S._snapTimer = null;
  S.scheduleSnapshot = function scheduleSnapshot(layer: any) {
    layer._dirty = true;   // mark immediately so a forced/idle save never misses this change
    clearTimeout(S._snapTimer);
    S._snapTimer = setTimeout(() => {
      S.saveSnapshot(layer);
      // Debounce thumbnail update too
      setTimeout(() => S.renderLayers(), 50);
    }, 320);
  }

  S.endPointer = function endPointer(e: any) {
    S.activePointers.delete(e.pointerId);
    if (S.activePointers.size < 2) state.pinchStart = null;

    // ─── Touch gesture detection ─────────────────────────────────────
    if (e.pointerType === 'touch' && S.gestureState.touchTimes.has(e.pointerId)) {
      const elapsed = Date.now() - S.gestureState.touchTimes.get(e.pointerId);
      S.gestureState.touchTimes.delete(e.pointerId);

      if (S.gestureState.touchTimes.size === 0) {
        // All fingers lifted — check if it was a quick tap
        if (elapsed < 220 && !state.drawing) {
          if (S.gestureState.peakCount === 2) {
            S.undo();
            S.showGestureFlash();
            S.showHint('↶  Undo');
          } else if (S.gestureState.peakCount === 3) {
            S.redo();
            S.showGestureFlash();
            S.showHint('↷  Redo');
          }
        }
        S.gestureState.peakCount = 0;
      }
    }

    if (state.isPanning) { state.isPanning = false; S.uiShow(200); }

    if (state.lineDrag && (state.lineDrag as any).pointerId === e.pointerId) {
      const ld: any = state.lineDrag;
      state.lineDrag = null;
      state.measurePreview = null;
      S.refreshMeasurements();
      $el('snap-badge').classList.remove('show');
      if (Math.hypot(ld.x2 - ld.x1, ld.y2 - ld.y1) > 3) {
        state.polyPoints = [{ x: ld.x1, y: ld.y1 }, { x: ld.x2, y: ld.y2 }];
        S.commitPolygonShape(false);
      }
      return;
    }

    // Restore UI on lift
    if (e.pointerType === 'pen' || e.pointerType === 'mouse') S.uiShow();

    if (!state.drawing) return;
    state.drawing = false;

    const l = S.activeLayer();
    if (state.tool === 'ruler') {
      const pending = state.measurePreview;
      state.measurePreview = null;
      S.commitMeasurement(pending);
      return;
    }
    if (['rect', 'circle'].includes(state.tool)) {
      if (state._shapeEnd) {
        const s = { x: state.startX, y: state.startY }, en = state._shapeEnd;
        if (state.snapshot) l.ctx.putImageData(state.snapshot, 0, 0);   // wipe the raster preview — shape is vector now
        let geom: any = null, entity: any = null;
        const sw = Math.max(0.5, state.size);
        if (state.tool === 'rect') {
          const x = Math.min(s.x, en.x), y = Math.min(s.y, en.y), w = Math.abs(en.x - s.x), h = Math.abs(en.y - s.y);
          if (w > 2 && h > 2) {
            geom = { kind: 'rect', x, y, w, h };
            entity = { kind:'rect', pts:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}], closed:true, stroke: state.color, width: sw };
          }
        } else {
          const r = Math.hypot(en.x - s.x, en.y - s.y);
          if (r > 2) {
            geom = { kind: 'circle', cx: s.x, cy: s.y, r };
            entity = { kind:'ellipse', cx:s.x, cy:s.y, rx:r, ry:r, stroke: state.color, width: sw };
          }
        }
        state._shapeEnd = null;
        if (entity) {
          const __b = S.vectorSnapshot();
          S.pushShapeEntity(entity);
          S.recordVec(__b);
          S.scheduleAutosave();
          if (entity.id && typeof S.selectShapeById === 'function') {
            S.selectShapeById(entity.id, 'programmatic');
          }
          if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
        }
        S.renderLayers(); S.refreshMeasurements();
        if (geom && typeof S.onShapeCommitted === 'function') S.onShapeCommitted(geom, { x: e.clientX, y: e.clientY });
      }
      return;
    }
    if (S.isDrawTool(state.tool)) {
      const brush = S.activeBrush();
      const tgt = S.strokeTarget();
      if (brush.tipType !== 'texture' && brush.id !== 'eraser-soft' && !state.usingBuffer) tgt.stroke();
      const rect = S._bboxRect(state.strokeBBox);

      if (state.usingBuffer) {
        // Pen path: capture the region BEFORE compositing (cheap), composite the
        // full-res replay, then capture the region AFTER. Region-only undo.
        const segs = state.strokeSegs || [];
        let before = null;
        if (rect) before = l._cur ? S._extractRegion(l._cur, rect.x, rect.y, rect.w, rect.h)
                                  : l.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
        if (segs.length) {
          if (S.replayCanvas.width !== S.doc.wPx || S.replayCanvas.height !== S.doc.hPx) {
            S.replayCanvas.width = S.doc.wPx; S.replayCanvas.height = S.doc.hPx;
          } else {
            S.replayCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
          }
          const fctx = S.replayCtx;
          fctx.strokeStyle = state.strokeColor || state.color;
          fctx.lineCap = brush.tipType === 'chisel' || brush.tipType === 'flat' ? 'square' : 'round';
          fctx.lineJoin = 'round';
          fctx.globalAlpha = 1;
          fctx.beginPath();
          fctx.moveTo(state.strokeStart.x, state.strokeStart.y);
          for (const s of segs) {
            fctx.lineWidth = s.w;
            fctx.quadraticCurveTo(s.cx, s.cy, s.mx, s.my);
            fctx.stroke();
            fctx.beginPath();
            fctx.moveTo(s.mx, s.my);
          }
          l.ctx.save();
          l.ctx.globalAlpha = state.alpha;
          l.ctx.globalCompositeOperation = (brush.blend && brush.blend !== 'source-over') ? brush.blend : 'source-over';
          l.ctx.drawImage(S.replayCanvas, 0, 0);
          l.ctx.restore();
        }
        S.strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
        S.strokeCtx.clearRect(0, 0, S.strokeCanvas.width, S.strokeCanvas.height);
        S.strokeCanvas.style.opacity = '0';        // hide via opacity — keeps the layer alive
        S.strokeCanvas.style.mixBlendMode = 'normal';
        state.usingBuffer = false;
        state.strokeSegs = [];
        if (rect && before) {
          const after = l.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
          S.pushRegionSnapshot(l, rect.x, rect.y, before, after);
        } else {
          S.saveSnapshot(l);
        }
      } else {
        // Eraser path: layer already modified. Pull "before" from the cached full
        // pixels (_cur) and "after" from the layer — both region-sized.
        if (rect && l._cur) {
          const before = S._extractRegion(l._cur, rect.x, rect.y, rect.w, rect.h);
          const after = l.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
          S.pushRegionSnapshot(l, rect.x, rect.y, before, after);
        } else {
          S.saveSnapshot(l);
        }
        // Erases must not reuse a stale cloud raster_path on the next parent save.
        l._rasterPath = null;
      }
      state.strokeBBox = null;
      // Thumbnail refresh — debounced, off the interactive path.
      clearTimeout(S._thumbTimer);
      S._thumbTimer = setTimeout(() => S.renderLayers(), 400);
      l._dirty = true;
      l._savedBlob = null;
      S.scheduleAutosave();
      S.saveDoc();
    }
  }
  S._thumbTimer = null;
  S.paper.addEventListener('pointerup', S.endPointer);
  S.paper.addEventListener('pointerup', () => { if (state._draggingOpening) { state._draggingOpening = false; if (state._slideMoved && state._slideBefore) S.recordVec(state._slideBefore, true); state._slideBefore = null; state._slideMoved = false; S.scheduleAutosave(); } });
  S.paper.addEventListener('pointercancel', S.endPointer);
  S.paper.addEventListener('pointerleave', S.endPointer);

  // Double-click closes the polygon (area / line). Wall uses drag-draw.
  S.paper.addEventListener('dblclick', (e: any) => {
    if ((state.tool === 'area' || (state.tool as any) === 'line') && state.polyActive) {
      e.preventDefault();
      S.finishPoly();
    }
  });

  // Returns the currently active brush (built-in or custom).
  S.activeBrush = function activeBrush() {
    if (state.activeBrush) return state.activeBrush;
    if (S.brushLibraryEngine) {
      const fromLib = S.brushLibraryEngine.get(state.tool);
      if (fromLib) return fromLib;
    }
    return S.BUILTIN_BRUSHES.find((b: any) => b.id === state.tool) || S.BUILTIN_BRUSHES[0];
  }

  S.configurePen = function configurePen(ctx: any, pressure: any, brush: any, skipMaster: any) {
    brush = brush || S.activeBrush();
    const brushApi = S.brushes;
    // Scale-aware mm → px: S.doc.dpi / 25.4, or project pxPerUnit when set.
    const pxPerMm = state.pxPerUnit
      ? (state.scaleUnit === 'mm' ? state.pxPerUnit : state.scaleUnit === 'cm' ? state.pxPerUnit / 10 : state.pxPerUnit / 1000)
      : (S.doc.dpi / 25.4);

    if (brushApi && typeof brushApi.resolveStrokeParams === 'function') {
      const params = brushApi.resolveStrokeParams(brush, pressure, {
        color: state.color,
        size: state.size,
        alpha: state.alpha,
        pxPerMm,
        zoom: state.zoom,
      });
      if (typeof brushApi.applyBrushToCanvasContext === 'function') {
        brushApi.applyBrushToCanvasContext(ctx, brush, params, state.color, {
          skipMasterAlpha: !!skipMaster,
        });
        if (skipMaster) {
          ctx.globalCompositeOperation = brush.kind === 'erase' ? 'destination-out' : 'source-over';
        }
        return params;
      }
    }

    ctx.globalCompositeOperation = brush.kind === 'erase' ? 'destination-out' : (skipMaster ? 'source-over' : brush.blend);
    ctx.strokeStyle = state.color;
    ctx.fillStyle = state.color;
    ctx.lineCap = brush.tipType === 'chisel' || brush.tipType === 'flat' ? 'square' : 'round';
    ctx.lineJoin = 'round';

    let baseSize = state.size;
    if (brush.scaleAware && brush.scaleAware.enabled && brush.scaleAware.lineWeightMm) {
      baseSize = Math.max(0.5, brush.scaleAware.lineWeightMm * pxPerMm);
    }
    const size = Math.max(0.3, baseSize * (1 - (brush.pressureSize || 0) + (brush.pressureSize || 0) * pressure));
    ctx.lineWidth = size;

    if (skipMaster) {
      ctx.globalAlpha = 1;
    } else {
      const alpha = state.alpha * (1 - (brush.pressureOpacity || 0) + (brush.pressureOpacity || 0) * pressure);
      ctx.globalAlpha = Math.min(1, Math.max(0.02, alpha));
    }
    const hard = brush.hardness == null ? 1 : brush.hardness;
    if (brush.kind !== 'erase' && brush.tipType === 'soft' && hard < 0.92) {
      ctx.shadowColor = state.color;
      ctx.shadowBlur = Math.max(0.4, size * (1 - hard) * 1.1);
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    if (brush.dash && brush.dash.enabled) {
      const dash = brush.dash.dashMm || 4;
      const gap = brush.dash.gapMm || 2;
      ctx.setLineDash(brush.dash.pattern === 'centerline' ? [dash * 3, gap, dash, gap] : [dash, gap]);
    } else {
      ctx.setLineDash([]);
    }
    return null;
  }

  // Get or load an Image object for a tip dataUrl, cached.
  S.getTipImage = function getTipImage(dataUrl: any) {
    if (!dataUrl) return null;
    let img = state.tipImageCache[dataUrl];
    if (img) {
      if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) return img;  // ready grain canvas
      return (img as any).complete ? img : null;
    }
    img = new Image();
    img.src = dataUrl;
    state.tipImageCache[dataUrl] = img;
    return (img as any).complete ? img : null;
  }

  // Stamp a tinted textured tip at (x,y) on the given context.
  S.stampTexture = function stampTexture(ctx: any, brush: any, x: any, y: any, pressure: any) {
    const img = S.getTipImage(brush.tipImage);
    if (!img) return;
    const effSize = Math.max(2, brush.size * (1 - brush.pressureSize + brush.pressureSize * pressure));
    // jitter
    let jx = 0, jy = 0, sScale = 1;
    if (brush.jitter > 0) {
      jx = (Math.random() - 0.5) * effSize * brush.jitter * 0.5;
      jy = (Math.random() - 0.5) * effSize * brush.jitter * 0.5;
      sScale = 1 - brush.jitter * 0.3 + Math.random() * brush.jitter * 0.6;
    }
    const w = effSize * sScale, h = effSize * sScale;
    // Build a tinted version of the tip into an offscreen canvas, then draw.
    const off = document.createElement('canvas');
    off.width = Math.max(2, Math.ceil(w));
    off.height = Math.max(2, Math.ceil(h));
    const oc = off.getContext('2d') as any;
    oc.drawImage(img, 0, 0, off.width, off.height);
    oc.globalCompositeOperation = 'source-in';
    oc.fillStyle = state.color;
    oc.fillRect(0, 0, off.width, off.height);

    const baseAlpha = state.alpha;
    const alpha = baseAlpha * (1 - brush.pressureOpacity + brush.pressureOpacity * pressure);
    ctx.save();
    ctx.globalCompositeOperation = brush.blend;
    ctx.globalAlpha = brush.kind === 'erase' ? 1 : Math.min(1, Math.max(0.02, alpha));
    ctx.drawImage(off, x - w/2 + jx, y - h/2 + jy, w, h);
    ctx.restore();
  }

  /* =================== MOUSE WHEEL ZOOM =================== */
  // Panels/popovers inside #canvas-area must keep native scroll — don't steal the wheel for zoom.
  S.isWheelOverScrollableUi = function isWheelOverScrollableUi(target: any) {
    if (!target || !target.closest) return false;
    return !!target.closest([
      '#brush-library',
      '#brush-list',
      '#brush-flyout',
      '#brush-modal',
      '#layers-panel',
      '#color-popover',
      '#stencil-popover',
      '#grid-popover',
      '#guide-popover',
      '#overflow-panel',
      '#canvas-size-dialog',
      '#scale-prompt',
      '.popover',
      '.brush-library',
      '.layers-scroll',
      'input',
      'textarea',
      'select',
    ].join(','));
  };
  S.area.addEventListener('wheel', (e: any) => {
    if (S.isWheelOverScrollableUi(e.target)) return;
    // Allow scroll-wheel zoom in draw mode (graphic tablets) without requiring Ctrl
    if (e.ctrlKey || e.metaKey || state.mode === 'navigate' || state.mode === 'draw') {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const oldZoom = state.zoom;
      state.zoom = Math.max(0.2, Math.min(8, state.zoom * (1 + delta)));
      // zoom around cursor
      const areaRect = S.area.getBoundingClientRect();
      const cx = e.clientX - areaRect.left - areaRect.width/2;
      const cy = e.clientY - areaRect.top - areaRect.height/2;
      const factor = state.zoom / oldZoom;
      state.panX = cx - (cx - state.panX) * factor;
      state.panY = cy - (cy - state.panY) * factor;
      S.applyStageTransform();
    }
  }, { passive: false });

  /* =================== NAVIGATE: pan on canvas-area background =================== */
  S.startAreaPan = function startAreaPan(e: any) {
    if (state.mode !== 'navigate' && state.tool !== 'hand') return false;
    if (!S.area || (S.paper && (e.target === S.paper || S.paper.contains(e.target)))) return false;
    e.preventDefault();
    S.area.setPointerCapture(e.pointerId);
    S.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    state.isPanning = true;
    state.panStartX = e.clientX - state.panX;
    state.panStartY = e.clientY - state.panY;
    S.area.style.cursor = 'grabbing';
    return true;
  }

  S.area.addEventListener('pointerdown', (e: any) => { S.startAreaPan(e); });

  S.area.addEventListener('pointermove', (e: any) => {
    if (!state.isPanning) return;
    if (state.mode !== 'navigate' && state.tool !== 'hand') return;
    if (S.area.hasPointerCapture && !S.area.hasPointerCapture(e.pointerId)) return;
    state.panX = e.clientX - state.panStartX;
    state.panY = e.clientY - state.panStartY;
    S.applyStageTransform();
  });

  S.area.addEventListener('pointerup', (e: any) => {
    if (state.isPanning && S.area.hasPointerCapture && S.area.hasPointerCapture(e.pointerId)) {
      state.isPanning = false;
      S.area.releasePointerCapture(e.pointerId);
      if (state.mode === 'navigate') S.area.style.cursor = 'grab';
      else S.area.style.cursor = '';
    }
  });

  S.area.addEventListener('pointercancel', (e: any) => {
    if (S.area.hasPointerCapture && S.area.hasPointerCapture(e.pointerId)) {
      state.isPanning = false;
      S.area.releasePointerCapture(e.pointerId);
      S.area.style.cursor = state.mode === 'navigate' ? 'grab' : '';
    }
  });


}
