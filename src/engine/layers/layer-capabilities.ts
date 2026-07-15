import type { LayerCapabilities, LayerKind } from "./types";

const SKETCH: LayerCapabilities = {
  canDraw: true,
  canHostObjects: false,
  showChildrenInPanel: false,
  lockByDefault: false,
  exportByDefault: true,
  supportsBlendMode: true,
  supportsOpacity: true,
  supportsMerge: true,
  supportsRasterize: true,
  supportsTransformWholeLayer: true,
  defaultObjectSelectable: false,
};

const OBJECT: LayerCapabilities = {
  canDraw: false,
  canHostObjects: true,
  showChildrenInPanel: true,
  lockByDefault: false,
  exportByDefault: true,
  supportsBlendMode: true,
  supportsOpacity: true,
  supportsMerge: false,
  supportsRasterize: false,
  supportsTransformWholeLayer: false,
  defaultObjectSelectable: true,
};

const ARCHITECTURE: LayerCapabilities = {
  canDraw: false,
  canHostObjects: true,
  showChildrenInPanel: true,
  lockByDefault: false,
  exportByDefault: true,
  supportsBlendMode: false,
  supportsOpacity: true,
  supportsMerge: false,
  supportsRasterize: false,
  supportsTransformWholeLayer: false,
  defaultObjectSelectable: true,
};

const REFERENCE: LayerCapabilities = {
  canDraw: false,
  canHostObjects: true,
  showChildrenInPanel: true,
  lockByDefault: true,
  exportByDefault: true,
  supportsBlendMode: true,
  supportsOpacity: true,
  supportsMerge: false,
  supportsRasterize: false,
  supportsTransformWholeLayer: true,
  defaultObjectSelectable: true,
};

const MEASUREMENT: LayerCapabilities = {
  canDraw: false,
  canHostObjects: true,
  showChildrenInPanel: true,
  lockByDefault: false,
  exportByDefault: true,
  supportsBlendMode: false,
  supportsOpacity: true,
  supportsMerge: false,
  supportsRasterize: false,
  supportsTransformWholeLayer: false,
  defaultObjectSelectable: true,
};

const GUIDE: LayerCapabilities = {
  canDraw: false,
  canHostObjects: true,
  showChildrenInPanel: false,
  lockByDefault: false,
  exportByDefault: false,
  supportsBlendMode: false,
  supportsOpacity: true,
  supportsMerge: false,
  supportsRasterize: false,
  supportsTransformWholeLayer: false,
  defaultObjectSelectable: true,
};

const BY_KIND: Record<LayerKind, LayerCapabilities> = {
  sketch: SKETCH,
  object: OBJECT,
  architecture: ARCHITECTURE,
  reference: REFERENCE,
  measurement: MEASUREMENT,
  guide: GUIDE,
};

export function getLayerCapabilities(kind: LayerKind): LayerCapabilities {
  return { ...BY_KIND[kind] };
}

export function defaultLayerName(kind: LayerKind, index: number): string {
  switch (kind) {
    case "sketch":
      return `Sketch ${String(index).padStart(2, "0")}`;
    case "object":
      return `Objects ${index}`;
    case "architecture":
      return "Architecture";
    case "reference":
      return "References";
    case "measurement":
      return "Measurements";
    case "guide":
      return "Guides";
    default:
      return `Layer ${index}`;
  }
}
