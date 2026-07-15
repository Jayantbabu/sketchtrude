import type { DomRefs } from "./types";
import { S } from "./scope";

function mustGet<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Studio DOM missing #${id}`);
  return el as T;
}

/** Capture studio-body DOM refs into S after HTML is mounted. */
export function initDom(): DomRefs {
  const refs: DomRefs = {
    paper: mustGet("paper"),
    stage: mustGet("canvas-stage"),
    area: mustGet("canvas-area"),
    bgImg: document.getElementById("bg-image") as HTMLImageElement | null,
    layersList: mustGet("layers-list"),
    rulerOverlay: mustGet("ruler-overlay"),
    colorPopover: document.getElementById("color-popover"),
    stencilPopover: document.getElementById("stencil-popover"),
    hintEl: document.getElementById("hint"),
    fileInputImportImage: document.getElementById(
      "file-import-image"
    ) as HTMLInputElement | null,
    fileInputStencil: document.getElementById(
      "file-stencil"
    ) as HTMLInputElement | null,
    scalePrompt: document.getElementById("scale-prompt"),
    imgOverlay: document.getElementById("img-overlay"),
  };

  Object.assign(S, refs);
  S.dom = refs;
  return refs;
}
