/**
 * Phase 5 surgical syntax fixes after split/type pass.
 */
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

function stripExtraClose(src) {
  // Remove duplicate final closing brace of init function
  return src.replace(/\n\}\n\}\n*$/, "\n}\n");
}

function fixGetContextChain(src) {
  // `.getContext('2d') as any.drawImage(...)` → `( .getContext('2d') as any).drawImage(...)`
  // Only when `as any.` (cast then property) — wrap the castee.
  return src.replace(
    /([^\n(]+)\.getContext\(('2d'|"2d")\) as any\./g,
    "($1.getContext($2) as any).",
  );
}

function fixSketchtrudeEngine(src) {
  return src.replace(
    /\(window as any\)\.sketchtrudeEngine = \{\n\s*S\.exportProjectDocument,\n\s*S\.importProjectDocument,\n\s*S\.subscribeToDocumentChanges,\n\s*S\.hasUnsavedChanges,\n\s*S\.getMutationVersion,/,
    `(window as any).sketchtrudeEngine = {
    exportProjectDocument: S.exportProjectDocument,
    importProjectDocument: S.importProjectDocument,
    subscribeToDocumentChanges: S.subscribeToDocumentChanges,
    hasUnsavedChanges: S.hasUnsavedChanges,
    getMutationVersion: S.getMutationVersion,`,
  );
}

for (const f of [
  "massing.ts",
  "walls.ts",
  "stroke-input.ts",
  "shell.ts",
  "persistence.ts",
  "host-bridge.ts",
  "boot-sequence.ts",
]) {
  patch(f, (s) => {
    s = fixGetContextChain(s);
    s = stripExtraClose(s);
    if (f === "host-bridge.ts") s = fixSketchtrudeEngine(s);
    return s;
  });
}

console.log("phase5 surgical done");
