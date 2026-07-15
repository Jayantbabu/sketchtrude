#!/usr/bin/env node
/**
 * Fix bare identifiers that must be S.name.
 * Handles strings, comments, AND regex literals so state doesn't desync.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "../src/engine/app");
const SKIP_FILES = new Set(["cores.ts", "types.ts", "dom.ts", "scope.ts", "boot.ts"]);

const EXTRA_FIELDS = [
  "paper", "stage", "area", "bgImg", "layersList", "rulerOverlay",
  "colorPopover", "stencilPopover", "hintEl", "fileInputImportImage",
  "fileInputStencil", "fileInputHatch", "scalePrompt", "imgOverlay",
  "gridCanvas", "gridCtx", "overflowPanel", "layersPanel", "layersTab",
  "guidePopover", "canvasSizeDialog", "_modalScrim", "massingCanvas",
  "strokeCanvas", "selOverlay", "selBar", "_brushFlyout", "_railMeta",
  "_logoEl", "_nmLineImg", "_sampleCanvas", "_sampleCtx",
  "AUTOSAVE_DB", "AUTOSAVE_STORE",
  "activePointers", "massing", "layerMenuEl",
  "bootDefaultLayers",
];
// NOTE: locals named `area` exist (shoelace). After rewriting, restore
// those numeric locals if a re-run incorrectly qualifies them as S.area.

function collectSiblingFns(files) {
  const names = new Set();
  const re = /\bS\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s+\1\b/g;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    let m;
    while ((m = re.exec(src))) names.add(m[1]);
  }
  return names;
}

function collectAssigned(files) {
  const names = new Set(EXTRA_FIELDS);
  const re = /\bS\.([A-Za-z_$][\w$]*)\s*=/g;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    let m;
    while ((m = re.exec(src))) {
      const id = m[1];
      // Skip very short / common noise
      if (id.length <= 1) continue;
      if (["doc", "state", "S"].includes(id)) continue;
      names.add(id);
    }
  }
  return names;
}

function isRegexContext(result) {
  // Previous non-space char suggests `/` starts a regex, not division.
  let i = result.length - 1;
  while (i >= 0 && /\s/.test(result[i])) i--;
  if (i < 0) return true;
  const prev = result[i];
  return /[=(:,;!?&|~^%+\-*\[{<>]/.test(prev) ||
    result.slice(Math.max(0, i - 5), i + 1).match(/\b(return|throw|case|typeof|new|delete|void|in|of)\s*$/);
}

function isFunctionParamBinding(result) {
  // Only skip when still inside an unclosed `function name(` / `function(` param list.
  const slice = result.slice(-120);
  // Find the last `function ... (` that is still unclosed at end of result.
  const re = /\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\(/g;
  let m;
  let last = null;
  while ((m = re.exec(slice))) last = m;
  if (!last) return false;
  const after = slice.slice(last.index + last[0].length);
  let depth = 1;
  for (let i = 0; i < after.length; i++) {
    const ch = after[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return false; // params already closed
    }
  }
  return depth > 0;
}

function rewriteRefs(src, names) {
  const list = new Set(names);
  let result = "";
  let i = 0;
  let inS = false, inD = false, inT = false, inLine = false, inBlock = false;

  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];

    if (inLine) {
      result += c;
      if (c === "\n") inLine = false;
      i++;
      continue;
    }
    if (inBlock) {
      result += c;
      if (c === "*" && n === "/") {
        result += "/";
        i += 2;
        inBlock = false;
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
      inLine = true;
      i += 2;
      continue;
    }
    if (c === "/" && n === "*") {
      result += "/*";
      inBlock = true;
      i += 2;
      continue;
    }

    // Regex literal
    if (c === "/" && isRegexContext(result)) {
      result += "/";
      i++;
      let inClass = false;
      while (i < src.length) {
        const ch = src[i];
        result += ch;
        if (ch === "\\" && i + 1 < src.length) {
          result += src[i + 1];
          i += 2;
          continue;
        }
        if (ch === "[") inClass = true;
        else if (ch === "]" && inClass) inClass = false;
        else if (ch === "/" && !inClass) {
          i++;
          // flags
          while (i < src.length && /[a-z]/i.test(src[i])) {
            result += src[i];
            i++;
          }
          break;
        }
        i++;
      }
      continue;
    }

    if (c === "'") { inS = true; result += c; i++; continue; }
    if (c === '"') { inD = true; result += c; i++; continue; }
    if (c === "`") { inT = true; result += c; i++; continue; }

    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[\w$]/.test(src[j])) j++;
      const id = src.slice(i, j);
      const prev = result.length ? result[result.length - 1] : "";

      if (prev === "." || prev === "$") {
        result += id;
        i = j;
        continue;
      }

      const before = result.slice(Math.max(0, result.length - 32));
      if (/\bfunction\s*$/.test(before) || /\b(?:const|let|var)\s*$/.test(before)) {
        result += id;
        i = j;
        continue;
      }

      if (list.has(id)) {
        if (isFunctionParamBinding(result)) {
          result += id;
          i = j;
          continue;
        }
        let k = j;
        while (k < src.length && /\s/.test(src[k])) k++;
        if (
          src[k] === ":" &&
          (prev === "{" || prev === "," || prev === "\n" || /\s/.test(prev))
        ) {
          result += id;
        } else if (
          (src[k] === "," || src[k] === "}") &&
          (prev === "{" || prev === "," || /\n\s*$/.test(result.slice(-20)))
        ) {
          result += id;
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

function main() {
  const files = fs
    .readdirSync(appDir)
    .filter((f) => f.endsWith(".ts") && !SKIP_FILES.has(f))
    .map((f) => path.join(appDir, f));

  const sibling = collectSiblingFns(files);
  // Also hoist non-function S.field bindings that look like bag fields (camel/\_)
  const assigned = collectAssigned(files);
  const names = new Set([...EXTRA_FIELDS, ...sibling]);
  for (const id of assigned) {
    if (/^[A-Z]/.test(id)) continue; // types/consts style
    if (id.length <= 2) continue;
    // Only bag-like identifiers that were assigned, not every localish temp
    if (EXTRA_FIELDS.includes(id) || id.startsWith("_") || /Canvas|Panel|Popover|Overlay|El|Btn|List|Dialog|Scrim|Menu/.test(id)) {
      names.add(id);
    }
  }

  console.log("Names:", names.size, "(siblings", sibling.size + ")");

  const edited = [];
  for (const f of files) {
    const orig = fs.readFileSync(f, "utf8");
    let next = rewriteRefs(orig, names);
    next = next.replace(/\bS\.S\./g, "S.");
    if (next !== orig) {
      fs.writeFileSync(f, next);
      edited.push(path.basename(f));
      console.log("Updated", path.basename(f));
    } else {
      console.log("Unchanged", path.basename(f));
    }
  }
  console.log("\nEdited:", edited.join(", ") || "(none)");
}

main();
