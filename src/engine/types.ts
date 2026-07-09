export type { StudioMode, StudioTool, Project, Layer } from "@/lib/types";

export interface EngineInitOptions {
  projectId: string;
  container: HTMLElement;
  onSave?: () => void;
  onExport?: (blob: Blob) => void;
}

export { useStudioStore } from "./state";
export { DEFAULT_DOCUMENT } from "./state-legacy";
export type { DocumentState, LayerState } from "./state-legacy";
export { initStudioEngine, destroyStudioEngine } from "./init";

// Module exports (extracted from legacy-app.js)
export { legacyCode as layersCode } from "./layers";
export { legacyCode as brushesCode } from "./brushes";
export { legacyCode as historyCode } from "./history";
export { legacyCode as measureCode } from "./tools/measure";
export { legacyCode as stencilsCode } from "./tools/stencils";
export { legacyCode as scaleCode } from "./tools/scale";
export { legacyCode as massingCode } from "./massing/index";
export { legacyCode as exportCode } from "./export";
export { legacyCode as persistenceCode } from "./persistence/local";
