/**
 * Fix string-literal corruptions where bare id qualify wrongly rewrote inside quotes.
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

for (const f of FILES) {
  const p = path.join(APP, f);
  let s = fs.readFileSync(p, "utf8");
  const orig = s;
  // Undo S. prefix inside string/template literals for known bag names
  const names = [
    "massing",
    "mctx",
    "faceEd",
    "strokeCtx",
    "replayCtx",
    "gestureState",
    "brushCursor",
    "massPointers",
    "massPinch",
    "massInspector",
    "MAT_PRESETS",
    "MAT_COLORS",
  ];
  for (const name of names) {
    // 'S.name' / "S.name" / `S.name` and id fragments like 'S.name-foo'
    const re = new RegExp(`(['"\`])S\\.${name}\\b`, "g");
    s = s.replace(re, `$1${name}`);
  }
  if (s !== orig) {
    fs.writeFileSync(p, s);
    console.log("fixed strings in", f);
  } else {
    console.log("clean", f);
  }
}
