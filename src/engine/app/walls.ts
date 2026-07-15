/* Wall / opening tool helpers — shared scope S */
import { S } from "./scope";

export function initWalls() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);


  /* ===================== WALL tool ===================== */
  // A wall is just a thin extruded footprint, so it reuses the whole mass system.
  S.wallDefaults = function wallDefaults() { if (S.massing.wallThick == null) S.massing.wallThick = 0.2; if (S.massing.wallHeight == null) S.massing.wallHeight = 3; }
  S.wallSegPoly = function wallSegPoly(a: any, b: any, t: any) {
    const dx = b.x - a.x, dz = b.z - a.z; const len = Math.hypot(dx, dz) || 1e-6;
    const ux = dx / len, uz = dz / len, px = -uz, pz = ux, h = t / 2;
    // extend each end by t/2 so consecutive walls overlap and corners read solid
    const a2 = { x: a.x - ux * h, z: a.z - uz * h }, b2 = { x: b.x + ux * h, z: b.z + uz * h };
    return [
      { x: a2.x + px * h, z: a2.z + pz * h }, { x: b2.x + px * h, z: b2.z + pz * h },
      { x: b2.x - px * h, z: b2.z - pz * h }, { x: a2.x - px * h, z: a2.z - pz * h }
    ];
  }
  S.pushWallSeg = function pushWallSeg(a: any, b: any) {
    S.massing.masses.push({ poly: S.wallSegPoly(a, b, S.massing.wallThick), h: S.massing.wallHeight, _wall: true });
    S.massing.selected = S.massing.masses.length - 1;
  }
  S.addWallVertex = function addWallVertex(sx: any, sy: any) {
    S.wallDefaults();
    const w = S.massing.wall = S.massing.wall || { pts: [] };
    const p = S.mGroundPick(sx, sy);
    if (w.pts.length >= 2) {                       // tap near the first dot → close the loop
      const f = w.pts[0], snap = Math.max(S.massing.wallThick * 2, 0.4);
      if (Math.hypot(p.x - f.x, p.z - f.z) < snap) { S.pushWallSeg(w.pts[w.pts.length - 1], f); S.finishWall(); return; }
    }
    if (w.pts.length === 0) { w.pts.push(p); S.massHint('Tap each corner · tap the first dot to close the room · Done to finish'); }
    else { if (w.pts.length === 1) S.massSnapshot(); S.pushWallSeg(w.pts[w.pts.length - 1], p); w.pts.push(p); }
    S.refreshInspector(); S.renderMassing();
  }
  S.finishWall = function finishWall() { S.massing.wall = null; S.massing.wallCursor = null; S.refreshInspector(); S.renderMassing(); S.massHint('Wall run placed · Select to edit, or tap to start another'); }
  S.drawWallOverlay = function drawWallOverlay() {
    const w = S.massing.wall; if (!w || !w.pts.length) return;
    w.pts.forEach((p: any, i: any) => {
      const s = S.mProject({ x: p.x, y: 0, z: p.z });
      S.mctx.beginPath(); S.mctx.arc(s.x, s.y, i === 0 ? 7 : 5, 0, Math.PI * 2);
      S.mctx.fillStyle = i === 0 ? '#fff' : '#a02835'; S.mctx.fill();
      S.mctx.lineWidth = 2; S.mctx.strokeStyle = '#a02835'; S.mctx.stroke();
    });
  }
  // ---- wall palette: thickness / height / done ----
  S._wallPaletteEl = null;
  S.ensureWallPalette = function ensureWallPalette() {
    if (S._wallPaletteEl) return S._wallPaletteEl;
    const style = document.createElement('style');
    style.textContent =
      '#wall-palette{position:fixed;z-index:1250;display:none;flex-direction:column;gap:10px;left:50%;transform:translateX(-50%);bottom:120px;' +
      'background:#1c1a18;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:11px 14px;box-shadow:0 10px 30px rgba(0,0,0,0.45);}' +
      '#wall-palette .bm-modes{display:flex;gap:5px;}' +
      '#wall-palette .bm{flex:1;font:600 11px ui-sans-serif,system-ui;letter-spacing:.06em;text-transform:uppercase;padding:8px 14px;background:#2b2826;color:rgba(255,255,255,0.6);border:1px solid #45403c;border-radius:7px;cursor:pointer;}' +
      '#wall-palette .bm.on{background:#a02835;color:#fff;border-color:#a02835;}' +
      '#wall-palette .bm-fields{display:flex;gap:12px;align-items:flex-end;}' +
      '#wall-palette .wf{display:flex;flex-direction:column;gap:5px;}' +
      '#wall-palette label{font:600 9px ui-sans-serif,system-ui;color:rgba(255,255,255,0.45);letter-spacing:.1em;text-transform:uppercase;}' +
      '#wall-palette input{width:74px;font:600 13px ui-sans-serif,system-ui;padding:7px 9px;background:#2b2826;border:1px solid #45403c;border-radius:6px;color:#fff;}' +
      '#wall-palette input:focus{outline:2px solid #a02835;outline-offset:1px;border-color:transparent;}' +
      '#wall-palette .bm-done{font:600 11px ui-sans-serif,system-ui;letter-spacing:.08em;text-transform:uppercase;padding:9px 16px;background:#a02835;color:#fff;border:none;border-radius:7px;cursor:pointer;align-self:flex-end;}' +
      '#wall-palette .bm-cut{align-self:flex-end;font:600 10px ui-sans-serif,system-ui;letter-spacing:.05em;text-transform:uppercase;padding:9px 13px;background:#2b2826;color:rgba(255,255,255,0.6);border:1px solid #45403c;border-radius:7px;cursor:pointer;white-space:nowrap;}' +
      '#wall-palette .bm-cut.on{background:#a02835;color:#fff;border-color:#a02835;}';
    document.head.appendChild(style);
    const el = document.createElement('div'); el.id = 'wall-palette';
    el.addEventListener('pointerdown', (ev: any) => ev.stopPropagation());
    document.body.appendChild(el); S._wallPaletteEl = el; return el;
  }
  S.buildDefaults = function buildDefaults() {
    S.wallDefaults();
    if (S.massing.buildMode == null) S.massing.buildMode = 'wall';
    if (S.massing.doorW == null) S.massing.doorW = 0.9; if (S.massing.doorH == null) S.massing.doorH = 2.1;
    if (S.massing.winW == null) S.massing.winW = 1.2; if (S.massing.winH == null) S.massing.winH = 1.2; if (S.massing.winSill == null) S.massing.winSill = 0.9;
  }
  // derive a wall's along/across axes, length, thickness and centre from its 4-pt footprint
  S.wallAxes = function wallAxes(b: any) {
    const p = b.poly;
    const dx = p[1].x - p[0].x, dz = p[1].z - p[0].z, len = Math.hypot(dx, dz) || 1e-6;
    const ux = dx / len, uz = dz / len, px = -uz, pz = ux;
    const thick = Math.hypot(p[2].x - p[1].x, p[2].z - p[1].z);
    const cx = (p[0].x + p[1].x + p[2].x + p[3].x) / 4, cz = (p[0].z + p[1].z + p[2].z + p[3].z) / 4;
    return { ux, uz, px, pz, len, thick, cx, cz };
  }
  S.openingPoly = function openingPoly(ax: any, W: any, depth: any) {
    const hw = W / 2, hd = depth / 2;
    const cr = (s1: any, s2: any) => ({ x: ax.cx + ax.ux * hw * s1 + ax.px * hd * s2, z: ax.cz + ax.uz * hw * s1 + ax.pz * hd * s2 });
    return [cr(-1, 1), cr(1, 1), cr(1, -1), cr(-1, -1)];
  }
  // Represented opening: a thin panel on the host wall (glass for windows, timber for doors).
  S.placeOpening = function placeOpening(bi: any, kind: any) {
    const b = S.massing.masses[bi];
    if (!b || !b._wall) { S.massHint('Tap a wall to place a ' + kind); return; }
    S.buildDefaults();
    const ax = S.wallAxes(b);
    const W = Math.min(kind === 'door' ? S.massing.doorW : S.massing.winW, ax.len * 0.95);
    const H = kind === 'door' ? S.massing.doorH : S.massing.winH;
    const sill = kind === 'door' ? 0 : S.massing.winSill;
    S.massSnapshot();
    S.massing.masses.push({
      poly: S.openingPoly(ax, W, ax.thick + 0.3), h: H, baseY: sill,
      color: kind === 'door' ? [120, 86, 60] : [150, 178, 196], _opening: kind, _host: bi
    });
    S.massing.selected = S.massing.masses.length - 1;
    S.refreshInspector(); S.renderMassing();
    S.massHint(kind[0].toUpperCase() + kind.slice(1) + ' placed · Select to slide it along the wall or scale · adjust size below');
  }
  S.cutToggle = function cutToggle() {
    S.buildDefaults();
    const b = document.createElement('button');
    b.className = 'bm-cut' + (S.massing.cutMode ? ' on' : '');
    b.textContent = S.massing.cutMode ? '✓ Cut through wall' : 'Cut through wall';
    b.onclick = () => { S.massing.cutMode = !S.massing.cutMode; S.buildBuildPalette();
      S.massHint(S.massing.cutMode ? 'Cut mode: tap a wall to punch a real see-through opening' : 'Tap a wall to place a represented ' + S.massing.buildMode); };
    return b;
  }
  S.delOpBtn = function delOpBtn() {
    const b = document.createElement('button');
    b.className = 'bm-cut'; b.style.background = '#3a2326'; b.style.borderColor = '#5a2a30'; b.style.color = '#e7b4ba';
    b.textContent = '✕ Delete';
    b.onclick = () => S.deleteSelOpening();
    return b;
  }
  // CUT placement: store the opening ON the wall (hosted) at the tapped position so it cuts a real hole.
  S.cutOpening = function cutOpening(sx: any, sy: any, bi: any, kind: any) {
    const b = S.massing.masses[bi];
    if (!b || !b._wall) { S.massHint('Tap a wall to cut a ' + kind); return; }
    S.buildDefaults();
    const g = S.mGroundPick(sx, sy);
    const p = b.poly, dux = p[1].x - p[0].x, duz = p[1].z - p[0].z, Llen = Math.hypot(dux, duz) || 1;
    const u = Math.min(0.97, Math.max(0.03, ((g.x - p[0].x) * dux + (g.z - p[0].z) * duz) / (Llen * Llen)));
    S.massSnapshot();
    b.openings = b.openings || [];
    b.openings.push({ kind, u,
      w: kind === 'door' ? S.massing.doorW : S.massing.winW,
      h: kind === 'door' ? S.massing.doorH : S.massing.winH,
      sill: kind === 'door' ? 0 : S.massing.winSill });
    S.massing.selOpening = { bi, idx: b.openings.length - 1 }; S.massing.selected = -1;
    S.buildBuildPalette(); S.refreshInspector(); S.renderMassing();
    S.massHint(kind[0].toUpperCase() + kind.slice(1) + ' cut · resize with the fields · drag in Select to move · undo to remove');
  }
  // pick an existing cut opening under the tap (its pane), nearest first
  S.openingAt = function openingAt(sx: any, sy: any) {
    let best = null, bestDepth = -Infinity;
    S.massing.masses.forEach((b: any, bi: any) => {
      if (!(b._wall && b.openings && b.openings.length)) return;
      b.openings.forEach((op: any, idx: any) => {
        const c = S.openingCorners3D(b, op);
        const quad = [c.M.Lb, c.M.Rb, c.M.Rt, c.M.Lt].map(S.mProject);
        if (S.pointInPoly(sx, sy, quad)) {
          let d = 0; quad.forEach((p: any) => d += p.depth); d /= 4;
          if (d > bestDepth) { bestDepth = d; best = { bi, idx }; }
        }
      });
    });
    return best;
  }
  S.selectedOpening = function selectedOpening() {
    const s = S.massing.selOpening; if (!s) return null;
    const b = S.massing.masses[s.bi];
    if (!b || !b.openings || !b.openings[s.idx]) { S.massing.selOpening = null; return null; }
    return b.openings[s.idx];
  }
  S.selectOpening = function selectOpening(hit: any) {
    S.massing.selOpening = hit; S.massing.selected = -1;
    const op = S.massing.masses[hit.bi].openings[hit.idx];
    S.massing.buildMode = op.kind;
    S.buildBuildPalette(); S.refreshInspector(); S.renderMassing();
    S.massHint(op.kind[0].toUpperCase() + op.kind.slice(1) + ' selected · resize with the fields · Delete to remove');
  }
  S.deleteSelOpening = function deleteSelOpening() {
    const s = S.massing.selOpening; if (!s) return;
    const b = S.massing.masses[s.bi]; if (!b || !b.openings) return;
    S.massSnapshot(); b.openings.splice(s.idx, 1); S.massing.selOpening = null;
    S.buildBuildPalette(); S.renderMassing(); S.massHint('Opening removed');
  }
  S.buildBuildPalette = function buildBuildPalette() {
    S.buildDefaults(); const el = S.ensureWallPalette(); el.innerHTML = '';
    const modes = document.createElement('div'); modes.className = 'bm-modes';
    [['wall', 'Wall'], ['door', 'Door'], ['window', 'Window']].forEach(([m, lab]) => {
      const b = document.createElement('button'); b.className = 'bm' + (S.massing.buildMode === m ? ' on' : ''); b.textContent = lab;
      b.onclick = () => { S.massing.buildMode = m; S.massing.selOpening = null; if (m !== 'wall' && S.massing.wall) S.finishWall(); S.buildBuildPalette(); S.renderMassing();
        S.massHint(m === 'wall' ? 'Tap each corner to lay walls · tap the first dot to close a room' : 'Tap a wall to drop a ' + m + ' · or tap an existing one to edit'); };
      modes.appendChild(b);
    });
    el.appendChild(modes);
    const fields = document.createElement('div'); fields.className = 'bm-fields';
    const mk = (lab: any, val: any, step: any, on: any) => {
      const f = document.createElement('div'); f.className = 'wf';
      const l = document.createElement('label'); l.textContent = lab;
      const i = document.createElement('input'); i.type = 'number'; i.step = step; i.min = '0.05'; i.value = val; i.inputMode = 'decimal';
      i.onchange = () => { const v = parseFloat(i.value); if (v > 0) on(v); };
      f.append(l, i); return f;
    };
    if (S.massing.buildMode === 'wall') {
      fields.append(mk('Thickness (m)', S.massing.wallThick, '0.05', (v: any) => S.massing.wallThick = v),
        mk('Height (m)', S.massing.wallHeight, '0.1', (v: any) => S.massing.wallHeight = v));
      const done = document.createElement('button'); done.className = 'bm-done'; done.textContent = 'Done'; done.onclick = () => S.finishWall();
      fields.appendChild(done);
    } else if (S.massing.buildMode === 'door') {
      const t = S.selectedOpening(); const tgt = (t && t.kind === 'door') ? t : null;
      fields.append(
        mk('Width (m)', tgt ? tgt.w : S.massing.doorW, '0.05', (v: any) => { if (tgt) { S.massSnapshot(); tgt.w = v; S.renderMassing(); } else S.massing.doorW = v; }),
        mk('Height (m)', tgt ? tgt.h : S.massing.doorH, '0.1', (v: any) => { if (tgt) { S.massSnapshot(); tgt.h = v; S.renderMassing(); } else S.massing.doorH = v; }));
      fields.appendChild(S.cutToggle());
      if (tgt) fields.appendChild(S.delOpBtn());
    } else {
      const t = S.selectedOpening(); const tgt = (t && t.kind === 'window') ? t : null;
      fields.append(
        mk('Width (m)', tgt ? tgt.w : S.massing.winW, '0.05', (v: any) => { if (tgt) { S.massSnapshot(); tgt.w = v; S.renderMassing(); } else S.massing.winW = v; }),
        mk('Height (m)', tgt ? tgt.h : S.massing.winH, '0.1', (v: any) => { if (tgt) { S.massSnapshot(); tgt.h = v; S.renderMassing(); } else S.massing.winH = v; }),
        mk('Sill (m)', tgt ? (tgt.sill || 0) : S.massing.winSill, '0.1', (v: any) => { if (tgt) { S.massSnapshot(); tgt.sill = v; S.renderMassing(); } else S.massing.winSill = v; }));
      fields.appendChild(S.cutToggle());
      if (tgt) fields.appendChild(S.delOpBtn());
    }
    el.appendChild(fields);
  }
  S.updateBuildPalette = function updateBuildPalette() {
    const show = S.massing.active && S.massing.tool === 'build';
    if (show) { S.buildBuildPalette(); S.ensureWallPalette().style.display = 'flex'; }
    else if (S._wallPaletteEl) { S._wallPaletteEl.style.display = 'none'; S.massing.selOpening = null; if (S.massing.wall) S.finishWall(); }
  }

}
