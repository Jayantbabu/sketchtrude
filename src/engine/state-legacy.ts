// Extracted state types and defaults from legacy-app.js
// The runtime state object lives in the legacy engine; this module
// provides TypeScript interfaces for the Zustand store and sync bridge.

export type LayerState = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
  traceTint: number;
};

export type DocumentState = {
  tool: string;
  mode: "draw" | "navigate";
  layers: LayerState[];
  scaleLabel: string;
  docWidthMm: number;
  docHeightMm: number;
  docDpi: number;
};

export const DEFAULT_DOCUMENT: DocumentState = {
  tool: "pen",
  mode: "draw",
  layers: [],
  scaleLabel: "1:50",
  docWidthMm: 420,
  docHeightMm: 297,
  docDpi: 150,
};
