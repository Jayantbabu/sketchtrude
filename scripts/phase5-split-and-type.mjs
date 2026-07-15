/**
 * Phase 5: split walls / host-bridge, strip @ts-nocheck, qualify bare S refs,
 * annotate params, inject $el helpers (same technique as Phases 3–4).
 */
import fs from "node:fs";
import path from "node:path";

const APP = path.resolve("src/engine/app");

function read(name) {
  return fs.readFileSync(path.join(APP, name), "utf8");
}

function write(name, content) {
  const p = path.join(APP, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("wrote", name, `(${content.split(/\n/).length} lines)`);
}

const BARE_TO_S = [
  "strokeCtx",
  "replayCtx",
  "gestureState",
  "mctx",
  "massingBar",
  "massPointers",
  "massPinch",
  "brushCursor",
  "exportProjectDocument",
  "importProjectDocument",
  "subscribeToDocumentChanges",
  "hasUnsavedChanges",
  "getMutationVersion",
];

function qualifyBare(src, names) {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const re = new RegExp(`(?<![.\\w$])${name}\\b`, "g");
    src = src.replace(re, (match, offset) => {
      if (offset >= 2 && src.slice(offset - 2, offset) === "S.") return match;
      let k = offset + match.length;
      while (k < src.length && /\s/.test(src[k])) k++;
      const prev = src.slice(Math.max(0, offset - 1), offset);
      if (src[k] === ":" && (prev === "{" || prev === "," || prev === "\n" || /\s/.test(prev))) {
        return match;
      }
      const before = src.slice(Math.max(0, offset - 40), offset);
      if (/\b(?:function|const|let|var)\s+$/.test(before)) return match;
      // Skip function/arrow param bindings: `function foo(mctx` or `(mctx,`
      if (/\bfunction(?:\s+\w+)?\s*\([^)]*$/.test(before)) return match;
      if (/\([^)]*$/.test(before) && /,\s*$|\(\s*$/.test(before.slice(-8))) {
        // Likely still inside paren list — be careful with mctx params
        const open = before.lastIndexOf("(");
        const close = before.lastIndexOf(")");
        if (open > close) return match;
      }
      return "S." + match;
    });
  }
  return src.replace(/\bS\.S\./g, "S.");
}

function annotateFnParams(src) {
  return src.replace(
    /\bfunction(\s+\w+)?\s*\(([^)]*)\)/g,
    (full, namePart, params) => {
      if (!params.trim()) return full;
      const typed = params
        .split(",")
        .map((p) => {
          const t = p.trim();
          if (!t || t.startsWith("...") || t.startsWith("{") || t.startsWith("[")) return t;
          if (/:\s*/.test(t.split("=")[0])) return t;
          const eq = t.indexOf("=");
          if (eq >= 0) {
            const left = t.slice(0, eq).trim();
            return `${left}: any ${t.slice(eq)}`;
          }
          return `${t}: any`;
        })
        .join(", ");
      return `function${namePart || ""}(${typed})`;
    },
  );
}

function annotateParenArrows(src) {
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

function annotateBareArrows(src) {
  return src.replace(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*=>/g, (full, id) => {
    if (id === "any") return full;
    return `(${id}: any) =>`;
  });
}

function castGetContext(src) {
  return src
    .replace(/\.getContext\(('2d'|"2d")\)(?!\s+as)/g, ".getContext($1) as any")
    .replace(/\.getContext\(('2d'|"2d")\) as any as any/g, ".getContext($1) as any");
}

function injectHelpers(src) {
  if (src.includes("const $el = ")) return src;
  return src.replace(
    /(export function init\w+\(\) \{\n  const state = S\.state;\n)/,
    `$1\n  const $el = (id: string): any => document.getElementById(id);\n  const $all = (sel: string): any => document.querySelectorAll(sel);\n  const $qs = (sel: string): any => document.querySelector(sel);\n\n`,
  );
}

function replaceDomLookups(src) {
  // Prefer $el over casts to avoid ASI issues
  src = src.replace(/document\.getElementById\(([^)]+)\)/g, "$el($1)");
  src = src.replace(/document\.querySelectorAll\(([^)]+)\)/g, "$all($1)");
  // querySelector — careful not to replace el.querySelector
  src = src.replace(/(?<![\w$])document\.querySelector\(([^)]+)\)/g, "$qs($1)");
  return src;
}

function fixWindowGlobals(src) {
  return src
    .replace(/window\.__SKETCHTRUDE_PROJECT_ID/g, "(window as any).__SKETCHTRUDE_PROJECT_ID")
    .replace(/window\.__SKETCHTRUDE_PROJECT_CONFIG/g, "(window as any).__SKETCHTRUDE_PROJECT_CONFIG")
    .replace(/window\.sketchtrudeEngine/g, "(window as any).sketchtrudeEngine")
    .replace(/\(window as any\) as any/g, "(window as any)");
}

function typeModule(src) {
  let s = src.replace(/^\/\/ @ts-nocheck\r?\n/, "");
  s = qualifyBare(s, BARE_TO_S);
  s = injectHelpers(s);
  s = replaceDomLookups(s);
  s = castGetContext(s);
  s = annotateFnParams(s);
  s = annotateParenArrows(s);
  s = annotateBareArrows(s);
  s = fixWindowGlobals(s);
  s = s.replace(/: any: any/g, ": any");
  s = s.replace(/\bS\.S\./g, "S.");
  // Don't rewrite $el / $all / $qs helpers' bodies
  s = s.replace(
    /const \$el = \(id: string\): any => \$el\(id\);/g,
    "const $el = (id: string): any => document.getElementById(id);",
  );
  s = s.replace(
    /const \$all = \(sel: string\): any => \$all\(sel\);/g,
    "const $all = (sel: string): any => document.querySelectorAll(sel);",
  );
  s = s.replace(
    /const \$qs = \(sel: string\): any => \$qs\(sel\);/g,
    "const $qs = (sel: string): any => document.querySelector(sel);",
  );
  return s;
}

// ─── Split walls from massing ─────────────────────────────────────
{
  const raw = read("massing.ts");
  const lines = raw.split(/\n/);
  const iWall = lines.findIndex((l) => l.includes("===================== WALL tool"));
  const iChip = lines.findIndex((l) => l.includes("floating Fill · Extrude chip") || l.includes("floating Fill"));
  if (iWall < 0 || iChip < 0) {
    throw new Error(`walls markers not found: wall=${iWall} chip=${iChip}`);
  }
  const iClose = lines.length - 1; // final `}` of initMassing

  const header = lines.slice(0, 6); // through const state
  // Find end of helpers insert point — after `const state = S.state;`
  const iState = lines.findIndex((l) => l.includes("const state = S.state"));

  const beforeWall = lines.slice(iState + 1, iWall);
  const wallBody = lines.slice(iWall, iChip);
  const afterWall = lines.slice(iChip, iClose);

  let wallsTs =
    `/* Wall / opening tool helpers — shared scope S */\n` +
    `import { S } from "./scope";\n\n` +
    `export function initWalls() {\n` +
    `  const state = S.state;\n\n` +
    wallBody.join("\n") +
    `\n}\n`;

  let massingTs =
    lines.slice(0, iState + 1).join("\n") +
    "\n" +
    beforeWall.join("\n") +
    "\n\n  initWalls();\n\n" +
    afterWall.join("\n") +
    "\n}\n";

  // Add import for initWalls
  massingTs = massingTs.replace(
    `import { S } from "./scope";`,
    `import { S } from "./scope";\nimport { initWalls } from "./walls";`,
  );

  wallsTs = typeModule(wallsTs);
  massingTs = typeModule(massingTs);
  write("walls.ts", wallsTs);
  write("massing.ts", massingTs);
}

// ─── Split host-bridge from persistence ───────────────────────────
{
  const raw = read("persistence.ts");
  const lines = raw.split(/\n/);

  // Markers
  const iRestore = lines.findIndex((l) => l.includes("S.restoreSession = async function restoreSession"));
  const iScaleSync = lines.findIndex((l) => l.includes("S._scaleSyncTimer = null"));
  const iClose = lines.length - 1;

  // Early host pings (postContentReady / postEngineReady) — move with bridge
  const iPostContent = lines.findIndex((l) => l.includes("S.postContentReady = function postContentReady"));
  const iAutosaveWaiters = lines.findIndex((l) => l.includes("S._autosaveWaiters = []"));

  if (iRestore < 0 || iScaleSync < 0 || iPostContent < 0 || iAutosaveWaiters < 0) {
    throw new Error(
      `persistence markers missing: restore=${iRestore} scale=${iScaleSync} post=${iPostContent} waiters=${iAutosaveWaiters}`,
    );
  }

  // Build host-bridge body:
  // 1) postContentReady + postEngineReady (iPostContent .. iAutosaveWaiters)
  // 2) restoreSession through message listener (iRestore .. iScaleSync)
  const postReadyBlock = lines.slice(iPostContent, iAutosaveWaiters);
  const bridgeMain = lines.slice(iRestore, iScaleSync);

  let hostTs =
    `/* Host postMessage / import-export bridge — shared scope S */\n` +
    `import { S } from "./scope";\n\n` +
    `export function initHostBridge() {\n` +
    `  const state = S.state;\n\n` +
    postReadyBlock.join("\n") +
    "\n" +
    bridgeMain.join("\n") +
    `\n}\n`;

  // persistence: remove postReady block and bridgeMain; call initHostBridge before scale sync
  const persistHead = lines.slice(0, iPostContent);
  const persistMid = lines.slice(iAutosaveWaiters, iRestore);
  const persistTail = lines.slice(iScaleSync, iClose);

  let persistTs =
    persistHead.join("\n") +
    "\n" +
    persistMid.join("\n") +
    "\n\n  initHostBridge();\n\n" +
    persistTail.join("\n") +
    "\n}\n";

  persistTs = persistTs.replace(
    `import { S } from "./scope";`,
    `import { S } from "./scope";\nimport { initHostBridge } from "./host-bridge";`,
  );

  hostTs = typeModule(hostTs);
  persistTs = typeModule(persistTs);
  write("host-bridge.ts", hostTs);
  write("persistence.ts", persistTs);
}

// ─── Type remaining nocheck modules ───────────────────────────────
for (const name of ["stroke-input.ts", "shell.ts", "boot-sequence.ts"]) {
  write(name, typeModule(read(name)));
}

console.log("phase5 split+type done");
