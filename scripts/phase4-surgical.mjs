import fs from "node:fs";
import path from "node:path";

const APP = path.resolve("src/engine/app");

function patch(rel, fn) {
  const p = path.join(APP, rel);
  const orig = fs.readFileSync(p, "utf8");
  const next = fn(orig);
  if (next !== orig) {
    fs.writeFileSync(p, next);
    console.log("patched", rel);
  } else {
    console.log("unchanged", rel);
  }
}

patch("chrome.ts", (s) =>
  s.replace(
    "    const ctx = S.gridCtx;\n    ctx.clearRect",
    "    const ctx: any = S.gridCtx;\n    ctx.clearRect",
  ),
);

patch("features/rooms.ts", (s) => {
  s = s.replace(
    "    const wall = { pts, thickMM: state.wallThickMM, heightM: state.wallHeightM };",
    "    const wall: any = { pts, thickMM: state.wallThickMM, heightM: state.wallHeightM };",
  );
  s = s.replace("    const saved = {};", "    const saved: any = {};");
  s = s.replace(
    "        const mass = { poly: S.wallSegPoly(a, b, tW), h: (w.heightM || 3), _wall: true, _fromWall: true, _wallKey: wi + ':' + i };",
    "        const mass: any = { poly: S.wallSegPoly(a, b, tW), h: (w.heightM || 3), _wall: true, _fromWall: true, _wallKey: wi + ':' + i };",
  );
  s = s.replace(
    "    const o = w.openings[sel.idx]; if (!o) return;\n    const a = w.pts[o.seg], b = w.pts[o.seg + 1];",
    "    const o: any = w.openings?.[sel.idx]; if (!o) return;\n    const a = w.pts[o.seg], b = w.pts[o.seg + 1];",
  );
  // querySelector results → any via $qs isn't available for el.querySelector
  s = s.replace(/el\.querySelector\(/g, "(el.querySelector as any)(");
  // That makes (el.querySelector as any)('#x') — good
  // Also S._wall2dPaletteEl.querySelector
  s = s.replace(
    /S\._wall2dPaletteEl\.querySelector\(/g,
    "(S._wall2dPaletteEl.querySelector as any)(",
  );
  s = s.replace(
    /S\._openPaletteEl\.querySelector\(/g,
    "(S._openPaletteEl.querySelector as any)(",
  );
  return s;
});

patch("fill.ts", (s) => {
  s = s.replace(
    "    const cx = c.getContext('2d', { willReadFrequently: true });",
    "    const cx: any = c.getContext('2d', { willReadFrequently: true });",
  );
  s = s.replace(
    "    const t = state.fillTextures[state.fillTexIndex];\n    return (t && t.img && t.img.complete) ? t.img : null;",
    "    const t: any = state.fillTextures[state.fillTexIndex as any];\n    return (t && t.img && t.img.complete) ? t.img : null;",
  );
  s = s.replace(
    /state\.fillTexIndex == null/g,
    "(state.fillTexIndex as any) == null",
  );
  // remaining fillTexIndex comparisons in paint code
  s = s.replace(
    /state\.fillTexIndex(?!\s+as)/g,
    "(state.fillTexIndex as any)",
  );
  return s;
});

patch("measure.ts", (s) => {
  s = s.replace(
    "    const hit = document.elementFromPoint(clientX, clientY);\n    if (!hit || !S.rulerOverlay.contains(hit)) return false;\n    const raw = hit.dataset ? hit.dataset.measureIdx : null;",
    "    const hit: any = document.elementFromPoint(clientX, clientY);\n    if (!hit || !S.rulerOverlay.contains(hit)) return false;\n    const raw = hit.dataset ? hit.dataset.measureIdx : null;",
  );
  s = s.replace(
    "    const midX = (state.pendingScaleStart.x + state.pendingScaleEnd.x) / 2;\n    const midY = (state.pendingScaleStart.y + state.pendingScaleEnd.y) / 2;",
    "    const midX = ((state.pendingScaleStart as any).x + (state.pendingScaleEnd as any).x) / 2;\n    const midY = ((state.pendingScaleStart as any).y + (state.pendingScaleEnd as any).y) / 2;",
  );
  s = s.replace(
    "    const v = parseFloat(document.getElementById('scale-length').value);\n    const u = $el('scale-unit').value;",
    "    const v = parseFloat($el('scale-length').value);\n    const u = $el('scale-unit').value;",
  );
  s = s.replace(
    "    const dx = state.pendingScaleEnd.x - state.pendingScaleStart.x;\n    const dy = state.pendingScaleEnd.y - state.pendingScaleStart.y;",
    "    const dx = (state.pendingScaleEnd as any).x - (state.pendingScaleStart as any).x;\n    const dy = (state.pendingScaleEnd as any).y - (state.pendingScaleStart as any).y;",
  );
  return s;
});

patch("stencils.ts", (s) =>
  s
    .replace(
      "      const hatch = S.hatchList()[state.selectedStencil];",
      "      const hatch = S.hatchList()[state.selectedStencil as any];",
    )
    .replace(
      "    const stencil = S.currentStencilList()[state.selectedStencil];",
      "    const stencil = S.currentStencilList()[state.selectedStencil as any];",
    ),
);

patch("tool-ui.ts", (s) => {
  s = s.replace("      let lp;", "      let lp: any;");
  s = s.replace("    const grouped = {};", "    const grouped: any = {};");
  s = s.replace(
    "          last = { x: sx, y: sy };",
    "          last = { x: sx, y: sy, pressure: p.pressure };",
  );
  s = s.replace(
    "    for (const file of files) {\n      const lower = file.name.toLowerCase();",
    "    for (const file of files as any[]) {\n      const lower = file.name.toLowerCase();",
  );
  s = s.replace("    const entries = [];", "    const entries: any[] = [];");
  return s;
});

console.log("surgical done");
