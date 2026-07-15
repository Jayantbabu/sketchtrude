/**
 * Fix ASI/IIFE breakage from (document.getElementById…) casts, add $el helpers,
 * and mop up remaining Phase-4 tsc issues.
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

const HELPERS = `  const $el = (id: string): any => document.getElementById(id);\n  const $all = (sel: string): any => document.querySelectorAll(sel);\n  const $qs = (sel: string): any => document.querySelector(sel);\n`;

function injectHelpers(src) {
  if (src.includes("const $el = ")) return src;
  return src.replace(
    /(export function init\w+\(\) \{\n  const state = S\.state;\n)/,
    `$1\n${HELPERS}`,
  );
}

function replaceDomCasts(src) {
  src = src.replace(/\(document\.getElementById\(([^)]+)\) as any\)/g, "$el($1)");
  src = src.replace(/\(document\.querySelectorAll\(([^)]+)\) as any\)/g, "$all($1)");
  src = src.replace(/\(document\.querySelector\(([^)]+)\) as any\)/g, "$qs($1)");
  // leftover unwrapped casts
  src = src.replace(/document\.getElementById\(([^)]+)\) as any/g, "$el($1)");
  src = src.replace(/document\.querySelectorAll\(([^)]+)\) as any/g, "$all($1)");
  src = src.replace(/document\.querySelector\(([^)]+)\) as any/g, "$qs($1)");
  return src;
}

function fixSetAttributeNumbers(src) {
  // path.setAttribute('foo', numberExpr) → String(numberExpr) when second arg isn't already stringy
  return src.replace(
    /\.setAttribute\(\s*('(?:stroke-width|opacity|cx|cy|r|x|y|x1|y1|x2|y2|width|height|font-size|dx|dy|rx|ry)'|"[^"]+")\s*,\s*([^)]+)\)/g,
    (full, attr, val) => {
      const v = val.trim();
      if (v.startsWith("String(") || v.startsWith("`") || v.startsWith("'") || v.startsWith('"')) {
        return full;
      }
      // already concatenated to string
      if (v.includes("+") && (v.includes("'") || v.includes('"'))) return full;
      return `.setAttribute(${attr}, String(${v}))`;
    },
  );
}

function fixMisc(src, rel) {
  // hintTimer
  src = src.replace(/let hintTimer;/g, "let hintTimer: any;");
  src = src.replace(/let hintTimer =/g, "let hintTimer: any =");

  // best / brushModal
  src = src.replace(/\blet best;/g, "let best: any;");
  src = src.replace(/\blet best =/g, "let best: any =");
  src = src.replace(/(?<![.\w$])brushModal\b/g, "S.brushModal");
  src = src.replace(/\bS\.S\./g, "S.");

  // StudioHelpers — always go through (window as any)
  src = src.replace(/window\.StudioHelpers/g, "(window as any).StudioHelpers");

  // gridCanvas / ctx nullables in chrome
  src = src.replace(/S\.gridCanvas = \$el\(/g, "S.gridCanvas = $el(");
  src = src.replace(/S\.gridCtx = S\.gridCanvas\.getContext/g, "S.gridCtx = (S.gridCanvas as any).getContext");
  src = src.replace(/\bS\.gridCanvas\./g, "(S.gridCanvas as any).");
  // undo over-cast
  src = src.replace(/\(S\.gridCanvas as any\) as any/g, "(S.gridCanvas as any)");

  // fileInputHatch etc.
  src = src.replace(/S\.fileInputHatch\./g, "(S.fileInputHatch as any).");

  // createElementNS setAttribute already handled

  // window project id
  src = src.replace(
    /window\.__SKETCHTRUDE_PROJECT_ID/g,
    "(window as any).__SKETCHTRUDE_PROJECT_ID",
  );

  // ctx nullables: const ctx = ...getContext → as any already; also `let ctx =`
  src = src.replace(
    /const ctx = (S\.gridCtx|gc\.getContext\([^)]+\) as any|[^;]+getContext\([^)]+\) as any);/g,
    (m) => m,
  );

  // Explicit: S.gridCtx usages that are possibly null — cast
  if (rel === "chrome.ts") {
    src = src.replace(
      /S\.drawDocGrid = function drawDocGrid\(\) \{\n    const ctx = S\.gridCtx;/,
      "S.drawDocGrid = function drawDocGrid() {\n    const ctx: any = S.gridCtx;",
    );
  }

  // fill cx possibly null
  src = src.replace(
    /const cx = ([^;]+)\.getContext\('2d'\) as any;/g,
    "const cx: any = $1.getContext('2d') as any;",
  );

  // rooms destructuring
  src = src.replace(
    /\.forEach\(\(\{ m, i \}\)/g,
    ".forEach(({ m, i }: any)",
  );
  src = src.replace(
    /\.map\(\(\{ m, i \}\)/g,
    ".map(({ m, i }: any)",
  );

  // Mass / wall object literals typed narrowly — cast pushes as any
  src = src.replace(
    /S\.massing\.masses\.push\(\{/g,
    "S.massing.masses.push({",
  );

  return src;
}

function ensureSemicolonsBeforeCallish(src) {
  // After `}` closing a function assigned to S.x = function...}  before '(' or '['
  // Safer: insert ; before statement-level $el( / $all( / $qs( / ['
  // that immediately follow a closing brace line
  return src.replace(/\}\n(\s*)(\$el\(|\$all\(|\$qs\(|\[')/g, "};\n$1$2");
}

for (const rel of FILES) {
  const p = path.join(APP, rel);
  let s = fs.readFileSync(p, "utf8");
  s = injectHelpers(s);
  s = replaceDomCasts(s);
  s = fixSetAttributeNumbers(s);
  s = fixMisc(s, rel);
  s = ensureSemicolonsBeforeCallish(s);
  // cleanup double semicolons
  s = s.replace(/;;+/g, ";");
  fs.writeFileSync(p, s);
  console.log("fixed", rel);
}

console.log("final fix done");
