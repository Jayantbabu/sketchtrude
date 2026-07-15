#!/usr/bin/env node
/**
 * One-shot converter: public/engine/app/*.js → src/engine/app/*.ts
 * Uses a shared mutable scope object (S) so classic-script globals become ESM.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcApp = path.join(root, "src/engine/app");
const pubApp = path.join(root, "public/engine/app");

fs.mkdirSync(srcApp, { recursive: true });
fs.mkdirSync(path.join(srcApp, "features"), { recursive: true });

const FILES = [
  { js: "01-state.js", ts: "state-init.ts", init: "initState" },
  { js: "02-viewport.js", ts: "viewport.ts", init: "initViewport" },
  { js: "03-layers.js", ts: "layers.ts", init: "initLayers" },
  { js: "04-stroke-input.js", ts: "stroke-input.ts", init: "initStrokeInput" },
  { js: "05-measure-stencils.js", ts: "measure-stencils.ts", init: "initMeasureStencils" },
  { js: "06-tool-ui.js", ts: "tool-ui.ts", init: "initToolUi" },
  { js: "07-selection-chrome.js", ts: "selection-chrome.ts", init: "initSelectionChrome" },
  { js: "08-features.js", ts: "features.ts", init: "initFeatures" },
  { js: "09-massing.js", ts: "massing.ts", init: "initMassing" },
  { js: "10-shell.js", ts: "shell.ts", init: "initShell" },
  { js: "11-persistence.js", ts: "persistence.ts", init: "initPersistence" },
  { js: "12-boot.js", ts: "boot-sequence.ts", init: "initBootSequence" },
];

function stripHeader(src) {
  // Remove our mechanical-split header if present
  return src.replace(
    /^\/\* =+\r?\n\s*SketchTrude engine[^*]*\*\/\r?\n*/m,
    ""
  );
}

function collectTopLevelNames(src) {
  const names = new Set();
  const lines = src.split(/\r?\n/);
  for (const line of lines) {
    let m = line.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) names.add(m[1]);
    m = line.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
    if (m) names.add(m[1]);
  }
  return names;
}

/** Rewrite top-level function/const declarations onto S. */
function hoistToScope(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // async function foo( → S.foo = async function foo(
    let m = line.match(/^(async\s+function)\s+([A-Za-z_$][\w$]*)(\s*\()/);
    if (m) {
      out.push(`S.${m[2]} = ${m[1]} ${m[2]}${m[3]}${line.slice(m[0].length)}`);
      continue;
    }
    m = line.match(/^(function)\s+([A-Za-z_$][\w$]*)(\s*\()/);
    if (m) {
      out.push(`S.${m[2]} = ${m[1]} ${m[2]}${m[3]}${line.slice(m[0].length)}`);
      continue;
    }

    // const/let/var name = → S.name =
    // Skip: already-scoped imports, and class
    m = line.match(/^(const|let|var)\s+([A-Za-z_$][\w$]*)(\s*=)/);
    if (m) {
      out.push(`S.${m[2]}${m[3]}${line.slice(m[0].length)}`);
      continue;
    }

    out.push(line);
  }
  return out.join("\n");
}

/** Replace bare references to hoisted names with S.name (outside strings). */
function rewriteRefs(src, names) {
  // Sort longer names first to avoid partial replacements
  const list = [...names].sort((a, b) => b.length - a.length);
  // Skip names that are too dangerous / short / keywords
  const skip = new Set([
    "if", "for", "while", "switch", "return", "throw", "try", "catch",
    "new", "this", "true", "false", "null", "undefined", "void", "typeof",
    "var", "let", "const", "function", "async", "await", "class", "import",
    "export", "default", "from", "of", "in", "as", "S", "doc", "state",
  ]);

  let result = "";
  let i = 0;
  let inS = false; // single quote
  let inD = false; // double
  let inT = false; // template
  let inLineComment = false;
  let inBlockComment = false;

  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];

    if (inLineComment) {
      result += c;
      if (c === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      result += c;
      if (c === "*" && n === "/") {
        result += "/";
        i += 2;
        inBlockComment = false;
        continue;
      }
      i++;
      continue;
    }
    if (inS) {
      result += c;
      if (c === "\\" && i + 1 < src.length) {
        result += src[i + 1];
        i += 2;
        continue;
      }
      if (c === "'") inS = false;
      i++;
      continue;
    }
    if (inD) {
      result += c;
      if (c === "\\" && i + 1 < src.length) {
        result += src[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') inD = false;
      i++;
      continue;
    }
    if (inT) {
      result += c;
      if (c === "\\" && i + 1 < src.length) {
        result += src[i + 1];
        i += 2;
        continue;
      }
      if (c === "`") inT = false;
      i++;
      continue;
    }

    if (c === "/" && n === "/") {
      result += "//";
      inLineComment = true;
      i += 2;
      continue;
    }
    if (c === "/" && n === "*") {
      result += "/*";
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (c === "'") {
      inS = true;
      result += c;
      i++;
      continue;
    }
    if (c === '"') {
      inD = true;
      result += c;
      i++;
      continue;
    }
    if (c === "`") {
      inT = true;
      result += c;
      i++;
      continue;
    }

    // Identifier?
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[\w$]/.test(src[j])) j++;
      const id = src.slice(i, j);
      const prev = result.length ? result[result.length - 1] : "";
      // Already qualified (S.foo or obj.foo) — if prev is '.' skip
      if (prev === "." || prev === "$") {
        result += id;
        i = j;
        continue;
      }
      // Don't rewrite the binding name in `function foo` / `async function foo`
      // or after const/let/var (local bindings that shadow globals)
      const before = result.slice(Math.max(0, result.length - 24));
      if (/\bfunction\s*$/.test(before)) {
        result += id;
        i = j;
        continue;
      }
      if (/\b(?:const|let|var)\s*$/.test(before)) {
        result += id;
        i = j;
        continue;
      }
      // Don't rewrite function parameter names: look for bare `(` before id with only
      // whitespace/commas between — e.g. `function foo(bar` or `, bar`
      if (/[(,]\s*$/.test(before)) {
        result += id;
        i = j;
        continue;
      }
      if (!skip.has(id) && list.includes(id)) {
        // Don't rewrite property keys in object literals
        let k = j;
        while (k < src.length && /\s/.test(src[k])) k++;
        if (
          src[k] === ":" &&
          (prev === "{" || prev === "," || prev === "\n" || /\s/.test(prev))
        ) {
          result += id;
        } else if (src[k] === "," || src[k] === "}" || src[k] === ")") {
          // Object shorthand `{ foo }` or `{ foo,` — preserve key
          // BUT also method calls ends with `)` — can't use alone.
          // Only treat as shorthand when prev suggests object context.
          if (prev === "{" || prev === "," || /\n\s*$/.test(result.slice(-20))) {
            result += id;
          } else {
            result += "S." + id;
          }
        } else {
          result += "S." + id;
        }
      } else {
        result += id;
      }
      i = j;
      continue;
    }

    result += c;
    i++;
  }
  return result;
}

function transformDocRefs(src) {
  return src
    .replace(/\bDOC_W_MM\b/g, "S.doc.wMM")
    .replace(/\bDOC_H_MM\b/g, "S.doc.hMM")
    .replace(/\bDOC_DPI\b/g, "S.doc.dpi")
    .replace(/\bDOC_W_PX\b/g, "S.doc.wPx")
    .replace(/\bDOC_H_PX\b/g, "S.doc.hPx");
}

function transformCores(src) {
  let out = src;
  // Interaction — value comes from initCores
  out = out.replace(
    /const __ix = \(typeof window !== 'undefined' && window\.SketchtrudeInteraction\) \|\| null;/,
    "/* S.__ix set by initCores */"
  );
  // Layers
  out = out.replace(
    /const __layersApi = window\.SketchtrudeLayers \|\| null;\s*\r?\nconst layerEngine = __layersApi \? __layersApi\.createLayerEngine\(\) : null;/,
    "S.layerEngine = S.__layersApi ? S.__layersApi.createLayerEngine() : null;"
  );
  // Brushes API
  out = out.replace(/window\.SketchtrudeBrushes/g, "S.brushes");
  return out;
}

function stripStateAndDocDecls(src) {
  // Remove the DOC_* declarations (moved to scope.ts)
  let out = src.replace(
    /(?:\/\/ Document config[^\n]*\r?\n)?let DOC_W_MM\s*=\s*[^;]+;\r?\nlet DOC_H_MM\s*=\s*[^;]+;\r?\nlet DOC_DPI\s*=\s*[^;]+;\r?\nlet DOC_W_PX\s*=\s*[^;]+;\r?\nlet DOC_H_PX\s*=\s*[^;]+;\r?\n*/,
    ""
  );
  // Remove `const state = { ... };` (moved to scope) — match balanced braces carefully
  const stateStart = out.indexOf("const state = {");
  if (stateStart >= 0) {
    let depth = 0;
    let i = out.indexOf("{", stateStart);
    for (; i < out.length; i++) {
      if (out[i] === "{") depth++;
      else if (out[i] === "}") {
        depth--;
        if (depth === 0) {
          // consume trailing `;\n`
          let end = i + 1;
          if (out[end] === ";") end++;
          if (out[end] === "\r") end++;
          if (out[end] === "\n") end++;
          out =
            out.slice(0, stateStart) +
            "// state lives on S.state (created in scope.ts)\n" +
            "const state = S.state;\n" +
            out.slice(end);
          break;
        }
      }
    }
  }
  // Logo assignment — keep or noop (frame sets logo)
  out = out.replace(
    /document\.getElementById\('logo'\)\.src = '\/logo\.png';/,
    "const _logoEl = document.getElementById('logo'); if (_logoEl) _logoEl.src = '/logo.png';"
  );
  return out;
}

function stripDomDecls(src) {
  // In viewport, const paper = document.getElementById → assign through S after initDom
  // We'll let hoist turn them into S.paper = ... which is fine when initDom already set them
  // Or remove them if initDom provides them.
  return src.replace(
    /\/\* =+ DOM =+ \*\/\nconst paper = document\.getElementById\('paper'\);\nconst stage = document\.getElementById\('canvas-stage'\);\nconst area = document\.getElementById\('canvas-area'\);\nconst bgImg = document\.getElementById\('bg-image'\);\nconst layersList = document\.getElementById\('layers-list'\);\nconst rulerOverlay = document\.getElementById\('ruler-overlay'\);\nconst colorPopover = document\.getElementById\('color-popover'\);\nconst stencilPopover = document\.getElementById\('stencil-popover'\);\nconst hintEl = document\.getElementById\('hint'\);\nconst fileInputImportImage = document\.getElementById\('file-import-image'\);\nconst fileInputStencil = document\.getElementById\('file-stencil'\);/,
    `/* =================== DOM (from S after initDom) =================== */
const paper = S.paper;
const stage = S.stage;
const area = S.area;
const bgImg = S.bgImg;
const layersList = S.layersList;
const rulerOverlay = S.rulerOverlay;
const colorPopover = S.colorPopover;
const stencilPopover = S.stencilPopover;
const hintEl = S.hintEl;
const fileInputImportImage = S.fileInputImportImage;
const fileInputStencil = S.fileInputStencil;`
  );
}

// ---------- Collect names across all files first ----------
const allNames = new Set();
  /** @type {Record<string, Set<string>>} */
  const namesPerFile = {};
  const fileSources = {};

  for (const f of FILES) {
    const raw = fs.readFileSync(path.join(pubApp, f.js), "utf8");
    let src = stripHeader(raw);
    fileSources[f.js] = src;
    const names = collectTopLevelNames(src);
    namesPerFile[f.js] = names;
    for (const n of names) allNames.add(n);
  }

  // Never hoist/rewrite these (handled specially)
  for (const n of [
    "state",
    "DOC_W_MM",
    "DOC_H_MM",
    "DOC_DPI",
    "DOC_W_PX",
    "DOC_H_PX",
  ]) {
    allNames.delete(n);
    for (const set of Object.values(namesPerFile)) set.delete(n);
  }

  console.log(`Collected ${allNames.size} top-level names`);

  for (const f of FILES) {
    let src = fileSources[f.js];
    if (f.js === "01-state.js") {
      src = stripStateAndDocDecls(src);
      src = transformCores(src);
    }
    if (f.js === "02-viewport.js") {
      src = stripDomDecls(src);
    }
    src = transformCores(src);
    src = transformDocRefs(src);
    src = hoistToScope(src);

    // Rewrite ALL hoisted names to S.name so sibling function-expression
    // assignments can call each other (named fn expressions are not outer-scoped).
    // Skips const/let/var bindings, params, and `function name` tokens.
    src = rewriteRefs(src, allNames);

    // Fix accidental double-prefix
    src = src.replace(/\bS\.S\./g, "S.");

    // Fix logo helper if converter left a bare _logoEl check
    src = src.replace(
      /S\._logoEl = document\.getElementById\('logo'\); if \(_logoEl\)/,
      "S._logoEl = document.getElementById('logo'); if (S._logoEl)"
    );
    src = src.replace(
      /S\._nmLineImg = new Image\(\); _nmLineImg\.src/,
      "S._nmLineImg = new Image(); S._nmLineImg.src"
    );
    // __ix local alias after cores wired it
    src = src.replace(
      /S\.__ix = S\.__ix;?/g,
      "/* __ix provided by initCores → S.__ix */"
    );
    src = src.replace(/\b__ix\b/g, "S.__ix");
    src = src.replace(/\bS\.S\.__ix\b/g, "S.__ix");
    // layerEngine local
    src = src.replace(/\blayerEngine\b/g, "S.layerEngine");
    src = src.replace(/\bS\.S\.layerEngine\b/g, "S.layerEngine");

    const wrapped = `// @ts-nocheck
/* Auto-converted from public/engine/app/${f.js} — shared scope S */
import { S } from "./scope";

export function ${f.init}() {
  const state = S.state;
${src
  .split("\n")
  .map((l) => (l.length ? "  " + l : l))
  .join("\n")}
}
`;

    fs.writeFileSync(path.join(srcApp, f.ts), wrapped);
    console.log("wrote", f.ts, `(rewrote ${allNames.size} symbols)`);
  }

console.log("Conversion complete.");
