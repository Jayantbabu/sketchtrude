import fs from "node:fs";
import path from "node:path";

const APP = path.resolve("src/engine/app");
const files = [
  "features/snap.ts",
  "features/rooms.ts",
  "features/dimensions.ts",
  "features/guides.ts",
  "features/hatch.ts",
  "measure.ts",
  "fill.ts",
  "selection.ts",
];

for (const rel of files) {
  const p = path.join(APP, rel);
  let s = fs.readFileSync(p, "utf8");

  // Remove orphan trailing comment opener before closing brace of init
  s = s.replace(/\n  \/\* ={10,}\s*\n\}\s*$/, "\n}\n");

  // hatch: collapse double opener before PATCH
  s = s.replace(
    /\n  \/\* ={10,}\s*\n  \/\* ={10,}\s*\n     PATCH:/,
    "\n  /* =================================================================\n     PATCH:",
  );

  // (x.getContext('2d') as any).method — not x.getContext('2d') as any.method
  s = s.replace(
    /([A-Za-z_$][\w$]*)\.getContext\(('2d'|"2d")\) as any\.(\w+)/g,
    "($1.getContext($2) as any).$3",
  );

  // Extra closing brace (measure)
  s = s.replace(/\n\}\n\}\s*$/, "\n}\n");

  // Normalize corrupted em-dashes to ASCII hyphen in comments
  s = s.replace(/\uFFFD.?"/g, "-");
  s = s.replace(/â€”/g, "-");

  fs.writeFileSync(p, s);
  console.log("patched", rel);
}
