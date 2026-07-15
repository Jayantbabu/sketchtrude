/**
 * Fix broken section comments from the split, and annotate arrow params with `: any`.
 */
import fs from "node:fs";
import path from "node:path";

const APP = path.resolve("src/engine/app");

const FILES = [
  "measure.ts",
  "stencils.ts",
  "color.ts",
  "fill.ts",
  "tool-ui.ts",
  "selection.ts",
  "chrome.ts",
  "features/snap.ts",
  "features/hatch.ts",
  "features/rooms.ts",
  "features/dimensions.ts",
  "features/guides.ts",
];

const FEATURE_HEADERS = {
  "features/snap.ts": "FEATURE 1 — ORTHOGONAL SNAP (Shift key)",
  "features/hatch.ts": "FEATURE 2 — MATERIAL HATCHING STENCILS",
  "features/rooms.ts": "FEATURE 3 — ROOM AREA POLYGON",
  "features/dimensions.ts": "FEATURE 4 — ARCHITECTURAL DIMENSION CHAIN",
  "features/guides.ts": "FEATURE 5 — PERSPECTIVE / ISOMETRIC GUIDE GRID",
};

function annotateArrows(src) {
  // (e) =>  / (a, b) =>  / (a, b, c) => — skip already typed, skip destructuring
  return src.replace(/\(([^()=]+)\)\s*=>/g, (full, params) => {
    const trimmed = params.trim();
    if (!trimmed) return full;
    if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith("...")) return full;
    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    const typed = parts
      .map((p) => {
        if (p.startsWith("...") || p.startsWith("{") || p.startsWith("[")) return p;
        const base = p.split("=")[0].trim();
        if (base.includes(":")) return p;
        if (p.includes("=")) {
          const [left, ...rest] = p.split("=");
          return `${left.trim()}: any=${rest.join("=")}`;
        }
        return `${p}: any`;
      })
      .join(", ");
    return `(${typed}) =>`;
  });
}

function annotateForEachLambdas(src) {
  // forEach((m, i) => already handled by annotateArrows
  // tile: (ctx, tileW, tileH) => also handled
  return src;
}

function fixFeatureHeader(name, src) {
  const label = FEATURE_HEADERS[name];
  if (!label) return src;
  // Replace broken mid-comment start with full block
  const broken = new RegExp(
    `\\n\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n\\s*={3,}\\s*\\*/`,
  );
  const fixed = `\n  /* =================================================================\n     ${label}\n     ================================================================= */`;
  if (broken.test(src)) return src.replace(broken, fixed);
  return src;
}

function fixPatchHeader(src) {
  // hatch has: `  /* =================================================================\n\n     PATCH: ...`
  // or broken without open. Normalize:
  return src.replace(
    /\n\s*\/\* ={3,}\s*\n\s*\n\s*PATCH:/,
    `\n  /* =================================================================\n     PATCH:`,
  ).replace(
    /\n\s*PATCH: Hatch stencils into stencil system \+ area-aware measurement render\s*\n\s*={3,}\s*\*\//,
    `\n  /* =================================================================\n     PATCH: Hatch stencils into stencil system + area-aware measurement render\n     ================================================================= */`,
  );
}

function castDomGets(src) {
  // document.getElementById(...).style / .classList often need null assertions —
  // Phase 3 used : any on params; for getElementById chain errors we cast as any
  // Only if tsc complains — skip for now
  return src;
}

for (const rel of FILES) {
  const p = path.join(APP, rel);
  let src = fs.readFileSync(p, "utf8");
  src = fixFeatureHeader(rel, src);
  if (rel === "features/hatch.ts") src = fixPatchHeader(src);
  src = annotateArrows(src);
  src = annotateForEachLambdas(src);
  // Double-annotate guard: `: any: any` cleanup
  src = src.replace(/: any: any/g, ": any");
  fs.writeFileSync(p, src);
  console.log("fixed", rel);
}

console.log("done");
