/* Auto-converted from public/engine/app/09-massing.js — shared scope S */
import { S } from "./scope";
import { initWalls } from "./walls";

export function initMassing() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);


  /* =================================================================
     3D MASSING — lightweight axonometric/perspective box renderer.
     Self-contained: own canvas, own state, own pointer handlers.
     Renders flat-shaded volumes with crisp edges; can bake to a 2D layer.
     ================================================================= */
  S.massingCanvas = $el('massing-canvas');
  S.mctx = S.massingCanvas.getContext('2d') as any;
  S.massingBar = $el('massing-bar');
  S.massingHintEl = $el('massing-hint');

  S.massing = {
    active: false,
    tool: 'add',                 // add | move | height | orbit
    masses: [],                  // [{x,z,w,d,h}] boxes OR {poly:[{x,z}..],h} prisms
    cam: { az: 0.7, el: 0.52, scale: 1, projection: 'axon', persp: 900 },
    grid: 1,                     // ground grid spacing in metres
    selected: -1,
    dragging: null,              // active drag descriptor
    cx: 0, cy: 0,                // screen centre
    panX: 0, panY: 0,            // view pan offset
    undoStack: [], redoStack: [],
    showBase: false,             // project the 2D drawing onto the ground plane
    baseImg: null,               // cached composite of visible 2D layers
    baseAnchor: null,            // { px, py, ppm } doc-pixel origin mapped to world 0,0
    baseAlpha: 0.92,
  };

  S.massHint = function massHint(t: any) {
    S.massingHintEl.textContent = t;
    S.massingHintEl.style.display = t ? 'block' : 'none';
  }

  // ---- 3D math ----
  S.mRotY = function mRotY(p: any, a: any){ const c=Math.cos(a), s=Math.sin(a); return { x:p.x*c+p.z*s, y:p.y, z:-p.x*s+p.z*c }; }
  S.mRotX = function mRotX(p: any, a: any){ const c=Math.cos(a), s=Math.sin(a); return { x:p.x, y:p.y*c-p.z*s, z:p.y*s+p.z*c }; }

  S.mProjectC = function mProjectC(p: any, cx: any, cy: any, s: any) {
    // world → camera space
    let q = S.mRotY(p, S.massing.cam.az);
    q = S.mRotX(q, S.massing.cam.el);
    if (S.massing.cam.projection === 'persp') {
      const d = S.massing.cam.persp;
      const f = d / (d - q.z * s);     // simple perspective divide
      return { x: cx + q.x * s * f, y: cy - q.y * s * f, depth: q.z };
    }
    return { x: cx + q.x * s, y: cy - q.y * s, depth: q.z };
  }
  S.mProject = function mProject(p: any) {
    return S.mProjectC(p, S.massing.cx, S.massing.cy, S.massing.cam.scale);
  }

  // Inverse: screen point → ground plane (y=0) world coords. Axon only (used for placing).
  S.mGroundPick = function mGroundPick(sx: any, sy: any) {
    const s = S.massing.cam.scale;
    const A = (sx - S.massing.cx) / s;
    const B = ((S.massing.cy - sy) / s) / Math.max(0.0001, Math.sin(S.massing.cam.el));
    const az = S.massing.cam.az;
    const x = A * Math.cos(az) + B * Math.sin(az);
    const z = A * Math.sin(az) - B * Math.cos(az);
    return { x, z };
  }

  S.mSnap = function mSnap(v: any){ return Math.round(v / S.massing.grid) * S.massing.grid; }
  S.mSnapH = function mSnapH(v: any){ return Math.round(v / 0.1) * 0.1; }   // fine 0.1 m steps for height / lift

  // Box → 8 corners. Footprint on ground up to height h, base at baseY.
  S.boxVerts = function boxVerts(b: any) {
    const { x, z, w, d, h } = b; const y0 = b.baseY || 0, y1 = y0 + h;
    return [
      {x:x,   y:y0, z:z},   {x:x+w, y:y0, z:z},   {x:x+w, y:y0, z:z+d},   {x:x,   y:y0, z:z+d},   // base 0-3
      {x:x,   y:y1, z:z},   {x:x+w, y:y1, z:z},   {x:x+w, y:y1, z:z+d},   {x:x,   y:y1, z:z+d},   // top  4-7
    ];
  }
  S.BOX_FACES = [
    { idx:[4,5,6,7], n:[0,1,0] },   // top
    { idx:[0,1,2,3], n:[0,-1,0] },  // bottom
    { idx:[0,1,5,4], n:[0,0,-1] },  // front (-z)
    { idx:[2,3,7,6], n:[0,0,1] },   // back (+z)
    { idx:[1,2,6,5], n:[1,0,0] },   // right (+x)
    { idx:[3,0,4,7], n:[-1,0,0] },  // left (-x)
  ];

  // Every mass is a footprint polygon + height, with optional rot / fscale / taper params.
  S.footPoly = function footPoly(b: any) {
    if (b.poly) return b.poly;
    return [ {x:b.x, z:b.z}, {x:b.x+b.w, z:b.z}, {x:b.x+b.w, z:b.z+b.d}, {x:b.x, z:b.z+b.d} ];
  }
  // Transformed base + top footprints (footprint scale, taper, rotation around centroid).
  S.massBaseTop = function massBaseTop(b: any) {
    const poly = S.footPoly(b);
    let cx = 0, cz = 0; poly.forEach((p: any) => { cx += p.x; cz += p.z; }); cx /= poly.length; cz /= poly.length;
    const rot = b.rot || 0, tp = (b.taper != null ? b.taper : 1);
    const fsx = (b.fsx != null ? b.fsx : (b.fscale != null ? b.fscale : 1));
    const fsz = (b.fsz != null ? b.fsz : (b.fscale != null ? b.fscale : 1));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const tf = (p: any, sx: any, sz: any) => { const dx = (p.x - cx) * sx, dz = (p.z - cz) * sz; return { x: cx + dx*cr - dz*sr, z: cz + dx*sr + dz*cr }; }
    return { base: poly.map((p: any) => tf(p, fsx, fsz)), top: poly.map((p: any) => tf(p, fsx*tp, fsz*tp)), cx, cz };
  }
  S.massVerts = function massVerts(b: any) {
    const { base, top } = S.massBaseTop(b);
    const y0 = b.baseY || 0, y1 = y0 + b.h, out = [];
    for (const p of base) out.push({ x: p.x, y: y0, z: p.z });   // base 0..n-1
    for (const p of top)  out.push({ x: p.x, y: y1, z: p.z });   // top  n..2n-1
    return out;
  }
  S.massFaces = function massFaces(b: any) {
    const { base } = S.massBaseTop(b);
    const n = base.length, faces = [];
    let cx = 0, cz = 0; base.forEach((p: any) => { cx += p.x; cz += p.z; }); cx /= n; cz /= n;
    const topIdx = [], botIdx = [];
    for (let i = 0; i < n; i++) { topIdx.push(n + i); botIdx.push(n - 1 - i); }
    faces.push({ idx: topIdx, n: [0, 1, 0], id: 'top' });
    faces.push({ idx: botIdx, n: [0, -1, 0], id: 'bottom' });
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ex = base[j].x - base[i].x, ez = base[j].z - base[i].z;
      let nx = ez, nz = -ex; const len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
      const mx = (base[i].x + base[j].x) / 2 - cx, mz = (base[i].z + base[j].z) / 2 - cz;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      faces.push({ idx: [i, j, n + j, n + i], n: [nx, 0, nz], id: 'side' + i });
    }
    return faces;
  }

  // ---- CUT openings (Phase 1): real holes through a wall, with reveals + glass/leaf ----
  // Opening stored on the wall: { kind:'door'|'window', u:0..1 along length, w, h, sill }
  S.openingCorners3D = function openingCorners3D(b: any, op: any) {
    const p = b.poly, y0 = b.baseY || 0, y1 = y0 + b.h;
    const dux = p[1].x - p[0].x, duz = p[1].z - p[0].z, L = Math.hypot(dux, duz) || 1;
    const ux = dux / L, uz = duz / L;
    const s = op.u * L, s0 = Math.max(0, s - op.w / 2), s1 = Math.min(L, s + op.w / 2);
    const sill = op.kind === 'door' ? 0 : (op.sill || 0);
    const yb = Math.max(y0, y0 + sill), yt = Math.min(y1, y0 + sill + op.h);
    const F = (ss: any, y: any) => ({ x: p[0].x + ux * ss, y, z: p[0].z + uz * ss });          // front edge p0→p1
    const B = (ss: any, y: any) => ({ x: p[3].x + ux * ss, y, z: p[3].z + uz * ss });          // back edge p3→p2
    const M = (ss: any, y: any) => ({ x: (p[0].x + p[3].x) / 2 + ux * ss, y, z: (p[0].z + p[3].z) / 2 + uz * ss });
    return {
      door: op.kind === 'door',
      F: { Lb: F(s0, yb), Rb: F(s1, yb), Rt: F(s1, yt), Lt: F(s0, yt) },
      B: { Lb: B(s0, yb), Rb: B(s1, yb), Rt: B(s1, yt), Lt: B(s0, yt) },
      M: { Lb: M(s0, yb), Rb: M(s1, yb), Rt: M(s1, yt), Lt: M(s0, yt) }
    };
  }
  S._avgDepth = function _avgDepth(pts: any) { let d = 0; for (const p of pts) d += p.depth; return d / pts.length; }
  S.pushWallWithOpenings = function pushWallWithOpenings(b: any, bi: any, vs: any, faces: any) {
    const sel = bi === S.massing.selected;
    const mf = S.massFaces(b);
    const get = (id: any) => mf.find((f: any) => f.id === id);
    // keep top, bottom and the two end caps as ordinary faces
    ['top', 'bottom', 'side1', 'side3'].forEach((id: any) => {
      const f = get(id); if (!f) return;
      const pts = f.idx.map((i: any) => vs[i]);
      faces.push({ bi, id, pts, n: f.n, depth: S._avgDepth(pts), selected: sel });
    });
    const proj = (q: any) => q.map(S.mProject);
    const f0 = get('side0'), f2 = get('side2');
    const n0 = f0.n, n2 = f2.n;
    const selOp = (S.massing.selOpening && S.massing.selOpening.bi === bi) ? S.massing.selOpening.idx : -1;
    const frontHoles: any[] = [], backHoles: any[] = [];
    b.openings.forEach((op: any, oi: any) => {
      const opSel = oi === selOp;
      const c = S.openingCorners3D(b, op);
      frontHoles.push(proj([c.F.Lb, c.F.Rb, c.F.Rt, c.F.Lt]));
      backHoles.push(proj([c.B.Lb, c.B.Rb, c.B.Rt, c.B.Lt]));
      const rev = (quad: any) => { const pts = proj(quad); faces.push({ bi, id: 'reveal', pts, n: [0, 1, 0], depth: S._avgDepth(pts), interior: true, selected: opSel }); };
      rev([c.F.Lt, c.F.Rt, c.B.Rt, c.B.Lt]);               // head
      if (!c.door) rev([c.F.Lb, c.F.Rb, c.B.Rb, c.B.Lb]);  // sill
      rev([c.F.Lb, c.F.Lt, c.B.Lt, c.B.Lb]);               // left jamb
      rev([c.F.Rb, c.F.Rt, c.B.Rt, c.B.Rb]);               // right jamb
      const pane = proj([c.M.Lb, c.M.Rb, c.M.Rt, c.M.Lt]);
      const e: any = { bi, id: 'pane', pts: pane, n: n0, depth: S._avgDepth(pane), selected: opSel };
      e[c.door ? 'leaf' : 'glass'] = true; faces.push(e);
    });
    const p0 = f0.idx.map((i: any) => vs[i]); faces.push({ bi, id: 'side0', pts: p0, n: n0, depth: S._avgDepth(p0), holes: frontHoles, selected: sel });
    const p2 = f2.idx.map((i: any) => vs[i]); faces.push({ bi, id: 'side2', pts: p2, n: n2, depth: S._avgDepth(p2), holes: backHoles, selected: sel });
  }
  S._mid = function _mid(a: any, b: any) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  S.drawPane = function drawPane(f: any, glass: any) {
    const pts = f.pts;
    S.mctx.beginPath(); S.mctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) S.mctx.lineTo(pts[i].x, pts[i].y); S.mctx.closePath();
    if (glass) {
      S.mctx.fillStyle = f.selected ? 'rgba(196,120,128,0.45)' : 'rgba(150,182,206,0.42)'; S.mctx.fill();
      S.mctx.strokeStyle = 'rgba(60,84,100,0.55)'; S.mctx.lineWidth = 1;
      const ml = S._mid(pts[0], pts[3]), mr = S._mid(pts[1], pts[2]), mt = S._mid(pts[3], pts[2]), mb = S._mid(pts[0], pts[1]);
      S.mctx.beginPath(); S.mctx.moveTo(ml.x, ml.y); S.mctx.lineTo(mr.x, mr.y); S.mctx.moveTo(mt.x, mt.y); S.mctx.lineTo(mb.x, mb.y); S.mctx.stroke();
    } else {
      S.mctx.fillStyle = f.selected ? 'rgb(176,108,116)' : 'rgb(120,86,60)'; S.mctx.fill();
      const hx = pts[1].x * 0.82 + pts[0].x * 0.18, hy = pts[1].y * 0.82 + pts[0].y * 0.18;
      const hx2 = pts[2].x * 0.82 + pts[3].x * 0.18, hy2 = pts[2].y * 0.82 + pts[3].y * 0.18;
      S.mctx.strokeStyle = 'rgba(40,30,22,0.5)'; S.mctx.lineWidth = 1.2;
      S.mctx.beginPath(); S.mctx.moveTo(hx, hy); S.mctx.lineTo(hx2, hy2); S.mctx.stroke();   // hinge line
    }
    S.mctx.strokeStyle = f.selected ? '#a02835' : 'rgba(40,36,33,0.75)'; S.mctx.lineWidth = f.selected ? 2 : 1.2; S.mctx.stroke();
  }

  // ---- render ----
  S.renderMassing = function renderMassing() {
    if (!S.massing.active) return;
    const rect = S.area.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    if (S.massingCanvas.width !== W || S.massingCanvas.height !== H) {
      S.massingCanvas.width = W; S.massingCanvas.height = H;
    }
    S.massing.cx = W / 2 + (S.massing.panX || 0); S.massing.cy = H * 0.58 + (S.massing.panY || 0);

    S.mctx.clearRect(0, 0, W, H);
    if (!S.massing._export) {
      S.mctx.fillStyle = '#e9e5e0';
      S.mctx.fillRect(0, 0, W, H);
      S.drawGroundGrid();
    }
    S.drawGroundImage(S.mctx);

    // Collect every face from every mass, sort far→near (painter's algorithm)
    const faces: any[] = [];
    S.massing.masses.forEach((b: any, bi: any) => {
      const vs = S.massVerts(b).map(S.mProject);
      if (b._wall && b.openings && b.openings.length) { S.pushWallWithOpenings(b, bi, vs, faces); return; }
      const cull = false;   // all masses are polygonal — depth-sort only
      S.massFaces(b).forEach((f: any) => {
        const p0 = vs[f.idx[0]], p1 = vs[f.idx[1]], p2 = vs[f.idx[2]];
        const cross = (p1.x-p0.x)*(p2.y-p0.y) - (p1.y-p0.y)*(p2.x-p0.x);
        if (cull && cross <= 0) return;                 // box backface cull
        let depth = 0; for (const i of f.idx) depth += vs[i].depth; depth /= f.idx.length;
        faces.push({ bi, id: f.id, pts: f.idx.map((i: any) => vs[i]), n: f.n, depth, selected: bi === S.massing.selected });
      });
    });
    // Phase 3-4: extruded face regions. Outward = protrusion; inward = recess (hole punched
    // in the base face, inner faces flagged interior so they read as a reveal).
    S.massing.masses.forEach((b: any, bi: any) => {
      if (!b.faceRegions) return;
      const sel = bi === S.massing.selected;
      Object.keys(b.faceRegions).forEach((faceId: any) => {
        b.faceRegions[faceId].forEach((region: any) => {
          const dM = (region.depth || 0) / 1000;
          if (Math.abs(dM) < 1e-4) return;
          const inward = dM < 0;
          S.extrudeRegionFaces(b, faceId, region, dM).forEach((ff: any) => {
            const pts = ff.world.map(S.mProject);
            faces.push({ bi, id: ff.id, pts, n: ff.n, depth: S._avgDepth(pts), selected: sel, feature: true, interior: inward, mat: region.mat || null });
          });
          if (inward) {
            const g = S.faceGeom(b, faceId);
            if (g && g.quad) {
              const holeLoop = region.uv.map((p: any) => S.mProject(S._bilinear(g.quad, p.u, p.v)));
              const bf = faces.find((f: any) => f.bi === bi && f.id === faceId && !f.feature);
              if (bf) { bf.holes = bf.holes || []; bf.holes.push(holeLoop); }
            }
          }
        });
      });
    });
    faces.sort((a: any, b: any) => a.depth - b.depth);
    S.massing._faces = faces;   // test/inspection seam

    // Light direction (normalised-ish) for flat shading
    const L = [-0.4, 0.82, 0.4];
    faces.forEach((f: any) => {
      const fb = S.massing.masses[f.bi];
      if (f.glass) { S.drawPane(f, true); return; }
      if (f.leaf) { S.drawPane(f, false); return; }
      const fmat = fb.faceMat && fb.faceMat[f.id];
      const ndl = Math.max(0, f.n[0]*L[0] + f.n[1]*L[1] + f.n[2]*L[2]);
      let shade = 0.55 + ndl * 0.45;            // 0.55 (dark side) → 1.0 (top)
      // base S.massing colour: per-face material colour, else per-mass tint, else warm stone
      let base = f.selected ? [196, 120, 128] : (fb.color || [188, 178, 168]);
      if (fmat && fmat.kind === 'color' && !f.selected) { const c = S.hexToRgba(fmat.hex); base = [c[0], c[1], c[2]]; }
      if (f.interior && !f.selected) { base = [150, 142, 132]; shade = 0.46; }   // recessed reveal — fixed dim
      const r = Math.round(base[0] * shade), g = Math.round(base[1] * shade), bl = Math.round(base[2] * shade);
      S.mctx.beginPath();
      S.mctx.moveTo(f.pts[0].x, f.pts[0].y);
      for (let i = 1; i < f.pts.length; i++) S.mctx.lineTo(f.pts[i].x, f.pts[i].y);
      S.mctx.closePath();
      if (f.holes) f.holes.forEach((loop: any) => {            // punch the openings (even-odd)
        S.mctx.moveTo(loop[0].x, loop[0].y);
        for (let i = 1; i < loop.length; i++) S.mctx.lineTo(loop[i].x, loop[i].y);
        S.mctx.closePath();
      });
      let fillStyle = `rgb(${r},${g},${bl})`;
      if (f.mat) {   // a region's own material always shows, even while the mass is selected
        if (f.mat.kind === 'texture') { const pat = S.regionPattern(f.mat); if (pat) fillStyle = pat; }
        else { const tr = S.matFill(f.mat); if (tr) fillStyle = tr; else if (f.mat.kind === 'color') { const c = S.hexToRgba(f.mat.hex); fillStyle = `rgb(${Math.round(c[0] * shade)},${Math.round(c[1] * shade)},${Math.round(c[2] * shade)})`; } }
      }
      S.mctx.fillStyle = fillStyle;
      S.mctx.fill(f.holes ? 'evenodd' : 'nonzero');
      S.mctx.lineJoin = 'round';
      S.mctx.strokeStyle = f.selected ? '#a02835' : 'rgba(40,36,33,0.85)';
      S.mctx.lineWidth = f.selected ? 2 : 1.2;
      S.mctx.stroke();
      if (f.holes) f.holes.forEach((loop: any) => {            // outline each opening edge
        S.mctx.beginPath(); S.mctx.moveTo(loop[0].x, loop[0].y);
        for (let i = 1; i < loop.length; i++) S.mctx.lineTo(loop[i].x, loop[i].y);
        S.mctx.closePath(); S.mctx.stroke();
      });
      if (f.holes || f.interior) return;               // v1: no material/sketch on holed walls or reveals
      // referenced texture material — re-tiled to the face's current size (under the sketch)
      if (fmat && fmat.kind === 'texture') {
        const mimg = S.matFaceImg(fb, f.id, fmat);
        if (mimg && mimg.complete && mimg.naturalWidth) {
          const g2 = S.faceGeom(fb, f.id);
          if (g2) S.drawFaceArt(S.mctx, g2.quad, mimg, g2.clip, S.mProject);
        }
      }
      // hand-drawn sketch art on top
      if (fb.faceArt && fb.faceArt[f.id]) {
        S.ensureFaceImg(fb);
        const g = S.faceGeom(fb, f.id);
        if (g) S.drawFaceArt(S.mctx, g.quad, fb._faceImg[f.id], g.clip, S.mProject);
      }
      // Phase 1-2: vector face regions mapped onto the face in 3D
      S.renderFaceRegions(S.mctx, fb, f);
    });

    // Footprint being drawn
    if (S.massing.dragging && S.massing.dragging.type === 'foot') {
      const d = S.massing.dragging;
      const corners = [
        {x:d.x0, z:d.z0}, {x:d.x1, z:d.z0}, {x:d.x1, z:d.z1}, {x:d.x0, z:d.z1}
      ].map((c: any) => S.mProject({x:c.x, y:0, z:c.z}));
      S.mctx.beginPath();
      S.mctx.moveTo(corners[0].x, corners[0].y);
      corners.forEach((c: any) => S.mctx.lineTo(c.x, c.y));
      S.mctx.closePath();
      S.mctx.fillStyle = 'rgba(160,40,53,0.18)';
      S.mctx.fill();
      S.mctx.strokeStyle = '#a02835'; S.mctx.lineWidth = 1.5; S.mctx.stroke();
    }

    // Transform gizmo on the selected mass (Select tool)
    if (S.massing.tool === 'select' && S.massing.selected >= 0 && S.massing.masses[S.massing.selected]) {
      S.drawGizmo(S.massing.masses[S.massing.selected]);
    }
    if (S.massing.tool === 'build' && (S.massing.buildMode || 'wall') === 'wall') S.drawWallOverlay();
  }

  S.drawGroundGrid = function drawGroundGrid() {
    const N = 20;                       // lines each side of origin
    const g = S.massing.grid;
    S.mctx.lineWidth = 1;
    for (let i = -N; i <= N; i++) {
      const major = (i % 5 === 0);
      S.mctx.strokeStyle = major ? 'rgba(40,36,33,0.28)' : 'rgba(40,36,33,0.12)';
      let a = S.mProject({x:i*g, y:0, z:-N*g}), b = S.mProject({x:i*g, y:0, z:N*g});
      S.mctx.beginPath(); S.mctx.moveTo(a.x,a.y); S.mctx.lineTo(b.x,b.y); S.mctx.stroke();
      a = S.mProject({x:-N*g, y:0, z:i*g}); b = S.mProject({x:N*g, y:0, z:i*g});
      S.mctx.beginPath(); S.mctx.moveTo(a.x,a.y); S.mctx.lineTo(b.x,b.y); S.mctx.stroke();
    }
  }

  // ---- base 2D drawing projected onto the ground plane ----
  S._massBaseCanvas = null;
  S.buildMassingBase = function buildMassingBase() {
    if (!S._massBaseCanvas) S._massBaseCanvas = document.createElement('canvas');
    S._massBaseCanvas.width = S.doc.wPx; S._massBaseCanvas.height = S.doc.hPx;
    S.flattenVisibleToCtx(S._massBaseCanvas.getContext('2d') as any);
    S.massing.baseImg = S._massBaseCanvas;
  }
  // doc pixel → world (anchored so the extruded footprint sits over its plan) → screen
  S.projectGround = function projectGround(px: any, py: any) {
    const a = S.massing.baseAnchor;
    return S.mProject({ x: (px - a.px) / a.ppm, y: 0, z: (py - a.py) / a.ppm });
  }
  S.drawGroundImage = function drawGroundImage(ctx: any) {
    if (!S.massing.showBase || !S.massing.baseImg || !S.massing.baseAnchor) return;
    const img = S.massing.baseImg, IW = img.width, IH = img.height;
    const N = S.massing.cam.projection === 'persp' ? 8 : 1;   // axon: one exact affine; persp: piecewise
    const cw = IW / N, ch = IH / N;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = S.massing.baseAlpha;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const sx = i * cw, sy = j * ch;
        const P0 = S.projectGround(sx, sy);
        const P1 = S.projectGround(sx + cw, sy);
        const P2 = S.projectGround(sx + cw, sy + ch);
        const P3 = S.projectGround(sx, sy + ch);
        const a = (P1.x - P0.x) / cw, b = (P1.y - P0.y) / cw;
        const c = (P3.x - P0.x) / ch, d = (P3.y - P0.y) / ch;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(P0.x, P0.y); ctx.lineTo(P1.x, P1.y); ctx.lineTo(P2.x, P2.y); ctx.lineTo(P3.x, P3.y);
        ctx.closePath(); ctx.clip();
        ctx.setTransform(a, b, c, d, P0.x, P0.y);
        ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
        ctx.restore();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = prevAlpha;
  }

  // hit-test: which mass is under a screen point (topmost by depth)
  S.massAt = function massAt(sx: any, sy: any) {
    let best = -1, bestDepth = -Infinity;
    S.massing.masses.forEach((b: any, bi: any) => {
      const vs = S.massVerts(b).map(S.mProject);
      S.massFaces(b).forEach((f: any) => {
        const pts = f.idx.map((i: any) => vs[i]);
        if (S.pointInPoly(sx, sy, pts)) {
          let depth = 0; for (const i of f.idx) depth += vs[i].depth; depth /= f.idx.length;
          if (depth > bestDepth) { bestDepth = depth; best = bi; }
        }
      });
    });
    return best;
  }
  S.pointInPoly = function pointInPoly(px: any, py: any, pts: any) {
    let inside = false;
    for (let i=0, j=pts.length-1; i<pts.length; j=i++) {
      const xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y;
      if (((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi)) inside = !inside;
    }
    return inside;
  }

  // ===== Polygon offset (shared by the 2D Offset tool + 3D footprint offset) =====
  S._offArea = function _offArea(pts: any){ let a=0; for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length]; a+=p.x*q.y-q.x*p.y;} return a/2; }
  S._offLineX = function _offLineX(p1: any, p2: any, p3: any, p4: any){
    const d=(p1.x-p2.x)*(p3.y-p4.y)-(p1.y-p2.y)*(p3.x-p4.x);
    if(Math.abs(d)<1e-9) return null;
    const a=p1.x*p2.y-p1.y*p2.x, b=p3.x*p4.y-p3.y*p4.x;
    return { x:(a*(p3.x-p4.x)-(p1.x-p2.x)*b)/d, y:(a*(p3.y-p4.y)-(p1.y-p2.y)*b)/d };
  }
  // dist > 0 grows (outward), < 0 shrinks (inward); winding-independent. null if it self-destructs.
  S.offsetPolygon = function offsetPolygon(pts: any, dist: any){
    const n=pts.length; if(n<3) return null;
    const ccw=S._offArea(pts)>0;
    const E=[];
    for(let i=0;i<n;i++){
      const a=pts[i], b=pts[(i+1)%n];
      let dx=b.x-a.x, dy=b.y-a.y; const L=Math.hypot(dx,dy)||1; dx/=L; dy/=L;
      const nx = ccw? dy : -dy, ny = ccw? -dx : dx;
      E.push({a:{x:a.x+nx*dist,y:a.y+ny*dist}, b:{x:b.x+nx*dist,y:b.y+ny*dist}});
    }
    const out=[];
    for(let i=0;i<n;i++){ const e0=E[(i-1+n)%n], e1=E[i]; const p=S._offLineX(e0.a,e0.b,e1.a,e1.b); out.push(p||{x:e1.a.x,y:e1.a.y}); }
    const a0=S._offArea(pts), a1=S._offArea(out);
    if(Math.sign(a1)!==Math.sign(a0) || Math.abs(a1)<1e-6) return null;
    for(let i=0;i<n;i++){ const oa=pts[i], ob=pts[(i+1)%n], na=out[i], nb=out[(i+1)%n];
      if((ob.x-oa.x)*(nb.x-na.x)+(ob.y-oa.y)*(nb.y-na.y) < 0) return null; }
    return out;
  }

  // ---- 2D Offset tool (offsets a room boundary) ----
  S.offsetRoomAt = function offsetRoomAt(p: any){
    for(let idx=(state.measurements||[]).length-1; idx>=0; idx--){
      const m=state.measurements[idx];
      if(m.type==='area' && m.points && m.points.length>=3 && S.pointInPoly(p.x,p.y,m.points)) return idx;
    }
    return -1;
  }
  S.shapeHitClosed = function shapeHitClosed(sh: any, p: any){
    if(sh.kind==='ellipse'){ const dx=(p.x-sh.cx)/((sh as any).rx||1), dy=(p.y-sh.cy)/((sh as any).ry||1); return dx*dx+dy*dy<=1.15; }
    if(sh.pts && (sh.closed||sh.kind==='rect') && sh.pts.length>=3) return S.pointInPoly(p.x,p.y,sh.pts);
    return false;   // open lines have no boundary to offset
  }
  S.shapeHit = function shapeHit(sh: any, p: any){
    if(S.shapeHitClosed(sh,p)) return true;
    if(sh.pts){ const n=sh.pts.length; for(let i=0;i<n-1;i++){ if(S._distToSeg(p,sh.pts[i],sh.pts[i+1])<10) return true; }
      if(sh.closed && n>2 && S._distToSeg(p,sh.pts[n-1],sh.pts[0])<10) return true; }
    return false;
  }
  S.offsetTargetAt = function offsetTargetAt(p: any){
    for(let i=(state.shapes||[]).length-1;i>=0;i--){ if(S.shapeHitClosed(state.shapes[i],p)) return {type:'shape',idx:i}; }
    const r=S.offsetRoomAt(p); if(r>=0) return {type:'room',idx:r};
    return null;
  }
  S.offsetDistDocPx = function offsetDistDocPx(){ const mm=(state.offset && state.offset.mm)||100; return (mm/1000)*S.pxPerMetre(); }
  S.computeOffsetPreview = function computeOffsetPreview(){
    if(!state.offset) return null;
    const d=S.offsetDistDocPx()*(state.offset.dir||-1);
    if(state.offset.type==='shape'){
      const sh=state.shapes[state.offset.idx]; if(!sh) return null;
      if(sh.kind==='ellipse'){ const rx=(sh as any).rx+d, ry=(sh as any).ry+d; if(rx<=1||ry<=1) return null; return {ellipse:true,cx:sh.cx,cy:sh.cy,rx,ry}; }
      if(sh.pts && (sh.closed||sh.kind==='rect') && sh.pts.length>=3) return S.offsetPolygon(sh.pts,d);
      return null;
    }
    const m=state.measurements[state.offset.idx]; if(!m||!m.points) return null;
    return S.offsetPolygon(m.points, d);
  }
  S.drawOffsetPreview = function drawOffsetPreview(prev: any){
    const svgns='http://www.w3.org/2000/svg';
    let el;
    if(prev.ellipse){ el=document.createElementNS(svgns,'ellipse'); el.setAttribute('cx',prev.cx); el.setAttribute('cy',prev.cy); el.setAttribute('rx',prev.rx); el.setAttribute('ry',prev.ry); }
    else { el=document.createElementNS(svgns,'polygon'); el.setAttribute('points', prev.map((p: any) =>`${p.x},${p.y}`).join(' ')); }
    el.setAttribute('fill','rgba(160,40,53,0.10)');
    el.setAttribute('stroke','#a02835'); el.setAttribute('stroke-width','2'); el.setAttribute('stroke-dasharray','8 5');
    S.rulerOverlay.appendChild(el);
  }
  S._offBarEl=null;
  S.ensureOffsetBar = function ensureOffsetBar(){
    if(S._offBarEl) return S._offBarEl;
    const el=document.createElement('div'); el.id='offset-bar';
    el.style.cssText='position:fixed;top:64px;left:50%;transform:translateX(-50%);display:none;gap:10px;align-items:center;flex-wrap:wrap;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.10);border-radius:10px;padding:7px 13px;box-shadow:0 6px 22px rgba(0,0,0,0.16);z-index:31;font-size:11px;';
    document.body.appendChild(el); S._offBarEl=el; return el;
  }
  S.showOffsetBar = function showOffsetBar(show: any){
    S.ensureOffsetBar();
    const el=S._offBarEl;
    if(!show||!state.offset){ el.style.display='none'; el.innerHTML=''; return; }
    const inp='font-family:inherit;font-size:11px;padding:3px 5px;border:1px solid #ccc;border-radius:5px;';
    el.innerHTML='<span style="font-weight:700;letter-spacing:0.5px;color:#a02835;">OFFSET</span>'
      +`<label style="display:flex;align-items:center;gap:5px;color:#555;">Dist <input id="of-mm" type="number" min="1" step="10" style="width:64px;${inp}"> mm</label>`
      +'<button id="of-in" class="op-mini">In</button><button id="of-out" class="op-mini">Out</button>'
      +'<button id="of-apply" class="op-mini" style="background:#a02835;color:#fff;">Apply</button>'
      +'<button id="of-cancel" class="op-mini">Cancel</button>';
    el.querySelector('#of-mm').value=state.offset.mm||100;
    const refl=()=>{ el.querySelector('#of-in').style.fontWeight=state.offset.dir<0?'700':'400'; el.querySelector('#of-out').style.fontWeight=state.offset.dir>0?'700':'400'; };
    refl();
    el.querySelector('#of-mm').addEventListener('input',(e: any) =>{ const v=parseFloat(e.target.value); if(v>0){ state.offset.mm=v; S.refreshMeasurements(); } });
    el.querySelector('#of-in').onclick=()=>{ state.offset.dir=-1; refl(); S.refreshMeasurements(); };
    el.querySelector('#of-out').onclick=()=>{ state.offset.dir=1; refl(); S.refreshMeasurements(); };
    el.querySelector('#of-apply').onclick=()=>S.applyOffset();
    el.querySelector('#of-cancel').onclick=()=>{ state.offset=null; S.showOffsetBar(false); S.refreshMeasurements(); S.showHint('Offset cancelled'); };
    el.style.display='flex';
  }
  S.applyOffset = function applyOffset(){
    const prev=S.computeOffsetPreview();
    if(!prev){ S.showHint('Offset too large — reduce the distance'); return; }
    const __b=S.vectorSnapshot();
    if(state.offset.type==='shape'){
      const src=state.shapes[state.offset.idx]||{};
      if(prev.ellipse){ S.pushShapeEntity({kind:'ellipse',cx:prev.cx,cy:prev.cy,rx:prev.rx,ry:prev.ry,stroke:src.stroke,width:src.width}); }
      else { S.pushShapeEntity({kind:(src.kind==='rect'?'rect':'polygon'),pts:prev.map((p: any) =>({x:p.x,y:p.y})),closed:true,stroke:src.stroke,width:src.width}); }
      S.showHint('Offset shape created');
    } else {
      const src=state.measurements[state.offset.idx];
      const name=(src&&src.name?src.name:'Room')+' offset';
      state.measurements.push({ type:'area', name, points:prev.map((p: any) =>({x:p.x,y:p.y})), label:'', x1:prev[0].x,y1:prev[0].y,x2:prev[0].x,y2:prev[0].y });
      if(typeof S.renderSchedule==='function') S.renderSchedule();
      S.showHint('Offset created as a new room');
    }
    state.offset=null; S.showOffsetBar(false);
    S.refreshMeasurements(); S.recordVec(__b); S.scheduleAutosave();
  }

  // ---- face sketching (Stage 2) ----
  S._d3 = function _d3(a: any, b: any) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
  // Footprint transform: local (lx,lz) → world at base or top (applies scale, taper, rotation, y).
  S.massXform = function massXform(b: any) {
    const poly = S.footPoly(b);
    let cx = 0, cz = 0; poly.forEach((p: any) => { cx += p.x; cz += p.z; }); cx /= poly.length; cz /= poly.length;
    const rot = b.rot || 0, tp = (b.taper != null ? b.taper : 1);
    const fsx = (b.fsx != null ? b.fsx : (b.fscale != null ? b.fscale : 1));
    const fsz = (b.fsz != null ? b.fsz : (b.fscale != null ? b.fscale : 1));
    const cr = Math.cos(rot), sr = Math.sin(rot), y0 = b.baseY || 0, y1 = y0 + b.h;
    return { cx, cz, fsx, fsz, pt: (lx: any, lz: any, which: any) => {
      const s = which === 'top' ? tp : 1;
      const dx = (lx - cx) * fsx * s, dz = (lz - cz) * fsz * s;
      return { x: cx + dx*cr - dz*sr, y: which === 'top' ? y1 : y0, z: cz + dx*sr + dz*cr };
    } };
  }
  // Geometry for a sketchable face: world quad the art maps onto, optional clip polygon,
  // real metre size, and (for roof/floor) a normalised outline to guide the editor.
  // planeOverride lets the plan export clip a roof sketch to the base footprint.
  S.faceGeom = function faceGeom(b: any, id: any, planeOverride: any) {
    const X = S.massXform(b), poly = S.footPoly(b), vs = S.massVerts(b), n = poly.length;
    const base = vs.slice(0, n), top = vs.slice(n);
    if (id === 'top' || id === 'bottom') {
      const which = planeOverride || (id === 'top' ? 'top' : 'base');
      const xs = poly.map((p: any) => p.x), zs = poly.map((p: any) => p.z);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const quad = [X.pt(minX,minZ,which), X.pt(maxX,minZ,which), X.pt(maxX,maxZ,which), X.pt(minX,maxZ,which)];
      const clip = which === 'top' ? top : base;
      const guide = poly.map((p: any) => ({ x: (p.x - minX) / ((maxX - minX) || 1), y: (p.z - minZ) / ((maxZ - minZ) || 1) }));
      return { quad, clip, w: (maxX - minX) * X.fsx, h: (maxZ - minZ) * X.fsz, guide };
    }
    const i = parseInt(id.slice(4), 10), j = (i + 1) % n;
    return { quad: [top[i], top[j], base[j], base[i]], clip: null, w: S._d3(base[i], base[j]), h: b.h, guide: null };
  }
  S.faceLabel = function faceLabel(id: any) { return id === 'top' ? 'Roof plan' : id === 'bottom' ? 'Floor plan' : 'Elevation'; }
  // Topmost sketchable (quad) face under a screen point.
  S.massFaceAt = function massFaceAt(sx: any, sy: any) {
    let best = null, bd = -Infinity;
    S.massing.masses.forEach((b: any, bi: any) => {
      const vs = S.massVerts(b).map(S.mProject);
      S.massFaces(b).forEach((f: any) => {
        const pts = f.idx.map((i: any) => vs[i]);
        if (S.pointInPoly(sx, sy, pts)) {
          let depth = 0; for (const i of f.idx) depth += vs[i].depth; depth /= f.idx.length;
          if (depth > bd) { bd = depth; best = { bi, id: f.id }; }
        }
      });
    });
    return best;
  }
  // Lazily decode stored face art (dataURL) into Image objects for rendering.
  S.ensureFaceImg = function ensureFaceImg(b: any) {
    if (!b.faceArt) return;
    b._faceImg = b._faceImg || {};
    for (const id in b.faceArt) {
      if (!b._faceImg[id]) {
        const img = new Image();
        img.onload = () => S.renderMassing();
        img.src = b.faceArt[id];
        b._faceImg[id] = img;
      }
    }
  }
  // Warp a face-art image onto its quad through `project` (world→2D), optionally clipped to a polygon.
  S._bilinear = function _bilinear(quad: any, u: any, v: any) {
    // quad order: [0]=TL(0,0) [1]=TR(1,0) [2]=BR(1,1) [3]=BL(0,1) — matches drawFaceArt's UV convention
    const tx = quad[0].x + (quad[1].x - quad[0].x) * u, ty = quad[0].y + (quad[1].y - quad[0].y) * u, tz = quad[0].z + (quad[1].z - quad[0].z) * u;
    const bx = quad[3].x + (quad[2].x - quad[3].x) * u, by = quad[3].y + (quad[2].y - quad[3].y) * u, bz = quad[3].z + (quad[2].z - quad[3].z) * u;
    return { x: tx + (bx - tx) * v, y: ty + (by - ty) * v, z: tz + (bz - tz) * v };
  }
  S.renderFaceRegions = function renderFaceRegions(mctx: any, fb: any, f: any) {
    const regs = fb.faceRegions && fb.faceRegions[f.id];
    if (!regs || !regs.length) return;
    const g = S.faceGeom(fb, f.id); if (!g || !g.quad) return;
    regs.forEach((r: any) => {
      if (!r.uv || r.uv.length < 3) return;
      if (r.depth && Math.abs(r.depth) >= 1) return;   // extruded regions render as 3D geometry, not a flat outline
      const scr = r.uv.map((p: any) => S.mProject(S._bilinear(g.quad, p.u, p.v)));
      S.mctx.beginPath(); S.mctx.moveTo(scr[0].x, scr[0].y);
      for (let i = 1; i < scr.length; i++) S.mctx.lineTo(scr[i].x, scr[i].y);
      S.mctx.closePath();
      const m = r.mat;
      if (m && m.kind === 'texture') { const pat = S.regionPattern(m); S.mctx.fillStyle = pat || 'rgba(160,40,53,0.14)'; }
      else { const tr = S.matFill(m); if (tr) S.mctx.fillStyle = tr; else if (m && m.kind === 'color') S.mctx.fillStyle = m.hex; else S.mctx.fillStyle = 'rgba(160,40,53,0.14)'; }
      S.mctx.fill();
      S.mctx.strokeStyle = m ? 'rgba(40,36,33,0.7)' : '#a02835'; S.mctx.lineWidth = 2; S.mctx.lineJoin = 'round'; S.mctx.stroke();
    });
  }
  // Phase 3 extrusion kernel: face region + signed depth (m, + = outward) → world-space
  // cap + side-quad faces with outward normals. Caller projects + depth-sorts them with base geometry.
  S.extrudeRegionFaces = function extrudeRegionFaces(b: any, faceId: any, region: any, depthM: any) {
    const g = S.faceGeom(b, faceId);
    if (!g || !g.quad || !region.uv || region.uv.length < 3) return [];
    const Q = g.quad;
    const sub = (a: any, c: any) => ({ x: a.x - c.x, y: a.y - c.y, z: a.z - c.z });
    const add = (a: any, c: any) => ({ x: a.x + c.x, y: a.y + c.y, z: a.z + c.z });
    const mul = (a: any, s: any) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
    const cross = (a: any, c: any) => ({ x: a.y * c.z - a.z * c.y, y: a.z * c.x - a.x * c.z, z: a.x * c.y - a.y * c.x });
    const dot = (a: any, c: any) => a.x * c.x + a.y * c.y + a.z * c.z;
    const norm = (a: any) => { const L = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / L, y: a.y / L, z: a.z / L }; }
    const avg = (arr: any) => { const s = { x: 0, y: 0, z: 0 }; arr.forEach((p: any) => { s.x += p.x; s.y += p.y; s.z += p.z; }); return mul(s, 1 / arr.length); };
    const C = avg(S.massVerts(b));                       // mass centroid → orient normals outward
    let N: any = norm(cross(sub(Q[1], Q[0]), sub(Q[3], Q[0])));
    const faceC = S._bilinear(Q, 0.5, 0.5);
    if (dot(N, sub(faceC, C)) < 0) N = mul(N, -1);
    const base = region.uv.map((p: any) => S._bilinear(Q, p.u, p.v));
    const cap = base.map((p: any) => add(p, mul(N, depthM)));
    const out = [{ world: cap.slice(), n: [N.x, N.y, N.z], id: 'feat:' + faceId + ':cap' }];
    const m = base.length;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m, wq = [base[i], base[j], cap[j], cap[i]];
      let sn = norm(cross(sub(wq[1], wq[0]), sub(wq[3], wq[0])));
      if (dot(sn, sub(avg(wq), faceC)) < 0) sn = mul(sn, -1);
      out.push({ world: wq, n: [sn.x, sn.y, sn.z], id: 'feat:' + faceId + ':s' + i });
    }
    return out;
  }
  // Phase 5: unit outward normal of a face in world space (mirrors the kernel's orientation logic)
  S.faceOutwardNormal = function faceOutwardNormal(b: any, faceId: any) {
    const g = S.faceGeom(b, faceId); if (!g || !g.quad) return { x: 0, y: 1, z: 0 };
    const Q = g.quad;
    const sub = (a: any, c: any) => ({ x: a.x - c.x, y: a.y - c.y, z: a.z - c.z });
    const cross = (a: any, c: any) => ({ x: a.y * c.z - a.z * c.y, y: a.z * c.x - a.x * c.z, z: a.x * c.y - a.y * c.x });
    const dot = (a: any, c: any) => a.x * c.x + a.y * c.y + a.z * c.z;
    const norm = (a: any) => { const L = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / L, y: a.y / L, z: a.z / L }; }
    let N: any = norm(cross(sub(Q[1], Q[0]), sub(Q[3], Q[0])));
    const vs = S.massVerts(b); const C = { x: 0, y: 0, z: 0 };
    vs.forEach((p: any) => { C.x += p.x; C.y += p.y; C.z += p.z; }); C.x /= vs.length; C.y /= vs.length; C.z /= vs.length;
    if (dot(N, sub(S._bilinear(Q, 0.5, 0.5), C)) < 0) N = { x: -N.x, y: -N.y, z: -N.z };
    return N;
  }
  // Phase 5: pick the front-most face region under a screen point (its footprint on the face plane)
  S._ptPolyNear = function _ptPolyNear(px: any, py: any, poly: any, tol: any) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
      let t = ((px - a.x) * dx + (py - a.y) * dy) / L2; t = Math.max(0, Math.min(1, t));
      if (Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)) <= tol) return true;
    }
    return false;
  }
  S.massPushLimits = function massPushLimits(b: any) {
    const vs = S.massVerts(b);
    if (!vs || !vs.length) return { hi: 5000, lo: -5000 };
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity, mnz = Infinity, mxz = -Infinity;
    vs.forEach((p: any) => { mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mny = Math.min(mny, p.y); mxy = Math.max(mxy, p.y); mnz = Math.min(mnz, p.z); mxz = Math.max(mxz, p.z); });
    const dx = mxx - mnx, dy = mxy - mny, dz = mxz - mnz;
    const maxExt = Math.max(dx, dy, dz), minHoriz = Math.min(dx, dz);
    // outward: generous; inward: allow through-cut recesses (Morpholio-style push/pull)
    return { hi: Math.round(maxExt * 2 * 1000), lo: -Math.round(Math.max(0.35, minHoriz * 1.05) * 1000) };
  }
  // approximate horizontal position (u, 0..1) of a screen tap along a face, by projecting
  // onto the face's top edge in screen space — good enough to position an opening where tapped
  S.faceUAt = function faceUAt(sx: any, sy: any, b: any, faceId: any) {
    const g = S.faceGeom(b, faceId); if (!g || !g.quad) return 0.5;
    const TL = S.mProject(g.quad[0]), TR = S.mProject(g.quad[1]);
    const ax = TR.x - TL.x, ay = TR.y - TL.y, L2 = ax * ax + ay * ay || 1;
    const t = ((sx - TL.x) * ax + (sy - TL.y) * ay) / L2;
    return Math.max(0, Math.min(1, t));
  }
  // place a recessed door/window directly on a tapped 3D face of an extruded (solid) mass
  S.placeOpeningOnFace = function placeOpeningOnFace(bi: any, faceId: any, uCenter: any, kind: any) {
    const b = S.massing.masses[bi]; if (!b) return false;
    const g = S.faceGeom(b, faceId); if (!g || !g.quad) return false;
    const W = g.w || 1, H = g.h || 1;
    if (W <= 0.05 || H <= 0.05) { S.massHint('Face too small for an opening'); return false; }
    let w, h, sill;
    if (kind === 'door') { w = 0.9; h = 2.1; sill = 0; } else { w = 1.2; h = 1.5; sill = 0.9; }
    w = Math.min(w, W * 0.92); h = Math.min(h, H * 0.92);       // clamp to fit — never silently no-op
    if (sill + h > H) sill = Math.max(0, H - h);
    let uL = uCenter - (w / 2) / W, uR = uCenter + (w / 2) / W;
    if (uL < 0) { uR -= uL; uL = 0; } if (uR > 1) { uL -= (uR - 1); uR = 1; }
    uL = Math.max(0, uL); uR = Math.min(1, uR);
    const vBot = 1 - sill / H, vTop = 1 - (sill + h) / H;
    const uv = [{ u: uL, v: vTop }, { u: uR, v: vTop }, { u: uR, v: vBot }, { u: uL, v: vBot }];
    const mat = kind === 'window' ? { kind: 'color', hex: '#7d97a8', id: 'glass', glass: true } : { kind: 'color', hex: '#3a3330', id: 'door' };
    S.massSnapshot();
    b.faceRegions = b.faceRegions || {}; b.faceRegions[faceId] = b.faceRegions[faceId] || [];
    b.faceRegions[faceId].push({ uv, depth: -100, mat, opening: kind });
    S.renderMassing();
    return true;
  }
  S.regionAt = function regionAt(sx: any, sy: any) {
    let best = null, bd = -Infinity;
    S.massing.masses.forEach((b: any, bi: any) => {
      if (!b.faceRegions) return;
      Object.keys(b.faceRegions).forEach((faceId: any) => {
        const g = S.faceGeom(b, faceId); if (!g || !g.quad) return;
        let N: any = null;
        b.faceRegions[faceId].forEach((region: any, ri: any) => {
          if (!region.uv || region.uv.length < 3) return;
          let world = region.uv.map((p: any) => S._bilinear(g.quad, p.u, p.v));
          const dM = (region.depth || 0) / 1000;
          if (Math.abs(dM) > 1e-4) {                       // hit-test the cap where the user actually sees it
            if (!N) N = S.faceOutwardNormal(b, faceId);
            world = world.map((p: any) => ({ x: p.x + N.x * dM, y: p.y + N.y * dM, z: p.z + N.z * dM }));
          }
          const scr = world.map(S.mProject);
          if (S.pointInPoly(sx, sy, scr) || S._ptPolyNear(sx, sy, scr, 9)) {   // 9px touch tolerance for finger/Pencil
            let depth = 0; scr.forEach((p: any) => depth += p.depth); depth /= scr.length;
            if (depth > bd) { bd = depth; best = { bi, faceId, ri, region }; }
          }
        });
      });
    });
    return best;
  }
  S.drawFaceArt = function drawFaceArt(ctx: any, quad: any, img: any, clipPoly: any, project: any) {
    if (!img || !img.complete || !img.naturalWidth) return;
    project = project || S.mProject;
    const N = S.massing.cam.projection === 'persp' ? (S.massing.dragging ? 2 : 8) : 1;   // axon: exact affine; persp: piecewise, coarser while the view moves
    const [TL, TR, BR, BL] = quad, IW = img.width, IH = img.height;
    const lerp = (a: any, b: any, t: any) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    const at = (u: any, v: any) => lerp(lerp(TL, TR, u), lerp(BL, BR, u), v);
    ctx.save();
    if (clipPoly && clipPoly.length) {
      const cp = clipPoly.map(project);
      ctx.beginPath(); ctx.moveTo(cp[0].x, cp[0].y); for (let k = 1; k < cp.length; k++) ctx.lineTo(cp[k].x, cp[k].y); ctx.closePath(); ctx.clip();
    }
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const u0 = c / N, u1 = (c + 1) / N, v0 = r / N, v1 = (r + 1) / N;
        const sP0 = project(at(u0, v0)), sP1 = project(at(u1, v0)), sP2 = project(at(u1, v1)), sP3 = project(at(u0, v1));
        const sx = u0 * IW, sy = v0 * IH, cw = IW / N, ch = IH / N;
        const a = (sP1.x - sP0.x) / cw, b2 = (sP1.y - sP0.y) / cw, cc = (sP3.x - sP0.x) / ch, d = (sP3.y - sP0.y) / ch;
        ctx.save();
        ctx.beginPath(); ctx.moveTo(sP0.x, sP0.y); ctx.lineTo(sP1.x, sP1.y); ctx.lineTo(sP2.x, sP2.y); ctx.lineTo(sP3.x, sP3.y); ctx.closePath(); ctx.clip();
        ctx.setTransform(a, b2, cc, d, sP0.x, sP0.y);
        ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
        ctx.restore();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
  }

  // ---- transform gizmo (Select tool) ----
  // Handles live in the mass's local footprint frame, projected to screen.
  S.gizmoHandles = function gizmoHandles(b: any) {
    const poly = S.footPoly(b);
    let cx = 0, cz = 0; poly.forEach((p: any) => { cx += p.x; cz += p.z; }); cx /= poly.length; cz /= poly.length;
    const fsx = (b.fsx != null ? b.fsx : (b.fscale != null ? b.fscale : 1));
    const fsz = (b.fsz != null ? b.fsz : (b.fscale != null ? b.fscale : 1));
    const rot = b.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot);
    const y0 = b.baseY || 0, y1 = y0 + b.h;
    const xs = poly.map((p: any) => p.x), zs = poly.map((p: any) => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const midX = (minX + maxX) / 2, midZ = (minZ + maxZ) / 2;
    const w2w = (lx: any, lz: any, y: any) => { const dx = (lx - cx) * fsx, dz = (lz - cz) * fsz; return { x: cx + dx*cr - dz*sr, y, z: cz + dx*sr + dz*cr }; }
    const scr = (lx: any, lz: any, y: any) => { const s = S.mProject(w2w(lx, lz, y)); return { x: s.x, y: s.y }; }
    const handles = [];
    [[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]].forEach((c: any) => handles.push({ type:'scale', ...scr(c[0],c[1],y0) }));
    handles.push({ type:'stretch', axis:'x', ...scr(maxX,midZ,y0) });
    handles.push({ type:'stretch', axis:'x', ...scr(minX,midZ,y0) });
    handles.push({ type:'stretch', axis:'z', ...scr(midX,maxZ,y0) });
    handles.push({ type:'stretch', axis:'z', ...scr(midX,minZ,y0) });
    { const s = S.mProject({ x: cx, y: y1, z: cz }); handles.push({ type:'height', x:s.x, y:s.y }); }
    { handles.push({ type:'rotate', ...scr(maxX + (maxX-minX)*0.4 + 0.6, midZ, y0) }); }
    return { handles, cx, cz };
  }
  S.gizmoPick = function gizmoPick(sx: any, sy: any) {
    if (S.massing.selected < 0 || !S.massing.masses[S.massing.selected]) return null;
    const { handles } = S.gizmoHandles(S.massing.masses[S.massing.selected]);
    let best = null, bd = 20 * 20;
    for (const h of handles) { const dx = h.x - sx, dy = h.y - sy, d = dx*dx + dy*dy; if (d < bd) { bd = d; best = h; } }
    return best;
  }
  S.drawGizmo = function drawGizmo(b: any) {
    const { handles } = S.gizmoHandles(b);
    handles.forEach((h: any) => {
      S.mctx.beginPath();
      if (h.type === 'rotate') S.mctx.arc(h.x, h.y, 6.5, 0, Math.PI*2);
      else S.mctx.rect(h.x - 5.5, h.y - 5.5, 11, 11);
      S.mctx.fillStyle = (h.type === 'height') ? '#a02835' : (h.type === 'rotate' ? '#fff' : '#fff');
      S.mctx.fill();
      S.mctx.lineWidth = 2; S.mctx.strokeStyle = '#a02835'; S.mctx.stroke();
    });
  }

  // ---- interaction ----
  S.massPointerDown = function massPointerDown(e: any) {
    e.preventDefault();
    S.massingCanvas.setPointerCapture(e.pointerId);
    const r = S.massingCanvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const t = S.massing.tool;

    if (t === 'orbit') {
      S.massing.dragging = { type:'orbit', sx, sy, az0: S.massing.cam.az, el0: S.massing.cam.el };
      return;
    }
    if (t === 'pan') {
      S.massing.dragging = { type:'pan', sx, sy, px0: S.massing.panX || 0, py0: S.massing.panY || 0 };
      return;
    }
    if (t === 'add') {
      const g = S.mGroundPick(sx, sy);
      S.massing.dragging = { type:'foot', x0: S.mSnap(g.x), z0: S.mSnap(g.z), x1: S.mSnap(g.x), z1: S.mSnap(g.z) };
      S.massHint('Drag to size the footprint, release to extrude');
      return;
    }
    if (t === 'push') {
      const hit = S.regionAt(sx, sy);
      if (!hit) { S.massHint('Tap a face region to push or pull \u2014 draw one with Sketch \u2192 Region'); return; }
      const b = S.massing.masses[hit.bi];
      const fc = (() => { const g = S.faceGeom(b, hit.faceId); return S._bilinear(g.quad, 0.5, 0.5); })();
      const N = S.faceOutwardNormal(b, hit.faceId);
      const s0 = S.mProject(fc), s1 = S.mProject({ x: fc.x + N.x, y: fc.y + N.y, z: fc.z + N.z });
      const vx = s1.x - s0.x, vy = s1.y - s0.y, len = Math.hypot(vx, vy) || 1;
      S.massing.dragging = { type: 'pushpull', bi: hit.bi, faceId: hit.faceId, ri: hit.ri, sx0: sx, sy0: sy,
        depth0: hit.region.depth || 0, dirX: vx / len, dirY: vy / len, pxPerM: len, moved: false };
      S.massing.selected = hit.bi;
      S.massHint('Drag out to extrude, in to recess');
      return;
    }
    if (t === 'sketch') {
      const fp = S.massFaceAt(sx, sy);
      if (fp) S.openFaceEditor(fp.bi, fp.id);
      else S.massHint('Tap a face (wall, roof or floor) to sketch on it');
      return;
    }
    if (t === 'material') {
      if (!S.massing.activeMat) { S.massHint('Pick a material from the palette first'); return; }
      const rg = S.regionAt(sx, sy);
      if (rg) { S.applyMaterialToRegion(rg); return; }
      const fp = S.massFaceAt(sx, sy);
      if (fp) S.applyMaterialToFace(fp.bi, fp.id);
      else S.massHint('Pick a material, then tap a face or a region');
      return;
    }
    if (t === 'build') {
      const mode = S.massing.buildMode || 'wall';
      if (mode === 'wall') { S.addWallVertex(sx, sy); return; }
      const oh = S.openingAt(sx, sy);                       // tap an existing cut opening → edit it
      if (oh) { S.selectOpening(oh); S.massing.dragging = { type: 'openSlide', bi: oh.bi, idx: oh.idx, moved: false }; return; }
      const fp = S.massFaceAt(sx, sy);                      // extruded (solid) mass → recessed opening on the tapped face
      if (fp && S.massing.masses[fp.bi] && !S.massing.masses[fp.bi]._wall) {
        const u = S.faceUAt(sx, sy, S.massing.masses[fp.bi], fp.id);
        if (S.placeOpeningOnFace(fp.bi, fp.id, u, mode)) { S.massing.selected = fp.bi; S.massHint((mode === 'door' ? 'Door' : 'Window') + ' placed \u2014 recessed into the face'); }
        return;
      }
      const bi = S.massAt(sx, sy);
      if (bi < 0) { S.massHint('Tap a wall or mass to ' + (S.massing.cutMode ? 'cut' : 'place') + ' a ' + mode); return; }
      if (S.massing.cutMode) S.cutOpening(sx, sy, bi, mode); else S.placeOpening(bi, mode);
      return;
    }
    const hit = S.massAt(sx, sy);
    if (t === 'select') {
      // 1) a gizmo handle on the already-selected mass?
      const hp = (S.massing.selected >= 0) ? S.gizmoPick(sx, sy) : null;
      if (hp) {
        S.massSnapshot();
        const b = S.massing.masses[S.massing.selected];
        const bt = S.massBaseTop(b), cx = bt.cx, cz = bt.cz, rot = b.rot || 0;
        const fsx = (b.fsx != null ? b.fsx : (b.fscale != null ? b.fscale : 1));
        const fsz = (b.fsz != null ? b.fsz : (b.fscale != null ? b.fscale : 1));
        const gp = S.mGroundPick(sx, sy);
        if (hp.type === 'height') {
          S.massing.dragging = { type:'height', bi: S.massing.selected, sy0: sy, h0: b.h };
          S.massHint('Drag up / down to push-pull height');
        } else if (hp.type === 'rotate') {
          S.massing.dragging = { type:'grotate', bi: S.massing.selected, cx, cz, rot0: rot, ang0: Math.atan2(gp.z - cz, gp.x - cx) };
          S.massHint('Drag around to rotate');
        } else if (hp.type === 'scale') {
          S.massing.dragging = { type:'gscale', bi: S.massing.selected, cx, cz, fsx0: fsx, fsz0: fsz, r0: Math.max(0.05, Math.hypot(gp.x - cx, gp.z - cz)) };
          S.massHint('Drag to scale the footprint');
        } else if (hp.type === 'stretch') {
          const cr = Math.cos(rot), sr = Math.sin(rot);
          const proj = hp.axis === 'x' ? (gp.x - cx)*cr + (gp.z - cz)*sr : -(gp.x - cx)*sr + (gp.z - cz)*cr;
          S.massing.dragging = { type:'gstretch', bi: S.massing.selected, cx, cz, rot0: rot, axis: hp.axis, fsx0: fsx, fsz0: fsz, ext0: Math.max(0.05, Math.abs(proj)) };
          S.massHint('Drag to push / pull this side');
        }
        return;
      }
      // 2) otherwise select the tapped mass and move it on the ground
      S.massing.selOpening = null;
      S.massing.selected = hit;
      if (hit >= 0) {
        S.massSnapshot();
        const g = S.mGroundPick(sx, sy);
        const b = S.massing.masses[hit];
        S.massing.dragging = { type:'move', axis:'ground', bi:hit, sx, sy, sy0:sy, gx0:g.x, gz0:g.z, bx0:b.x, bz0:b.z, baseY0:b.baseY||0, poly0: b.poly ? b.poly.map((p: any) => ({ x:p.x, z:p.z })) : null };
        S.massHint('Drag to move · grab a handle to push-pull, scale or rotate');
      } else {
        S.massHint('Tap a mass to select it');
      }
      S.refreshInspector();
      S.renderMassing();
      return;
    }
    if (t === 'remove') {
      const oh = S.openingAt(sx, sy);
      if (oh) { S.massing.selOpening = oh; S.deleteSelOpening(); return; }
      if (hit >= 0) {
        S.massSnapshot();
        S.massing.masses.splice(hit, 1);
        if (S.massing.selected === hit) S.massing.selected = -1;
        else if (S.massing.selected > hit) S.massing.selected--;
        if (S.massing.masses.length === 0) S.massing.baseAnchor = null;   // fresh anchor next time
        S.massHint(S.massing.masses.length ? 'Removed · tap another to remove' : 'All masses removed');
      } else {
        S.massHint('Tap a mass to remove it');
      }
      S.refreshInspector();
      S.renderMassing();
      return;
    }
    if (t === 'move') {
      S.massing.selected = hit;
      if (hit >= 0) {
        S.massSnapshot();
        const g = S.mGroundPick(sx, sy);
        const b = S.massing.masses[hit];
        S.massing.dragging = { type:'move', bi:hit, sx, sy, sy0:sy, axis:null,
          gx0:g.x, gz0:g.z, bx0:b.x, bz0:b.z, baseY0: b.baseY || 0,
          poly0: b.poly ? b.poly.map((p: any) => ({ x:p.x, z:p.z })) : null };
        S.massHint('Drag sideways to move on ground · drag up/down to raise/lower');
      }
      S.refreshInspector();
      S.renderMassing();
      return;
    }
    if (t === 'height') {
      S.massing.selected = hit;
      if (hit >= 0) {
        S.massSnapshot();
        S.massing.dragging = { type:'height', bi:hit, sy0:sy, h0:S.massing.masses[hit].h };
        S.massHint('Drag up / down to push-pull height');
      }
      S.refreshInspector();
      S.renderMassing();
      return;
    }
  }

  S.massPointerMove = function massPointerMove(e: any) {
    if (!S.massing.dragging) return;
    const r = S.massingCanvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const d = S.massing.dragging;

    if (d.type === 'orbit') {
      S.massing.cam.az = d.az0 + (sx - d.sx) * 0.01;
      S.massing.cam.el = Math.max(0.12, Math.min(1.45, d.el0 + (sy - d.sy) * 0.008));
    } else if (d.type === 'pan') {
      S.massing.panX = d.px0 + (sx - d.sx);
      S.massing.panY = d.py0 + (sy - d.sy);
    } else if (d.type === 'foot') {
      const g = S.mGroundPick(sx, sy);
      d.x1 = S.mSnap(g.x); d.z1 = S.mSnap(g.z);
    } else if (d.type === 'move') {
      const b = S.massing.masses[d.bi];
      // Lock the axis from the initial drag direction: steep drag = vertical (elevation).
      if (!d.axis) {
        const adx = Math.abs(sx - d.sx), ady = Math.abs(sy - d.sy);
        if (adx + ady > 6) { d.axis = (ady > adx * 1.7) ? 'y' : 'ground'; S.massHint(d.axis === 'y' ? '↕ elevation' : 'move on ground'); }
      }
      if (d.axis === 'y') {
        const dy = S.mSnapH((d.sy0 - sy) / S.massing.cam.scale);   // screen-up = world-up
        b.baseY = Math.max(0, d.baseY0 + dy);
      } else if (d.axis === 'ground') {
        const g = S.mGroundPick(sx, sy);
        if (b.poly && d.poly0) {
          const dx = S.mSnap(g.x - d.gx0), dz = S.mSnap(g.z - d.gz0);
          b.poly = d.poly0.map((p: any) => ({ x: p.x + dx, z: p.z + dz }));
        } else {
          b.x = S.mSnap(d.bx0 + (g.x - d.gx0));
          b.z = S.mSnap(d.bz0 + (g.z - d.gz0));
        }
      }
    } else if (d.type === 'height') {
      const b = S.massing.masses[d.bi];
      b.h = Math.max(0.1, S.mSnapH(d.h0 + (d.sy0 - sy) / S.massing.cam.scale));   // fine 0.1 m
    } else if (d.type === 'grotate') {
      const gp = S.mGroundPick(sx, sy);
      const ang = Math.atan2(gp.z - d.cz, gp.x - d.cx);
      S.massing.masses[d.bi].rot = d.rot0 + (ang - d.ang0);
    } else if (d.type === 'gscale') {
      const gp = S.mGroundPick(sx, sy);
      const f = Math.max(0.1, Math.hypot(gp.x - d.cx, gp.z - d.cz) / d.r0);
      const b = S.massing.masses[d.bi];
      b.fsx = Math.max(0.1, d.fsx0 * f); b.fsz = Math.max(0.1, d.fsz0 * f); delete b.fscale;
    } else if (d.type === 'gstretch') {
      const gp = S.mGroundPick(sx, sy);
      const cr = Math.cos(d.rot0), sr = Math.sin(d.rot0);
      const proj = d.axis === 'x' ? (gp.x - d.cx)*cr + (gp.z - d.cz)*sr : -(gp.x - d.cx)*sr + (gp.z - d.cz)*cr;
      const f = Math.max(0.1, Math.abs(proj) / d.ext0);
      const b = S.massing.masses[d.bi];
      if (d.axis === 'x') b.fsx = Math.max(0.1, d.fsx0 * f); else b.fsz = Math.max(0.1, d.fsz0 * f);
      delete b.fscale;
    } else if (d.type === 'pushpull') {
      const b = S.massing.masses[d.bi];
      const regs = b && b.faceRegions && b.faceRegions[d.faceId];
      if (regs && regs[d.ri]) {
        if (!d.moved) { S.massSnapshot(); d.moved = true; }
        const deltaM = ((sx - d.sx0) * d.dirX + (sy - d.sy0) * d.dirY) / d.pxPerM;   // screen drag → metres along outward normal
        let mm = Math.round((d.depth0 + deltaM * 1000) / 10) * 10;                   // snap 10mm
        const lim = d.lim || (d.lim = S.massPushLimits(b));                            // clamp so a fast drag can't fling past the mass
        mm = Math.max(lim.lo, Math.min(lim.hi, mm));
        regs[d.ri].depth = mm;
        S.massHint((mm > 0 ? 'Pull +' : (mm < 0 ? 'Recess ' : 'Flat ')) + (mm !== 0 ? Math.abs(mm) + 'mm' : ''));
      }
    } else if (d.type === 'openSlide') {
      const b = S.massing.masses[d.bi];
      if (b && b.openings && b.openings[d.idx]) {
        if (!d.moved) { S.massSnapshot(); d.moved = true; }
        const op = b.openings[d.idx];
        const p = b.poly, dux = p[1].x - p[0].x, duz = p[1].z - p[0].z;
        const L2 = dux * dux + duz * duz, L = Math.sqrt(L2) || 1;
        const g = S.mGroundPick(sx, sy);
        const u = ((g.x - p[0].x) * dux + (g.z - p[0].z) * duz) / L2;
        const half = Math.min(0.49, (op.w / 2) / L);
        op.u = Math.max(half, Math.min(1 - half, u));
      }
    }
    S.renderMassing();
  }

  S.massPointerUp = function massPointerUp(e: any) {
    try { S.massingCanvas.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
    const d = S.massing.dragging;
    if (d && d.type === 'foot') {
      let { x0, z0, x1, z1 } = d;
      const x = Math.min(x0,x1), z = Math.min(z0,z1);
      const w = Math.abs(x1-x0) || S.massing.grid * 3;
      const dd = Math.abs(z1-z0) || S.massing.grid * 3;
      S.massSnapshot();
      S.massing.masses.push({ x, z, w, d: dd, h: S.massing.grid * 3 });
      S.massing.selected = S.massing.masses.length - 1;
      S.massHint('Use Height to push-pull · Orbit to spin the view');
    }
    if (d && d.type === 'openSlide' && d.moved) S.massHint('Opening moved · drag again to slide · resize with the fields');
    if (d && d.type === 'pushpull') {
      const b = S.massing.masses[d.bi]; const regs = b && b.faceRegions && b.faceRegions[d.faceId];
      const mm = regs && regs[d.ri] ? (regs[d.ri].depth || 0) : 0;
      if (d.moved) S.massHint(mm > 0 ? 'Pulled out ' + mm + 'mm' : (mm < 0 ? 'Recessed ' + (-mm) + 'mm' : 'Flattened'));
    }
    S.massing.dragging = null;
    S.refreshInspector();
    S.renderMassing();
  }

  S.massingCanvas.addEventListener('pointerdown', S.massPointerDown);
  S.massingCanvas.addEventListener('pointermove', S.massPointerMove);
  S.massingCanvas.addEventListener('pointerup', S.massPointerUp);
  S.massingCanvas.addEventListener('pointercancel', () => { S.massing.dragging = null; });

  // pinch-zoom the massing view
  S.massPinch = null;
  S.massPointers = new Map<any, any>();
  S.massingCanvas.addEventListener('pointerdown', (e: any) => S.massPointers.set(e.pointerId, e));
  S.massingCanvas.addEventListener('pointermove', (e: any) => {
    if (S.massPointers.has(e.pointerId)) S.massPointers.set(e.pointerId, e);
    if (S.massPointers.size === 2) {
      const [a,b] = [...S.massPointers.values()];
      const dist = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      if (S.massPinch) { S.massing.cam.scale = Math.max(6, Math.min(160, S.massPinch.s0 * dist/S.massPinch.d0)); S.renderMassing(); }
      else S.massPinch = { d0: dist, s0: S.massing.cam.scale };
    }
  });
  S.massingCanvas.addEventListener('pointerup', (e: any) => { S.massPointers.delete(e.pointerId); if (S.massPointers.size<2) S.massPinch=null; });
  S.massingCanvas.addEventListener('wheel', (e: any) => {
    e.preventDefault();
    S.massing.cam.scale = Math.max(6, Math.min(160, S.massing.cam.scale * (e.deltaY < 0 ? 1.08 : 0.93)));
    S.renderMassing();
  }, { passive:false });

  // ---- footprint extraction + extrude from a 2D selection ----
  S._perpDist = function _perpDist(p: any, a: any, b: any) {
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx*dx + dy*dy;
    if (!len2) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t*dx), p.y - (a.y + t*dy));
  }
  S.simplifyPoly = function simplifyPoly(pts: any, eps: any) {
    if (pts.length < 3) return pts.slice();
    let dmax = 0, idx = 0;
    const a = pts[0], b = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) { const d = S._perpDist(pts[i], a, b); if (d > dmax) { dmax = d; idx = i; } }
    if (dmax > eps) {
      const left = S.simplifyPoly(pts.slice(0, idx + 1), eps);
      const right = S.simplifyPoly(pts.slice(idx), eps);
      return left.slice(0, -1).concat(right);
    }
    return [a, b];
  }
  // Moore-neighbour boundary trace of a binary mask → ordered contour (doc px).
  S.traceMaskContour = function traceMaskContour(mask: any, bbox: any) {
    const W = S.doc.wPx, H = S.doc.hPx;
    const inside = (x: any, y: any) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
    let sx = -1, sy = -1;
    outer: for (let y = bbox.y; y < bbox.y + bbox.h; y++)
      for (let x = bbox.x; x < bbox.x + bbox.w; x++)
        if (mask[y * W + x]) { sx = x; sy = y; break outer; }
    if (sx < 0) return [];
    const dirs = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
    const contour = [];
    let cx = sx, cy = sy, bdir = 4;          // came from the left (background)
    const maxSteps = (bbox.w + bbox.h) * 8 + 4000;
    let steps = 0;
    do {
      contour.push({ x: cx, y: cy });
      let found = false;
      for (let k = 1; k <= 8; k++) {
        const dir = (bdir + k) % 8;
        const nx = cx + dirs[dir][0], ny = cy + dirs[dir][1];
        if (inside(nx, ny)) { bdir = (dir + 4 + 1) % 8; cx = nx; cy = ny; found = true; break; }
      }
      if (!found) break;
      steps++;
    } while ((cx !== sx || cy !== sy) && steps < maxSteps);
    return contour;
  }
  S.pxPerMetre = function pxPerMetre() {
    if (state.pxPerUnit && state.scaleUnit) {
      const unitInMm = { mm:1, cm:10, m:1000, in:25.4, ft:304.8 }[state.scaleUnit] || 1;
      return (state.pxPerUnit / unitInMm) * 1000;
    }
    return (S.doc.wPx / S.doc.wMM) * 1000;     // fall back to the sheet's physical size
  }
  // Turn the current selection into an extruded prism and open the 3D S.massing view.
  S.extrudeSelection = function extrudeSelection() {
    if (!state.selection) { S.showHint('Make a selection first (wand or lasso)'); return; }
    const { mask, bbox } = state.selection;
    const contour = S.traceMaskContour(mask, bbox);
    if (contour.length < 3) { S.showHint('Could not read a footprint outline'); return; }
    let simp = S.simplifyPoly(contour, 8);
    // Drop vertices that nearly coincide with their neighbour (contour artifacts), within ~3px.
    const TOL = 3;
    simp = simp.filter((p: any, k: any) => { const q = simp[(k + 1) % simp.length]; return !(Math.abs(p.x - q.x) < TOL && Math.abs(p.y - q.y) < TOL); });
    if (simp.length > 2 && Math.abs(simp[0].x - simp[simp.length-1].x) < TOL && Math.abs(simp[0].y - simp[simp.length-1].y) < TOL) simp = simp.slice(0, -1);
    if (simp.length < 3) { S.showHint('Footprint too small to extrude'); return; }
    const ppm = S.pxPerMetre();
    let cx = 0, cz = 0; simp.forEach((p: any) => { cx += p.x; cz += p.y; }); cx /= simp.length; cz /= simp.length;
    // One shared anchor per S.massing session: set it on the FIRST extrude (centre this
    // footprint), then reuse it so later masses land at their true relative positions.
    if (S.massing.masses.length === 0 || !S.massing.baseAnchor) {
      S.massing.baseAnchor = { px: cx, py: cz, ppm };
    }
    const A = S.massing.baseAnchor;
    const poly = simp.map((p: any) => ({ x: (p.x - A.px) / A.ppm, z: (p.y - A.py) / A.ppm }));
    const hadScale = !!(state.pxPerUnit && state.scaleUnit);
    S.clearSelection();
    S.enterMassing();                  // refreshes the base composite from current layers
    S.massing.showBase = true;
    S.updateMassBaseBtn();
    S.massSnapshot();
    S.massing.masses.push({ poly, h: 3 });            // default 3 m
    S.massing.selected = S.massing.masses.length - 1;
    S.refreshInspector();
    S.massing.tool = 'select';
    S.syncMassToolButtons();
    S.renderMassing();
    S.massHint(hadScale
      ? 'Extruded to 3 m · grab a handle to push-pull / scale / rotate · Exit when done'
      : 'Extruded (no drawing scale set — size approximate) · use the handles to edit · Exit');
  }

  /* =================================================================
     SHAPE → FILL / EXTRUDE  (rect · circle · closed polygon)
     Model A: act at the moment of commit. Footprints and interior
     masks are built from exact geometry, never traced from pixels.
     ================================================================= */

  // Build a binary interior mask (Uint8Array, 1 = inside) + bbox for a shape.
  S.shapeInteriorMask = function shapeInteriorMask(geom: any) {
    const W = S.doc.wPx, H = S.doc.hPx;
    const mask = new Uint8Array(W * H);
    if (geom.kind === 'rect') {
      const x0 = Math.max(0, Math.floor(Math.min(geom.x, geom.x + geom.w)));
      const y0 = Math.max(0, Math.floor(Math.min(geom.y, geom.y + geom.h)));
      const x1 = Math.min(W, Math.ceil(Math.max(geom.x, geom.x + geom.w)));
      const y1 = Math.min(H, Math.ceil(Math.max(geom.y, geom.y + geom.h)));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * W + x] = 1;
      return { mask, bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
    }
    if (geom.kind === 'circle') {
      const { cx, cy, r } = geom, r2 = r * r;
      const x0 = Math.max(0, Math.floor(cx - r)), y0 = Math.max(0, Math.floor(cy - r));
      const x1 = Math.min(W, Math.ceil(cx + r)), y1 = Math.min(H, Math.ceil(cy + r));
      for (let y = y0; y < y1; y++) { const dy = y - cy; for (let x = x0; x < x1; x++) { const dx = x - cx; if (dx * dx + dy * dy <= r2) mask[y * W + x] = 1; } }
      return { mask, bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
    }
    // polygon — scanline fill (even-odd)
    const pts = geom.pts;
    let minX = W, minY = H, maxX = 0, maxY = 0;
    pts.forEach((p: any) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
    const yLo = Math.max(0, Math.floor(minY)), yHi = Math.min(H - 1, Math.ceil(maxY));
    for (let y = yLo; y <= yHi; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          xs.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x));
        }
      }
      xs.sort((p: any, q: any) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k])), xb = Math.min(W - 1, Math.floor(xs[k + 1]));
        for (let x = xa; x <= xb; x++) mask[y * W + x] = 1;
      }
    }
    return { mask, bbox: { x: Math.max(0, Math.floor(minX)), y: yLo, w: Math.min(W, Math.ceil(maxX) + 1) - Math.max(0, Math.floor(minX)), h: yHi - yLo + 1 } };
  }

  // Exact footprint vertices (doc px) for extrusion. Circle → 48-gon.
  S.shapeFootprint = function shapeFootprint(geom: any) {
    if (geom.kind === 'rect') {
      return [{ x: geom.x, y: geom.y }, { x: geom.x + geom.w, y: geom.y }, { x: geom.x + geom.w, y: geom.y + geom.h }, { x: geom.x, y: geom.y + geom.h }];
    }
    if (geom.kind === 'circle') {
      const N = 48, out = [];
      for (let i = 0; i < N; i++) { const t = i / N * Math.PI * 2; out.push({ x: geom.cx + geom.r * Math.cos(t), y: geom.cy + geom.r * Math.sin(t) }); }
      return out;
    }
    return geom.pts.map((p: any) => ({ x: p.x, y: p.y }));
  }

  // Fill a shape's interior with the current fill source (colour or texture).
  S.fillShape = function fillShape(geom: any) {
    const { mask, bbox } = S.shapeInteriorMask(geom);
    if (!bbox || bbox.w <= 0 || bbox.h <= 0) { S.showHint('Nothing to fill'); return; }
    const l = S.activeLayer();
    S.applyFill(l, mask);
    S.saveSnapshot(l);
    // Remember the material used, so a following Extrude can carry it onto the mass.
    if (state.fillStyle === 'image' && S.currentFillTexture()) {
      state._lastShapeFill = { type: 'image', img: S.currentFillTexture(), scale: state.fillTexScale };
    } else {
      const c = S.hexToRgba(state.color);
      state._lastShapeFill = { type: 'color', rgb: [c[0], c[1], c[2]] };
    }
    S.renderLayers();
    S.showHint(state.fillStyle === 'image' && S.currentFillTexture() ? 'Filled with texture' : 'Filled');
  }

  // Extrude exact footprint vertices into a real 3D mass; preserves plan
  // position via the shared baseAnchor and opens the S.massing/Axon view.
  S.extrudePolygon = function extrudePolygon(ptsPx: any, fill: any) {
    if (!ptsPx || ptsPx.length < 3) { S.showHint('Need a closed shape to extrude'); return; }
    const ppm = S.pxPerMetre();
    let cx = 0, cz = 0; ptsPx.forEach((p: any) => { cx += p.x; cz += p.y; }); cx /= ptsPx.length; cz /= ptsPx.length;
    if (S.massing.masses.length === 0 || !S.massing.baseAnchor) {
      S.massing.baseAnchor = { px: cx, py: cz, ppm };
    }
    const A = S.massing.baseAnchor;
    const poly = ptsPx.map((p: any) => ({ x: (p.x - A.px) / A.ppm, z: (p.y - A.py) / A.ppm }));
    const hadScale = !!(state.pxPerUnit && state.scaleUnit);
    S.enterMassing();
    S.massing.showBase = true;
    S.updateMassBaseBtn();
    S.massSnapshot();
    S.massing.masses.push({ poly, h: 3 });
    S.massing.selected = S.massing.masses.length - 1;
    if (fill) S.applyMaterialToMass(S.massing.masses[S.massing.selected], fill);
    S.refreshInspector();
    S.massing.tool = 'select';
    S.syncMassToolButtons();
    S.renderMassing();
    S.massHint(hadScale
      ? 'Extruded to 3 m · grab a handle to push-pull / scale / rotate · Exit when done'
      : 'Extruded (no drawing scale set — size approximate) · use the handles to edit · Exit');
  }

  S.extrudeShape = function extrudeShape(geom: any) { S.extrudePolygon(S.shapeFootprint(geom), state._lastShapeFill); }

  // Render a tiling material into a face-sized canvas at real-world scale → dataURL.
  S.makeMaterialFaceCanvas = function makeMaterialFaceCanvas(wM: any, hM: any, texImg: any, tileM: any) {
    const MAXDIM = 1024, FA_PPM = 48;
    const maxM = Math.max(wM, hM, 0.1);
    const ppm = Math.min(FA_PPM, MAXDIM / maxM);
    const cw = Math.max(2, Math.round(wM * ppm)), ch = Math.max(2, Math.round(hM * ppm));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const cx = c.getContext('2d') as any;
    const iw = texImg.naturalWidth || texImg.width || 1, ih = texImg.naturalHeight || texImg.height || 1;
    const tw = Math.max(2, Math.round(Math.max(0.05, tileM) * ppm));
    const th = Math.max(2, Math.round(tw * (ih / iw)));
    const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
(    tc.getContext('2d') as any).drawImage(texImg, 0, 0, tw, th);
    const pat = cx.createPattern(tc, 'repeat');
    cx.fillStyle = pat;
    cx.fillRect(0, 0, cw, ch);
    return c.toDataURL('image/png');
  }

  // Carry a captured 2D fill onto a freshly extruded mass as its material.
  // colour → whole-volume base tint; texture → tiled onto every face (skip the unseen bottom).
  S.applyMaterialToMass = function applyMaterialToMass(mass: any, fill: any) {
    if (!fill || !mass) return;
    if (fill.type === 'color') { mass.color = fill.rgb.slice(0, 3); return; }
    if (fill.type === 'image' && fill.img && fill.img.complete) {
      const tileM = ((fill.img.naturalWidth || fill.img.width) * (fill.scale || 1)) / S.pxPerMetre();
      mass.faceArt = mass.faceArt || {};
      const gTop = S.faceGeom(mass, 'top');
      if (gTop) mass.faceArt['top'] = S.makeMaterialFaceCanvas(gTop.w, gTop.h, fill.img, tileM);
      const n = mass.poly.length;
      for (let i = 0; i < n; i++) {
        const gs = S.faceGeom(mass, 'side' + i);
        if (gs) mass.faceArt['side' + i] = S.makeMaterialFaceCanvas(gs.w, gs.h, fill.img, tileM);
      }
      mass._faceImg = {};
      S.ensureFaceImg(mass);
    }
  }

  /* ===== per-face MATERIALS in S.massing (referenced; re-tile on resize) ===== */
  S.MAT_COLORS = [
    ['Concrete', '#9a978f'], ['Off-white', '#e8e6e1'], ['Charcoal', '#3a3a3e'],
    ['Brick', '#9c4a36'], ['Timber', '#b07a45'], ['Glass', '#7d97a8']
  ];
  // named, touch-friendly material presets (shown as their own row in the palette)
  S.MAT_PRESETS = [
    ['Concrete', { kind: 'color', hex: '#9a978f', id: 'mat-concrete' }],
    ['Wood',     { kind: 'color', hex: '#a9743f', id: 'mat-wood' }],
    ['Glass',    { kind: 'color', hex: '#7d97a8', id: 'mat-glass', glass: true }],
    ['Water',    { kind: 'color', hex: '#3f7d96', id: 'mat-water', alpha: 0.62 }],
    ['Grass',    { kind: 'color', hex: '#6f8a4e', id: 'mat-grass' }]
  ];
  S._matSrcCache = {};
  S.matSrcImage = function matSrcImage(src: any) {
    if (!src) return null;
    if (S._matSrcCache[src]) return S._matSrcCache[src];
    const img = new Image();
    img.onload = () => { if (S.massing.active) S.renderMassing(); };
    img.src = src;
    S._matSrcCache[src] = img;
    return img;
  }
  S.cloneMat = function cloneMat(m: any) { return m ? { ...m } : null; }

  // Cached tiled material canvas for a face. Rebuilt only when the face's real
  // size (or the material) changes, so the tile holds real-world scale on resize.
  // During an active transform we reuse the last canvas (no per-frame rebuilds).
  S.matFaceImg = function matFaceImg(mass: any, faceId: any, mat: any) {
    const g = S.faceGeom(mass, faceId);
    if (!g) return null;
    mass._matImg = mass._matImg || {};
    mass._matSig = mass._matSig || {};
    const cached = mass._matImg[faceId] || null;
    if (S.massing.dragging && cached) return cached;     // mid-drag: stretch the old one
    const sig = `${(g.w || 0).toFixed(2)}x${(g.h || 0).toFixed(2)}x${mat.id}x${mat.scale || 1}`;
    if (cached && mass._matSig[faceId] === sig) return cached;
    const srcImg = S.matSrcImage(mat.src);
    if (!srcImg || !srcImg.complete || !srcImg.naturalWidth) return cached;   // re-render on decode
    const tileM = (srcImg.naturalWidth * (mat.scale || 1)) / S.pxPerMetre();
    const img = new Image();
    img.onload = () => { if (S.massing.active) S.renderMassing(); };
    img.src = S.makeMaterialFaceCanvas(g.w, g.h, srcImg, tileM);
    mass._matImg[faceId] = img;
    mass._matSig[faceId] = sig;
    return cached;   // keep showing the old tile until the new one decodes
  }

  // Apply the active material to one face, or (scope='mass') every face but the base.
  S.applyMaterialToFace = function applyMaterialToFace(bi: any, id: any) {
    const mat = S.massing.activeMat;
    if (!mat) { S.massHint('Pick a material from the palette first'); return; }
    const b = S.massing.masses[bi];
    if (!b) return;
    S.massSnapshot();
    b.faceMat = b.faceMat || {};
    if ((S.massing.matScope || 'face') === 'mass') {
      b.faceMat['top'] = S.cloneMat(mat);
      for (let i = 0; i < b.poly.length; i++) b.faceMat['side' + i] = S.cloneMat(mat);
    } else {
      b.faceMat[id] = S.cloneMat(mat);
    }
    b._matImg = {}; b._matSig = {};
    S.renderMassing();
    S.massHint((S.massing.matScope === 'mass' ? 'Material on the whole mass' : 'Material on ' + S.faceLabel(id)) + ' · scale holds on resize');
  }

  // ---- material palette (visible while the Material tool is active) ----
  S._matPaletteEl = null;
  S.ensureMatPalette = function ensureMatPalette() {
    if (S._matPaletteEl) return S._matPaletteEl;
    const style = document.createElement('style');
    style.textContent =
      '#mat-palette{position:fixed;z-index:1250;display:none;flex-direction:column;gap:8px;left:50%;transform:translateX(-50%);bottom:120px;' +
      'background:#1c1a18;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,0.45);max-width:92vw;}' +
      '#mat-palette .row{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:center;}' +
      '#mat-palette .sw{width:30px;height:30px;border-radius:8px;border:2px solid transparent;cursor:pointer;background-size:cover;background-position:center;}' +
      '#mat-palette .sw.active{border-color:#a02835;}' +
      '#mat-palette .lab{font:600 10px ui-sans-serif,system-ui;color:rgba(255,255,255,0.45);letter-spacing:.04em;text-transform:uppercase;}' +
      '#mat-palette .scope{display:flex;border:1px solid rgba(255,255,255,0.14);border-radius:8px;overflow:hidden;}' +
      '#mat-palette .scope button{font:600 11px ui-sans-serif,system-ui;color:rgba(255,255,255,0.6);background:transparent;border:none;padding:6px 12px;cursor:pointer;}' +
      '#mat-palette .scope button.on{background:#a02835;color:#fff;}';
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.id = 'mat-palette';
    el.addEventListener('pointerdown', (ev: any) => ev.stopPropagation());
    document.body.appendChild(el);
    S._matPaletteEl = el;
    return el;
  }
  S.markActiveSwatch = function markActiveSwatch(b: any) {
    if (S._matPaletteEl) S._matPaletteEl.querySelectorAll('.sw').forEach((s: any) => s.classList.remove('active'));
    if (b) b.classList.add('active');
  }
  S.buildMatPalette = function buildMatPalette() {
    const el = S.ensureMatPalette();
    S.massing.matScope = S.massing.matScope || 'face';
    el.innerHTML = '';
    // named material presets — the quick, touch-friendly row
    const pr = document.createElement('div'); pr.className = 'row';
    const pl = document.createElement('span'); pl.className = 'lab'; pl.textContent = 'Materials'; pr.appendChild(pl);
    S.MAT_PRESETS.forEach(([name, mat]: any) => {
      const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';
      const b = document.createElement('div'); b.className = 'sw'; b.title = name;
      b.style.background = mat.glass ? 'linear-gradient(135deg,rgba(150,182,206,0.6),rgba(150,182,206,0.18))'
        : (mat.alpha != null ? (() => { const c = S.hexToRgba(mat.hex); return `rgba(${c[0]},${c[1]},${c[2]},${mat.alpha})`; })() : mat.hex);
      b.addEventListener('click', () => { S.massing.activeMat = { ...mat }; S.markActiveSwatch(b); });
      const cap = document.createElement('span'); cap.style.cssText = 'font:600 8px ui-sans-serif,system-ui;color:rgba(255,255,255,0.5);'; cap.textContent = name;
      wrap.appendChild(b); wrap.appendChild(cap); pr.appendChild(wrap);
    });
    el.appendChild(pr);
    const cr = document.createElement('div'); cr.className = 'row';
    const cl = document.createElement('span'); cl.className = 'lab'; cl.textContent = 'Colour'; cr.appendChild(cl);
    S.MAT_COLORS.forEach(([name, hex]: any) => {
      const b = document.createElement('div'); b.className = 'sw'; b.title = name; b.style.background = hex;
      b.addEventListener('click', () => { S.massing.activeMat = { kind: 'color', hex, id: 'c' + hex }; S.markActiveSwatch(b); });
      cr.appendChild(b);
    });
    el.appendChild(cr);
    const tr = document.createElement('div'); tr.className = 'row';
    const tl = document.createElement('span'); tl.className = 'lab'; tl.textContent = 'Texture'; tr.appendChild(tl);
    const texes = state.fillTextures || [];
    if (!texes.length) {
      const hint = document.createElement('span'); hint.className = 'lab'; hint.style.textTransform = 'none'; hint.style.color = 'rgba(255,255,255,0.35)';
      hint.textContent = '— import in the 2D Fill panel'; tr.appendChild(hint);
    }
    texes.forEach((t: any, i: any) => {
      const b = document.createElement('div'); b.className = 'sw'; b.title = t.name || ('texture ' + (i + 1));
      b.style.backgroundImage = `url(${t.dataUrl})`;
      b.addEventListener('click', () => { S.massing.activeMat = { kind: 'texture', src: t.dataUrl, scale: state.fillTexScale || 1, id: 't' + i }; S.markActiveSwatch(b); });
      tr.appendChild(b);
    });
    el.appendChild(tr);
    const sr = document.createElement('div'); sr.className = 'row';
    const sl = document.createElement('span'); sl.className = 'lab'; sl.textContent = 'Apply to'; sr.appendChild(sl);
    const sc = document.createElement('div'); sc.className = 'scope';
    [['face', 'Face'], ['mass', 'Whole mass']].forEach(([scope, label]) => {
      const b = document.createElement('button'); b.textContent = label;
      b.classList.toggle('on', (S.massing.matScope || 'face') === scope);
      b.addEventListener('click', () => { S.massing.matScope = scope; sc.querySelectorAll('button').forEach((x: any) => x.classList.remove('on')); b.classList.add('on'); });
      sc.appendChild(b);
    });
    sr.appendChild(sc); el.appendChild(sr);
  }
  S.applyMaterialToRegion = function applyMaterialToRegion(rg: any) {
    const mat = S.massing.activeMat; if (!mat) return;
    const b = S.massing.masses[rg.bi]; if (!b) return;
    const regs = b.faceRegions && b.faceRegions[rg.faceId];
    if (!regs || !regs[rg.ri]) return;
    S.massSnapshot();
    regs[rg.ri].mat = S.cloneMat(mat);
    S.renderMassing();
    S.massHint(S.isGlassMat(mat) ? 'Glass / translucent on region' : 'Material on region');
  }
  S.isGlassMat = function isGlassMat(m: any) { return !!m && m.kind === 'color' && (m.hex === '#7d97a8' || m.glass); }
  // fill style for translucent materials (glass, water); null if the material is opaque
  S.matFill = function matFill(m: any) {
    if (!m || m.kind !== 'color') return null;
    if (m.glass || m.hex === '#7d97a8') return 'rgba(150,182,206,0.42)';
    if (m.alpha != null) { const c = S.hexToRgba(m.hex); return `rgba(${c[0]},${c[1]},${c[2]},${m.alpha})`; }
    return null;
  }
  S._regionPatCache = {};
  S.regionPattern = function regionPattern(mat: any) {
    if (!mat || mat.kind !== 'texture' || !mat.src) return null;
    if (S._regionPatCache[mat.src] !== undefined) return S._regionPatCache[mat.src];
    const img = S.matSrcImage(mat.src);
    if (!img || !img.complete || !img.naturalWidth) return null;   // re-render on decode
    const pat = S.mctx.createPattern(img, 'repeat');
    S._regionPatCache[mat.src] = pat;
    return pat;
  }
  S.updateMatPalette = function updateMatPalette() {
    const show = S.massing.active && S.massing.tool === 'material';
    if (show) { S.buildMatPalette(); S._matPaletteEl.style.display = 'flex'; }
    else if (S._matPaletteEl) S._matPaletteEl.style.display = 'none';
  }


  initWalls();

  // ---- the floating Fill · Extrude chip ----
  S._shapeChipEl = null;
  S.ensureShapeChip = function ensureShapeChip() {
    if (S._shapeChipEl) return S._shapeChipEl;
    const style = document.createElement('style');
    style.textContent =
      '#shape-chip{position:fixed;z-index:9999;display:none;gap:6px;padding:5px;background:rgba(20,20,22,0.94);' +
      'border:1px solid rgba(255,255,255,0.12);border-radius:11px;box-shadow:0 8px 24px rgba(0,0,0,0.4);backdrop-filter:blur(6px);}' +
      '#shape-chip button{font:600 12px/1 ui-sans-serif,system-ui,sans-serif;color:#fff;border:none;border-radius:7px;' +
      'padding:9px 15px;cursor:pointer;letter-spacing:.02em;}' +
      '#shape-chip button[data-act="fill"]{background:#2c2c33;}' +
      '#shape-chip button[data-act="extrude"]{background:#a02835;}' +
      '#shape-chip button:active{transform:scale(0.96);}';
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.id = 'shape-chip';
    el.innerHTML = '<button data-act="fill">Fill</button><button data-act="extrude">Extrude</button>';
    document.body.appendChild(el);
    el.addEventListener('pointerdown', (ev: any) => ev.stopPropagation());
    el.addEventListener('click', (ev: any) => {
      const act = ev.target && ev.target.dataset && ev.target.dataset.act;
      if (!act) return;
      const geom = state._lastShape;
      if (!geom) { S.hideShapeChip(); return; }
      if (act === 'fill') { S.fillShape(geom); }           // keep chip so Extrude is still offered
      else if (act === 'extrude') { S.hideShapeChip(); S.extrudeShape(geom); }
    });
    S._shapeChipEl = el;
    return el;
  }
  S.showShapeChip = function showShapeChip(geom: any, screenPt: any) {
    const el = S.ensureShapeChip();
    state._lastShape = geom;
    el.style.display = 'flex';
    const r = el.getBoundingClientRect();
    const px = screenPt ? screenPt.x : window.innerWidth / 2;
    const py = screenPt ? screenPt.y : window.innerHeight / 2;
    let left = px - r.width / 2, top = py - r.height - 18;
    left = Math.max(8, Math.min(window.innerWidth - r.width - 8, left));
    top = Math.max(8, Math.min(window.innerHeight - r.height - 8, top));
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }
  S.hideShapeChip = function hideShapeChip() { if (S._shapeChipEl) S._shapeChipEl.style.display = 'none'; }

  // Called from shape-commit paths (rect/circle on pointerup, polygon on close).
  S.onShapeCommitted = function onShapeCommitted(geom: any, screenPt: any) {
    if (!geom) return;
    state._lastShapeFill = null;
    S.showShapeChip(geom, screenPt);
  }

  // ---- enter / exit ----
  // ---- S.massing undo / redo (snapshots the masses, independent of the 2D pixel history) ----
  S.massState = function massState() {
    // Drop only non-serializable cached images (not semantic flags like _wall / _opening / _host).
    const skipCache = (k: any, v: any) => {
      if (typeof v === 'function') return undefined;
      if (typeof HTMLImageElement !== 'undefined' && v instanceof HTMLImageElement) return undefined;
      if (typeof HTMLCanvasElement !== 'undefined' && v instanceof HTMLCanvasElement) return undefined;
      if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return undefined;
      return v;
    };
    return {
      masses: JSON.parse(JSON.stringify(S.massing.masses, skipCache)),
      selected: S.massing.selected,
      anchor: S.massing.baseAnchor ? { ...S.massing.baseAnchor } : null,
    };
  }
  S.massApply = function massApply(s: any) {
    S.massing.masses = JSON.parse(JSON.stringify(s.masses));
    S.massing.selected = s.selected;
    S.massing.baseAnchor = s.anchor ? { ...s.anchor } : null;
  }
  S.massSnapshot = function massSnapshot() {
    S.massing.undoStack.push(S.massState());
    if (S.massing.undoStack.length > 60) S.massing.undoStack.shift();
    S.massing.redoStack = [];
    if (typeof S.scheduleMassAutosave === 'function') S.scheduleMassAutosave();   // 3D edits persist quickly
  }
  S.massUndo = function massUndo() {
    if (!S.massing.undoStack.length) { S.massHint('Nothing to undo'); return; }
    S.massing.redoStack.push(S.massState());
    S.massApply(S.massing.undoStack.pop());
    S.renderMassing();
    S.refreshInspector();
    S.massHint('Undo');
  }
  S.massRedo = function massRedo() {
    if (!S.massing.redoStack.length) { S.massHint('Nothing to redo'); return; }
    S.massing.undoStack.push(S.massState());
    S.massApply(S.massing.redoStack.pop());
    S.renderMassing();
    S.refreshInspector();
    S.massHint('Redo');
  }
  // ---- numeric inspector for the selected mass ----
  S.massInspector = $el('mass-inspector');
  S._inspBefore = null;
  S.refreshInspector = function refreshInspector() {
    const b = (S.massing.selected >= 0) ? S.massing.masses[S.massing.selected] : null;
    const show = b && S.massing.active && ((window as any).StudioHelpers
      ? (window as any).StudioHelpers.shouldShowMassInspector(S.massing)
      : ['select', 'move', 'height', 'push', 'material'].includes(S.massing.tool));
    if (!show) { S.massInspector.style.display = 'none'; return; }
    S.massInspector.style.display = 'flex';
    $el('insp-h').value = (+b.h).toFixed(1);
    $el('insp-base').value = (+(b.baseY || 0)).toFixed(1);
    $el('insp-rot').value = Math.round((b.rot || 0) * 180 / Math.PI);
    $el('insp-fscale').value = Math.round((b.fsx != null ? b.fsx : (b.fscale != null ? b.fscale : 1)) * 100);
    $el('insp-taper').value = Math.round((b.taper != null ? b.taper : 1) * 100);
  }
  S._inspApply = function _inspApply() {
    const b = (S.massing.selected >= 0) ? S.massing.masses[S.massing.selected] : null;
    if (!b) return;
    const h = parseFloat($el('insp-h').value);
    const base = parseFloat($el('insp-base').value);
    const rot = parseFloat($el('insp-rot').value);
    const fs = parseFloat($el('insp-fscale').value);
    const tp = parseFloat($el('insp-taper').value);
    if (!isNaN(h)) b.h = Math.max(0.1, h);
    if (!isNaN(base)) b.baseY = Math.max(0, base);
    if (!isNaN(rot)) b.rot = rot * Math.PI / 180;
    if (!isNaN(fs)) { b.fsx = Math.max(0.1, fs / 100); b.fsz = Math.max(0.1, fs / 100); delete b.fscale; }
    if (!isNaN(tp)) b.taper = Math.max(0.05, tp / 100);
    S.renderMassing();
  };
  ['insp-h','insp-base','insp-rot','insp-fscale','insp-taper'].forEach((id: any) => {
    const el = $el(id);
    el.addEventListener('focus', () => { S._inspBefore = S.massState(); });
    el.addEventListener('input', S._inspApply);
    el.addEventListener('change', () => {
      if (S._inspBefore) { S.massing.undoStack.push(S._inspBefore); if (S.massing.undoStack.length > 60) S.massing.undoStack.shift(); S.massing.redoStack = []; S._inspBefore = null; }
    });
  });

  S.duplicateMass = function duplicateMass() {
    if (S.massing.selected < 0 || !S.massing.masses[S.massing.selected]) { S.massHint('Select a mass first (Move-tap), then Duplicate'); return; }
    S.massSnapshot();
    const copy = JSON.parse(JSON.stringify(S.massing.masses[S.massing.selected]));
    const off = 2;   // 2 m offset so the copy is visible
    if (copy.poly) copy.poly = copy.poly.map((p: any) => ({ x: p.x + off, z: p.z + off }));
    else { copy.x += off; copy.z += off; }
    S.massing.masses.push(copy);
    S.massing.selected = S.massing.masses.length - 1;
    S.renderMassing();
    S.refreshInspector();
    S.massHint('Duplicated · Move to reposition');
  }
  S.deleteSelectedMass = function deleteSelectedMass() {
    if (S.massing.selected < 0 || !S.massing.masses[S.massing.selected]) { S.massHint('Select a mass first (Move-tap), then Delete'); return; }
    S.massSnapshot();
    S.massing.masses.splice(S.massing.selected, 1);
    S.massing.selected = -1;
    if (S.massing.masses.length === 0) S.massing.baseAnchor = null;
    S.renderMassing();
    S.refreshInspector();
    S.massHint('Deleted');
  }

  S.showModeLoading = function showModeLoading(show: any) {
    const el = $el('studio-mode-loading');
    if (el) {
      if (show) {
        el.hidden = false;
        el.setAttribute('aria-hidden', 'false');
      } else {
        el.hidden = true;
        el.setAttribute('aria-hidden', 'true');
      }
    }
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'sketchtrude-mode-loading',
        loading: !!show,
        projectId: (window as any).__SKETCHTRUDE_PROJECT_ID,
      }, '*');
    }
  }

  S.enterMassing = function enterMassing() {
    S.showModeLoading(true);
    requestAnimationFrame(() => {
      try {
        S.dismissSketchOverlays();
        S.releaseTransientInput();
        state.tool = 'massing';
        S.massing.active = true;
        if (!S.massing.baseAnchor) S.massing.baseAnchor = { px: S.doc.wPx / 2, py: S.doc.hPx / 2, ppm: S.pxPerMetre() };
        S.syncWallsToMasses();             // bring 2D walls into the 3D model
        S.buildMassingBase();              // always reflect the current 2D drawing
        S.massingCanvas.style.display = 'block';
        S.massingBar.style.display = 'flex';
        S.updateMassBaseBtn();
        if (S.massing.cam.scale === 1) {
          // first run: sensible default zoom relative to viewport
          const r = S.area.getBoundingClientRect();
          S.massing.cam.scale = Math.min(r.width, r.height) / 26;
        }
        S.massHint('Add: drag a footprint on the ground, then use Height');
        S.renderMassing();
        S.updateZoomDisplay();
        S.highlightRailGroups();
        S.syncMassToolButtons();
      } finally {
        requestAnimationFrame(() => S.showModeLoading(false));
      }
    });
  }
  S.exitMassing = function exitMassing() {
    S.showModeLoading(true);
    requestAnimationFrame(() => {
      try {
        S.massing.active = false;
        S.massing.dragging = null;
        S.massing.selected = -1;
        if ((window as any)._closeMassMenus) (window as any)._closeMassMenus();
        if (typeof S.updateMatPalette === 'function') S.updateMatPalette();
        if (typeof S.updateBuildPalette === 'function') S.updateBuildPalette();
        $el('mass-inspector').style.display = 'none';
        S.massingCanvas.style.display = 'none';
        S.massingBar.style.display = 'none';
        S.massHint('');
        S.initGrainTips();
        S.regroupRail();
        S.setTool('pen');
        S.fitToScreen();
      } finally {
        requestAnimationFrame(() => S.showModeLoading(false));
      }
    });
  }

  // ---- flatten current masses onto a new 2D layer, ALIGNED to the plan ----
  // Top-down commit: each footprint is drawn at its exact original document location
  // (no orbit lean), with a height tag — i.e. a true plan outline locked to your drawing.
  S.drawMassingAligned = function drawMassingAligned(ctx: any) {
    const A = S.massing.baseAnchor || { px: S.doc.wPx / 2, py: S.doc.hPx / 2, ppm: S.pxPerMetre() };
    S.massing.masses.forEach((b: any) => {
      const foot = S.massBaseTop(b).base;
      const pts = foot.map((p: any) => ({ x: A.px + p.x * A.ppm, y: A.py + p.z * A.ppm }));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(160,40,53,0.10)';
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(34,30,28,0.92)';
      ctx.lineWidth = 3;
      ctx.stroke();
      // roof sketch, mapped onto the footprint (clipped to the plan outline)
      if (b.faceArt && b.faceArt.top) {
        S.ensureFaceImg(b);
        const g = S.faceGeom(b, 'top', 'base');
        const dp = (p: any) => ({ x: A.px + p.x * A.ppm, y: A.py + p.z * A.ppm });
        S.drawFaceArt(ctx, g.quad, b._faceImg.top, g.clip, dp);
      }
      let cx = 0, cy = 0; pts.forEach((p: any) => { cx += p.x; cy += p.y; }); cx /= pts.length; cy /= pts.length;
      ctx.fillStyle = 'rgba(34,30,28,0.85)';
      ctx.font = '600 30px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${b.h.toFixed(1)} m`, cx, cy);
    });
  }

  S.flattenMassingToLayer = function flattenMassingToLayer() {
    if (!S.massing.masses.length) { S.showHint('Add some masses first'); return; }
    const tmp = document.createElement('canvas');
    tmp.width = S.doc.wPx; tmp.height = S.doc.hPx;
    S.drawMassingAligned(tmp.getContext('2d') as any);
    S.createLayer('Massing plan');
    const layer = state.layers[state.layers.length - 1];
    state.activeLayer = state.layers.length - 1;
    layer.ctx.drawImage(tmp, 0, 0);
    S.saveSnapshot(layer);
    S.updateLayerOrder(); S.renderLayers(); S.updateUI();
    S.massHint('Plan added on a new layer · Exit when done');
  }

  // Export the current angled 3D view (plan-on-ground + masses) onto a new 2D layer.
  S.exportAngledView = function exportAngledView() {
    if (!S.massing.masses.length) { S.showHint('Add some masses first'); return; }
    S.massing._export = true; S.renderMassing();          // transparent, no grid
    const src = S.massingCanvas;
    const tmp = document.createElement('canvas');
    tmp.width = S.doc.wPx; tmp.height = S.doc.hPx;
    const scale = Math.min(S.doc.wPx / src.width, S.doc.hPx / src.height) * 0.94;
    const dw = src.width * scale, dh = src.height * scale;
(    tmp.getContext('2d') as any).drawImage(src, (S.doc.wPx - dw) / 2, (S.doc.hPx - dh) / 2, dw, dh);
    S.massing._export = false; S.renderMassing();
    S.createLayer('3D view');
    const layer = state.layers[state.layers.length - 1];
    state.activeLayer = state.layers.length - 1;
    layer.ctx.drawImage(tmp, 0, 0);
    S.saveSnapshot(layer);
    S.updateLayerOrder(); S.renderLayers(); S.updateUI();
    S.massHint('3D view added on a new layer · Exit when done');
  }

  // Render all masses head-on (el=0) for a given azimuth into a target, world y=0 at groundY.
  S.drawElevationInto = function drawElevationInto(ctx: any, az: any, scale: any, ox: any, groundY: any) {
    const proj = (p: any) => { const q = S.mRotY(p, az); return { x: ox + q.x * scale, y: groundY - q.y * scale, depth: q.z }; }
    const faces: any[] = [];
    S.massing.masses.forEach((b: any) => {
      const vs = S.massVerts(b).map(proj);
      S.massFaces(b).forEach((f: any) => {
        let d = 0; for (const i of f.idx) d += vs[i].depth; d /= f.idx.length;
        faces.push({ b, id: f.id, pts: f.idx.map((i: any) => vs[i]), n: f.n, depth: d });
      });
    });
    faces.sort((a: any, b: any) => a.depth - b.depth);
    faces.forEach((f: any) => {
      ctx.beginPath(); ctx.moveTo(f.pts[0].x, f.pts[0].y);
      for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(236,232,226,0.95)'; ctx.fill();
      ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(26,23,21,0.92)'; ctx.lineWidth = 2; ctx.stroke();
      if (f.b.faceArt && f.b.faceArt[f.id]) {
        S.ensureFaceImg(f.b);
        const g = S.faceGeom(f.b, f.id);
        S.drawFaceArt(ctx, g.quad, f.b._faceImg[f.id], g.clip, proj);
      }
    });
  }

  // Generate a 2×2 elevation sheet (Front/Right/Back/Left) at a consistent scale.
  S.generateElevations = function generateElevations() {
    if (!S.massing.masses.length) { S.showHint('Add some masses first'); return; }
    const views = [
      { a: 0, label: 'FRONT (S)' }, { a: Math.PI / 2, label: 'RIGHT (E)' },
      { a: Math.PI, label: 'BACK (N)' }, { a: -Math.PI / 2, label: 'LEFT (W)' },
    ];
    let gW = 0, gH = 0;
    const measured = views.map((o: any) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      S.massing.masses.forEach((b: any) => S.massVerts(b).forEach((p: any) => {
        const q = S.mRotY(p, o.a);
        if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x;
        if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y;
      }));
      gW = Math.max(gW, maxX - minX); gH = Math.max(gH, maxY - minY);
      return { minX, maxX, maxY };
    });
    const pad = Math.min(S.doc.wPx, S.doc.hPx) * 0.06;
    const cellW = (S.doc.wPx - pad * 3) / 2;
    const cellH = (S.doc.hPx - pad * 3) / 2 - 44;     // room for label
    const fit = Math.min(cellW / (gW || 1), cellH / (gH || 1)) * 0.82;
    const tmp = document.createElement('canvas'); tmp.width = S.doc.wPx; tmp.height = S.doc.hPx;
    const ctx = tmp.getContext('2d') as any;
    views.forEach((o: any, i: any) => {
      const col = i % 2, row = (i / 2) | 0;
      const cx0 = pad + col * (cellW + pad), cy0 = pad + row * (cellH + pad + 44);
      const m = measured[i];
      const midX = (m.minX + m.maxX) / 2;
      const ox = cx0 + cellW / 2 - midX * fit;
      const groundY = cy0 + cellH - cellH * 0.08;
      S.drawElevationInto(ctx, o.a, fit, ox, groundY);
      ctx.fillStyle = 'rgba(34,30,28,0.82)';
      ctx.font = '600 26px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.label, cx0 + cellW / 2, cy0 + cellH + 22);
    });
    S.createLayer('Elevations');
    const layer = state.layers[state.layers.length - 1];
    state.activeLayer = state.layers.length - 1;
    layer.ctx.drawImage(tmp, 0, 0);
    S.saveSnapshot(layer);
    S.updateLayerOrder(); S.renderLayers(); S.updateUI();
    S.massHint('Elevations added on a new layer · Exit when done');
  }

  // Render S.massing to an arbitrary ctx (used for flatten). bg=false → transparent.
  S.drawMassingTo = function drawMassingTo(ctx: any, W: any, H: any, bg: any) {
    const saveCx = S.massing.cx, saveCy = S.massing.cy;
    S.massing.cx = W/2; S.massing.cy = H*0.58;
    if (bg) { ctx.fillStyle = '#e9e5e0'; ctx.fillRect(0,0,W,H); }
    const faces: any[] = [];
    S.massing.masses.forEach((b: any, bi: any) => {
      const vs = S.massVerts(b).map(S.mProject);
      const cull = false;   // all masses are polygonal — depth-sort only
      S.massFaces(b).forEach((f: any) => {
        const p0=vs[f.idx[0]], p1=vs[f.idx[1]], p2=vs[f.idx[2]];
        const cross=(p1.x-p0.x)*(p2.y-p0.y)-(p1.y-p0.y)*(p2.x-p0.x);
        if (cull && cross<=0) return;
        let depth=0; for (const i of f.idx) depth += vs[i].depth; depth /= f.idx.length;
        faces.push({ pts:f.idx.map((i: any) =>vs[i]), n:f.n, depth });
      });
    });
    faces.sort((a: any, b: any) =>a.depth-b.depth);
    const L=[-0.4,0.82,0.4];
    faces.forEach((f: any) =>{
      const ndl=Math.max(0,f.n[0]*L[0]+f.n[1]*L[1]+f.n[2]*L[2]);
      const shade=0.6+ndl*0.4;
      const base=[236,232,226];
      const r=Math.round(base[0]*shade),g=Math.round(base[1]*shade),bl=Math.round(base[2]*shade);
      ctx.beginPath(); ctx.moveTo(f.pts[0].x,f.pts[0].y);
      for(let i=1;i<f.pts.length;i++) ctx.lineTo(f.pts[i].x,f.pts[i].y);
      ctx.closePath();
      ctx.fillStyle=`rgb(${r},${g},${bl})`; ctx.fill();
      ctx.lineJoin='round'; ctx.strokeStyle='rgba(20,18,16,0.9)'; ctx.lineWidth=2; ctx.stroke();
    });
    S.massing.cx = saveCx; S.massing.cy = saveCy;
  }

  // ---- control bar wiring ----
  $all('.mass-tool').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      $all('.mass-tool').forEach((b: any) => b.classList.remove('active'));
      btn.classList.add('active');
      S.massing.dragging = null;
      S.massing.tool = btn.dataset.mtool;
      const hints: Record<string, string> = { add:'Drag a footprint on the ground, release to extrude',
        build:'Wall: tap corners (tap first dot to close). Door/Window: tap a wall to drop one. Modes & sizes below.',
        select:'Tap a mass to select · drag body to move · grab a handle to push-pull, scale or rotate',
        sketch:'Tap a face — wall, roof or floor — to draw its elevation / plan',
        push:'Tap a face region and drag — out to extrude, in to recess',
        material:'Pick a material, then tap a face · toggle “Whole mass” to skin all faces',
        remove:'Tap a mass to delete it', orbit:'Drag to orbit · pinch or scroll to zoom',
        pan:'Drag to pan the view' };
      S.massHint(hints[S.massing.tool]);
      S.updateMatPalette(); S.updateBuildPalette(); S.refreshInspector();
    });
  });
  S.syncMassToolButtons = function syncMassToolButtons() {
    $all('.mass-tool').forEach((b: any) => b.classList.toggle('active', b.dataset.mtool === S.massing.tool));
    if (typeof S.updateMatPalette === 'function') S.updateMatPalette();
    if (typeof S.updateBuildPalette === 'function') S.updateBuildPalette();
  };
  (function () {
    const vMenu = $el('mass-view-menu'), eMenu = $el('mass-export-menu');
    const vPop = $el('mass-view-pop'), ePop = $el('mass-export-pop');
    function closeMassMenus() { vPop.style.display = 'none'; ePop.style.display = 'none'; vMenu.classList.remove('active'); eMenu.classList.remove('active'); }
    function toggle(pop: any, menu: any) { const open = pop.style.display !== 'none'; closeMassMenus(); if (!open) { pop.style.display = 'flex'; menu.classList.add('active'); } }
    vMenu.addEventListener('click', (e: any) => { e.stopPropagation(); toggle(vPop, vMenu); });
    eMenu.addEventListener('click', (e: any) => { e.stopPropagation(); toggle(ePop, eMenu); });
    ['mass-flatten','mass-elev','mass-view'].forEach((id: any) => $el(id).addEventListener('click', closeMassMenus));
    document.addEventListener('pointerdown', (e: any) => { const t = e.target; if (!(t instanceof Element) || !t.closest('#mass-view-pop,#mass-export-pop,#mass-view-menu,#mass-export-menu')) closeMassMenus(); });
    (window as any)._closeMassMenus = closeMassMenus;
  })();

  // ---- face sketch editor ----
  S.faceEd = { bi: -1, id: null, tool: 'pen', color: '#1c1a18', size: 4, drawing: false, last: null, ctx: null, regionPts: [], guide: null, grid: false, snap: false, pxm: 100, gridM: 0.25, fw: 1, fh: 1, openW: 1200, openH: 1500, openSill: 900 };
  S.feCanvas = $el('fe-canvas');
  S.openFaceEditor = function openFaceEditor(bi: any, id: any) {
    const b = S.massing.masses[bi]; if (!b) return;
    const fg = S.faceGeom(b, id); if (!fg) return;
    let pxm = 100, wpx = Math.max(64, Math.round(fg.w * pxm)), hpx = Math.max(64, Math.round(fg.h * pxm));
    const cap = 1400, mx = Math.max(wpx, hpx);
    if (mx > cap) { const s = cap / mx; wpx = Math.round(wpx * s); hpx = Math.round(hpx * s); }
    S.feCanvas.width = wpx; S.feCanvas.height = hpx;
    const ctx = S.feCanvas.getContext('2d') as any; S.faceEd.ctx = ctx;
    ctx.clearRect(0, 0, wpx, hpx);                 // transparent — only ink maps back onto the face
    S.faceEd.guide = fg.guide || null;
    if (b.faceArt && b.faceArt[id]) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, wpx, hpx); im.src = b.faceArt[id]; }
    S.faceEd.bi = bi; S.faceEd.id = id;
    S.faceEd.regionPts = [];
    S.faceEd.pxm = fg.w ? (wpx / fg.w) : 100;        // effective px per metre (after the size cap)
    S.faceEd.fw = fg.w || 1; S.faceEd.fh = fg.h || 1;
    S.faceEd.gridM = S._niceGridM(fg.w || 1, fg.h || 1);
    const gbtn = $el('fe-grid'); if (gbtn) gbtn.classList.toggle('active', !!S.faceEd.grid);
    const sbtn = $el('fe-snap'); if (sbtn) sbtn.classList.toggle('active', !!S.faceEd.snap);
    const gmm = $el('fe-gridmm'); if (gmm) gmm.value = Math.round(S.faceEd.gridM * 1000);
    if (typeof S._feSyncOpenFields === 'function') S._feSyncOpenFields();
    const regs0 = b.faceRegions && b.faceRegions[id];
    const fd = $el('fe-depth'); if (fd) fd.value = (regs0 && regs0.length) ? (regs0[regs0.length - 1].depth || 0) : 0;
    // overlay: boundary guide + any committed face regions + in-progress region
    S.feRedrawOverlay();
    $el('fe-label').textContent = S.faceLabel(id).toUpperCase();
    $el('face-editor').style.display = 'flex';
  }
  S.feClose = function feClose() { $el('face-editor').style.display = 'none'; S.faceEd.bi = -1; S.faceEd.id = null; S.faceEd.drawing = false; S.faceEd.regionPts = []; }
  S.fePos = function fePos(e: any) { const r = S.feCanvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (S.feCanvas.width / r.width), y: (e.clientY - r.top) * (S.feCanvas.height / r.height) }; }
  S.feCanvas.addEventListener('pointerdown', (e: any) => {
    e.preventDefault();
    if (S.faceEd.tool === 'window' || S.faceEd.tool === 'door') {
      const p = S._feSnap(S.fePos(e));
      S.feCommitOpening(p.x / S.feCanvas.width);
      return;
    }
    if (S.faceEd.tool === 'region') {
      const p = S._feSnap(S.fePos(e)), pts = S.faceEd.regionPts || (S.faceEd.regionPts = []);
      if (pts.length >= 3 && Math.hypot(p.x - pts[0].x, p.y - pts[0].y) < 14) { S.feCommitRegion(); return; }
      pts.push(p); S.feRedrawOverlay(); return;
    }
    S.feCanvas.setPointerCapture(e.pointerId); S.faceEd.drawing = true; S.faceEd.last = S.fePos(e);
  });
  S.feCanvas.addEventListener('pointermove', (e: any) => {
    if (S.faceEd.tool === 'region' || !S.faceEd.drawing) return;
    const p = S.fePos(e), ctx = S.faceEd.ctx;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = S.faceEd.size;
    if (S.faceEd.tool === 'erase') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = S.faceEd.color; }
    ctx.beginPath(); ctx.moveTo(S.faceEd.last.x, S.faceEd.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    S.faceEd.last = p;
  });

  // place a parametric door/window as a recessed region (reuses the recess kernel + materials)
  S.feCommitOpening = function feCommitOpening(uCenter: any) {
    const b = S.massing.masses[S.faceEd.bi]; if (!b) return;
    const kind = S.faceEd.tool;                                  // 'window' | 'door'
    const W = S.faceEd.fw || 1, H = S.faceEd.fh || 1;              // face dims (metres)
    if (W <= 0.05 || H <= 0.05) { if (typeof S.massHint === 'function') S.massHint('Face too small for an opening'); return; }
    let w = Math.max(0.1, (S.faceEd.openW || 1200) / 1000), h = Math.max(0.1, (S.faceEd.openH || 1500) / 1000);
    let sill = Math.max(0, (S.faceEd.openSill || 0) / 1000);
    const fitted = (w > W * 0.92) || (h > H * 0.92) || (sill + h > H);   // clamp to the face — never silently reject
    w = Math.min(w, W * 0.92); h = Math.min(h, H * 0.92);
    if (sill + h > H) sill = Math.max(0, H - h);
    let uL = uCenter - (w / 2) / W, uR = uCenter + (w / 2) / W;
    if (uL < 0) { uR -= uL; uL = 0; } if (uR > 1) { uL -= (uR - 1); uR = 1; }   // keep within the face width
    uL = Math.max(0, uL); uR = Math.min(1, uR);
    const vBot = 1 - sill / H, vTop = 1 - (sill + h) / H;       // v=0 top, v=1 bottom
    const uv = [{ u: uL, v: vTop }, { u: uR, v: vTop }, { u: uR, v: vBot }, { u: uL, v: vBot }];
    const mat = kind === 'window'
      ? { kind: 'color', hex: '#7d97a8', id: 'glass', glass: true }   // translucent glazing
      : { kind: 'color', hex: '#3a3330', id: 'door' };                // recessed panel
    S.massSnapshot();
    b.faceRegions = b.faceRegions || {}; b.faceRegions[S.faceEd.id] = b.faceRegions[S.faceEd.id] || [];
    b.faceRegions[S.faceEd.id].push({ uv, depth: -100, mat, opening: kind });   // ~100mm reveal; tweak via Pull
    S.feRedrawOverlay(); S.renderMassing();
    if (typeof S.massHint === 'function') S.massHint((kind === 'window' ? 'Window placed' : 'Door placed') + (fitted ? ' \u2014 fitted to face' : ' \u2014 adjust depth with Pull'));
  }
  S.feCommitRegion = function feCommitRegion() {
    const b = S.massing.masses[S.faceEd.bi];
    if (!b || !S.faceEd.regionPts || S.faceEd.regionPts.length < 3) { S.faceEd.regionPts = []; S.feRedrawOverlay(); return; }
    S.massSnapshot();
    b.faceRegions = b.faceRegions || {};
    b.faceRegions[S.faceEd.id] = b.faceRegions[S.faceEd.id] || [];
    b.faceRegions[S.faceEd.id].push({ uv: S.faceEd.regionPts.map((p: any) => ({ u: p.x / S.feCanvas.width, v: p.y / S.feCanvas.height })) });
    S.faceEd.regionPts = [];
    S.feRedrawOverlay(); S.renderMassing();
    if (typeof S.massHint === 'function') S.massHint('Region added \u2014 it now maps onto the face in 3D');
  }
  S._niceGridM = function _niceGridM(w: any, h: any) {
    const big = Math.max(w, h) || 1, target = big / 12;
    const steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5];
    for (const s of steps) if (s >= target) return s;
    return steps[steps.length - 1];
  }
  S._feSnap = function _feSnap(p: any) {
    if (!S.faceEd.snap || !S.faceEd.pxm || !S.faceEd.gridM) return p;
    const step = S.faceEd.gridM * S.faceEd.pxm;
    return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
  }
  // Existing holes on this face, in UV: recessed regions + door/window openings (which cut side0/side2).
  S.facePunctures = function facePunctures(b: any, faceId: any) {
    const out: any[] = [];
    const regs = b.faceRegions && b.faceRegions[faceId];
    if (regs) regs.forEach((r: any) => { if ((r.depth || 0) < 0 && r.uv && r.uv.length >= 3) out.push(r.uv.map((p: any) => ({ u: p.u, v: p.v }))); });
    if ((faceId === 'side0' || faceId === 'side2') && b.openings && b.h) {
      const L = S.faceEd.fw || 1, H = b.h;
      b.openings.forEach((op: any) => {
        const halfU = (op.w / 2) / L;
        let uc = op.u; if (faceId === 'side2') uc = 1 - uc;
        const uL = uc - halfU, uR = uc + halfU;
        const sill = op.kind === 'door' ? 0 : (op.sill || 0);
        const vBot = 1 - sill / H, vTop = 1 - (sill + op.h) / H;
        out.push([{ u: uL, v: vTop }, { u: uR, v: vTop }, { u: uR, v: vBot }, { u: uL, v: vBot }]);
      });
    }
    return out;
  }
  S.feRedrawOverlay = function feRedrawOverlay() {
    const gv = $el('fe-guide'); if (!gv) return;
    gv.style.display = 'block'; gv.width = S.feCanvas.width; gv.height = S.feCanvas.height;
    const gx = gv.getContext('2d') as any; gx.clearRect(0, 0, gv.width, gv.height);
    // snap grid (under everything)
    if (S.faceEd.grid && S.faceEd.pxm && S.faceEd.gridM) {
      const step = S.faceEd.gridM * S.faceEd.pxm;
      if (step >= 4) {
        gx.strokeStyle = 'rgba(160,40,53,0.13)'; gx.lineWidth = 1; gx.setLineDash([]);
        gx.beginPath();
        for (let x = 0; x <= gv.width + 0.5; x += step) { gx.moveTo(x, 0); gx.lineTo(x, gv.height); }
        for (let y = 0; y <= gv.height + 0.5; y += step) { gx.moveTo(0, y); gx.lineTo(gv.width, y); }
        gx.stroke();
      }
    }
    if (S.faceEd.guide) {
      gx.strokeStyle = 'rgba(160,40,53,0.5)'; gx.setLineDash([8, 6]); gx.lineWidth = 2;
      gx.beginPath(); S.faceEd.guide.forEach((p: any, k: any) => { const X = p.x * gv.width, Y = p.y * gv.height; k ? gx.lineTo(X, Y) : gx.moveTo(X, Y); }); gx.closePath(); gx.stroke();
    }
    gx.setLineDash([]);
    const b = S.massing.masses[S.faceEd.bi];
    // existing punctures (openings / recesses) — drawn as hatched voids so you sketch around them
    if (b) {
      const punc = S.facePunctures(b, S.faceEd.id);
      punc.forEach((poly: any) => {
        gx.save();
        gx.beginPath(); poly.forEach((p: any, k: any) => { const X = p.u * gv.width, Y = p.v * gv.height; k ? gx.lineTo(X, Y) : gx.moveTo(X, Y); }); gx.closePath();
        gx.fillStyle = 'rgba(28,26,24,0.16)'; gx.fill();
        gx.strokeStyle = 'rgba(28,26,24,0.65)'; gx.setLineDash([5, 4]); gx.lineWidth = 1.5; gx.stroke();
        gx.clip(); gx.setLineDash([]); gx.strokeStyle = 'rgba(28,26,24,0.22)'; gx.lineWidth = 1;
        let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
        poly.forEach((p: any) => { const X = p.u * gv.width, Y = p.v * gv.height; mnx = Math.min(mnx, X); mny = Math.min(mny, Y); mxx = Math.max(mxx, X); mxy = Math.max(mxy, Y); });
        gx.beginPath();
        for (let d = mny - (mxx - mnx); d <= mxy; d += 9) { gx.moveTo(mnx, d); gx.lineTo(mxx, d + (mxx - mnx)); }   // diagonal hatch
        gx.stroke();
        gx.restore();
      });
    }
    const regs = (b && b.faceRegions && b.faceRegions[S.faceEd.id]) || [];
    regs.forEach((r: any) => {
      gx.beginPath(); r.uv.forEach((p: any, k: any) => { const X = p.u * gv.width, Y = p.v * gv.height; k ? gx.lineTo(X, Y) : gx.moveTo(X, Y); }); gx.closePath();
      gx.fillStyle = 'rgba(58,110,165,0.18)'; gx.fill(); gx.strokeStyle = '#3a6ea5'; gx.lineWidth = 2; gx.stroke();
    });
    const pts = S.faceEd.regionPts || [];
    if (pts.length) {
      gx.strokeStyle = '#a02835'; gx.lineWidth = 2; gx.beginPath();
      pts.forEach((p: any, k: any) => { k ? gx.lineTo(p.x, p.y) : gx.moveTo(p.x, p.y); }); gx.stroke();
      pts.forEach((p: any) => { gx.fillStyle = '#a02835'; gx.beginPath(); gx.arc(p.x, p.y, 4, 0, 6.2832); gx.fill(); });
    }
  }
  S.feCanvas.addEventListener('pointerup', () => { S.faceEd.drawing = false; });
  S.feCanvas.addEventListener('pointercancel', () => { S.faceEd.drawing = false; });
  $el('fe-grid').addEventListener('click', () => {
    S.faceEd.grid = !S.faceEd.grid;
    $el('fe-grid').classList.toggle('active', S.faceEd.grid);
    S.feRedrawOverlay();
    if (typeof S.massHint === 'function') S.massHint(S.faceEd.grid ? 'Grid shown \u2014 ' + Math.round(S.faceEd.gridM * 1000) + 'mm' : 'Grid hidden');
  });
  $el('fe-snap').addEventListener('click', () => {
    S.faceEd.snap = !S.faceEd.snap;
    $el('fe-snap').classList.toggle('active', S.faceEd.snap);
    if (typeof S.massHint === 'function') S.massHint(S.faceEd.snap ? 'Snap on \u2014 region taps lock to ' + Math.round(S.faceEd.gridM * 1000) + 'mm' : 'Snap off');
  });
  $el('fe-gridmm').addEventListener('change', (e: any) => {
    let mm = Math.round(parseFloat(e.target.value) || 0);
    mm = Math.max(10, Math.min(5000, mm)); e.target.value = mm;
    S.faceEd.gridM = mm / 1000;
    S.faceEd.grid = true; $el('fe-grid').classList.add('active');   // show the grid so the new step is visible
    S.feRedrawOverlay();
    if (typeof S.massHint === 'function') S.massHint('Grid step ' + mm + 'mm' + (S.faceEd.snap ? ' \u2014 snapping' : ''));
  });
  S._feSyncOpenFields = function _feSyncOpenFields() {
    const ow = $el('fe-ow'), oh = $el('fe-oh'), os = $el('fe-osill');
    if (ow) ow.value = S.faceEd.openW; if (oh) oh.value = S.faceEd.openH; if (os) os.value = S.faceEd.openSill;
  }
  $el('fe-ow').addEventListener('change', (e: any) => { S.faceEd.openW = Math.max(100, Math.min(20000, Math.round(parseFloat(e.target.value) || 0))); e.target.value = S.faceEd.openW; });
  $el('fe-oh').addEventListener('change', (e: any) => { S.faceEd.openH = Math.max(100, Math.min(20000, Math.round(parseFloat(e.target.value) || 0))); e.target.value = S.faceEd.openH; });
  $el('fe-osill').addEventListener('change', (e: any) => { S.faceEd.openSill = Math.max(0, Math.min(20000, Math.round(parseFloat(e.target.value) || 0))); e.target.value = S.faceEd.openSill; });
  $all('.fe-tool').forEach((btn: any) => btn.addEventListener('click', () => {
    if (!btn.dataset.fetool) return;     // Grid is a toggle, not a tool — handled separately
    $all('.fe-tool').forEach((b: any) => b.classList.remove('active')); btn.classList.add('active'); S.faceEd.tool = btn.dataset.fetool;
    if (S.faceEd.tool === 'window') { S.faceEd.openW = 1200; S.faceEd.openH = 1500; S.faceEd.openSill = 900; S._feSyncOpenFields(); if (typeof S.massHint === 'function') S.massHint('Window \u2014 tap the face to place (W/H/sill set above)'); }
    else if (S.faceEd.tool === 'door') { S.faceEd.openW = 900; S.faceEd.openH = 2100; S.faceEd.openSill = 0; S._feSyncOpenFields(); if (typeof S.massHint === 'function') S.massHint('Door \u2014 tap the face to place'); }
    const gb = $el('fe-grid'); if (gb) gb.classList.toggle('active', !!S.faceEd.grid);   // keep grid state visible across tool switches
    const sb = $el('fe-snap'); if (sb) sb.classList.toggle('active', !!S.faceEd.snap);
  }));
  $el('fe-size').addEventListener('input', (e: any) => { S.faceEd.size = +e.target.value; });
  ['#1c1a18','#a02835','#3a6ea5','#6a6a6a'].forEach((c: any, i: any) => {
    const b = document.createElement('button'); b.className = 'fe-sw' + (i === 0 ? ' active' : ''); b.style.background = c;
    b.addEventListener('click', () => {
      $all('.fe-sw').forEach((x: any) => x.classList.remove('active')); b.classList.add('active');
      S.faceEd.color = c; S.faceEd.tool = 'pen';
      $all('.fe-tool').forEach((x: any) => x.classList.toggle('active', x.dataset.fetool === 'pen'));
    });
    $el('fe-swatches').appendChild(b);
  });
  $el('fe-clear').addEventListener('click', () => { S.faceEd.ctx.clearRect(0, 0, S.feCanvas.width, S.feCanvas.height); });
  $el('fe-cancel').addEventListener('click', S.feClose);
  $el('fe-depth').addEventListener('change', (e: any) => {
    const mm = parseFloat(e.target.value) || 0;
    const b = S.massing.masses[S.faceEd.bi]; if (!b) return;
    const regs = b.faceRegions && b.faceRegions[S.faceEd.id];
    if (!regs || !regs.length) { if (typeof S.massHint === 'function') S.massHint('Draw a region first, then set Pull'); e.target.value = 0; return; }
    S.massSnapshot();
    regs[regs.length - 1].depth = mm;                 // pull the most-recent region on this face
    S.feRedrawOverlay(); S.renderMassing();
    if (typeof S.massHint === 'function') S.massHint(mm > 0 ? 'Region pulled out ' + mm + 'mm \u2014 close to see it in 3D' : (mm < 0 ? 'Region recessed ' + (-mm) + 'mm \u2014 close to see it in 3D' : 'Region flattened'));
  });
  $el('fe-done').addEventListener('click', () => {
    const b = S.massing.masses[S.faceEd.bi];
    if (b) { S.massSnapshot(); b.faceArt = b.faceArt || {}; b.faceArt[S.faceEd.id] = S.feCanvas.toDataURL('image/png'); b._faceImg = b._faceImg || {}; delete b._faceImg[S.faceEd.id]; S.ensureFaceImg(b); }
    S.feClose(); S.renderMassing();
  });
  $el('mass-proj').addEventListener('click', () => {
    S.massing.cam.projection = S.massing.cam.projection === 'axon' ? 'persp' : 'axon';
    $el('mass-proj').textContent = S.massing.cam.projection === 'axon' ? 'Axon' : 'Persp';
    S.renderMassing();
  });
  S.updateMassBaseBtn = function updateMassBaseBtn() {
    const btn = $el('mass-base');
    if (btn) btn.classList.toggle('active', !!S.massing.showBase);
  }
  $el('mass-base').addEventListener('click', () => {
    S.massing.showBase = !S.massing.showBase;
    if (S.massing.showBase) {
      if (!S.massing.baseAnchor) S.massing.baseAnchor = { px: S.doc.wPx / 2, py: S.doc.hPx / 2, ppm: S.pxPerMetre() };
      S.buildMassingBase();
    }
    S.updateMassBaseBtn();
    S.renderMassing();
    S.massHint(S.massing.showBase ? 'Plan shown on ground' : 'Plan hidden');
  });
  $el('mass-flatten').addEventListener('click', S.flattenMassingToLayer);
  $el('mass-dup').addEventListener('click', S.duplicateMass);
  $el('mass-del').addEventListener('click', S.deleteSelectedMass);
  $el('mass-elev').addEventListener('click', S.generateElevations);
  $el('mass-view').addEventListener('click', S.exportAngledView);
  $el('mass-clear').addEventListener('click', () => {
    if (S.massing.masses.length && confirm('Delete all masses?')) { S.massSnapshot(); S.massing.masses = []; S.massing.selected = -1; S.massing.baseAnchor = null; S.renderMassing(); }
  });
  $el('mass-exit').addEventListener('click', S.exitMassing);

  window.addEventListener('resize', () => { if (S.massing.active) S.renderMassing(); });


}
