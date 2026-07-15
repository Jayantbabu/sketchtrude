/**
 * Phase 5 mop-up: ASI semis, complete bare→S. qualify, :any locals, window helpers.
 */
import fs from "node:fs";
import path from "node:path";

const APP = path.resolve("src/engine/app");

const FILES = [
  "stroke-input.ts",
  "massing.ts",
  "walls.ts",
  "persistence.ts",
  "host-bridge.ts",
  "shell.ts",
  "boot-sequence.ts",
];

const BARE = [
  "strokeCtx",
  "replayCtx",
  "gestureState",
  "mctx",
  "massingBar",
  "massPointers",
  "massPinch",
  "brushCursor",
  "faceEd",
  "massInspector",
  "MAT_PRESETS",
  "MAT_COLORS",
  "massing",
  "StudioHelpers",
  "feCanvas",
  "exportProjectDocument",
  "importProjectDocument",
  "subscribeToDocumentChanges",
  "hasUnsavedChanges",
  "getMutationVersion",
];

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

/** Qualify bare bag ids — skip only true decls and object keys / S. already. */
function qualifyBare(src, names) {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const re = new RegExp(`(?<![.\\w$])${name}\\b`, "g");
    src = src.replace(re, (match, offset) => {
      if (offset >= 2 && src.slice(offset - 2, offset) === "S.") return match;
      const before = src.slice(Math.max(0, offset - 48), offset);
      // declarations
      if (/\b(?:function|const|let|var|class|enum|interface|type)\s+$/.test(before)) return match;
      // object key `name:` (simple)
      let k = offset + match.length;
      while (k < src.length && /\s/.test(src[k])) k++;
      const prev = src.slice(Math.max(0, offset - 1), offset);
      if (src[k] === ":" && (prev === "{" || prev === "," || prev === "\n" || /\s/.test(prev))) {
        return match;
      }
      // function PARAM binding only: still inside `function foo(` … unclosed
      const slice = before.slice(-80);
      const fnRe = /\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\(/g;
      let m;
      let last = null;
      while ((m = fnRe.exec(slice))) last = m;
      if (last) {
        const after = slice.slice(last.index + last[0].length);
        let depth = 1;
        for (let i = 0; i < after.length; i++) {
          if (after[i] === "(") depth++;
          else if (after[i] === ")") {
            depth--;
            if (depth === 0) break;
          }
        }
        if (depth > 0) return match; // still in params
      }
      // Special: StudioHelpers → (window as any).StudioHelpers
      if (name === "StudioHelpers") return "(window as any).StudioHelpers";
      return "S." + match;
    });
  }
  return src
    .replace(/\bS\.S\./g, "S.")
    .replace(/\bS\.\(window as any\)\.StudioHelpers/g, "(window as any).StudioHelpers");
}

function fixAsi(src) {
  // After a function expression assignment closing `}`, insert `;` before `(window` / `[` / `$el` / `$all` that would ASI-call
  // Pattern: `  }\n\n  (window` or `  }\n  [` 
  src = src.replace(/\}\n(\n?)(\s*)(\(window as any\))/g, "};\n$1$2$3");
  src = src.replace(/\}\n(\n?)(\s*)(\[['\"][\w-]+['\"])/g, "};\n$1$2$3");
  // Also `}\n  $el(` / `$all(` at start of statement after bare function close — less common
  // Protect IIFE-like: `}(function` already has ASI issues rarely
  // Deduplicate `};};`
  src = src.replace(/\};(\s*)\};/g, "};$1}");
  // Don't turn block closes inside if/else into `};` incorrectly — the patterns above are specific
  return src;
}

function annotateLocals(src) {
  src = src.replace(/\bconst faces = \[\]/g, "const faces: any[] = []");
  src = src.replace(/\bconst frontHoles = \[\]/g, "const frontHoles: any[] = []");
  src = src.replace(/\bconst backHoles = \[\]/g, "const backHoles: any[] = []");
  src = src.replace(/\bconst out = \[\]/g, "const out: any[] = []");
  src = src.replace(/\blet resizeTimer;/g, "let resizeTimer: any;");
  src = src.replace(/\blet resizeTimer =/g, "let resizeTimer: any =");
  src = src.replace(/\blet N;/g, "let N: any;");
  src = src.replace(/\blet N =/g, "let N: any =");
  src = src.replace(/\blet cloudSaved = null, localSaved = null;/g, "let cloudSaved: any = null, localSaved: any = null;");
  // pinch / Map value unknowns
  src = src.replace(/S\.activePointers = new Map\(\)/g, "S.activePointers = new Map<any, any>()");
  src = src.replace(/S\.massPointers = new Map\(\)/g, "S.massPointers = new Map<any, any>()");
  return src;
}

function fixNullables(src) {
  src = src.replace(
    /S\.gridCanvas\.width = S\.doc\.wPx; S\.gridCanvas\.height = S\.doc\.hPx;/g,
    "(S.gridCanvas as any).width = S.doc.wPx; (S.gridCanvas as any).height = S.doc.hPx;",
  );
  src = src.replace(
    /S\.gridCanvas\.width = S\.doc\.wPx;\s*S\.gridCanvas\.height = S\.doc\.hPx;/g,
    "(S.gridCanvas as any).width = S.doc.wPx; (S.gridCanvas as any).height = S.doc.hPx;",
  );
  // err.message on unknown
  src = src.replace(
    /\(err && err\.message\) \? err\.message : String\(err\)/g,
    `(err && (err as any).message) ? (err as any).message : String(err)`,
  );
  // labels[state.symmetryAxis]
  src = src.replace(
    /labels\[state\.symmetryAxis\]/g,
    "(labels as any)[state.symmetryAxis]",
  );
  // typeof S.xxx checks that are always true for functions — leave; fix if reported
  // blob assignment
  src = src.replace(/let blob = null;/g, "let blob: any = null;");
  src = src.replace(/let blob: null = null;/g, "let blob: any = null;");
  // img.complete on union
  src = src.replace(/\.complete\b/g, (m, offset, whole) => {
    // Only when used on stroke/image fill path — cast the receiver if needed is harder;
    // surgical later
    return m;
  });
  return src;
}

function fixMassingSpecific(src) {
  // glass/leaf index
  src = src.replace(
    /faces\.push\(\{ bi, id: `\$\{bi\}-\$\{oi\}-\$\{side\}`, pts, n: f\.n, depth: S\._avgDepth\(pts\), selected: bi === S\.massing\.selected, \[side\]: true \}\);/,
    (full) => full, // leave; surgical below
  );
  // window._closeMassMenus
  src = src.replace(/window\._closeMassMenus/g, "(window as any)._closeMassMenus");
  // massing shorthand that become S.massing wrongly on object keys handled already
  // sh.rx possibly undefined
  src = src.replace(/sh\.rx/g, "(sh as any).rx");
  src = src.replace(/sh\.ry/g, "(sh as any).ry");
  // HINTS[tool] index
  src = src.replace(
    /const HINTS = \{/,
    "const HINTS: Record<string, string> = {",
  );
  // binding elements in forEach
  src = src.replace(
    /MAT_PRESETS\.forEach\(\(\[name, mat\]\)/g,
    "S.MAT_PRESETS.forEach(([name, mat]: any)",
  );
  src = src.replace(
    /S\.MAT_PRESETS\.forEach\(\(\[name, mat\]\)/g,
    "S.MAT_PRESETS.forEach(([name, mat]: any)",
  );
  src = src.replace(
    /MAT_COLORS\.forEach\(\(\[name, hex\]\)/g,
    "S.MAT_COLORS.forEach(([name, hex]: any)",
  );
  src = src.replace(
    /S\.MAT_COLORS\.forEach\(\(\[name, hex\]\)/g,
    "S.MAT_COLORS.forEach(([name, hex]: any)",
  );
  // fix double S on MAT after qualify
  src = src.replace(/S\.S\.MAT_/g, "S.MAT_");
  // drawGroundImage(mctx) leftover
  src = src.replace(/S\.drawGroundImage\(mctx\)/g, "S.drawGroundImage(S.mctx)");
  src = src.replace(/S\.drawFaceArt\(mctx,/g, "S.drawFaceArt(S.mctx,");
  src = src.replace(/S\.renderFaceRegions\(mctx,/g, "S.renderFaceRegions(S.mctx,");
  // Inside renderFaceRegions body, mctx param should be used — we over-qualified to S.mctx which is OK
  // pushWall openings side key
  src = src.replace(
    /\[side\]: true/g,
    "...({ [side]: true } as any)",
  );
  // maybe broken — check original: `{ ..., [side]: true }`
  // Better:
  return src;
}

function fixPersistenceChecks(src) {
  // `if (S.saveDoc)` style always-true — these might be `if (S._lastDocPayload` etc.
  // Error: condition will always return true since this function is always defined
  // lines 118, 128 — probably `if (S.notifyAutosaveWaiters)` without call, or typeof without
  return src;
}

function fixStrokeSpecific(src) {
  // leftover bare strokeCtx / gestureState
  src = src.replace(/(?<![.\w$])strokeCtx\b/g, "S.strokeCtx");
  src = src.replace(/(?<![.\w$])gestureState\b/g, "S.gestureState");
  src = src.replace(/(?<![.\w$])replayCtx\b/g, "S.replayCtx");
  src = src.replace(/\bS\.S\./g, "S.");
  // activePointers values — cast pts
  src = src.replace(
    /const pts = Array\.from\(S\.activePointers\.values\(\)\);/g,
    "const pts: any[] = Array.from(S.activePointers.values());",
  );
  // pinchStart typed as any
  src = src.replace(
    /state\.pinchStart = \{/g,
    "state.pinchStart = {",
  );
  // Force pinchStart as any access — annotate assignments
  src = src.replace(
    /state\.pinchStart\b/g,
    "(state.pinchStart as any)",
  );
  // But assignment `(state.pinchStart as any) =` is invalid
  src = src.replace(/\(state\.pinchStart as any\) =/g, "state.pinchStart =");
  // line tool comparison — cast
  src = src.replace(
    /state\.tool === 'line'/g,
    "(state.tool as any) === 'line'",
  );
  // image complete
  src = src.replace(
    /(\w+)\.complete\b/g,
    "($1 as any).complete",
  );
  // undo over-cast on randomly matched
  src = src.replace(/\(S\.strokeCanvas as any\)\.complete/g, "S.strokeCanvas"); // unlikely
  src = src.replace(/\(\(([a-zA-Z_$][\w$]*) as any\) as any\)\.complete/g, "($1 as any).complete");
  // stroke/drawing local refs
  src = src.replace(
    /state\.drawingRef\b/g,
    "(state.drawingRef as any)",
  );
  src = src.replace(/\(state\.drawingRef as any\) =/g, "state.drawingRef =");
  // poly / shape state bags often `{}`
  src = src.replace(/state\.ruler\b/g, "(state.ruler as any)");
  src = src.replace(/\(state\.ruler as any\) =/g, "state.ruler =");
  return src;
}

for (const f of FILES) {
  patch(f, (s) => {
    s = qualifyBare(s, BARE);
    s = fixAsi(s);
    s = annotateLocals(s);
    s = fixNullables(s);
    if (f === "massing.ts" || f === "walls.ts") s = fixMassingSpecific(s);
    if (f === "stroke-input.ts") s = fixStrokeSpecific(s);
    if (f === "shell.ts") {
      s = s.replace(/(?<![.\w$])brushCursor\b/g, "S.brushCursor").replace(/\bS\.S\./g, "S.");
    }
    // StudioHelpers window path
    s = s.replace(/window\.StudioHelpers/g, "(window as any).StudioHelpers");
    s = s.replace(/\?\s*StudioHelpers\./g, "? (window as any).StudioHelpers.");
    s = s.replace(/: StudioHelpers\./g, ": (window as any).StudioHelpers.");
    // Fix broken `[side]` expansion if any
    s = s.replace(
      /\.\.\.\(\{ \[side\]: true \} as any\)/g,
      "...({ [side]: true } as any)",
    );
    return s;
  });
}

console.log("phase5 mop done");
