/* Feature: Keyplan-style wall graph — independent segments, junctions, rooms, arcs */
import { S } from "../scope";

const JOIN_DOC_PX = 12;
const MIN_WALL_LEN = 8;
/** Free-draw angle quantisation; Shift snaps to 45°. */
const ANGLE_STEP_RAD = (5 * Math.PI) / 180;
const ORTHO_STEP_RAD = Math.PI / 4;
/** Cardinal/diagonal angles get a wider capture cone so straight runs lock in. */
const CARDINAL_STEPS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const CARDINAL_CONE_RAD = (2.5 * Math.PI) / 180;

export function initWallGraph() {
  const state = S.state;
  if (!state.wallRooms) state.wallRooms = [];
  if (state.wallChainEnd == null) state.wallChainEnd = null;
  if (state.wallDrag == null) state.wallDrag = null;

  S.wallJoinTol = function wallJoinTol() {
    const scale = (state.zoom || 1) * (state.baseZoom || 1);
    return Math.max(JOIN_DOC_PX, 14 / scale);
  };

  /** Signed circular-arc sagitta (bulge). 0 = straight. */
  S.wallBulge = function wallBulge(w: any) {
    const b = w && w.bulge;
    return typeof b === "number" && Math.abs(b) > 0.5 ? b : 0;
  };

  /** Sample centerline points for a wall (straight or arc). */
  S.wallCenterlinePts = function wallCenterlinePts(w: any, samples?: number) {
    const pts = w && w.pts;
    if (!pts || pts.length < 2) return [];
    const a = pts[0],
      b = pts[pts.length - 1];
    const bulge = S.wallBulge(w);
    if (!bulge) return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
    const chord = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const n = Math.max(8, samples || Math.ceil(chord / 18));
    return S.sampleArcByBulge(a, b, bulge, n);
  };

  /**
   * Arc through chord a→b whose midpoint sits `bulge` away from the chord along
   * the chord normal (-dy, dx). Positive bulge bows the same way the handle is
   * dragged, so the curve tracks the pointer.
   */
  S.sampleArcByBulge = function sampleArcByBulge(a: any, b: any, bulge: any, n: any) {
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const chord = Math.hypot(dx, dy) || 1;
    const nx = -dy / chord,
      ny = dx / chord;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const sAbs = Math.abs(bulge);
    const steps = Math.max(2, n | 0);
    if (sAbs < 0.5) {
      const out = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        out.push({ x: a.x + dx * t, y: a.y + dy * t });
      }
      return out;
    }
    const sign = bulge > 0 ? 1 : -1;
    // sagitta → radius, centre on the far side of the chord from the bulge
    const R = (chord * chord) / (8 * sAbs) + sAbs / 2;
    const cx = mid.x - nx * sign * (R - sAbs);
    const cy = mid.y - ny * sign * (R - sAbs);
    const a0 = Math.atan2(a.y - cy, a.x - cx);
    const a1 = Math.atan2(b.y - cy, b.x - cx);
    let da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da <= -Math.PI) da += 2 * Math.PI;
    // Keep the sweep whose midpoint lands on the bulge side of the chord.
    const midAng = a0 + da / 2;
    const probe = { x: cx + Math.cos(midAng) * R, y: cy + Math.sin(midAng) * R };
    const side = (probe.x - mid.x) * nx * sign + (probe.y - mid.y) * ny * sign;
    if (side < 0) da += da > 0 ? -2 * Math.PI : 2 * Math.PI;
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = a0 + da * t;
      out.push({ x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R });
    }
    // Force exact endpoints
    out[0] = { x: a.x, y: a.y };
    out[out.length - 1] = { x: b.x, y: b.y };
    return out;
  };

  S.arcLengthByBulge = function arcLengthByBulge(a: any, b: any, bulge: any) {
    if (!bulge || Math.abs(bulge) < 0.5) return Math.hypot(b.x - a.x, b.y - a.y);
    const pts = S.sampleArcByBulge(a, b, bulge, 32);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return len;
  };

  S.bulgeHandlePoint = function bulgeHandlePoint(w: any) {
    const pts = w && w.pts;
    if (!pts || pts.length < 2) return null;
    const a = pts[0],
      b = pts[pts.length - 1];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const chord = Math.hypot(dx, dy) || 1;
    const nx = -dy / chord,
      ny = dx / chord;
    const bulge = S.wallBulge(w);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return { x: mid.x + nx * bulge, y: mid.y + ny * bulge, mid, nx, ny, chord };
  };

  /** Snap end point: existing corners win, then angle in 5° steps (Shift = 45°). */
  S.snapWallDrawEnd = function snapWallDrawEnd(start: any, raw: any, forceOrtho?: boolean) {
    let p = { x: raw.x, y: raw.y };
    // Endpoint / corner snap first
    const corner = S.snapVertex(p);
    if (corner.snap === "corner") {
      return { x: corner.x, y: corner.y, snap: "corner" as string | null };
    }
    const dx = p.x - start.x,
      dy = p.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return { x: p.x, y: p.y, snap: null };
    const rawAng = Math.atan2(dy, dx);
    const step = forceOrtho ? ORTHO_STEP_RAD : ANGLE_STEP_RAD;
    let ang = Math.round(rawAng / step) * step;
    let snapKind: string | null = "angle";
    if (!forceOrtho) {
      // Widen the cone on straight runs so 0/90/180/270 don't slip to 5°.
      for (const cand of CARDINAL_STEPS) {
        let d = Math.abs(rawAng - cand);
        while (d > Math.PI) d = Math.abs(d - 2 * Math.PI);
        if (d < CARDINAL_CONE_RAD) {
          ang = cand;
          snapKind = "straight";
          break;
        }
      }
    }
    p = { x: start.x + Math.cos(ang) * len, y: start.y + Math.sin(ang) * len };
    // Re-check corner after angle snap — snapping onto an existing end wins
    const c2 = S.snapVertex(p);
    if (c2.snap === "corner") return { x: c2.x, y: c2.y, snap: "corner" };
    return { x: p.x, y: p.y, snap: snapKind };
  };

  /** Split multi-segment polylines into independent 2-pt walls; remap openings. */
  S.migrateWallsToSegments = function migrateWallsToSegments() {
    const walls = state.walls || [];
    if (!walls.length) return false;
    const next: any[] = [];
    let changed = false;
    walls.forEach((w: any) => {
      const pts = (w.pts || []).map((p: any) => ({ x: p.x, y: p.y }));
      if (pts.length < 2) return;
      const closed =
        pts.length > 2 &&
        Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.5;
      const segs = pts.length - 1;
      if (segs === 1) {
        next.push(w);
        return;
      }
      changed = true;
      for (let i = 0; i < segs; i++) {
        if (closed && i === segs - 1) {
          // last seal segment duplicates first→last; skip if zero length
          if (Math.hypot(pts[i].x - pts[i + 1].x, pts[i].y - pts[i + 1].y) < 0.5) continue;
        }
        const a = { x: pts[i].x, y: pts[i].y };
        const b = { x: pts[i + 1].x, y: pts[i + 1].y };
        if (Math.hypot(b.x - a.x, b.y - a.y) < 1) continue;
        const openings = (w.openings || [])
          .filter((o: any) => o.seg === i)
          .map((o: any) => ({ ...o, seg: 0 }));
        const segWall: any = {
          id: undefined,
          pts: [a, b],
          thickMM: w.thickMM,
          heightM: w.heightM,
          openings,
          bulge: w.bulge || 0,
          name: "Wall",
          visible: w.visible,
          roomId: null,
        };
        S.ensureWallId(segWall);
        next.push(segWall);
      }
    });
    if (changed) {
      state.walls = next;
      S.reconcileWallRooms();
    }
    return changed;
  };

  /** Snap point onto nearest existing wall endpoint within join tol. */
  S.joinWallEndpoint = function joinWallEndpoint(p: any) {
    const tol = S.wallJoinTol();
    let best: any = null,
      bestD = tol;
    (state.walls || []).forEach((w: any) => {
      const pts = w.pts || [];
      if (pts.length < 2) return;
      [pts[0], pts[pts.length - 1]].forEach((v: any) => {
        const d = Math.hypot(p.x - v.x, p.y - v.y);
        if (d < bestD) {
          bestD = d;
          best = { x: v.x, y: v.y };
        }
      });
    });
    return best || { x: p.x, y: p.y };
  };

  /** Walls whose endpoint matches p (within tol). */
  S.wallsAtPoint = function wallsAtPoint(p: any, excludeId?: string) {
    const tol = S.wallJoinTol();
    const hits: { wall: any; end: "a" | "b" }[] = [];
    (state.walls || []).forEach((w: any) => {
      if (!w || w.id === excludeId) return;
      const pts = w.pts || [];
      if (pts.length < 2) return;
      if (Math.hypot(pts[0].x - p.x, pts[0].y - p.y) <= tol) hits.push({ wall: w, end: "a" });
      else if (Math.hypot(pts[pts.length - 1].x - p.x, pts[pts.length - 1].y - p.y) <= tol)
        hits.push({ wall: w, end: "b" });
    });
    return hits;
  };

  /** Move all wall endpoints that currently sit on `from` to `to`. */
  S.moveSharedJunction = function moveSharedJunction(from: any, to: any, excludeId?: string) {
    const tol = S.wallJoinTol();
    (state.walls || []).forEach((w: any) => {
      if (!w || w.id === excludeId) return;
      const pts = w.pts || [];
      if (pts.length < 2) return;
      if (Math.hypot(pts[0].x - from.x, pts[0].y - from.y) <= tol) {
        pts[0] = { x: to.x, y: to.y };
      }
      if (Math.hypot(pts[pts.length - 1].x - from.x, pts[pts.length - 1].y - from.y) <= tol) {
        pts[pts.length - 1] = { x: to.x, y: to.y };
      }
    });
  };

  /** True when this wall end shares a junction with another wall. */
  S.wallEndJoined = function wallEndJoined(wall: any, end: "a" | "b") {
    const pts = wall && wall.pts;
    if (!pts || pts.length < 2) return false;
    const p = end === "a" ? pts[0] : pts[pts.length - 1];
    return S.wallsAtPoint(p, wall.id).length > 0;
  };

  /**
   * Record which neighbour endpoints share this wall's junctions, captured once at
   * drag start. Re-searching by live position mid-drag loses neighbours after the
   * first frame, which is why a moved wall used to detach from its room.
   */
  S.captureWallJunctionLinks = function captureWallJunctionLinks(wall: any) {
    const pts = wall && wall.pts;
    if (!pts || pts.length < 2) return { a: [], b: [] };
    const mapHits = (p: any) =>
      S.wallsAtPoint(p, wall.id)
        .filter((h: any) => h.wall && h.wall.id)
        .map((h: any) => ({ id: h.wall.id, end: h.end }));
    return { a: mapHits(pts[0]), b: mapHits(pts[pts.length - 1]) };
  };

  /** Write a junction position into every neighbour endpoint recorded for it. */
  function applyJunctionLinks(links: any, to: any) {
    if (!links || !links.length) return;
    links.forEach((link: any) => {
      const w = (state.walls || []).find((x: any) => x && x.id === link.id);
      const pts = w && w.pts;
      if (!pts || pts.length < 2) return;
      if (link.end === "a") pts[0] = { x: to.x, y: to.y };
      else pts[pts.length - 1] = { x: to.x, y: to.y };
    });
  }

  /**
   * Constrained move: translate wall along its normal only; drag the shared
   * junctions with it so adjacent walls stretch and the room resizes.
   */
  S.applyWallNormalMove = function applyWallNormalMove(
    wall: any,
    baseA: any,
    baseB: any,
    dx: any,
    dy: any,
    links?: any,
  ) {
    const ux = baseB.x - baseA.x,
      uy = baseB.y - baseA.y;
    const len = Math.hypot(ux, uy) || 1;
    const nx = -uy / len,
      ny = ux / len;
    const dist = dx * nx + dy * ny;
    const na = { x: baseA.x + nx * dist, y: baseA.y + ny * dist };
    const nb = { x: baseB.x + nx * dist, y: baseB.y + ny * dist };
    if (links) {
      applyJunctionLinks(links.a, na);
      applyJunctionLinks(links.b, nb);
    } else {
      S.moveSharedJunction(baseA, na, wall.id);
      S.moveSharedJunction(baseB, nb, wall.id);
    }
    wall.pts = [na, nb];
  };

  /** Resize the wall from the endpoint nearest the pointer-down position. */
  S.applyWallTangentScale = function applyWallTangentScale(
    wall: any,
    baseA: any,
    baseB: any,
    _origin: any,
    start: any,
    cur: any,
    links?: any,
  ) {
    const ux = baseB.x - baseA.x,
      uy = baseB.y - baseA.y;
    const len0 = Math.hypot(ux, uy) || 1;
    const tx = ux / len0,
      ty = uy / len0;
    const startToA = Math.hypot(start.x - baseA.x, start.y - baseA.y);
    const startToB = Math.hypot(start.x - baseB.x, start.y - baseB.y);
    const moveA = startToA <= startToB;
    const pointerDelta = (cur.x - start.x) * tx + (cur.y - start.y) * ty;
    let na = { x: baseA.x, y: baseA.y };
    let nb = { x: baseB.x, y: baseB.y };

    if (moveA) {
      const delta = Math.min(pointerDelta, len0 - MIN_WALL_LEN);
      na = { x: baseA.x + tx * delta, y: baseA.y + ty * delta };
      if (links) applyJunctionLinks(links.a, na);
      else S.moveSharedJunction(baseA, na, wall.id);
    } else {
      const delta = Math.max(pointerDelta, MIN_WALL_LEN - len0);
      nb = { x: baseB.x + tx * delta, y: baseB.y + ty * delta };
      if (links) applyJunctionLinks(links.b, nb);
      else S.moveSharedJunction(baseB, nb, wall.id);
    }
    wall.pts = [na, nb];
  };

  /** Build adjacency undirected graph of wall ids by shared endpoints. */
  S.buildWallAdjacency = function buildWallAdjacency() {
    const walls = state.walls || [];
    const adj = new Map<string, Set<string>>();
    const ensure = (id: string) => {
      if (!adj.has(id)) adj.set(id, new Set());
    };
    walls.forEach((w: any) => {
      if (!w || !w.id) return;
      ensure(w.id);
    });
    const tol = S.wallJoinTol();
    for (let i = 0; i < walls.length; i++) {
      const wi = walls[i];
      if (!wi || !wi.id || !wi.pts || wi.pts.length < 2) continue;
      const endsI = [wi.pts[0], wi.pts[wi.pts.length - 1]];
      for (let j = i + 1; j < walls.length; j++) {
        const wj = walls[j];
        if (!wj || !wj.id || !wj.pts || wj.pts.length < 2) continue;
        const endsJ = [wj.pts[0], wj.pts[wj.pts.length - 1]];
        let linked = false;
        for (const a of endsI) {
          for (const b of endsJ) {
            if (Math.hypot(a.x - b.x, a.y - b.y) <= tol) {
              linked = true;
              break;
            }
          }
          if (linked) break;
        }
        if (linked) {
          adj.get(wi.id)!.add(wj.id);
          adj.get(wj.id)!.add(wi.id);
        }
      }
    }
    return adj;
  };

  /**
   * Find simple cycles of length ≥ 3 (rooms). Uses DFS; returns wall-id loops
   * oriented with unique undirected edge sets (no duplicate rooms).
   */
  S.findWallCycles = function findWallCycles() {
    const adj = S.buildWallAdjacency();
    const wallsById = new Map((state.walls || []).filter((w: any) => w && w.id).map((w: any) => [w.id, w]));
    const cycles: string[][] = [];
    const edgeKey = (a: string, b: string) => (a < b ? a + "|" + b : b + "|" + a);
    const seenRooms = new Set<string>();

    const nodeList = [...adj.keys()];
    for (const start of nodeList) {
      const stack: { id: string; path: string[]; used: Set<string> }[] = [
        { id: start, path: [start], used: new Set() },
      ];
      while (stack.length) {
        const cur = stack.pop()!;
        if (cur.path.length > 12) continue; // cap room complexity
        const neighbors = adj.get(cur.id);
        if (!neighbors) continue;
        for (const n of neighbors) {
          const ek = edgeKey(cur.id, n);
          if (cur.used.has(ek)) continue;
          if (n === start && cur.path.length >= 3) {
            const loop = cur.path.slice();
            const keys = [];
            for (let i = 0; i < loop.length; i++) {
              keys.push(edgeKey(loop[i], loop[(i + 1) % loop.length]));
            }
            keys.sort();
            const sig = keys.join(";");
            if (!seenRooms.has(sig)) {
              seenRooms.add(sig);
              cycles.push(loop);
            }
            continue;
          }
          if (cur.path.includes(n)) continue;
          const used2 = new Set(cur.used);
          used2.add(ek);
          stack.push({ id: n, path: cur.path.concat(n), used: used2 });
        }
      }
    }

    // Prefer minimal cycles: drop any cycle whose edge set strictly contains another
    const filtered: string[][] = [];
    const sigs = cycles.map((loop) => {
      const keys: string[] = [];
      for (let i = 0; i < loop.length; i++) keys.push(edgeKey(loop[i], loop[(i + 1) % loop.length]));
      keys.sort();
      return { loop, set: new Set(keys), sig: keys.join(";") };
    });
    sigs.sort((a, b) => a.set.size - b.set.size);
    for (const c of sigs) {
      let contained = false;
      for (const f of filtered) {
        const fKeys = new Set<string>();
        for (let i = 0; i < f.length; i++) fKeys.add(edgeKey(f[i], f[(i + 1) % f.length]));
        if (fKeys.size < c.set.size && [...fKeys].every((k) => c.set.has(k))) {
          contained = true;
          break;
        }
      }
      if (!contained) filtered.push(c.loop);
    }

    // Validate geometric closed polygon (endpoints chain)
    return filtered.filter((loop) => {
      const poly = S.cyclePolygon(loop, wallsById);
      return poly && poly.length >= 3 && S.shoelaceArea(poly) > 50;
    });
  };

  S.cyclePolygon = function cyclePolygon(wallIds: string[], wallsById?: Map<string, any>) {
    const byId = wallsById || new Map((state.walls || []).filter((w: any) => w && w.id).map((w: any) => [w.id, w]));
    const tol = S.wallJoinTol();
    if (!wallIds.length) return null;
    const first = byId.get(wallIds[0]);
    if (!first || !first.pts || first.pts.length < 2) return null;
    // Walk: pick oriented points so ends meet
    const poly: { x: number; y: number }[] = [];
    let cursor = { x: first.pts[0].x, y: first.pts[0].y };
    // Try both orientations of first wall
    const tryOrient = (startEnd: "a" | "b") => {
      const out: { x: number; y: number }[] = [];
      let cur =
        startEnd === "a"
          ? { x: first.pts[0].x, y: first.pts[0].y }
          : { x: first.pts[first.pts.length - 1].x, y: first.pts[first.pts.length - 1].y };
      out.push(cur);
      for (let i = 0; i < wallIds.length; i++) {
        const w = byId.get(wallIds[i]);
        if (!w || !w.pts || w.pts.length < 2) return null;
        const a = w.pts[0],
          b = w.pts[w.pts.length - 1];
        const da = Math.hypot(a.x - cur.x, a.y - cur.y);
        const db = Math.hypot(b.x - cur.x, b.y - cur.y);
        let next;
        let forward: boolean;
        if (da <= tol && db <= tol) {
          // both match — prefer continuing unused
          forward = !(i === 0 && startEnd === "b");
          next = forward ? b : a;
        } else if (da <= tol) {
          forward = true;
          next = b;
        } else if (db <= tol) {
          forward = false;
          next = a;
        } else return null;
        // Arc walls: sample the curve so the room area follows the bow. Walking
        // b→a flips the chord normal, so the sagitta sign flips with it.
        const bulge = S.wallBulge(w);
        if (bulge) {
          const samples = S.sampleArcByBulge(cur, next, forward ? bulge : -bulge, 12);
          for (let s = 1; s < samples.length; s++) out.push(samples[s]);
        } else {
          out.push({ x: next.x, y: next.y });
        }
        cur = { x: next.x, y: next.y };
      }
      // close check
      if (Math.hypot(out[0].x - cur.x, out[0].y - cur.y) > tol * 2) return null;
      return out;
    };
    return tryOrient("a") || tryOrient("b") || poly;
  };

  S.reconcileWallRooms = function reconcileWallRooms(opts?: { skipLayerSync?: boolean }) {
    const cycles = S.findWallCycles();
    const prev = state.wallRooms || [];
    const usedWalls = new Set<string>();
    const nextRooms: any[] = [];

    cycles.forEach((loop: string[], idx: number) => {
      const poly = S.cyclePolygon(loop);
      const areaPx2 = poly ? S.shoelaceArea(poly) : 0;
      // Reuse existing room id if same wall set
      const sig = [...loop].sort().join(",");
      const existing = prev.find((r: any) => [...(r.wallIds || [])].sort().join(",") === sig);
      const room: any = existing
        ? existing
        : {
            id: "room_" + Date.now().toString(36) + "_" + idx,
            name: undefined as string | undefined,
            wallIds: loop.slice(),
            areaPx2,
          };
      room.wallIds = loop.slice();
      room.areaPx2 = areaPx2;
      if (!room.name) room.name = "Room " + (nextRooms.length + 1);
      nextRooms.push(room);
      loop.forEach((id) => usedWalls.add(id));
    });

    // Clear roomId on walls no longer in a room; set on members
    (state.walls || []).forEach((w: any) => {
      if (!w) return;
      if (!w.id || !usedWalls.has(w.id)) w.roomId = null;
    });
    nextRooms.forEach((r: any) => {
      (r.wallIds || []).forEach((id: string) => {
        const w = (state.walls || []).find((x: any) => x && x.id === id);
        if (w) w.roomId = r.id;
      });
    });
    state.wallRooms = nextRooms;
    if (!opts?.skipLayerSync && typeof S.syncWallRoomsToLayerPanel === "function") {
      S.syncWallRoomsToLayerPanel();
    }
  };

  /** Commit one independent wall segment from drag-draw. */
  S.commitWallSegment = function commitWallSegment(a: any, b: any) {
    const ja = S.joinWallEndpoint(a);
    const jb = S.joinWallEndpoint(b);
    if (Math.hypot(jb.x - ja.x, jb.y - ja.y) < MIN_WALL_LEN) {
      S.showHint("Wall too short");
      return null;
    }
    const __b = S.vectorSnapshot();
    const wall: any = {
      pts: [
        { x: ja.x, y: ja.y },
        { x: jb.x, y: jb.y },
      ],
      thickMM: state.wallThickMM,
      heightM: state.wallHeightM,
      openings: [],
      bulge: 0,
      roomId: null,
    };
    S.ensureWallId(wall);
    const n = (state.walls || []).length + 1;
    wall.name = "Wall " + n;
    state.walls.push(wall);
    state.wallChainEnd = { x: jb.x, y: jb.y };
    S.reconcileWallRooms();
    S.refreshMeasurements();
    S.syncWallsToMasses();
    if (typeof S.registerWallInLayerPanel === "function") S.registerWallInLayerPanel(wall);
    if (typeof S.syncWallRoomsToLayerPanel === "function") S.syncWallRoomsToLayerPanel();
    S.recordVec(__b);
    S.scheduleAutosave();
    S.showHint(`Wall added · ${state.wallThickMM} mm × ${state.wallHeightM} m · drag next from end or Esc`);
    return wall;
  };

  S.beginWallDrag = function beginWallDrag(p: any, shiftKey?: boolean) {
    let start = p;
    if (state.wallChainEnd) {
      const d = Math.hypot(p.x - state.wallChainEnd.x, p.y - state.wallChainEnd.y);
      if (d < S.wallJoinTol() * 2) start = { x: state.wallChainEnd.x, y: state.wallChainEnd.y };
    }
    const s = S.snapVertex(start);
    if (s.snap) S.flashSnap(s.snap);
    start = S.joinWallEndpoint({ x: s.x, y: s.y });
    state.wallDrag = {
      start,
      current: { x: start.x, y: start.y },
      shift: !!shiftKey,
    };
    state.polyActive = false;
    state.polyPoints = [];
  };

  S.updateWallDrag = function updateWallDrag(p: any, shiftKey?: boolean) {
    const d = state.wallDrag;
    if (!d) return;
    d.shift = !!shiftKey;
    const end = S.snapWallDrawEnd(d.start, p, d.shift);
    if (end.snap) S.flashSnap(end.snap);
    d.current = { x: end.x, y: end.y };
    S.refreshWallDragOverlay();
  };

  S.endWallDrag = function endWallDrag() {
    const d = state.wallDrag;
    state.wallDrag = null;
    if (!d) return;
    const wall = S.commitWallSegment(d.start, d.current);
    S.refreshMeasurements();
    return wall;
  };

  S.cancelWallDrag = function cancelWallDrag() {
    state.wallDrag = null;
    state.wallChainEnd = null;
    S.refreshMeasurements();
  };

  S.refreshWallDragOverlay = function refreshWallDragOverlay() {
    // Reuse measurement overlay: draw preview segment on top of walls
    S.refreshMeasurements();
    const d = state.wallDrag;
    if (!d) return;
    const a = d.start,
      b = d.current;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 2) return;
    S._ovLine(a.x, a.y, b.x, b.y, "#a02835", 2, "6 4");
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const nx = -dy / len,
      ny = dx / len;
    const label = S.formatLen(len);
    const svgns = S._SVGNS;
    const g = document.createElementNS(svgns, "g");
    const lx = mid.x + nx * 28,
      ly = mid.y + ny * 28;
    const bg = document.createElementNS(svgns, "rect");
    const pw = label.length * 10 + 16;
    bg.setAttribute("x", String(lx - pw / 2));
    bg.setAttribute("y", String(ly - 12));
    bg.setAttribute("width", String(pw));
    bg.setAttribute("height", "22");
    bg.setAttribute("rx", "4");
    bg.setAttribute("fill", "#a02835");
    g.appendChild(bg);
    const t = document.createElementNS(svgns, "text");
    t.setAttribute("x", String(lx));
    t.setAttribute("y", String(ly + 4));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", "#fff");
    t.setAttribute("font-size", "13");
    t.setAttribute("font-family", "JetBrains Mono,monospace");
    t.textContent = label;
    g.appendChild(t);
    S.rulerOverlay.appendChild(g);
    // start/end dots
    [a, b].forEach((p: any) => {
      const c = document.createElementNS(svgns, "circle");
      c.setAttribute("cx", String(p.x));
      c.setAttribute("cy", String(p.y));
      c.setAttribute("r", "5");
      c.setAttribute("fill", "#a02835");
      S.rulerOverlay.appendChild(c);
    });
  };
}
