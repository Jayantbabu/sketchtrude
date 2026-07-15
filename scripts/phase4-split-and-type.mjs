/**
 * Phase 4: split measure/tool-ui/selection/features modules and strip @ts-nocheck
 * with Phase-3-style `: any` param annotations.
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

/** Annotate bare function params with `: any` (named + anonymous). */
function annotateParams(src) {
  // function name(a, b) / function(a, b) — skip if already typed
  return src.replace(
    /\bfunction(\s+\w+)?\s*\(([^)]*)\)/g,
    (full, namePart, params) => {
      if (!params.trim()) return full;
      if (/:\s*any\b|:[\s\w<>,.|\[\]"'`]+/.test(params) && !/,\s*\w+\s*(,|\))/.test(params.replace(/:\s*any/g, ""))) {
        // Heuristic: if every param already has a type-ish `:`, leave alone.
        // But also re-walk to ensure all get : any.
      }
      const typed = params
        .split(",")
        .map((p) => {
          const t = p.trim();
          if (!t) return t;
          if (t === "...") return t;
          // rest / destructure / already typed
          if (t.startsWith("...") || t.startsWith("{") || t.startsWith("[")) return t;
          if (/:\s*/.test(t.split("=")[0])) return t;
          // default value: name = x
          const eq = t.indexOf("=");
          if (eq >= 0) {
            const left = t.slice(0, eq).trim();
            const right = t.slice(eq);
            if (left.includes(":")) return t;
            return `${left}: any ${right}`;
          }
          return `${t}: any`;
        })
        .join(", ");
      return `function${namePart || ""}(${typed})`;
    },
  );
}

function castGetContext(src) {
  return src
    .replace(/\.getContext\(('2d'|"2d")\)(?!\s+as)/g, ".getContext($1) as any")
    .replace(/\.getContext\(('2d'|"2d")\) as any as any/g, ".getContext($1) as any");
}

function fixBareIds(src) {
  // Bare BUILTIN_STENCILS → S.BUILTIN_STENCILS (avoid double-prefix)
  return src.replace(/(?<![.\w])BUILTIN_STENCILS\b/g, "S.BUILTIN_STENCILS");
}

function stripNocheck(src) {
  return src.replace(/^\/\/ @ts-nocheck\r?\n/, "");
}

function wrapInit(exportName, bodyLines, headerComment) {
  const body = bodyLines.join("\n");
  // body currently includes leading indent from inside old init — keep as-is
  let inner = body;
  // Ensure we have `const state = S.state;` if body uses state
  if (/\bstate\./.test(inner) || /\bstate\b/.test(inner)) {
    if (!/^\s*const state = S\.state;/.test(inner.trimStart())) {
      // body may already start with blank / comments — prepend after opening
    }
  }
  const hasState = /const state = S\.state;/.test(inner);
  const stateLine = hasState ? "" : "  const state = S.state;\n\n";
  // Dedent: old init body is indented by 2 spaces; keep it
  return (
    `/* ${headerComment} */\n` +
    `import { S } from "./scope";\n\n` +
    `export function ${exportName}() {\n` +
    stateLine +
    inner +
    (inner.endsWith("\n") ? "" : "\n") +
    "}\n"
  );
}

function wrapInitFeatures(exportName, bodyLines, headerComment) {
  // features live in features/ so scope import is ../scope
  const body = bodyLines.join("\n");
  const hasState = /const state = S\.state;/.test(body);
  const stateLine = hasState ? "" : "  const state = S.state;\n\n";
  return (
    `/* ${headerComment} */\n` +
    `import { S } from "../scope";\n\n` +
    `export function ${exportName}() {\n` +
    stateLine +
    body +
    (body.endsWith("\n") ? "" : "\n") +
    "}\n"
  );
}

function typeAndFix(src) {
  return fixBareIds(castGetContext(annotateParams(stripNocheck(src))));
}

function extractBetween(lines, startIdx, endIdx) {
  // lines are 0-based; startIdx inclusive, endIdx exclusive
  return lines.slice(startIdx, endIdx);
}

// ─── measure-stencils ─────────────────────────────────────────────
{
  const raw = read("measure-stencils.ts");
  const lines = raw.split(/\n/);
  // Find section markers (0-based line indices of comment lines)
  const iMeasure = lines.findIndex((l) => l.includes("MEASUREMENTS"));
  const iStencils = lines.findIndex((l) => l.includes("=================== STENCILS"));
  const iScale = lines.findIndex((l) => l.includes("=================== SCALE"));
  const iClose = lines.length - 1; // closing `}` of init

  // Body of init starts after `export function initMeasureStencils() {` and `const state = S.state;`
  const iInitOpen = lines.findIndex((l) => l.includes("export function initMeasureStencils"));
  const iState = lines.findIndex((l, i) => i > iInitOpen && l.includes("const state = S.state"));

  const measureBody = [
    "  const state = S.state;",
    "",
    ...extractBetween(lines, iMeasure, iStencils),
    ...extractBetween(lines, iScale, iClose), // scale with measure
  ];
  const stencilsBody = [
    "  const state = S.state;",
    "",
    ...extractBetween(lines, iStencils, iScale),
  ];

  let measureTs = wrapInit("initMeasure", measureBody, "Measure + scale — shared scope S");
  let stencilsTs = wrapInit("initStencils", stencilsBody, "Stencils — shared scope S");
  measureTs = typeAndFix(measureTs).replace(
    `import { S } from "./scope";`,
    `import { S } from "./scope";`,
  );
  stencilsTs = typeAndFix(stencilsTs);

  // Fix relative scope for same folder — already ./scope
  write("measure.ts", typeAndFix(wrapInit("initMeasure", measureBody, "Measure + scale — shared scope S")));
  write("stencils.ts", typeAndFix(wrapInit("initStencils", stencilsBody, "Stencils — shared scope S")));
  write(
    "measure-stencils.ts",
    `/* Thin re-export — measure + stencils */\n` +
      `import { initMeasure } from "./measure";\n` +
      `import { initStencils } from "./stencils";\n\n` +
      `export function initMeasureStencils() {\n` +
      `  initMeasure();\n` +
      `  initStencils();\n` +
      `}\n`,
  );
}

// ─── tool-ui ──────────────────────────────────────────────────────
{
  const raw = read("tool-ui.ts");
  const lines = raw.split(/\n/);
  const iColor = lines.findIndex((l) => l.includes("=================== COLOR"));
  const iFill = lines.findIndex((l) => l.includes("=================== FLOOD FILL"));
  const iInitOpen = lines.findIndex((l) => l.includes("export function initToolUi"));
  const iState = lines.findIndex((l, i) => i > iInitOpen && l.includes("const state = S.state"));
  const iClose = (() => {
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim() === "}") return i;
    return lines.length - 1;
  })();
  // Also keep STENCIL SCALE with tool-ui (between color end and fill) — plan: color + fill extract
  // Color section: COLOR ... through eyedropper (before STENCIL SCALE)
  const iStencilScale = lines.findIndex((l) => l.includes("=================== STENCIL SCALE"));

  const toolBody = [
    "  const state = S.state;",
    "",
    ...extractBetween(lines, iState + 1, iColor),
    ...extractBetween(lines, iStencilScale, iFill),
  ];
  const colorBody = [
    "  const state = S.state;",
    "",
    ...extractBetween(lines, iColor, iStencilScale),
  ];
  const fillBody = [
    "  const state = S.state;",
    "",
    ...extractBetween(lines, iFill, iClose),
  ];

  write("color.ts", typeAndFix(wrapInit("initColor", colorBody, "Colour wheel — shared scope S")));
  write("fill.ts", typeAndFix(wrapInit("initFill", fillBody, "Flood fill — shared scope S")));
  write(
    "tool-ui.ts",
    typeAndFix(
      `/* Tool UI + brushes — shared scope S */\n` +
        `import { S } from "./scope";\n` +
        `import { initColor } from "./color";\n` +
        `import { initFill } from "./fill";\n\n` +
        `export function initToolUi() {\n` +
        `  const state = S.state;\n\n` +
        extractBetween(lines, iState + 1, iColor).join("\n") +
        "\n" +
        extractBetween(lines, iStencilScale, iFill).join("\n") +
        "\n" +
        `  initColor();\n` +
        `  initFill();\n` +
        `}\n`,
    ),
  );
}

// ─── selection-chrome ─────────────────────────────────────────────
{
  const raw = read("selection-chrome.ts");
  const lines = raw.split(/\n/);
  const iPuck = lines.findIndex((l) => l.includes("=================== PUCK CONTROLS"));
  const iInitOpen = lines.findIndex((l) => l.includes("export function initSelectionChrome"));
  const iState = lines.findIndex((l, i) => i > iInitOpen && l.includes("const state = S.state"));
  const iClose = (() => {
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim() === "}") return i;
    return lines.length - 1;
  })();

  const selBody = [
    "  const state = S.state;",
    "",
    ...extractBetween(lines, iState + 1, iPuck),
  ];
  const chromeBody = [
    "  const state = S.state;",
    "",
    ...extractBetween(lines, iPuck, iClose),
  ];

  write("selection.ts", typeAndFix(wrapInit("initSelection", selBody, "Selection (magic wand) — shared scope S")));
  write("chrome.ts", typeAndFix(wrapInit("initChrome", chromeBody, "Chrome / HUD controls — shared scope S")));
  write(
    "selection-chrome.ts",
    `/* Thin re-export — selection + chrome */\n` +
      `import { initSelection } from "./selection";\n` +
      `import { initChrome } from "./chrome";\n\n` +
      `export function initSelectionChrome() {\n` +
      `  initSelection();\n` +
      `  initChrome();\n` +
      `}\n`,
  );
}

// ─── features folder ──────────────────────────────────────────────
{
  const raw = read("features.ts");
  const lines = raw.split(/\n/);
  const markers = [
    { name: "snap", init: "initSnap", label: "FEATURE 1", start: -1 },
    { name: "hatch", init: "initHatch", label: "FEATURE 2", start: -1 },
    { name: "rooms", init: "initRooms", label: "FEATURE 3", start: -1 },
    { name: "dimensions", init: "initDimensions", label: "FEATURE 4", start: -1 },
    { name: "guides", init: "initGuides", label: "FEATURE 5", start: -1 },
    { name: "patch", init: "initFeaturePatch", label: "PATCH:", start: -1 },
  ];
  for (const m of markers) {
    m.start = lines.findIndex((l) => l.includes(m.label));
  }
  const iInitOpen = lines.findIndex((l) => l.includes("export function initFeatures"));
  const iState = lines.findIndex((l, i) => i > iInitOpen && l.includes("const state = S.state"));
  const iClose = (() => {
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim() === "}") return i;
    return lines.length - 1;
  })();

  // Snap starts at FEATURE 1; if there's content between state and FEATURE 1, include in snap
  const ranges = [];
  for (let i = 0; i < markers.length; i++) {
    const start = i === 0 ? markers[i].start : markers[i].start;
    const end = i + 1 < markers.length ? markers[i + 1].start : iClose;
    ranges.push({ ...markers[i], start, end });
  }

  // Merge patch into hatch (it patches hatch + measure SVG)
  for (const r of ranges) {
    if (r.name === "patch") continue;
    let bodyStart = r.start;
    let bodyEnd = r.end;
    if (r.name === "hatch") {
      const patch = ranges.find((x) => x.name === "patch");
      // write hatch with its own section, then append patch at end of hatch
      const hatchLines = [
        "  const state = S.state;",
        "",
        ...extractBetween(lines, r.start, r.end),
        "",
        ...extractBetween(lines, patch.start, patch.end),
      ];
      write(
        `features/${r.name}.ts`,
        typeAndFix(wrapInitFeatures(r.init, hatchLines, `Feature: ${r.name} — shared scope S`)),
      );
      continue;
    }
    if (r.name === "snap") {
      // Include any lines between const state and FEATURE 1 (usually none beyond blank)
      const snapLines = [
        "  const state = S.state;",
        "",
        ...extractBetween(lines, Math.max(r.start, iState + 1), r.end),
      ];
      // If FEATURE 1 comment is after iState, use r.start
      write(
        `features/${r.name}.ts`,
        typeAndFix(
          wrapInitFeatures(
            r.init,
            ["  const state = S.state;", "", ...extractBetween(lines, r.start, r.end)],
            `Feature: ${r.name} — shared scope S`,
          ),
        ),
      );
      continue;
    }
    write(
      `features/${r.name}.ts`,
      typeAndFix(
        wrapInitFeatures(
          r.init,
          ["  const state = S.state;", "", ...extractBetween(lines, r.start, r.end)],
          `Feature: ${r.name} — shared scope S`,
        ),
      ),
    );
  }

  write(
    "features/index.ts",
    `/* Features — orthogonal snap, hatch, rooms, dimensions, guides */\n` +
      `import { initSnap } from "./snap";\n` +
      `import { initHatch } from "./hatch";\n` +
      `import { initRooms } from "./rooms";\n` +
      `import { initDimensions } from "./dimensions";\n` +
      `import { initGuides } from "./guides";\n\n` +
      `export function initFeatures() {\n` +
      `  initSnap();\n` +
      `  initHatch();\n` +
      `  initRooms();\n` +
      `  initDimensions();\n` +
      `  initGuides();\n` +
      `}\n`,
  );

  // Remove old monolith features.ts so folder index is used
  fs.unlinkSync(path.join(APP, "features.ts"));
  console.log("removed features.ts (now features/)");
}

console.log("Phase 4 split done.");
