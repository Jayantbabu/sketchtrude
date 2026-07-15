/**
 * Phase 4: qualify bare S-bag refs, cast DOM lookups, annotate bare arrows.
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

/** Identifiers that live on S (from tsc + known bag fields). */
const BARE_TO_S = [
  "stylusOnly",
  "hsv",
  "selCtx",
  "selOverlay",
  "selBar",
  "TOOL_GROUPS",
  "_railMeta",
  "brushLibrary",
  "editorBrush",
  "editorEditIndex",
  "HATCH_PATTERNS",
  "fileInputFillTex",
  "imageProps",
  "imgOverlay",
  "gridCanvas",
  "gridCtx",
  "guidePopover",
  "colorPopover",
  "stencilPopover",
  "BUILTIN_STENCILS",
  "_brushFlyout",
  "_nmLogoImg",
  "_selPendingBefore",
  "_penDown",
  "_stylusGuard",
  "updateStylusBtn",
  "updatePreview",
];

function qualifyBare(src, names) {
  // Sort longer first so TOOL_GROUPS before GROUPS etc.
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const re = new RegExp(`(?<![.\\w$])${name}\\b`, "g");
    src = src.replace(re, (match, offset) => {
      // Skip if already S.name
      if (offset >= 2 && src.slice(offset - 2, offset) === "S.") return match;
      // Skip object keys `name:` in object literals (simple heuristic)
      let k = offset + match.length;
      while (k < src.length && /\s/.test(src[k])) k++;
      const prev = src.slice(Math.max(0, offset - 1), offset);
      if (src[k] === ":" && (prev === "{" || prev === "," || prev === "\n" || /\s/.test(prev))) {
        return match;
      }
      // Skip function/const/let/var declarations
      const before = src.slice(Math.max(0, offset - 40), offset);
      if (/\b(?:function|const|let|var)\s+$/.test(before)) return match;
      // Skip type annotations after `: `  — rare
      return "S." + match;
    });
  }
  return src.replace(/\bS\.S\./g, "S.");
}

function castGetElementById(src) {
  // document.getElementById('x') → (document.getElementById('x') as any)
  // Avoid double-wrapping
  return src.replace(
    /(?<!\()document\.getElementById\(([^)]+)\)(?!\s*as\b)/g,
    "(document.getElementById($1) as any)",
  );
}

function castQuerySelector(src) {
  return src
    .replace(
      /(?<!\()document\.querySelector\(([^)]+)\)(?!\s*as\b)/g,
      "(document.querySelector($1) as any)",
    )
    .replace(
      /(?<!\()document\.querySelectorAll\(([^)]+)\)(?!\s*as\b)/g,
      "(document.querySelectorAll($1) as any)",
    );
}

function annotateBareArrows(src) {
  // e =>  /  ev =>  (identifier without parens)
  return src.replace(
    /(?<![.\w$])([A-Za-z_$][\w$]*)\s*=>/g,
    (full, id) => {
      if (id === "any") return full;
      // Don't touch if it's part of `): any =>` somehow
      return `(${id}: any) =>`;
    },
  );
}

function fixStudioHelpers(src) {
  return src.replace(
    /(?<![.\w$])StudioHelpers\b/g,
    "(window as any).StudioHelpers",
  );
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

for (const rel of FILES) {
  const p = path.join(APP, rel);
  let s = fs.readFileSync(p, "utf8");
  s = qualifyBare(s, BARE_TO_S);
  s = fixStudioHelpers(s);
  s = castGetElementById(s);
  s = castQuerySelector(s);
  s = annotateFnParams(s);
  s = annotateParenArrows(s);
  s = annotateBareArrows(s);
  // cleanup double any tags
  s = s.replace(/: any: any/g, ": any");
  s = s.replace(/\(window as any\)\.StudioHelpers/g, "(window as any).StudioHelpers");
  // Fix (window as any) becoming S.(window...) — shouldn't have been in list
  s = s.replace(/\bS\.\(window as any\)/g, "(window as any)");
  fs.writeFileSync(p, s);
  console.log("typed", rel);
}

console.log("bulk type pass done");
