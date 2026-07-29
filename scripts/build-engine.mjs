#!/usr/bin/env node
/**
 * Bundle the studio engine (src/engine/app) into public/engine/studio.js
 * for the iframe runtime.
 */
import * as esbuild from "esbuild";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const entry = path.join(root, "src/engine/app/boot.ts");
const outfile = path.join(root, "public/engine/studio.js");
const pdfWorkerSource = path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const pdfWorkerOutfile = path.join(root, "public/engine/pdf.worker.min.mjs");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  absWorkingDir: root,
  entryPoints: [entry],
  bundle: true,
  outfile,
  format: "iife",
  platform: "browser",
  target: ["es2018"],
  // Keep esbuild from walking above the repository looking for tsconfig files.
  // That also makes isolated/worktree builds deterministic.
  tsconfigRaw: {
    compilerOptions: {
      target: "ES2018",
      useDefineForClassFields: true,
    },
  },
  sourcemap: true,
  logLevel: "info",
  // Resolve @/ paths like tsconfig
  alias: {
    "@": path.join(root, "src"),
  },
  // Keep large JSON importable
  loader: {
    ".json": "json",
  },
};

async function main() {
  await copyFile(pdfWorkerSource, pdfWorkerOutfile);
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log("[engine] watching src/engine/app → public/engine/studio.js");
  } else {
    await esbuild.build(options);
    console.log("[engine] built public/engine/studio.js");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
