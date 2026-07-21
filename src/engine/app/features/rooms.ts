/* Feature: rooms — shared scope S */
import { S } from "../scope";

export function initRooms() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);
  /* =================================================================
     FEATURE 3 — ROOM AREA POLYGON
     ================================================================= */
  state.polyPoints = [];
  state.polyActive = false;

  S.startPolyTool = function startPolyTool() {
    state.polyPoints = [];
    state.polyActive = true;
    $el('poly-hint').style.display = 'block';
    S.refreshAreaOverlay();
  }

  S.snapVertex = function snapVertex(p: any) {
    if (state.snapEnabled === false) return { x: p.x, y: p.y, snap: null };
    const scale = (state.zoom || 1) * (state.baseZoom || 1);
    const thr = 14 / scale;                 // 14 screen-px tolerance → doc px
    // 1) snap to an existing corner (rooms, poly points, wall endpoints)
    let best: any = null, bestD = thr;
    const consider = (v: any) => { const d = Math.hypot(p.x - v.x, p.y - v.y); if (d < bestD) { bestD = d; best = v; } };
    state.measurements.forEach((m: any) => { if (m.type === 'area' && m.points) m.points.forEach(consider); });
    state.polyPoints.forEach(consider);
    if (state.wallsVisible !== false) {
      (state.walls || []).forEach((w: any) => { if (w.pts) w.pts.forEach(consider); });
    }
    if (best) return { x: best.x, y: best.y, snap: 'corner' };
    // 2) snap to the grid when one is shown
    if (state.showGrid && state.gridType && state.gridType !== 'off') {
      const sp = S.mmToDocPx(state.gridSpacingMM);
      if (sp > 1) {
        const gx = Math.round(p.x / sp) * sp, gy = Math.round(p.y / sp) * sp;
        if (Math.hypot(p.x - gx, p.y - gy) < thr) return { x: gx, y: gy, snap: 'grid' };
      }
    }
    return { x: p.x, y: p.y, snap: null };
  }

  S.flashSnap = function flashSnap(kind: any) {
    const b = $el('snap-badge');
    if (!b) return;
    b.textContent = kind === 'grid' ? '\u2610 GRID SNAP' : '\u2610 CORNER SNAP';
    b.classList.add('show');
    clearTimeout(state._snapBadgeT);
    state._snapBadgeT = setTimeout(() => b.classList.remove('show'), 650);
  }

  S.addPolyVertex = function addPolyVertex(p: any) {
    if (!state.polyActive) return;
    const s = S.snapVertex(p);
    p = { x: s.x, y: s.y };
    if (s.snap) S.flashSnap(s.snap);
    // Close if near first vertex (larger hit target for polygon / wall / area)
    if (state.polyPoints.length >= 3) {
      const first = state.polyPoints[0];
      const dx = p.x - first.x, dy = p.y - first.y;
      const screenDist = Math.sqrt(dx*dx+dy*dy) * state.zoom * state.baseZoom;
      if (screenDist < 28) { S.closePoly(); return; }
    }
    state.polyPoints.push({ x: p.x, y: p.y });
    S.refreshAreaOverlay();
  }

  S.closePoly = function closePoly() {
    if (state.tool === 'wall') { S.commitWall(true); return; }
    if (state.polyPoints.length < 3) return;
    if (state.tool === 'line') { S.commitPolygonShape(true); return; }
    const area = S.shoelaceArea(state.polyPoints);
    const areaLabel = S.formatArea(area);
    const roomName = 'Room ' + (state.measurements.filter((m: any) => m.type === 'area').length + 1);
    const __b = S.vectorSnapshot();
    state.measurements.push({
      type: 'area',
      name: roomName,
      points: [...state.polyPoints],
      label: areaLabel,
      x1: state.polyPoints[0].x, y1: state.polyPoints[0].y,
      x2: state.polyPoints[0].x, y2: state.polyPoints[0].y,
    });
    state.polyPoints = [];
    state.polyActive = false;
    $el('poly-hint').style.display = 'none';
    S.refreshMeasurements();
    S.renderSchedule();
    S.recordVec(__b);
    S.showHint(`${roomName}: ${areaLabel}`);
  }

  // Finish the in-progress polyline. Polygon tool: 3+ pts → closed polygon,
  // exactly 2 → an open line, otherwise cancel. Area tool: needs 3+ to close.
  S.finishPoly = function finishPoly() {
    if (state.tool === 'wall') {
      if (state.polyPoints.length >= 2) S.commitWall(false); else S.cancelPoly();
      return;
    }
    if (state.tool === 'line') {
      if (state.polyPoints.length >= 3) S.commitPolygonShape(true);
      else if (state.polyPoints.length === 2) S.commitPolygonShape(false);
      else S.cancelPoly();
    } else if (state.polyPoints.length >= 3) {
      S.closePoly();
    }
  }

  S.commitWall = function commitWall(closed: any) {
    const pts = state.polyPoints.slice();
    if (pts.length < 2) { S.cancelPoly(); return; }
    if (closed && pts.length >= 3 &&
        (pts[0].x !== pts[pts.length - 1].x || pts[0].y !== pts[pts.length - 1].y)) {
      pts.push({ x: pts[0].x, y: pts[0].y });   // seal the loop
    }
    const __b = S.vectorSnapshot();
    const wall: any = { pts, thickMM: state.wallThickMM, heightM: state.wallHeightM };
    S.ensureWallId(wall);
    const n = (state.walls || []).length + 1;
    const isClosed = !!(closed && pts.length >= 3 &&
      pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y);
    wall.name = isClosed ? ('Room ' + n) : ('Wall ' + n);
    state.walls.push(wall);
    // Vector-only: do not bake a centerline onto the sketch canvas — that line
    // ghosts when the wall is moved or its layer visibility is toggled off.
    state.polyPoints = [];
    state.polyActive = false;
    $el('poly-hint').style.display = 'none';
    S.refreshMeasurements();
    S.syncWallsToMasses();
    S.registerWallInLayerPanel(wall);
    S.recordVec(__b);
    S.scheduleAutosave();
    S.showHint(`Wall added · ${state.wallThickMM} mm \u00d7 ${state.wallHeightM} m · view in 3D`);
  }

  S.cancelPoly = function cancelPoly() {
    state.polyPoints = [];
    state.polyActive = false;
    const ph = $el('poly-hint');
    if (ph) ph.style.display = 'none';
    S.refreshMeasurements();
  }

  // Commit the in-progress polygon as a vector entity (SVG overlay).
  // closed=true → closed polygon (fill/extrude-ready); false → open polyline.
  // Do NOT bake onto the sketch canvas — baked ink ghosts when the vector moves.
  S.commitPolygonShape = function commitPolygonShape(closed: any) {
    const pts = state.polyPoints.slice();
    if (pts.length < 2) { S.cancelPoly(); return; }
    const isPolygon = closed && pts.length >= 3;
    const entity: any = { kind: 'polygon', pts: pts.map((p: any) => ({ x: p.x, y: p.y })), closed: !!closed, stroke: state.color, width: Math.max(0.5, state.size) };
    const __b = S.vectorSnapshot(); S.pushShapeEntity(entity); S.recordVec(__b); S.scheduleAutosave();
    state.polyPoints = [];
    state.polyActive = false;
    const ph = $el('poly-hint');
    if (ph) ph.style.display = 'none';
    S.refreshMeasurements();
    S.renderLayers();
    if (entity.id && typeof S.selectShapeById === 'function') {
      S.selectShapeById(entity.id, 'programmatic');
    }
    if (isPolygon && typeof S.onShapeCommitted === 'function') {
      S.onShapeCommitted({ kind: 'polygon', pts }, state._lastPolyClient);
    }
    if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
    S.showHint(isPolygon ? 'Polygon placed — drag to move' : 'Line placed — drag to move');
  }

  S.shoelaceArea = function shoelaceArea(pts: any) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area) / 2; // in doc px²
  }

  S.perimeterPx = function perimeterPx(pts: any, closed: any = true) {
    if (!pts || pts.length < 2) return 0;
    let per = 0;
    const n = pts.length;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      per += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return per; // in doc px
  }

  S.formatArea = function formatArea(areaPx2: any) {
    if (state.pxPerUnit && state.scaleUnit) {
      const u = state.scaleUnit;
      const unitInMm = { mm:1, cm:10, m:1000, in:25.4, ft:304.8 }[u] || 1;
      const mmPerPx = unitInMm / state.pxPerUnit;
      const areaMm2 = areaPx2 * mmPerPx * mmPerPx;   // true physical area, in mm²
      if (u === 'in' || u === 'ft') {                // imperial family → in² ↔ ft²
        const ft2 = areaMm2 / 92903.04;              // 1 ft² = 304.8² mm²
        if (ft2 >= 1) return `${ft2.toFixed(2)} ft²`;
        return `${(areaMm2 / 645.16).toFixed(1)} in²`; // 1 in² = 25.4² mm²
      }
      // metric family → mm² ↔ cm² ↔ m²
      const m2 = areaMm2 / 1e6;
      if (m2 >= 1) return `${m2.toFixed(2)} m²`;
      const cm2 = areaMm2 / 100;
      if (cm2 >= 1) return `${cm2.toFixed(1)} cm²`;
      return `${areaMm2.toFixed(0)} mm²`;
    }
    // No scale set — estimate from canvas px
    const docPxPerMm = S.doc.wPx / S.doc.wMM;
    const areaMm2 = areaPx2 / (docPxPerMm * docPxPerMm);
    return `${(areaMm2 / 100).toFixed(0)} cm² (est.)`;
  }

  S.formatLen = function formatLen(px: any) {
    if (state.pxPerUnit && state.scaleUnit) {
      const u = state.scaleUnit;
      const unitInMm = { mm:1, cm:10, m:1000, in:25.4, ft:304.8 }[u] || 1;
      const mm = (px / state.pxPerUnit) * unitInMm;   // true physical length, in mm
      if (u === 'in' || u === 'ft') {                 // imperial → in ↔ ft
        const ft = mm / 304.8;
        if (ft >= 1) return `${ft.toFixed(2)} ft`;
        return `${(mm / 25.4).toFixed(1)} in`;
      }
      const m = mm / 1000;                            // metric → mm ↔ cm ↔ m
      if (m >= 1) return `${m.toFixed(2)} m`;
      const cm = mm / 10;
      if (cm >= 1) return `${cm.toFixed(1)} cm`;
      return `${mm.toFixed(0)} mm`;
    }
    return `${Math.round(px)} px`;
  }

  S.ensureSchedulePanel = function ensureSchedulePanel() {
    if (document.getElementById('room-schedule')) return;
    const style = document.createElement('style');
    style.textContent = `
      #room-schedule{position:fixed;left:68px;bottom:16px;width:290px;max-height:46vh;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.10);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.20);z-index:30;display:none;flex-direction:column;overflow:hidden;}
      #room-schedule.show{display:flex;}
      #rs-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(0,0,0,0.08);}
      #rs-head .t{font-size:12px;font-weight:700;letter-spacing:0.4px;color:#0a0a0a;flex:1;}
      #rs-head button{border:none;background:transparent;cursor:pointer;font-size:14px;color:#666;padding:2px 7px;border-radius:6px;}
      #rs-head button:hover{background:rgba(0,0,0,0.06);}
      #rs-rows{overflow-y:auto;padding:3px 0;}
      .rs-row{display:flex;align-items:center;gap:5px;padding:5px 10px 5px 12px;}
      .rs-row input.nm{flex:1;min-width:0;border:1px solid transparent;background:transparent;font-family:inherit;font-size:12px;font-weight:600;color:#0a0a0a;padding:3px 5px;border-radius:5px;}
      .rs-row input.nm:focus{border-color:#cbcbcb;background:#fff;outline:none;}
      .rs-row .ar{font-family:JetBrains Mono,monospace;font-size:11px;color:#333;white-space:nowrap;}
      .rs-row .vd{font-size:9px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:#888;cursor:pointer;border:1px solid #cbcbcb;border-radius:5px;padding:3px 5px;user-select:none;}
      .rs-row .vd.on{background:#a02835;color:#fff;border-color:#a02835;}
      .rs-row .dl{border:none;background:transparent;color:#b00020;cursor:pointer;font-size:16px;line-height:1;padding:0 3px;}
      .rs-row.void input.nm{text-decoration:line-through;color:#9aa;}
      #rs-foot{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;border-top:1px solid rgba(0,0,0,0.08);}
      #rs-foot .tl{font-size:11px;font-weight:700;letter-spacing:0.6px;color:#666;text-transform:uppercase;}
      #rs-foot .tv{font-family:JetBrains Mono,monospace;font-size:14px;font-weight:700;color:#15803d;}
      #rs-toggle{position:fixed;left:68px;bottom:16px;z-index:29;background:#15803d;color:#fff;border:none;border-radius:20px;padding:9px 15px;font-family:inherit;font-size:12px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(0,0,0,0.22);cursor:pointer;display:none;align-items:center;gap:6px;}
      #rs-toggle.show{display:flex;}
    `;
    document.head.appendChild(style);
    const panel = document.createElement('div');
    panel.id = 'room-schedule';
    panel.innerHTML = '<div id="rs-head"><span class="t">Room Schedule</span><button id="rs-collapse" title="Hide">\u25be</button></div><div id="rs-rows"></div><div id="rs-foot"><span class="tl">Total</span><span class="tv" id="rs-total">\u2014</span></div>';
    document.body.appendChild(panel);
    const toggle = document.createElement('button');
    toggle.id = 'rs-toggle';
    document.body.appendChild(toggle);
    $el('rs-collapse').addEventListener('click', () => { state._scheduleHidden = true; S.renderSchedule(); });
    toggle.addEventListener('click', () => { state._scheduleHidden = false; S.renderSchedule(); });
  }

  S.scheduleAreaRooms = function scheduleAreaRooms() {
    return state.measurements
      .map((m: any, i: any) => ({ m, i }))
      .filter((o: any) => o.m.type === 'area' && o.m.points && o.m.points.length >= 3);
  }

  S.renderSchedule = function renderSchedule() {
    S.ensureSchedulePanel();
    const panel = $el('room-schedule');
    const toggle = $el('rs-toggle');
    const rows = $el('rs-rows');
    const rooms = S.scheduleAreaRooms();

    if (rooms.length === 0) {
      panel.classList.remove('show');
      toggle.classList.remove('show');
      rows.innerHTML = '';
      return;
    }

    rows.innerHTML = '';
    let totalPx2 = 0;
    rooms.forEach(({ m, i }: any) => {
      const a = S.shoelaceArea(m.points);
      if (!m.void) totalPx2 += a;   // void = kept for reference but not counted

      const row = document.createElement('div');
      row.className = 'rs-row' + (m.void ? ' void' : '');

      const nm = document.createElement('input');
      nm.className = 'nm';
      nm.value = m.name || ('Room ' + (i + 1));
      nm.setAttribute('aria-label', 'Room name');
      nm.addEventListener('input', () => { m.name = nm.value; });
      nm.addEventListener('change', () => { m.name = nm.value; S.refreshMeasurements(); S.scheduleAutosave(); });

      const ar = document.createElement('span');
      ar.className = 'ar';
      ar.innerHTML = S.formatArea(a) + ' <span style="color:#9aa;font-weight:400;">\u00b7 ' + S.formatLen(S.perimeterPx(m.points)) + '</span>';

      const vd = document.createElement('span');
      vd.className = 'vd' + (m.void ? ' on' : '');
      vd.textContent = 'void';
      vd.title = 'Subtract from total (courtyard, shaft, etc.)';
      vd.addEventListener('click', () => { m.void = !m.void; S.refreshMeasurements(); S.renderSchedule(); S.scheduleAutosave(); });

      const dl = document.createElement('button');
      dl.className = 'dl';
      dl.textContent = '\u00d7';
      dl.title = 'Delete room';
      dl.addEventListener('click', () => { S.deleteMeasurement(i); });

      row.append(nm, ar, vd, dl);
      rows.appendChild(row);
    });

    $el('rs-total').textContent = S.formatArea(Math.max(0, totalPx2));

    if (state._scheduleHidden) {
      panel.classList.remove('show');
      toggle.textContent = 'Schedule (' + rooms.length + ')';
      toggle.classList.add('show');
    } else {
      panel.classList.add('show');
      toggle.classList.remove('show');
    }
  }

  S.wallThickPx = function wallThickPx(w: any) {
    return Math.max(2, (w.thickMM / 1000) * S.pxPerMetre());
  }

  S._SVGNS = 'http://www.w3.org/2000/svg';
  S._ovLine = function _ovLine(x1: any, y1: any, x2: any, y2: any, stroke: any, wdt: any, dash: any) {
    const l = document.createElementNS(S._SVGNS, 'line');
    l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1)); l.setAttribute('x2', String(x2)); l.setAttribute('y2', String(y2));
    l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', String(wdt)); l.setAttribute('stroke-linecap', 'round');
    if (dash) l.setAttribute('stroke-dasharray', dash);
    S.rulerOverlay.appendChild(l);
  }
  // Door plan symbol: leaf + quarter swing arc. J0/J1 = jamb centre points; px,py = wall normal.
  S.drawDoorSymbol = function drawDoorSymbol(o: any, J0: any, J1: any, px: any, py: any, col: any) {
    const Wpx = Math.hypot(J1.x - J0.x, J1.y - J0.y);
    const hand = (o.hand >= 0) ? 1 : -1, sw = (o.swing >= 0) ? 1 : -1;
    const H = hand > 0 ? J0 : J1, O = hand > 0 ? J1 : J0;   // hinge / latch jamb
    const tip = { x: H.x + px * sw * Wpx, y: H.y + py * sw * Wpx };
    S._ovLine(H.x, H.y, tip.x, tip.y, col, 1.6);               // leaf at 90°
    const a0 = Math.atan2(O.y - H.y, O.x - H.x), a1 = Math.atan2(tip.y - H.y, tip.x - H.x);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    let d = `M ${O.x} ${O.y}`;
    for (let k = 1; k <= 16; k++) { const ang = a0 + da * (k / 16); d += ` L ${H.x + Math.cos(ang) * Wpx} ${H.y + Math.sin(ang) * Wpx}`; }
    const arc = document.createElementNS(S._SVGNS, 'path');
    arc.setAttribute('d', d); arc.setAttribute('fill', 'none'); arc.setAttribute('stroke', '#9a9a9a'); arc.setAttribute('stroke-width', '1'); arc.setAttribute('stroke-dasharray', '4 3');
    S.rulerOverlay.appendChild(arc);
  }
  // Window plan symbol: frame faces across the opening + two glass lines.
  S.drawWindowSymbol = function drawWindowSymbol(o: any, J0: any, J1: any, px: any, py: any, h: any, col: any) {
    S._ovLine(J0.x + px*h, J0.y + py*h, J1.x + px*h, J1.y + py*h, col, 1.2);
    S._ovLine(J0.x - px*h, J0.y - py*h, J1.x - px*h, J1.y - py*h, col, 1.2);
    const g = h * 0.42;
    S._ovLine(J0.x + px*g, J0.y + py*g, J1.x + px*g, J1.y + py*g, '#4a6b8a', 1);
    S._ovLine(J0.x - px*g, J0.y - py*g, J1.x - px*g, J1.y - py*g, '#4a6b8a', 1);
  }

  /** Whether a room wall segment should draw (LayerEngine per-face visibility). */
  S.isWallSegmentVisible = function isWallSegmentVisible(wall: any, seg: any) {
    if (!wall || wall.visible === false) return false;
    if (!S.layerEngine || !wall.id) return true;
    const face = S.findEngineObjectByLegacy(
      (r: any) => r.kind === 'wall-face' && r.wallId === wall.id && r.seg === seg,
    );
    if (!face) return true;
    return S.layerEngine.isEffectivelyVisible(face.id);
  };

  // Render one wall: poché + double-lines, broken at openings, with door/window symbols.
  S.renderOneWall = function renderOneWall(w: any, svgns: any, wi: any) {
    const pts = w.pts;
    if (!pts || pts.length < 2) return;
    const tPx = S.wallThickPx(w), h = tPx / 2;
    const n = pts.length;
    const closed = n > 2 && pts[0].x === pts[n - 1].x && pts[0].y === pts[n - 1].y;
    const segs = n - 1;
    const ppm = S.pxPerMetre();
    const wallSelected = state.sel && state.sel.type === 'wall' && state.sel.wi === wi;
    const selSeg = wallSelected ? state.sel.seg : undefined;
    for (let i = 0; i < segs; i++) {
      if (!S.isWallSegmentVisible(w, i)) continue;
      // Highlight only the selected face when a segment is active; whole room if Room is selected.
      const selThis = wallSelected && (typeof selSeg !== 'number' || selSeg === i);
      const wFill = selThis ? 'rgba(160,40,53,0.32)' : 'rgba(48,48,52,0.82)';
      const wcol = selThis ? '#a02835' : '#161616';
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, segLen = Math.hypot(dx, dy) || 1e-6;
      const ux = dx / segLen, uy = dy / segLen, px = -uy, py = ux;
      const sIn = closed || i > 0, eIn = closed || i < segs - 1;
      const ops = (w.openings || []).map((o: any, idx: any) => ({ o, idx })).filter((x: any) => x.o.seg === i).map((x: any) => {
        const half = (x.o.wMM / 1000 * ppm) / 2, c = x.o.t * segLen;
        return { o: x.o, idx: x.idx, d0: Math.max(0, c - half), d1: Math.min(segLen, c + half) };
      }).sort((A: any, B: any) => A.d0 - B.d0);
      // solid spans = segment minus opening intervals
      const spans = []; let cur = 0;
      ops.forEach((op: any) => { if (op.d0 > cur) spans.push([cur, op.d0]); cur = Math.max(cur, op.d1); });
      if (cur < segLen) spans.push([cur, segLen]);
      spans.forEach(([s0, s1]) => {
        const startJoint = (s0 <= 0.01 && sIn), endJoint = (s1 >= segLen - 0.01 && eIn);
        const pax = a.x + ux * (s0 - (startJoint ? h : 0)), pay = a.y + uy * (s0 - (startJoint ? h : 0));
        const pbx = a.x + ux * (s1 + (endJoint ? h : 0)), pby = a.y + uy * (s1 + (endJoint ? h : 0));
        const poly = document.createElementNS(svgns, 'polygon');
        poly.setAttribute('points', `${pax + px*h},${pay + py*h} ${pbx + px*h},${pby + py*h} ${pbx - px*h},${pby - py*h} ${pax - px*h},${pay - py*h}`);
        poly.setAttribute('fill', wFill); poly.setAttribute('stroke', 'none');
        S.rulerOverlay.appendChild(poly);
        const ls = s0 + (startJoint ? h : 0), le = s1 - (endJoint ? h : 0);
        const Ax = a.x + ux*ls, Ay = a.y + uy*ls, Bx = a.x + ux*le, By = a.y + uy*le;
        S._ovLine(Ax + px*h, Ay + py*h, Bx + px*h, By + py*h, wcol, 1.5);
        S._ovLine(Ax - px*h, Ay - py*h, Bx - px*h, By - py*h, wcol, 1.5);
        if (s0 <= 0.01 && !sIn) S._ovLine(a.x + px*h, a.y + py*h, a.x - px*h, a.y - py*h, wcol, 1.5);
        if (s1 >= segLen - 0.01 && !eIn) S._ovLine(b.x + px*h, b.y + py*h, b.x - px*h, b.y - py*h, wcol, 1.5);
      });
      ops.forEach((op: any) => {
        const sel = state.selOpening2D && state.selOpening2D.wi === wi && state.selOpening2D.idx === op.idx;
        const col = sel ? '#a02835' : '#161616';
        const J0 = { x: a.x + ux*op.d0, y: a.y + uy*op.d0 }, J1 = { x: a.x + ux*op.d1, y: a.y + uy*op.d1 };
        S._ovLine(J0.x + px*h, J0.y + py*h, J0.x - px*h, J0.y - py*h, col, 1.6);
        S._ovLine(J1.x + px*h, J1.y + py*h, J1.x - px*h, J1.y - py*h, col, 1.6);
        if (op.o.kind === 'door') S.drawDoorSymbol(op.o, J0, J1, px, py, col);
        else S.drawWindowSymbol(op.o, J0, J1, px, py, h, col);
      });
    }
  }

  S.renderShapes2D = function renderShapes2D() {
    const svgns = 'http://www.w3.org/2000/svg';
    (state.shapes || []).forEach((sh: any, si: any) => {
      if (sh.visible === false) return;
      const engObj = (S.layerEngine && sh.id && typeof S.findEngineObjectByLegacy === 'function')
        ? S.findEngineObjectByLegacy((r: any) => r.kind === 'shape' && r.id === sh.id)
        : null;
      if (engObj && engObj.visible === false) return;
      const selSh = state.sel && state.sel.type === 'shape' && (
        state.sel.idx === si || (state.sel.id && sh.id && state.sel.id === sh.id)
      );
      const stroke = selSh ? '#a02835' : (sh.stroke || '#1c1a18');
      const w = sh.width || 2;
      const shapeOpacity = typeof sh.opacity === 'number' ? sh.opacity
        : (engObj && typeof engObj.opacity === 'number' ? engObj.opacity : 1);
      const clipId = 'shclip_' + si;
      if (sh.bgImage) {
        // Background image clipped to shape bounds
        const defs = document.createElementNS(svgns, 'defs');
        const clip = document.createElementNS(svgns, 'clipPath');
        clip.setAttribute('id', clipId);
        if (sh.kind === 'ellipse') {
          const c = document.createElementNS(svgns, 'ellipse');
          c.setAttribute('cx', String(sh.cx)); c.setAttribute('cy', String(sh.cy));
          c.setAttribute('rx', String(sh.rx)); c.setAttribute('ry', String(sh.ry));
          clip.appendChild(c);
        } else if (sh.pts && sh.pts.length >= 3) {
          const c = document.createElementNS(svgns, 'polygon');
          c.setAttribute('points', sh.pts.map((p: any) => `${p.x},${p.y}`).join(' '));
          clip.appendChild(c);
        }
        defs.appendChild(clip);
        S.rulerOverlay.appendChild(defs);
        let bx, by, bw, bh;
        if (sh.kind === 'ellipse') {
          bx = sh.cx - sh.rx; by = sh.cy - sh.ry; bw = sh.rx * 2; bh = sh.ry * 2;
        } else {
          const xs = sh.pts.map((p: any) => p.x), ys = sh.pts.map((p: any) => p.y);
          bx = Math.min(...xs); by = Math.min(...ys);
          bw = Math.max(...xs) - bx; bh = Math.max(...ys) - by;
        }
        const img = document.createElementNS(svgns, 'image');
        img.setAttribute('href', sh.bgImage);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', sh.bgImage);
        img.setAttribute('x', String(bx)); img.setAttribute('y', String(by));
        img.setAttribute('width', String(bw)); img.setAttribute('height', String(bh));
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        img.setAttribute('clip-path', 'url(#' + clipId + ')');
        S.rulerOverlay.appendChild(img);
      }
      if (sh.kind === 'ellipse') {
        const el = document.createElementNS(svgns, 'ellipse');
        el.setAttribute('cx', String(sh.cx)); el.setAttribute('cy', String(sh.cy));
        el.setAttribute('rx', String(sh.rx)); el.setAttribute('ry', String(sh.ry));
        el.setAttribute('fill', 'none'); el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', String(w));
        el.setAttribute('opacity', String(shapeOpacity));
        S.rulerOverlay.appendChild(el);
      } else {
        const pts = sh.pts || []; if (pts.length < 2) return;
        const tag = (sh.closed || sh.kind === 'rect') ? 'polygon' : 'polyline';
        const el = document.createElementNS(svgns, tag);
        el.setAttribute('points', pts.map((p: any) => `${p.x},${p.y}`).join(' '));
        el.setAttribute('fill', 'none'); el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', String(w));
        el.setAttribute('stroke-linejoin', 'round'); el.setAttribute('stroke-linecap', 'round');
        el.setAttribute('opacity', String(shapeOpacity));
        S.rulerOverlay.appendChild(el);
      }
    });
  }

  S.renderWalls2D = function renderWalls2D() {
    if (state.wallsVisible === false) return;
    if (!state.walls || !state.walls.length) return;
    const svgns = S._SVGNS;
    state.walls.forEach((w: any, wi: any) => {
      if (w.visible === false) return;
      S.renderOneWall(w, svgns, wi);
    });
  }

  // Rebuild extruded wall masses from the 2D walls (carrying openings) so they appear & cut in 3D.
  // Face features added in 3D (push/pull regions, sketches, materials) are preserved across the
  // rebuild, keyed by wall:segment, so a 2D↔3D round-trip or a reload doesn't wipe them.
  /** True when a mass footprint matches a wall-segment poly (catches duplicates that lost _fromWall). */
  S.massPolyMatchesWallSeg = function massPolyMatchesWallSeg(poly: any, expected: any, tol: any = 0.04) {
    if (!poly || !expected || poly.length !== expected.length) return false;
    const used = new Array(expected.length).fill(false);
    for (let i = 0; i < poly.length; i++) {
      let hit = -1;
      for (let j = 0; j < expected.length; j++) {
        if (used[j]) continue;
        if (Math.hypot(poly[i].x - expected[j].x, (poly[i].z ?? 0) - (expected[j].z ?? 0)) <= tol) {
          hit = j; break;
        }
      }
      if (hit < 0) return false;
      used[hit] = true;
    }
    return true;
  };

  S.syncWallsToMasses = function syncWallsToMasses() {
    if (typeof S.massing === 'undefined' || !S.massing.masses) return;
    const anchor = S.massing.baseAnchor || { px: S.doc.wPx / 2, py: S.doc.hPx / 2, ppm: S.pxPerMetre() };
    const ax = anchor.px, ay = anchor.py, ppm = anchor.ppm || S.pxPerMetre();
    const saved: any = {};
    S.massing.masses.forEach((m: any) => {
      if (m._fromWall && m._wallKey) {
        saved[m._wallKey] = {
          faceRegions: m.faceRegions, faceArt: m.faceArt, faceMat: m.faceMat, _faceImg: m._faceImg,
        };
      }
    });

    // Planned wall footprints to regenerate (and to cull stale duplicates against).
    const planned: any[] = [];
    (state.walls || []).forEach((w: any, wi: any) => {
      if (w.visible === false) return;
      const tW = (w.thickMM || 230) / 1000;
      const pts = w.pts || [];
      for (let i = 0; i < pts.length - 1; i++) {
        if (typeof S.isWallSegmentVisible === 'function' && !S.isWallSegmentVisible(w, i)) continue;
        const a = { x: (pts[i].x - ax) / ppm, z: (pts[i].y - ay) / ppm };
        const b = { x: (pts[i + 1].x - ax) / ppm, z: (pts[i + 1].y - ay) / ppm };
        planned.push({
          wi, seg: i, a, b, tW, h: (w.heightM || 3),
          poly: S.wallSegPoly(a, b, tW),
          openings: (w.openings || []).filter((o: any) => o.seg === i),
          wallKey: wi + ':' + i,
        });
      }
    });

    // Drop regenerated walls + orphaned copies left after saves that stripped _fromWall/_wall.
    S.massing.masses = S.massing.masses.filter((m: any) => {
      if (m._fromWall) return false;
      if (m._wall && m._wallKey) return false;
      if (planned.length && m.poly && planned.some((p: any) => S.massPolyMatchesWallSeg(m.poly, p.poly))) {
        return false;
      }
      return true;
    });

    planned.forEach((p: any) => {
      const mass: any = {
        poly: p.poly,
        h: p.h,
        _wall: true,
        _fromWall: true,
        _wallKey: p.wallKey,
      };
      if (p.openings && p.openings.length) {
        const segLenW = Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z), massLen = segLenW + p.tW;
        mass.openings = p.openings.map((o: any) => {
          const u = Math.min(0.97, Math.max(0.03, (o.t * segLenW + p.tW / 2) / massLen));
          return { kind: o.kind, u, w: o.wMM / 1000, h: o.hMM / 1000, sill: o.sillMM / 1000 };
        });
      }
      const sv = saved[p.wallKey];
      if (sv) {
        if (sv.faceRegions) mass.faceRegions = sv.faceRegions;
        if (sv.faceArt) mass.faceArt = sv.faceArt;
        if (sv.faceMat) mass.faceMat = sv.faceMat;
        if (sv._faceImg) mass._faceImg = sv._faceImg;
      }
      S.massing.masses.push(mass);
    });
  };

  // ---- placing / selecting / sliding openings on 2D walls ----
  S.wallSegHit = function wallSegHit(p: any) {
    if (state.wallsVisible === false) return null;
    let best: any = null;
    (state.walls || []).forEach((w: any, wi: any) => {
      if (w.visible === false) return;
      const tPx = S.wallThickPx(w);
      for (let i = 0; i < w.pts.length - 1; i++) {
        if (typeof S.isWallSegmentVisible === 'function' && !S.isWallSegmentVisible(w, i)) continue;
        const a = w.pts[i], b = w.pts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, len2 = dx*dx + dy*dy || 1;
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2; t = Math.max(0, Math.min(1, t));
        const cx = a.x + dx*t, cy = a.y + dy*t, d = Math.hypot(p.x - cx, p.y - cy);
        if (d < tPx/2 + 14 && (!best || d < best.d)) best = { wi, seg: i, t, d, segLen: Math.hypot(dx, dy) };
      }
    });
    return best;
  }
  S.openingDims = function openingDims(kind: any) {
    return kind === 'door'
      ? { wMM: state.doorWMM, hMM: state.doorHMM, sillMM: 0 }
      : { wMM: state.winWMM, hMM: state.winHMM, sillMM: state.winSillMM };
  }
  S.placeOpening2D = function placeOpening2D(p: any) {
    const hit = S.wallSegHit(p);
    if (!hit) { S.showHint('Tap on a wall to place a ' + state.openingKind); return; }
    const w = state.walls[hit.wi];
    const dims = S.openingDims(state.openingKind);
    const halfFrac = ((dims.wMM / 1000) * S.pxPerMetre() / 2) / Math.max(1, hit.segLen);
    if (halfFrac >= 0.48) { S.showHint('Wall segment too short for this ' + state.openingKind); return; }
    const t = Math.max(halfFrac + 0.02, Math.min(1 - halfFrac - 0.02, hit.t));
    const __b = S.vectorSnapshot();
    w.openings = w.openings || [];
    w.openings.push({ kind: state.openingKind, seg: hit.seg, t, wMM: dims.wMM, hMM: dims.hMM, sillMM: dims.sillMM, hand: 1, swing: 1 });
    state.selOpening2D = { wi: hit.wi, idx: w.openings.length - 1 };
    S.refreshMeasurements(); S.syncWallsToMasses(); S.updateOpeningPalette(); S.recordVec(__b); S.scheduleAutosave();
    S.showHint(`${state.openingKind === 'door' ? 'Door' : 'Window'} placed · drag to slide · flip & resize in the bar`);
  }
  S.openingHitTest2D = function openingHitTest2D(p: any) {
    if (state.wallsVisible === false) return null;
    let best: any = null;
    (state.walls || []).forEach((w: any, wi: any) => {
      (w.openings || []).forEach((o: any, idx: any) => {
        const a = w.pts[o.seg], b = w.pts[o.seg + 1]; if (!a || !b) return;
        const cx = a.x + (b.x - a.x) * o.t, cy = a.y + (b.y - a.y) * o.t, d = Math.hypot(p.x - cx, p.y - cy);
        if (d < S.wallThickPx(w)/2 + 12 && (!best || d < best.d)) best = { wi, idx, d };
      });
    });
    return best ? { wi: best.wi, idx: best.idx } : null;
  }
  S.slideOpening2D = function slideOpening2D(sel: any, p: any) {
    const w = state.walls[sel.wi]; if (!w) return;
    const o: any = w.openings?.[sel.idx]; if (!o) return;
    const a = w.pts[o.seg], b = w.pts[o.seg + 1];
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx*dx + dy*dy || 1, segLen = Math.sqrt(len2);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    const halfFrac = ((o.wMM / 1000) * S.pxPerMetre() / 2) / Math.max(1, segLen);
    o.t = Math.max(halfFrac + 0.02, Math.min(1 - halfFrac - 0.02, t));
    S.refreshMeasurements(); S.syncWallsToMasses();
  }
  S.deleteOpening2D = function deleteOpening2D(sel: any) {
    const w = state.walls[sel.wi]; if (!w || !w.openings) return;
    const __b = S.vectorSnapshot();
    w.openings.splice(sel.idx, 1);
    state.selOpening2D = null;
    S.refreshMeasurements(); S.syncWallsToMasses(); S.updateOpeningPalette(); S.recordVec(__b); S.scheduleAutosave();
  }
  S.selectedOpening2D = function selectedOpening2D() {
    const s = state.selOpening2D; if (!s) return null;
    const w = state.walls[s.wi]; return (w && w.openings) ? w.openings[s.idx] : null;
  }

  S._wall2dPaletteEl = null;
  S.ensureWall2dPalette = function ensureWall2dPalette() {
    if (S._wall2dPaletteEl) return S._wall2dPaletteEl;
    const el = document.createElement('div');
    el.id = 'wall2d-palette';
    el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);display:none;gap:12px;align-items:center;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.10);border-radius:10px;padding:7px 13px;box-shadow:0 6px 22px rgba(0,0,0,0.16);z-index:31;font-size:11px;';
    el.innerHTML = '<span style="font-weight:700;letter-spacing:0.5px;color:#a02835;">WALL</span>'
      + '<label style="display:flex;align-items:center;gap:5px;color:#555;">Thick <input id="w2-thick" type="number" min="50" max="600" step="10" value="230" style="width:56px;font-family:inherit;font-size:11px;padding:3px 5px;border:1px solid #ccc;border-radius:5px;"> mm</label>'
      + '<label style="display:flex;align-items:center;gap:5px;color:#555;">Height <input id="w2-height" type="number" min="0.5" max="20" step="0.1" value="3" style="width:52px;font-family:inherit;font-size:11px;padding:3px 5px;border:1px solid #ccc;border-radius:5px;"> m</label>';
    document.body.appendChild(el);
    (el.querySelector as any)('#w2-thick').addEventListener('input', (e: any) => { const v = parseFloat(e.target.value); if (v > 0) state.wallThickMM = v; });
    (el.querySelector as any)('#w2-height').addEventListener('input', (e: any) => { const v = parseFloat(e.target.value); if (v > 0) state.wallHeightM = v; });
    S._wall2dPaletteEl = el;
    return el;
  }
  S.showWall2dPalette = function showWall2dPalette(show: any) {
    S.ensureWall2dPalette();
    // Controls live in the bottom tool options bar now.
    S._wall2dPaletteEl.style.display = 'none';
    if (show && typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
  }

  S._openPaletteEl = null;
  S.ensureOpeningPalette = function ensureOpeningPalette() {
    if (S._openPaletteEl) return S._openPaletteEl;
    const st = document.createElement('style');
    st.textContent = '.op-chip{border:1px solid #ccc;background:#fff;border-radius:6px;padding:4px 11px;font-size:11px;font-weight:600;cursor:pointer;color:#333;}.op-chip.on{background:#a02835;color:#fff;border-color:#a02835;}.op-mini{border:1px solid #ccc;background:#fff;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;color:#333;}.op-mini:hover{background:#f2f2f2;}';
    document.head.appendChild(st);
    const el = document.createElement('div');
    el.id = 'opening-palette';
    el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);display:none;gap:9px;align-items:center;flex-wrap:wrap;max-width:94vw;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.10);border-radius:10px;padding:7px 12px;box-shadow:0 6px 22px rgba(0,0,0,0.16);z-index:31;font-size:11px;';
    el.innerHTML = '<div style="display:flex;gap:4px;"><button id="op-door" class="op-chip">Door</button><button id="op-window" class="op-chip">Window</button></div>'
      + '<label style="display:flex;align-items:center;gap:4px;color:#555;">W <input id="op-w" type="number" step="10" style="width:54px;font-size:11px;padding:3px 4px;border:1px solid #ccc;border-radius:5px;"> mm</label>'
      + '<label style="display:flex;align-items:center;gap:4px;color:#555;">H <input id="op-h" type="number" step="10" style="width:54px;font-size:11px;padding:3px 4px;border:1px solid #ccc;border-radius:5px;"> mm</label>'
      + '<label id="op-sill-l" style="display:flex;align-items:center;gap:4px;color:#555;">Sill <input id="op-sill" type="number" step="10" style="width:50px;font-size:11px;padding:3px 4px;border:1px solid #ccc;border-radius:5px;"> mm</label>'
      + '<button id="op-hinge" class="op-mini">\u21c4 Hinge</button><button id="op-swing" class="op-mini">\u21c5 Swing</button>'
      + '<button id="op-del" class="op-mini" style="color:#b00020;">Delete</button>';
    document.body.appendChild(el);
    (el.querySelector as any)('#op-door').onclick = () => { state.openingKind = 'door'; if (S.selectedOpening2D()) { const __b = S.vectorSnapshot(); S.selectedOpening2D().kind = 'door'; S.refreshMeasurements(); S.syncWallsToMasses(); S.recordVec(__b, true); } S.updateOpeningPalette(); };
    (el.querySelector as any)('#op-window').onclick = () => { state.openingKind = 'window'; if (S.selectedOpening2D()) { const __b = S.vectorSnapshot(); S.selectedOpening2D().kind = 'window'; S.refreshMeasurements(); S.syncWallsToMasses(); S.recordVec(__b, true); } S.updateOpeningPalette(); };
    (el.querySelector as any)('#op-w').addEventListener('input', (e: any) => { const v = parseFloat(e.target.value); if (!(v > 0)) return; const o = S.selectedOpening2D(); const __b = o ? S.vectorSnapshot() : null; if (o) o.wMM = v; else if (state.openingKind === 'door') state.doorWMM = v; else state.winWMM = v; S.refreshMeasurements(); S.syncWallsToMasses(); if (__b) S.recordVec(__b, true); });
    (el.querySelector as any)('#op-h').addEventListener('input', (e: any) => { const v = parseFloat(e.target.value); if (!(v > 0)) return; const o = S.selectedOpening2D(); const __b = o ? S.vectorSnapshot() : null; if (o) o.hMM = v; else if (state.openingKind === 'door') state.doorHMM = v; else state.winHMM = v; S.syncWallsToMasses(); if (__b) S.recordVec(__b, true); });
    (el.querySelector as any)('#op-sill').addEventListener('input', (e: any) => { const v = parseFloat(e.target.value); if (!(v >= 0)) return; const o = S.selectedOpening2D(); const __b = o ? S.vectorSnapshot() : null; if (o) o.sillMM = v; else state.winSillMM = v; S.syncWallsToMasses(); if (__b) S.recordVec(__b, true); });
    (el.querySelector as any)('#op-hinge').onclick = () => { const o = S.selectedOpening2D(); if (o) { const __b = S.vectorSnapshot(); o.hand = -(o.hand || 1); S.refreshMeasurements(); S.recordVec(__b, true); } };
    (el.querySelector as any)('#op-swing').onclick = () => { const o = S.selectedOpening2D(); if (o) { const __b = S.vectorSnapshot(); o.swing = -(o.swing || 1); S.refreshMeasurements(); S.recordVec(__b, true); } };
    (el.querySelector as any)('#op-del').onclick = () => { if (state.selOpening2D) S.deleteOpening2D(state.selOpening2D); };
    S._openPaletteEl = el;
    return el;
  }
  S.showOpeningPalette = function showOpeningPalette(show: any) {
    S.ensureOpeningPalette();
    // Controls live in the bottom tool options bar now.
    S._openPaletteEl.style.display = 'none';
    if (show) {
      S.updateOpeningPalette();
      if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
    }
  }
  S.updateOpeningPalette = function updateOpeningPalette() {
    if (!S._openPaletteEl) return;
    const o = S.selectedOpening2D();
    const kind = o ? o.kind : state.openingKind;
    (S._openPaletteEl.querySelector as any)('#op-door').classList.toggle('on', kind === 'door');
    (S._openPaletteEl.querySelector as any)('#op-window').classList.toggle('on', kind === 'window');
    const dims = o ? { wMM: o.wMM, hMM: o.hMM, sillMM: o.sillMM } : S.openingDims(kind);
    (S._openPaletteEl.querySelector as any)('#op-w').value = dims.wMM;
    (S._openPaletteEl.querySelector as any)('#op-h').value = dims.hMM;
    (S._openPaletteEl.querySelector as any)('#op-sill').value = dims.sillMM || 0;
    (S._openPaletteEl.querySelector as any)('#op-sill-l').style.display = kind === 'window' ? 'flex' : 'none';
    (S._openPaletteEl.querySelector as any)('#op-hinge').style.display = kind === 'door' ? 'inline-block' : 'none';
    (S._openPaletteEl.querySelector as any)('#op-swing').style.display = kind === 'door' ? 'inline-block' : 'none';
    (S._openPaletteEl.querySelector as any)('#op-del').style.display = o ? 'inline-block' : 'none';
  }

  // ===== Select / edit tool: pick an entity and offer edit + delete =====
  S._distToSeg = function _distToSeg(p: any, a: any, b: any) {
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx*dx + dy*dy || 1;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + dx*t), p.y - (a.y + dy*t));
  }
  S.measurementHit = function measurementHit(p: any) {
    let best: any = null;
    (state.measurements || []).forEach((m: any, idx: any) => {
      if (m.type === 'area' || m.x1 == null) return;
      const d = S._distToSeg(p, { x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 });
      if (d < 12 && (!best || d < best.d)) best = { idx, type: 'dim', d };
    });
    if (best) return best;
    for (let idx = (state.measurements || []).length - 1; idx >= 0; idx--) {
      const m = state.measurements[idx];
      if (m.type === 'area' && m.points && m.points.length >= 3 && S.pointInPoly(p.x, p.y, m.points)) return { idx, type: 'area' };
    }
    return null;
  }
  S.selectEntityAt = function selectEntityAt(p: any) {
    const op = S.openingHitTest2D(p);
    if (op) {
      state.sel = { type: 'opening', wi: op.wi, idx: op.idx }; state.selOpening2D = op;
      S.showSelectBar(null); S.showOpeningPalette(true); S.updateOpeningPalette();
      S.syncSelectionManagerFromLegacy('canvas');
      S.refreshMeasurements();
      S.showHint('Door / Window selected — edit in the bar'); return true;
    }
    const wh = S.wallSegHit(p);
    if (wh) {
      const wall = state.walls[wh.wi];
      if (wall) S.ensureWallId(wall);
      state.sel = {
        type: 'wall',
        wi: wh.wi,
        seg: typeof wh.seg === 'number' ? wh.seg : null,
        id: wall && wall.id,
      };
      state.selOpening2D = null;
      S.showOpeningPalette(false); S.showSelectBar('wall');
      S.syncSelectionManagerFromLegacy('canvas');
      S.refreshMeasurements();
      S.showHint(
        typeof wh.seg === 'number' && S.isWallClosedLoop && S.isWallClosedLoop(wall)
          ? ('Wall ' + (wh.seg + 1) + ' selected — Move / Scale / Rotate this side')
          : 'Wall selected — edit thickness / height or delete',
      );
      return true;
    }
    for (let i = (state.shapes || []).length - 1; i >= 0; i--) {
      if (S.shapeHit(state.shapes[i], p)) {
        const sh = state.shapes[i];
        const id = S.ensureShapeId(sh);
        // Capability-gated selection (Phase 2B) — do not fork on type for selectability.
        if (S.__ix && S.__ix.capabilityRegistry && !S.__ix.capabilityRegistry.get('shape').selectable) {
          break;
        }
        state.sel = { type: 'shape', idx: i, id }; state.selOpening2D = null;
        S.showOpeningPalette(false); S.showSelectBar('shape');
        S.syncSelectionManagerFromLegacy('canvas');
        S.refreshMeasurements();
        S.showHint('Shape selected — edit width or delete'); return true;
      }
    }
    const mh = S.measurementHit(p);
    if (mh) {
      state.selOpening2D = null; S.showOpeningPalette(false);
      if (mh.type === 'area') { state.sel = { type: 'room', idx: mh.idx }; S.showSelectBar('room'); S.showHint('Room selected'); }
      else { state.sel = { type: 'dim', idx: mh.idx }; S.showSelectBar('dim'); S.showHint('Dimension selected'); }
      S.syncSelectionManagerFromLegacy('canvas');
      S.refreshMeasurements(); return true;
    }
    state.sel = null; state.selOpening2D = null; S.showOpeningPalette(false); S.showSelectBar(null);
    S.syncSelectionManagerFromLegacy('canvas');
    S.refreshMeasurements();
    S.showHint('Nothing here — tap a wall, door, window, or room');
    return false;
  }
  S.deleteWall = function deleteWall(wi: any) {
    if (!state.walls || !state.walls[wi]) return;
    const __b = S.vectorSnapshot();
    if (typeof S.eraseWallRasterInk === 'function') S.eraseWallRasterInk(state.walls[wi]);
    state.walls.splice(wi, 1);
    state.sel = null; state.selOpening2D = null;
    state._panelSelectedObjectId = null;
    S.showSelectBar(null);
    S.syncSceneObjectsToEngine();
    S.refreshMeasurements(); S.syncWallsToMasses(); S.recordVec(__b); S.scheduleAutosave();
    S.renderLayers();
    S.showHint('Wall deleted');
  }
  S._selBarEl = null;
  S.ensureSelectBar = function ensureSelectBar() {
    if (S._selBarEl) return S._selBarEl;
    const el = document.createElement('div');
    el.id = 'select-bar';
    el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);display:none;gap:10px;align-items:center;flex-wrap:wrap;max-width:94vw;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.10);border-radius:10px;padding:7px 13px;box-shadow:0 6px 22px rgba(0,0,0,0.16);z-index:1600;font-size:11px;';
    document.body.appendChild(el);
    S._selBarEl = el;
    return el;
  }
  S.showSelectBar = function showSelectBar(type: any) {
    S.ensureSelectBar();
    const el = S._selBarEl, sel = state.sel;
    // Prefer bottom tool options bar for shape/wall transforms.
    el.style.display = 'none';
    if (!type || type === 'opening' || !sel) {
      el.innerHTML = '';
      if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
      return;
    }
    if ((type === 'shape' || type === 'wall' || type === 'element') && typeof S.syncToolOptionsBar === 'function') {
      el.innerHTML = '';
      S.syncToolOptionsBar();
      return;
    }
    const inp = 'font-family:inherit;font-size:11px;padding:3px 5px;border:1px solid #ccc;border-radius:5px;';
    const tag = (t: any) => `<span style="font-weight:700;letter-spacing:0.5px;color:#a02835;">${t}</span>`;
    if (type === 'wall') {
      const w = state.walls[sel.wi]; if (!w) { el.style.display = 'none'; return; }
      el.innerHTML = tag('WALL')
        + `<label style="display:flex;align-items:center;gap:5px;color:#555;">Thick <input id="se-thick" type="number" min="50" max="600" step="10" style="width:56px;${inp}"> mm</label>`
        + `<label style="display:flex;align-items:center;gap:5px;color:#555;">Height <input id="se-height" type="number" min="0.5" max="20" step="0.1" style="width:52px;${inp}"> m</label>`
        + '<button id="se-move" class="op-mini">Move</button>'
        + '<button id="se-scale" class="op-mini">Scale</button>'
        + '<button id="se-rotate" class="op-mini">Rotate</button>'
        + '<button id="se-img" class="op-mini">Image</button>'
        + '<button id="se-del" class="op-mini" style="color:#b00020;">Delete</button>';
      (el.querySelector as any)('#se-thick').value = w.thickMM || 230;
      (el.querySelector as any)('#se-height').value = w.heightM || 3;
      (el.querySelector as any)('#se-thick').addEventListener('input', (e: any) => { const v = parseFloat(e.target.value); if (v > 0) { const __b = S.vectorSnapshot(); w.thickMM = v; S.refreshMeasurements(); S.syncWallsToMasses(); S.recordVec(__b, true); S.scheduleAutosave(); } });
      (el.querySelector as any)('#se-height').addEventListener('input', (e: any) => { const v = parseFloat(e.target.value); if (v > 0) { const __b = S.vectorSnapshot(); w.heightM = v; S.syncWallsToMasses(); S.recordVec(__b, true); S.scheduleAutosave(); } });
      (el.querySelector as any)('#se-move').onclick = () => S.beginVecXform('move');
      (el.querySelector as any)('#se-scale').onclick = () => S.beginVecXform('scale');
      (el.querySelector as any)('#se-rotate').onclick = () => S.beginVecXform('rotate');
      (el.querySelector as any)('#se-img').onclick = () => S.addBackgroundImageToSelection();
      (el.querySelector as any)('#se-del').onclick = () => S.deleteWall(sel.wi);
    } else if (type === 'room') {
      const m = state.measurements[sel.idx]; if (!m) { el.style.display = 'none'; return; }
      el.innerHTML = tag('ROOM')
        + `<input id="se-name" type="text" style="width:120px;${inp}">`
        + '<label style="display:flex;align-items:center;gap:5px;color:#555;cursor:pointer;"><input id="se-void" type="checkbox"> Void</label>'
        + '<button id="se-del" class="op-mini" style="color:#b00020;">Delete</button>';
      (el.querySelector as any)('#se-name').value = m.name || '';
      (el.querySelector as any)('#se-void').checked = !!m.void;
      (el.querySelector as any)('#se-name').addEventListener('input', (e: any) => { const __b = S.vectorSnapshot(); m.name = e.target.value; S.refreshMeasurements(); if (typeof S.renderSchedule === 'function') S.renderSchedule(); S.recordVec(__b, true); });
      (el.querySelector as any)('#se-void').addEventListener('change', (e: any) => { const __b = S.vectorSnapshot(); m.void = e.target.checked; S.refreshMeasurements(); if (typeof S.renderSchedule === 'function') S.renderSchedule(); S.recordVec(__b, true); });
      (el.querySelector as any)('#se-del').onclick = () => { S.deleteMeasurement(sel.idx); state.sel = null; S.showSelectBar(null); if (typeof S.renderSchedule === 'function') S.renderSchedule(); };
    } else if (type === 'dim') {
      const m = state.measurements[sel.idx]; if (!m) { el.style.display = 'none'; return; }
      el.innerHTML = tag('DIMENSION')
        + `<span style="color:#555;">${m.label || ''}</span>`
        + '<button id="se-del" class="op-mini" style="color:#b00020;">Delete</button>';
      (el.querySelector as any)('#se-del').onclick = () => { S.deleteMeasurement(sel.idx); state.sel = null; S.showSelectBar(null); };
    } else if (type === 'shape') {
      const sh = state.shapes[sel.idx]; if (!sh) { el.style.display = 'none'; return; }
      el.innerHTML = tag('SHAPE')
        + `<span style="color:#999;text-transform:capitalize;">${sh.kind}</span>`
        + `<label style="display:flex;align-items:center;gap:5px;color:#555;">Line <input id="se-sw" type="number" min="0.5" max="40" step="0.5" style="width:52px;${inp}"> px</label>`
        + '<button id="se-move" class="op-mini">Move</button>'
        + '<button id="se-scale" class="op-mini">Scale</button>'
        + '<button id="se-rotate" class="op-mini">Rotate</button>'
        + '<button id="se-img" class="op-mini">Image</button>'
        + '<button id="se-del" class="op-mini" style="color:#b00020;">Delete</button>';
      (el.querySelector as any)('#se-sw').value = sh.width || 2;
      (el.querySelector as any)('#se-sw').addEventListener('input', (e: any) => { const v = parseFloat(e.target.value); if (v > 0) { const __b = S.vectorSnapshot(); sh.width = v; S.refreshMeasurements(); S.recordVec(__b, true); S.scheduleAutosave(); } });
      (el.querySelector as any)('#se-move').onclick = () => S.beginVecXform('move');
      (el.querySelector as any)('#se-scale').onclick = () => S.beginVecXform('scale');
      (el.querySelector as any)('#se-rotate').onclick = () => S.beginVecXform('rotate');
      (el.querySelector as any)('#se-img').onclick = () => S.addBackgroundImageToSelection();
      (el.querySelector as any)('#se-del').onclick = () => {
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
      };
    } else if (type === 'element') {
      el.innerHTML = tag('ELEMENT')
        + '<button id="se-move" class="op-mini">Move</button>'
        + '<button id="se-scale" class="op-mini">Scale</button>'
        + '<button id="se-rotate" class="op-mini">Rotate</button>'
        + '<button id="se-img" class="op-mini">Image</button>'
        + '<button id="se-group" class="op-mini">Group</button>';
      (el.querySelector as any)('#se-move').onclick = () => S.beginVecXform('move');
      (el.querySelector as any)('#se-scale').onclick = () => S.beginVecXform('scale');
      (el.querySelector as any)('#se-rotate').onclick = () => S.beginVecXform('rotate');
      (el.querySelector as any)('#se-img').onclick = () => S.addBackgroundImageToSelection();
      (el.querySelector as any)('#se-group').onclick = () => S.groupSelectedElements();
    }
    el.style.display = 'flex';
  }

  S.refreshAreaOverlay = function refreshAreaOverlay() {
    // Redraw current polygon preview in the ruler overlay
    S.refreshMeasurements();
    if (!state.polyActive || state.polyPoints.length === 0) return;
    const svgns = 'http://www.w3.org/2000/svg';
    S.rulerOverlay.setAttribute('viewBox', `0 0 ${S.doc.wPx} ${S.doc.hPx}`);
    const pts = state.polyPoints;
    // Fill shape
    if (pts.length >= 3) {
      const fill = document.createElementNS(svgns, 'polygon');
      fill.setAttribute('points', pts.map((p: any) => `${p.x},${p.y}`).join(' '));
      fill.setAttribute('class', 'area-fill');
      S.rulerOverlay.appendChild(fill);
    }
    // Edges
    for (let i = 0; i < pts.length - 1; i++) {
      const l = document.createElementNS(svgns, 'line');
      l.setAttribute('x1', String(pts[i].x)); l.setAttribute('y1', String(pts[i].y));
      l.setAttribute('x2', String(pts[i+1].x)); l.setAttribute('y2', String(pts[i+1].y));
      l.setAttribute('class', 'area-edge');
      S.rulerOverlay.appendChild(l);
    }
    // Vertices — brand-red dots (first vertex is the close target; kept compact)
    const scale = Math.max(0.5, 1 / ((state.zoom || 1) * (state.baseZoom || 1)));
    pts.forEach((p: any, i: any) => {
      const isFirst = i === 0;
      const canClose = isFirst && pts.length >= 3;
      const r = (canClose ? 8 : isFirst ? 7 : 5.5) * scale;
      if (canClose) {
        const ring = document.createElementNS(svgns, 'circle');
        ring.setAttribute('cx', String(p.x)); ring.setAttribute('cy', String(p.y));
        ring.setAttribute('r', String(r * 1.55));
        ring.setAttribute('class', 'area-vertex-close-ring');
        S.rulerOverlay.appendChild(ring);
      }
      const c = document.createElementNS(svgns, 'circle');
      c.setAttribute('cx', String(p.x)); c.setAttribute('cy', String(p.y));
      c.setAttribute('r', String(r));
      c.setAttribute('class', 'area-vertex' + (isFirst ? ' area-vertex-first' : '') + (canClose ? ' area-vertex-close' : ''));
      if (isFirst) c.style.cursor = 'pointer';
      S.rulerOverlay.appendChild(c);
    });
    // Live area (only for the area-measure tool, not the polygon shape tool)
    if (pts.length >= 3 && state.tool === 'area') {
      const area = S.shoelaceArea(pts);
      const cx = pts.reduce((s: any, p: any) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s: any, p: any) => s + p.y, 0) / pts.length;
      const lbl = S.formatArea(area) + '  \u00b7  ' + S.formatLen(S.perimeterPx(pts));
      const bg = document.createElementNS(svgns, 'rect');
      const bw = lbl.length * 16 + 30;
      bg.setAttribute('x', String(cx - bw/2)); bg.setAttribute('y', String(cy - 22));
      bg.setAttribute('width', String(bw)); bg.setAttribute('height', String(36));
      bg.setAttribute('rx', String(6)); bg.setAttribute('fill', '#15803d');
      S.rulerOverlay.appendChild(bg);
      const txt = document.createElementNS(svgns, 'text');
      txt.setAttribute('x', String(cx)); txt.setAttribute('y', String(cy + 4));
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('fill', 'white');
      txt.setAttribute('font-family', 'JetBrains Mono,monospace');
      txt.setAttribute('font-weight', '600');
      txt.setAttribute('font-size', '22');
      txt.setAttribute('pointer-events', 'none');
      txt.textContent = lbl;
      S.rulerOverlay.appendChild(txt);
    }
  }

}
