"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/engine/app/scope.ts
  function computePx(wMM, hMM, dpi) {
    return {
      wPx: Math.round(wMM / 25.4 * dpi),
      hPx: Math.round(hMM / 25.4 * dpi)
    };
  }
  var initial = computePx(420, 297, 150);
  var doc = {
    wMM: 420,
    hMM: 297,
    dpi: 150,
    wPx: initial.wPx,
    hPx: initial.hPx
  };
  function syncDocPx() {
    const px = computePx(doc.wMM, doc.hMM, doc.dpi);
    doc.wPx = px.wPx;
    doc.hPx = px.hPx;
  }
  var state = {
    mode: "draw",
    tool: "pen",
    color: "#0a0a0a",
    size: 2,
    alpha: 1,
    layers: [],
    activeLayer: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    baseZoom: 1,
    drawing: false,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    lastStampX: 0,
    lastStampY: 0,
    stampAccum: 0,
    snapshot: null,
    pxPerUnit: null,
    scaleUnit: "cm",
    measurements: [],
    showGrid: false,
    gridType: "square",
    gridSpacingMM: 20,
    snapEnabled: true,
    walls: [],
    wallsVisible: true,
    shapes: [],
    wallThickMM: 230,
    wallHeightM: 3,
    openingKind: "door",
    doorWMM: 900,
    doorHMM: 2100,
    winWMM: 1200,
    winHMM: 1200,
    winSillMM: 900,
    selOpening2D: null,
    gridMajor: 5,
    gridOpacity: 0.45,
    showMeasurements: true,
    pendingScale: false,
    pendingScaleStart: null,
    pendingScaleEnd: null,
    selectedStencil: null,
    customStencils: [],
    customHatches: [],
    fillStyle: "color",
    fillTextures: [],
    fillTexIndex: null,
    fillTexMode: "tile",
    fillTexScale: 1,
    stencilCat: "builtin",
    customBrushes: [],
    activeBrush: null,
    tipImageCache: {},
    cropMode: false,
    replaceImageInLayer: null,
    eyedropperActive: false,
    stabilizer: 0.3,
    smoothedX: 0,
    smoothedY: 0,
    velocity: 0,
    strokeAge: 0,
    usingBuffer: false,
    isPanning: false,
    pinchStart: null,
    infiniteCanvas: false,
    autoExpandCanvas: false,
    symmetryAxis: null,
    paperBg: "#ffffff",
    lineDrag: null
  };
  var S = {
    state,
    doc,
    syncDocPx
  };

  // src/engine/app/dom.ts
  function mustGet(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Studio DOM missing #${id}`);
    return el;
  }
  function initDom() {
    const refs = {
      paper: mustGet("paper"),
      stage: mustGet("canvas-stage"),
      area: mustGet("canvas-area"),
      bgImg: document.getElementById("bg-image"),
      layersList: mustGet("layers-list"),
      rulerOverlay: mustGet("ruler-overlay"),
      colorPopover: document.getElementById("color-popover"),
      stencilPopover: document.getElementById("stencil-popover"),
      hintEl: document.getElementById("hint"),
      fileInputImportImage: document.getElementById(
        "file-import-image"
      ),
      fileInputStencil: document.getElementById(
        "file-stencil"
      ),
      scalePrompt: document.getElementById("scale-prompt"),
      imgOverlay: document.getElementById("img-overlay")
    };
    Object.assign(S, refs);
    S.dom = refs;
    return refs;
  }

  // src/engine/interaction/object-capabilities.ts
  var DEFAULT_CAPABILITIES = {
    selectable: true,
    movable: true,
    deletable: true,
    renamable: true,
    reorderable: true,
    groupable: true,
    resizable: true,
    scalable: true,
    rotatable: true,
    supportsFill: false,
    supportsStroke: false,
    supportsOpacity: true,
    supportsMaterial: false,
    supportsChildren: false,
    selectableChildren: false,
    constrainedToParent: false,
    boundingBoxMode: "axis-aligned",
    resizeHandleMode: "corners"
  };
  var REGISTRY = {
    shape: {
      ...DEFAULT_CAPABILITIES,
      supportsFill: true,
      supportsStroke: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "corners-and-edges"
    },
    line: {
      ...DEFAULT_CAPABILITIES,
      supportsFill: false,
      supportsStroke: true,
      resizable: true,
      scalable: false,
      boundingBoxMode: "path-bounds",
      resizeHandleMode: "custom"
    },
    "sketch-stroke": {
      ...DEFAULT_CAPABILITIES,
      supportsFill: false,
      supportsStroke: true,
      resizable: false,
      scalable: true,
      rotatable: true,
      boundingBoxMode: "path-bounds",
      resizeHandleMode: "none"
    },
    stencil: {
      ...DEFAULT_CAPABILITIES,
      supportsFill: true,
      supportsStroke: false,
      boundingBoxMode: "oriented",
      resizeHandleMode: "corners-and-edges"
    },
    image: {
      ...DEFAULT_CAPABILITIES,
      supportsFill: false,
      supportsStroke: false,
      supportsOpacity: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "corners-and-edges"
    },
    // Registered early so architectural objects can opt in later without schema churn.
    wall: {
      ...DEFAULT_CAPABILITIES,
      scalable: false,
      supportsFill: true,
      supportsStroke: true,
      supportsMaterial: true,
      supportsChildren: true,
      selectableChildren: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom"
    },
    window: {
      ...DEFAULT_CAPABILITIES,
      reorderable: false,
      groupable: false,
      scalable: false,
      rotatable: false,
      supportsMaterial: true,
      constrainedToParent: true,
      moveConstraint: "along-host-wall",
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom"
    },
    door: {
      ...DEFAULT_CAPABILITIES,
      reorderable: false,
      groupable: false,
      scalable: false,
      rotatable: false,
      supportsMaterial: true,
      constrainedToParent: true,
      moveConstraint: "along-host-wall",
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom"
    },
    group: {
      ...DEFAULT_CAPABILITIES,
      supportsChildren: true,
      selectableChildren: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "corners-and-edges"
    },
    measurement: {
      ...DEFAULT_CAPABILITIES,
      groupable: true,
      scalable: false,
      supportsFill: false,
      supportsStroke: true,
      boundingBoxMode: "axis-aligned",
      resizeHandleMode: "custom"
    },
    floor: {
      ...DEFAULT_CAPABILITIES,
      supportsChildren: true,
      selectableChildren: true,
      supportsMaterial: true,
      boundingBoxMode: "axis-aligned",
      resizeHandleMode: "none"
    },
    mass: {
      ...DEFAULT_CAPABILITIES,
      supportsMaterial: true,
      supportsChildren: true,
      selectableChildren: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom"
    },
    "mass-face": {
      ...DEFAULT_CAPABILITIES,
      reorderable: false,
      groupable: false,
      movable: false,
      constrainedToParent: true,
      boundingBoxMode: "face-bounds",
      resizeHandleMode: "custom"
    },
    region: {
      ...DEFAULT_CAPABILITIES,
      supportsFill: true,
      supportsStroke: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom"
    },
    guide: {
      ...DEFAULT_CAPABILITIES,
      deletable: true,
      groupable: false,
      resizable: false,
      scalable: false,
      boundingBoxMode: "none",
      resizeHandleMode: "none"
    },
    light: {
      ...DEFAULT_CAPABILITIES,
      supportsMaterial: false,
      boundingBoxMode: "axis-aligned",
      resizeHandleMode: "none"
    },
    roof: {
      ...DEFAULT_CAPABILITIES,
      supportsMaterial: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom"
    }
  };
  var ObjectCapabilityRegistry = class {
    constructor(seed = REGISTRY) {
      this.map = new Map(Object.entries(seed));
    }
    get(type) {
      var _a;
      return (_a = this.map.get(type)) != null ? _a : { ...DEFAULT_CAPABILITIES, selectable: false };
    }
    register(type, capabilities) {
      this.map.set(type, capabilities);
    }
    has(type) {
      return this.map.has(type);
    }
  };
  var capabilityRegistry = new ObjectCapabilityRegistry();
  function createCapabilityRegistry(seed) {
    return new ObjectCapabilityRegistry(seed != null ? seed : REGISTRY);
  }

  // src/engine/interaction/selection-state.ts
  function createEmptySelectionState() {
    return {
      selectedIds: [],
      primarySelectedId: null,
      hoveredId: null,
      focusedLayerId: null,
      activeEditContextId: null,
      selectedSubElementId: null,
      selectionSource: "programmatic",
      isolationRootId: null,
      editingPathId: null,
      selectedFaceId: null
    };
  }
  function createSceneObjectId(prefix = "obj") {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  // src/engine/interaction/selection-manager.ts
  var SelectionManager = class {
    constructor(options = {}) {
      this.state = createEmptySelectionState();
      this.listeners = /* @__PURE__ */ new Set();
      var _a, _b;
      this.capabilities = (_a = options.capabilities) != null ? _a : capabilityRegistry;
      this.canSelect = (_b = options.canSelect) != null ? _b : (() => true);
    }
    getState() {
      return { ...this.state, selectedIds: [...this.state.selectedIds] };
    }
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    /** Replace selection with a single object (or clear if null). */
    select(objectId, source = "programmatic") {
      if (objectId == null) {
        this.clear(source);
        return;
      }
      if (!this.canSelect(objectId, source)) return;
      this.commit([objectId], objectId, source);
    }
    /** Shift-click / multi-select toggle. */
    toggle(objectId, source = "canvas") {
      var _a;
      if (!this.canSelect(objectId, source)) return;
      const set = new Set(this.state.selectedIds);
      if (set.has(objectId)) {
        set.delete(objectId);
        const next = [...set];
        this.commit(next, (_a = next[next.length - 1]) != null ? _a : null, source);
        return;
      }
      set.add(objectId);
      this.commit([...set], objectId, source);
    }
    /** Add without removing existing (marquee add mode). */
    add(objectIds, source = "canvas") {
      const set = new Set(this.state.selectedIds);
      let primary = this.state.primarySelectedId;
      for (const id of objectIds) {
        if (!this.canSelect(id, source)) continue;
        set.add(id);
        primary = id;
      }
      this.commit([...set], primary, source);
    }
    setMany(objectIds, source = "programmatic", primaryId) {
      var _a;
      const allowed = objectIds.filter((id) => this.canSelect(id, source));
      const primary = primaryId && allowed.includes(primaryId) ? primaryId : (_a = allowed[allowed.length - 1]) != null ? _a : null;
      this.commit(allowed, primary, source);
    }
    clear(source = "programmatic") {
      this.commit([], null, source);
    }
    setHovered(objectId) {
      if (this.state.hoveredId === objectId) return;
      this.state = { ...this.state, hoveredId: objectId };
    }
    setIsolationRoot(objectId) {
      this.state = { ...this.state, isolationRootId: objectId };
    }
    setEditingPath(objectId) {
      this.state = {
        ...this.state,
        editingPathId: objectId,
        activeEditContextId: objectId
      };
    }
    setActiveEditContext(objectId) {
      this.state = {
        ...this.state,
        activeEditContextId: objectId,
        editingPathId: objectId
      };
    }
    setSelectedSubElement(subElementId) {
      this.state = { ...this.state, selectedSubElementId: subElementId };
    }
    setFocusedLayer(layerId) {
      this.state = { ...this.state, focusedLayerId: layerId };
    }
    /**
     * Escape: exit edit context first, then clear selection.
     * Returns true when something changed.
     */
    handleEscape(source = "keyboard") {
      if (this.state.activeEditContextId || this.state.editingPathId) {
        this.setActiveEditContext(null);
        this.setSelectedSubElement(null);
        return true;
      }
      if (this.state.selectedIds.length > 0) {
        this.clear(source);
        return true;
      }
      return false;
    }
    isSelected(objectId) {
      return this.state.selectedIds.includes(objectId);
    }
    /** Capability helper used by interaction code. */
    isSelectableType(type) {
      return this.capabilities.get(type).selectable;
    }
    commit(selectedIds, primarySelectedId, source) {
      const same = this.state.primarySelectedId === primarySelectedId && this.state.selectionSource === source && this.state.selectedIds.length === selectedIds.length && this.state.selectedIds.every((id, i) => id === selectedIds[i]);
      if (same) return;
      this.state = {
        ...this.state,
        selectedIds,
        primarySelectedId,
        selectionSource: source
      };
      const event = {
        type: "selection-changed",
        selectedIds: [...selectedIds],
        primarySelectedId,
        source
      };
      for (const listener of this.listeners) listener(event);
    }
  };
  function createSelectionManager(options) {
    return new SelectionManager(options);
  }

  // src/engine/interaction/legacy-shape-adapter.ts
  function sceneTypeFromShapeKind(kind) {
    if (kind === "line") return "line";
    return "shape";
  }
  function ensureShapeId(shape) {
    if (typeof shape.id === "string" && shape.id.length > 0) return shape.id;
    shape.id = createSceneObjectId("shape");
    return shape.id;
  }
  function ensureAllShapeIds(shapes) {
    return shapes.map((shape) => ensureShapeId(shape));
  }

  // src/engine/layers/types.ts
  function createIdentityTransform2(x = 0, y = 0, z = 0) {
    return {
      position: { x, y, z },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    };
  }
  function createEmptyRelations(partial = {}) {
    var _a, _b, _c, _d, _e;
    return {
      hierarchyParentId: (_a = partial.hierarchyParentId) != null ? _a : null,
      hostObjectId: (_b = partial.hostObjectId) != null ? _b : null,
      floorId: (_c = partial.floorId) != null ? _c : null,
      layerId: (_d = partial.layerId) != null ? _d : null,
      groupIds: partial.groupIds ? [...partial.groupIds] : [],
      sourceObjectId: (_e = partial.sourceObjectId) != null ? _e : null,
      derivedObjectIds: partial.derivedObjectIds ? [...partial.derivedObjectIds] : []
    };
  }

  // src/engine/layers/ids.ts
  function createLayerEngineId(prefix) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
  function createFloorId() {
    return createLayerEngineId("floor");
  }
  function createLayerId() {
    return createLayerEngineId("layer");
  }
  function createObjectId(prefix = "obj") {
    return createLayerEngineId(prefix);
  }

  // src/engine/layers/layer-capabilities.ts
  var SKETCH = {
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
    defaultObjectSelectable: false
  };
  var OBJECT = {
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
    defaultObjectSelectable: true
  };
  var ARCHITECTURE = {
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
    defaultObjectSelectable: true
  };
  var REFERENCE = {
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
    defaultObjectSelectable: true
  };
  var MEASUREMENT = {
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
    defaultObjectSelectable: true
  };
  var GUIDE = {
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
    defaultObjectSelectable: true
  };
  var BY_KIND = {
    sketch: SKETCH,
    object: OBJECT,
    architecture: ARCHITECTURE,
    reference: REFERENCE,
    measurement: MEASUREMENT,
    guide: GUIDE
  };
  function getLayerCapabilities(kind) {
    return { ...BY_KIND[kind] };
  }
  function defaultLayerName(kind, index) {
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

  // src/engine/layers/transform-capabilities.ts
  var VISUAL = {
    movable: true,
    rotatable: true,
    scalable: true,
    resizable: true,
    editableGeometry: false,
    preserveAspectRatio: false,
    resizeMode: "free",
    flipable: true
  };
  var PROPORTIONAL = {
    ...VISUAL,
    preserveAspectRatio: true,
    resizable: true,
    scalable: true,
    resizeMode: "free"
  };
  var ARCH_RESIZE = {
    movable: true,
    rotatable: true,
    scalable: false,
    resizable: true,
    editableGeometry: true,
    resizeMode: "endpoints",
    flipable: false
  };
  var HOSTED_OPENING = {
    movable: true,
    rotatable: false,
    scalable: false,
    resizable: true,
    editableGeometry: false,
    constrainedToParent: true,
    allowedAxes: ["x"],
    resizeMode: "host-constrained"
  };
  var MEASUREMENT2 = {
    movable: true,
    rotatable: false,
    scalable: false,
    resizable: false,
    editableGeometry: true,
    resizeMode: "endpoints"
  };
  var GUIDE2 = {
    movable: true,
    rotatable: false,
    scalable: false,
    resizable: false,
    editableGeometry: true
  };
  var BY_TYPE = {
    "sketch-stroke": {
      movable: true,
      rotatable: true,
      scalable: true,
      resizable: false,
      editableGeometry: false,
      preserveAspectRatio: true,
      flipable: true
    },
    shape: {
      ...VISUAL,
      editableGeometry: true,
      resizeMode: "width-height"
    },
    line: {
      movable: true,
      rotatable: true,
      scalable: false,
      resizable: true,
      editableGeometry: true,
      resizeMode: "endpoints"
    },
    stencil: { ...PROPORTIONAL, mirrorable: true },
    image: { ...PROPORTIONAL, cropable: true, flipable: true },
    text: {
      movable: true,
      rotatable: true,
      scalable: true,
      resizable: true,
      editableGeometry: true,
      resizeMode: "width-height"
    },
    region: {
      ...VISUAL,
      editableGeometry: true,
      resizeMode: "free"
    },
    group: {
      movable: true,
      rotatable: true,
      scalable: true,
      resizable: true,
      editableGeometry: false,
      preserveAspectRatio: false,
      resizeMode: "free"
    },
    wall: { ...ARCH_RESIZE, resizeMode: "endpoints" },
    "floor-slab": {
      movable: true,
      rotatable: true,
      scalable: false,
      resizable: true,
      editableGeometry: true,
      resizeMode: "free"
    },
    ceiling: {
      movable: true,
      rotatable: false,
      scalable: false,
      resizable: true,
      editableGeometry: true,
      resizeMode: "free"
    },
    roof: {
      movable: true,
      rotatable: true,
      scalable: false,
      resizable: true,
      editableGeometry: true,
      resizeMode: "free"
    },
    door: HOSTED_OPENING,
    window: HOSTED_OPENING,
    column: {
      movable: true,
      rotatable: true,
      scalable: false,
      resizable: true,
      editableGeometry: false,
      resizeMode: "width-height"
    },
    stair: {
      movable: true,
      rotatable: true,
      scalable: false,
      resizable: true,
      editableGeometry: true,
      resizeMode: "free"
    },
    room: {
      movable: true,
      rotatable: false,
      scalable: false,
      resizable: true,
      editableGeometry: true,
      resizeMode: "free"
    },
    furniture: { ...PROPORTIONAL, resizeMode: "width-height" },
    fixture: { ...PROPORTIONAL },
    light: {
      movable: true,
      rotatable: true,
      scalable: false,
      resizable: false,
      editableGeometry: false
    },
    measurement: MEASUREMENT2,
    mass: {
      movable: true,
      rotatable: true,
      scalable: true,
      resizable: true,
      editableGeometry: true,
      resizeMode: "face-extrusion"
    },
    "mass-face": {
      movable: false,
      rotatable: false,
      scalable: false,
      resizable: true,
      editableGeometry: true,
      constrainedToParent: true,
      resizeMode: "face-extrusion"
    },
    guide: GUIDE2,
    "vanishing-point": GUIDE2,
    "construction-line": GUIDE2
  };
  var LAYER_WHOLE = {
    movable: true,
    rotatable: true,
    scalable: true,
    resizable: false,
    editableGeometry: false,
    preserveAspectRatio: true,
    flipable: true
  };
  function getTransformCapabilities(type) {
    const caps = BY_TYPE[type];
    if (caps) return { ...caps };
    return {
      movable: true,
      rotatable: true,
      scalable: true,
      resizable: true,
      editableGeometry: false,
      resizeMode: "free"
    };
  }
  function getLayerTransformCapabilities() {
    return { ...LAYER_WHOLE };
  }
  function prefersResizeOverScale(type) {
    const caps = getTransformCapabilities(type);
    return caps.resizable && !caps.scalable;
  }

  // src/engine/layers/coordinates.ts
  function defaultTransformSpace(objectType, hasHost) {
    if (objectType === "door" || objectType === "window") {
      return hasHost ? "wall-local" : "world";
    }
    if (objectType === "furniture" || objectType === "fixture" || objectType === "light" || objectType === "room") {
      return "floor-local";
    }
    if (objectType === "mass-face") return "object-local";
    return "world";
  }
  function translateTransform(t, delta) {
    return {
      ...t,
      position: {
        x: t.position.x + delta.x,
        y: t.position.y + delta.y,
        z: t.position.z + delta.z
      }
    };
  }
  function rotateTransformZ(t, degrees) {
    return {
      ...t,
      rotation: {
        ...t.rotation,
        z: t.rotation.z + degrees
      }
    };
  }
  function scaleTransform(t, factor, uniform = false) {
    const sx = factor.x;
    const sy = uniform ? factor.x : factor.y;
    const sz = uniform ? factor.x : factor.z;
    return {
      ...t,
      scale: {
        x: t.scale.x * sx,
        y: t.scale.y * sy,
        z: t.scale.z * sz
      }
    };
  }

  // src/engine/layers/snap-engine.ts
  var SnapEngine = class {
    constructor(options = {}) {
      this.targets = [];
      var _a, _b, _c, _d, _e;
      this.enabled = (_a = options.enabled) != null ? _a : true;
      this.tolerancePx = (_b = options.tolerancePx) != null ? _b : 8;
      this.gridSpacing = (_c = options.gridSpacing) != null ? _c : 5;
      this.gridSnap = (_d = options.gridSnap) != null ? _d : true;
      this.objectSnap = (_e = options.objectSnap) != null ? _e : true;
    }
    configure(options) {
      if (options.enabled !== void 0) this.enabled = options.enabled;
      if (options.tolerancePx !== void 0) this.tolerancePx = options.tolerancePx;
      if (options.gridSpacing !== void 0) this.gridSpacing = options.gridSpacing;
      if (options.gridSnap !== void 0) this.gridSnap = options.gridSnap;
      if (options.objectSnap !== void 0) this.objectSnap = options.objectSnap;
    }
    setTargets(targets) {
      this.targets = targets.slice();
    }
    clearTargets() {
      this.targets = [];
    }
    snap(point, excludeObjectIds = []) {
      if (!this.enabled) return null;
      const exclude = new Set(excludeObjectIds);
      let best = null;
      if (this.gridSnap && this.gridSpacing > 0) {
        const gx = Math.round(point.x / this.gridSpacing) * this.gridSpacing;
        const gy = Math.round(point.y / this.gridSpacing) * this.gridSpacing;
        const gridPoint = { x: gx, y: gy, z: point.z };
        const distance = Math.hypot(point.x - gx, point.y - gy);
        if (distance <= this.tolerancePx) {
          best = {
            type: "grid",
            point: gridPoint,
            distance
          };
        }
      }
      if (this.objectSnap) {
        for (const target of this.targets) {
          if (target.objectId && exclude.has(target.objectId)) continue;
          const distance = Math.hypot(
            point.x - target.point.x,
            point.y - target.point.y,
            point.z - target.point.z
          );
          if (distance > this.tolerancePx) continue;
          if (best) {
            if (distance > best.distance) continue;
            if (distance === best.distance && best.type !== "grid") continue;
          }
          best = {
            type: target.type,
            targetObjectId: target.objectId,
            point: { ...target.point },
            distance,
            guide: target.axis ? { axis: target.axis, from: point, to: target.point } : void 0
          };
        }
      }
      return best;
    }
    /** Apply snap if available, otherwise return the original point. */
    resolve(point, excludeObjectIds) {
      const hit = this.snap(point, excludeObjectIds);
      return hit ? { ...hit.point } : { ...point };
    }
  };
  function createSnapEngine(options) {
    return new SnapEngine(options);
  }

  // src/engine/layers/transform-engine.ts
  var TransformEngine = class {
    constructor(options = {}) {
      this.session = null;
      var _a;
      this.snap = (_a = options.snap) != null ? _a : null;
    }
    getCapabilities(object) {
      return getTransformCapabilities(object.type);
    }
    prefersResize(object) {
      return prefersResizeOverScale(object.type);
    }
    begin(objects, mode, options = {}) {
      var _a, _b;
      if (objects.length === 0) return null;
      for (const obj of objects) {
        const caps = this.getCapabilities(obj);
        if (mode === "move" && !caps.movable) return null;
        if (mode === "rotate" && !caps.rotatable) return null;
        if (mode === "scale" && !caps.scalable) return null;
        if (mode === "resize" && !caps.resizable) return null;
        if (mode === "edit-geometry" && !caps.editableGeometry) return null;
      }
      const startTransforms = {};
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (const obj of objects) {
        startTransforms[obj.id] = cloneTransform(obj.transform);
        sx += obj.transform.position.x;
        sy += obj.transform.position.y;
        sz += obj.transform.position.z;
      }
      const n = objects.length;
      const pivot = (_a = options.pivot) != null ? _a : { x: sx / n, y: sy / n, z: sz / n };
      const preserveAspectRatio = (_b = options.preserveAspectRatio) != null ? _b : objects.every((o) => this.getCapabilities(o).preserveAspectRatio);
      this.session = {
        mode,
        objectIds: objects.map((o) => o.id),
        startTransforms,
        pivot,
        preserveAspectRatio: Boolean(preserveAspectRatio)
      };
      return this.session;
    }
    getSession() {
      return this.session ? {
        ...this.session,
        objectIds: [...this.session.objectIds],
        startTransforms: { ...this.session.startTransforms }
      } : null;
    }
    update(objectsById, delta) {
      if (!this.session) return [];
      const results = [];
      for (const id of this.session.objectIds) {
        const obj = objectsById[id];
        const start = this.session.startTransforms[id];
        if (!obj || !start) continue;
        const caps = this.getCapabilities(obj);
        if (this.session.mode === "move" && delta.translation) {
          let next = delta.translation;
          if (this.snap) {
            const target = {
              x: start.position.x + next.x,
              y: start.position.y + next.y,
              z: start.position.z + next.z
            };
            const snapped = this.snap.resolve(target, this.session.objectIds);
            next = {
              x: snapped.x - start.position.x,
              y: snapped.y - start.position.y,
              z: snapped.z - start.position.z
            };
          }
          if (caps.constrainedToParent && caps.allowedAxes) {
            next = constrainAxes(next, caps.allowedAxes);
          }
          results.push({
            objectId: id,
            transform: translateTransform(start, next)
          });
          continue;
        }
        if (this.session.mode === "rotate" && delta.rotationDeg !== void 0) {
          results.push({
            objectId: id,
            transform: rotateTransformZ(start, delta.rotationDeg)
          });
          continue;
        }
        if (this.session.mode === "scale" && delta.scaleFactor) {
          const factor = this.session.preserveAspectRatio ? {
            x: delta.scaleFactor.x,
            y: delta.scaleFactor.x,
            z: delta.scaleFactor.x
          } : delta.scaleFactor;
          results.push({
            objectId: id,
            transform: scaleTransform(start, factor, this.session.preserveAspectRatio)
          });
          continue;
        }
        if (this.session.mode === "resize" && delta.resize) {
          results.push({
            objectId: id,
            transform: { ...start },
            geometryPatch: { ...delta.resize }
          });
        }
      }
      return results;
    }
    commit() {
      if (!this.session) return null;
      const result = {
        objectIds: [...this.session.objectIds],
        mode: this.session.mode
      };
      this.session = null;
      return result;
    }
    cancel() {
      this.session = null;
    }
  };
  function cloneTransform(t) {
    return {
      position: { ...t.position },
      rotation: { ...t.rotation },
      scale: { ...t.scale }
    };
  }
  function constrainAxes(delta, axes) {
    return {
      x: axes.includes("x") ? delta.x : 0,
      y: axes.includes("y") ? delta.y : 0,
      z: axes.includes("z") ? delta.z : 0
    };
  }
  function createTransformEngine(options) {
    return new TransformEngine(options);
  }

  // src/engine/layers/layer-engine.ts
  function nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  var LayerEngine = class {
    constructor(options = {}) {
      this.floors = {};
      this.layers = {};
      this.objects = {};
      this.rootFloorIds = [];
      this.activeFloorId = null;
      this.activeLayerId = null;
      this.mutationVersion = 0;
      this._mainLayerId = null;
      this._sketchLayerId = null;
      this.listeners = /* @__PURE__ */ new Set();
      var _a, _b;
      this.snap = (_a = options.snap) != null ? _a : createSnapEngine();
      this.transform = (_b = options.transform) != null ? _b : createTransformEngine({ snap: this.snap });
    }
    /* ───────── lifecycle ───────── */
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    getMutationVersion() {
      return this.mutationVersion;
    }
    snapshot() {
      return {
        floors: structuredClone(this.floors),
        layers: structuredClone(this.layers),
        objects: structuredClone(this.objects),
        rootFloorIds: [...this.rootFloorIds],
        activeFloorId: this.activeFloorId,
        activeLayerId: this.activeLayerId
      };
    }
    loadSnapshot(snapshot) {
      this.floors = structuredClone(snapshot.floors);
      this.layers = structuredClone(snapshot.layers);
      this.objects = structuredClone(snapshot.objects);
      this.rootFloorIds = [...snapshot.rootFloorIds];
      this.activeFloorId = snapshot.activeFloorId;
      this.activeLayerId = snapshot.activeLayerId;
      this.bump("scene-loaded");
    }
    /**
     * Figma-style default: Layer 1 (hosts walls/shapes as elements) + Sketch.
     */
    bootstrap(options = {}) {
      var _a, _b, _c;
      this.floors = {};
      this.layers = {};
      this.objects = {};
      this.rootFloorIds = [];
      this.activeFloorId = null;
      this.activeLayerId = null;
      const floorId = this.createFloor((_a = options.floorName) != null ? _a : "Canvas");
      const mainLayerId = this.createLayer({
        name: (_b = options.mainLayerName) != null ? _b : "Layer 1",
        layerKind: "object",
        floorId
      });
      const sketchLayerId = this.createLayer({
        name: (_c = options.sketchLayerName) != null ? _c : "Sketch",
        layerKind: "sketch",
        floorId
      });
      this.layers[mainLayerId].expanded = true;
      this._mainLayerId = mainLayerId;
      this._sketchLayerId = sketchLayerId;
      this.setActiveLayer(sketchLayerId);
      return { floorId, mainLayerId, sketchLayerId };
    }
    getMainLayerId() {
      var _a, _b;
      if (this._mainLayerId && this.layers[this._mainLayerId]) return this._mainLayerId;
      const objectLayer = Object.values(this.layers).find((l) => l.layerKind === "object");
      if (objectLayer) return objectLayer.id;
      const floorId = this.rootFloorIds[0];
      if (!floorId) return null;
      return (_b = (_a = this.floors[floorId]) == null ? void 0 : _a.layerIds[0]) != null ? _b : null;
    }
    getSketchLayerId() {
      var _a, _b;
      if (this._sketchLayerId && this.layers[this._sketchLayerId]) {
        return this._sketchLayerId;
      }
      return (_b = (_a = Object.values(this.layers).find((l) => l.layerKind === "sketch")) == null ? void 0 : _a.id) != null ? _b : null;
    }
    /**
     * Drawable (raster) layer ids in paint order — bottom of stack first.
     * Object-host layers like "Layer 1" are excluded; only sketch surfaces ink.
     */
    getRasterLayerIds() {
      const ids = [];
      const walk = (layerIds) => {
        for (const id of layerIds) {
          const layer = this.layers[id];
          if (!layer) continue;
          if (getLayerCapabilities(layer.layerKind).canDraw) ids.push(id);
          if (layer.childLayerIds.length) walk(layer.childLayerIds);
        }
      };
      for (const floorId of this.rootFloorIds) {
        const floor = this.floors[floorId];
        if (floor) walk(floor.layerIds);
      }
      return ids;
    }
    /**
     * Rebuild floors/layers from a flat legacy save list (raster rows only).
     * Always creates an object host "Layer 1", then one sketch layer per entry.
     * Returns engine ids aligned 1:1 with `legacyLayers` for surface allocation.
     */
    rebuildFromLegacyLayers(legacyLayers, activeIndex = 0) {
      var _a, _b;
      this.floors = {};
      this.layers = {};
      this.objects = {};
      this.rootFloorIds = [];
      this.activeFloorId = null;
      this.activeLayerId = null;
      this._mainLayerId = null;
      this._sketchLayerId = null;
      const floorId = this.createFloor("Canvas");
      const mainLayerId = this.createLayer({
        name: "Layer 1",
        layerKind: "object",
        floorId
      });
      this.layers[mainLayerId].expanded = true;
      this._mainLayerId = mainLayerId;
      const engineIds = [];
      const list = Array.isArray(legacyLayers) ? legacyLayers : [];
      for (let i = 0; i < list.length; i++) {
        const ld = (_a = list[i]) != null ? _a : {};
        const id = this.createLayer({
          name: ld.name || `Layer ${i + 1}`,
          layerKind: "sketch",
          floorId,
          visible: ld.visible !== false,
          locked: ld.locked,
          opacity: typeof ld.opacity === "number" ? ld.opacity : 1,
          blendMode: ld.blendMode
        });
        const layer = this.layers[id];
        if (typeof ld.trace === "number") layer.trace = ld.trace;
        layer.rasterPath = (_b = ld.raster_path) != null ? _b : null;
        engineIds.push(id);
        if (i === 0) this._sketchLayerId = id;
      }
      if (engineIds.length === 0) {
        const sketchId = this.createLayer({
          name: "Sketch",
          layerKind: "sketch",
          floorId
        });
        this._sketchLayerId = sketchId;
        this.setActiveLayer(sketchId);
        return [];
      }
      const clamped = Math.max(0, Math.min(activeIndex, engineIds.length - 1));
      this.setActiveLayer(engineIds[clamped]);
      return engineIds;
    }
    /* ───────── floors ───────── */
    createFloor(name = "Floor", elevation = 0) {
      const id = createFloorId();
      const order = this.rootFloorIds.length;
      this.floors[id] = {
        id,
        kind: "floor",
        name,
        visible: true,
        locked: false,
        opacity: 1,
        order,
        layerIds: [],
        elevation
      };
      this.rootFloorIds.push(id);
      if (!this.activeFloorId) this.activeFloorId = id;
      this.emit({ type: "floor-changed", floorId: id });
      this.bump("floor-created");
      return id;
    }
    getFloor(floorId) {
      var _a;
      return (_a = this.floors[floorId]) != null ? _a : null;
    }
    getActiveFloorId() {
      return this.activeFloorId;
    }
    setActiveFloor(floorId) {
      if (!this.floors[floorId]) return;
      this.activeFloorId = floorId;
      this.emit({ type: "floor-changed", floorId });
    }
    renameFloor(floorId, name) {
      const floor = this.floors[floorId];
      if (!floor) return;
      floor.name = name.trim() || floor.name;
      this.emit({ type: "floor-changed", floorId });
      this.bump("floor-renamed");
    }
    /* ───────── layers ───────── */
    createLayer(options = {}) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      const layerKind = (_a = options.layerKind) != null ? _a : "sketch";
      const caps = getLayerCapabilities(layerKind);
      const floorId = (_c = (_b = options.floorId) != null ? _b : this.activeFloorId) != null ? _c : this.rootFloorIds[0];
      if (!floorId || !this.floors[floorId]) {
        throw new Error("LayerEngine.createLayer: no floor available");
      }
      const parentLayerId = (_d = options.parentLayerId) != null ? _d : null;
      if (parentLayerId && !this.layers[parentLayerId]) {
        throw new Error("LayerEngine.createLayer: parent layer not found");
      }
      const siblings = parentLayerId ? this.layers[parentLayerId].childLayerIds : this.floors[floorId].layerIds;
      const id = createLayerId();
      const index = siblings.length + 1;
      const layer = {
        id,
        kind: "layer",
        layerKind,
        name: (_e = options.name) != null ? _e : defaultLayerName(layerKind, index),
        floorId,
        parentLayerId,
        visible: (_f = options.visible) != null ? _f : true,
        locked: (_g = options.locked) != null ? _g : caps.lockByDefault,
        opacity: (_h = options.opacity) != null ? _h : 1,
        order: 0,
        blendMode: (_i = options.blendMode) != null ? _i : "source-over",
        expanded: layerKind === "architecture" || layerKind === "object",
        trace: layerKind === "sketch" ? 0 : void 0,
        rasterPath: null,
        childLayerIds: [],
        objectIds: []
      };
      this.layers[id] = layer;
      const insertAt = options.insertAt !== void 0 ? Math.max(0, Math.min(options.insertAt, siblings.length)) : siblings.length;
      siblings.splice(insertAt, 0, id);
      this.reindexLayerOrders(siblings);
      if (parentLayerId) {
        this.layers[parentLayerId].expanded = true;
      }
      if (!this.activeLayerId) this.activeLayerId = id;
      this.activeFloorId = floorId;
      this.emit({ type: "layer-created", layerId: id });
      this.bump("layer-created");
      return id;
    }
    getLayer(layerId) {
      var _a;
      return (_a = this.layers[layerId]) != null ? _a : null;
    }
    getActiveLayerId() {
      return this.activeLayerId;
    }
    setActiveLayer(layerId) {
      if (layerId && !this.layers[layerId]) return;
      if (this.activeLayerId === layerId) return;
      this.activeLayerId = layerId;
      if (layerId) {
        this.activeFloorId = this.layers[layerId].floorId;
      }
      this.emit({ type: "active-layer-changed", layerId });
      this.emit({ type: "selection-sync-needed" });
    }
    renameLayer(layerId, name) {
      const layer = this.layers[layerId];
      if (!layer || layer.locked) return;
      layer.name = name.trim() || layer.name;
      this.emit({ type: "layer-updated", layerId });
      this.bump("layer-renamed");
    }
    setLayerVisibility(layerId, visible) {
      const layer = this.layers[layerId];
      if (!layer) return;
      layer.visible = visible;
      this.emit({ type: "layer-updated", layerId });
      this.bump("layer-visibility");
    }
    setLayerLocked(layerId, locked) {
      const layer = this.layers[layerId];
      if (!layer) return;
      layer.locked = locked;
      this.emit({ type: "layer-updated", layerId });
      this.bump("layer-lock");
    }
    setLayerOpacity(layerId, opacity) {
      const layer = this.layers[layerId];
      if (!layer) return;
      layer.opacity = clamp01(opacity);
      this.emit({ type: "layer-updated", layerId });
      this.bump("layer-opacity");
    }
    setLayerBlendMode(layerId, blendMode) {
      const layer = this.layers[layerId];
      if (!layer) return;
      const caps = getLayerCapabilities(layer.layerKind);
      if (!caps.supportsBlendMode) return;
      layer.blendMode = blendMode;
      this.emit({ type: "layer-updated", layerId });
      this.bump("layer-blend");
    }
    setLayerExpanded(layerId, expanded) {
      const layer = this.layers[layerId];
      if (!layer) return;
      layer.expanded = expanded;
      this.emit({ type: "layer-updated", layerId });
    }
    toggleLayerExpanded(layerId) {
      const layer = this.layers[layerId];
      if (!layer) return;
      this.setLayerExpanded(layerId, !layer.expanded);
    }
    /** Reorder a layer among its siblings. */
    moveLayer(layerId, toIndex) {
      const layer = this.layers[layerId];
      if (!layer) return;
      const siblings = this.siblingLayerIds(layer);
      const from = siblings.indexOf(layerId);
      if (from < 0) return;
      siblings.splice(from, 1);
      const insertAt = Math.max(0, Math.min(toIndex, siblings.length));
      siblings.splice(insertAt, 0, layerId);
      this.reindexLayerOrders(siblings);
      this.emit({ type: "layer-reordered", layerIds: [...siblings] });
      this.bump("layer-reordered");
    }
    duplicateLayer(layerId) {
      const src = this.layers[layerId];
      if (!src) return null;
      const newId = this.createLayer({
        name: `${src.name} copy`,
        layerKind: src.layerKind,
        floorId: src.floorId,
        parentLayerId: src.parentLayerId,
        locked: src.locked,
        visible: src.visible,
        opacity: src.opacity,
        blendMode: src.blendMode
      });
      const dst = this.layers[newId];
      dst.trace = src.trace;
      dst.rasterPath = src.rasterPath;
      for (const objectId of src.objectIds) {
        const obj = this.objects[objectId];
        if (!obj || obj.relations.hierarchyParentId) continue;
        this.duplicateObjectTree(objectId, newId, null);
      }
      return newId;
    }
    deleteLayers(layerIds) {
      const toDelete = /* @__PURE__ */ new Set();
      const collect = (id) => {
        if (toDelete.has(id)) return;
        const layer = this.layers[id];
        if (!layer) return;
        toDelete.add(id);
        for (const child of layer.childLayerIds) collect(child);
      };
      for (const id of layerIds) collect(id);
      const objectIds = [];
      for (const id of toDelete) {
        const layer = this.layers[id];
        if (!layer) continue;
        objectIds.push(...this.collectObjectIdsOnLayer(id));
        this.detachLayerFromParent(layer);
        delete this.layers[id];
      }
      this.deleteObjects(objectIds, { skipLayerCleanup: true });
      if (this.activeLayerId && toDelete.has(this.activeLayerId)) {
        this.activeLayerId = this.firstDrawableLayerId();
        this.emit({
          type: "active-layer-changed",
          layerId: this.activeLayerId
        });
      }
      this.emit({ type: "layer-deleted", layerIds: [...toDelete] });
      this.bump("layer-deleted");
    }
    getLayerCapabilities(layerId) {
      const layer = this.layers[layerId];
      if (!layer) return null;
      return getLayerCapabilities(layer.layerKind);
    }
    /* ───────── objects ───────── */
    createObject(options) {
      var _a, _b, _c, _d, _e, _f;
      const layer = this.layers[options.layerId];
      if (!layer) throw new Error("LayerEngine.createObject: layer not found");
      const caps = getLayerCapabilities(layer.layerKind);
      if (!caps.canHostObjects && options.type !== "sketch-stroke") {
        if (layer.layerKind !== "sketch") {
          throw new Error(
            `LayerEngine.createObject: layer kind "${layer.layerKind}" cannot host objects`
          );
        }
      }
      const id = createObjectId(options.type);
      const stamp = nowIso();
      const hostObjectId = (_a = options.hostObjectId) != null ? _a : null;
      const hierarchyParentId = (_b = options.parentObjectId) != null ? _b : null;
      if (hierarchyParentId && !this.objects[hierarchyParentId]) {
        throw new Error("LayerEngine.createObject: parent object not found");
      }
      if (hostObjectId && !this.objects[hostObjectId]) {
        throw new Error("LayerEngine.createObject: host object not found");
      }
      const node = {
        id,
        kind: options.type === "group" ? "group" : "object",
        type: options.type,
        name: (_c = options.name) != null ? _c : defaultObjectName(options.type),
        layerId: options.layerId,
        floorId: layer.floorId,
        visible: (_d = options.visible) != null ? _d : true,
        locked: (_e = options.locked) != null ? _e : false,
        opacity: (_f = options.opacity) != null ? _f : 1,
        order: 0,
        transform: options.transform ? cloneTransform2(options.transform) : createIdentityTransform2(),
        transformSpace: defaultTransformSpace(options.type, Boolean(hostObjectId)),
        relations: createEmptyRelations({
          hierarchyParentId,
          hostObjectId,
          floorId: layer.floorId,
          layerId: options.layerId
        }),
        childIds: [],
        geometry: options.geometry ? { ...options.geometry } : void 0,
        style: options.style ? { ...options.style } : void 0,
        createdAt: stamp,
        updatedAt: stamp,
        metadata: options.metadata ? { ...options.metadata } : void 0
      };
      this.objects[id] = node;
      layer.expanded = true;
      if (hierarchyParentId) {
        this.objects[hierarchyParentId].childIds.push(id);
      } else {
        layer.objectIds.push(id);
        node.order = layer.objectIds.length - 1;
      }
      if (hostObjectId) {
        const host = this.objects[hostObjectId];
        if (!host.childIds.includes(id)) host.childIds.push(id);
      }
      this.emit({ type: "object-created", objectId: id });
      this.bump("object-created");
      return id;
    }
    getObject(objectId) {
      var _a;
      return (_a = this.objects[objectId]) != null ? _a : null;
    }
    getObjects() {
      return this.objects;
    }
    renameObject(objectId, name) {
      const obj = this.objects[objectId];
      if (!obj || obj.locked) return;
      obj.name = name.trim() || obj.name;
      obj.updatedAt = nowIso();
      this.emit({ type: "object-updated", objectId });
      this.bump("object-renamed");
    }
    setObjectVisibility(objectId, visible) {
      const obj = this.objects[objectId];
      if (!obj) return;
      obj.visible = visible;
      obj.updatedAt = nowIso();
      this.emit({ type: "object-updated", objectId });
      this.bump("object-visibility");
    }
    setObjectLocked(objectId, locked) {
      const obj = this.objects[objectId];
      if (!obj) return;
      obj.locked = locked;
      obj.updatedAt = nowIso();
      this.emit({ type: "object-updated", objectId });
      this.bump("object-lock");
    }
    setObjectOpacity(objectId, opacity) {
      const obj = this.objects[objectId];
      if (!obj) return;
      obj.opacity = clamp01(opacity);
      obj.updatedAt = nowIso();
      this.emit({ type: "object-updated", objectId });
      this.bump("object-opacity");
    }
    applyObjectTransform(objectId, transform) {
      const obj = this.objects[objectId];
      if (!obj || obj.locked) return;
      obj.transform = cloneTransform2(transform);
      obj.updatedAt = nowIso();
      this.emit({ type: "object-updated", objectId });
      this.bump("object-transform");
    }
    patchObjectGeometry(objectId, patch) {
      var _a;
      const obj = this.objects[objectId];
      if (!obj || obj.locked) return;
      obj.geometry = { ...(_a = obj.geometry) != null ? _a : {}, ...patch };
      obj.updatedAt = nowIso();
      this.emit({ type: "object-updated", objectId });
      this.bump("object-geometry");
    }
    /**
     * Group selected objects into a visual group.
     * Preserves world transforms and host constraints (doors stay on walls).
     */
    groupObjects(objectIds, name = "Group") {
      var _a;
      const roots = objectIds.map((id) => this.objects[id]).filter((o) => Boolean(o));
      if (roots.length < 2) return null;
      const layerId = roots[0].layerId;
      if (!roots.every((o) => o.layerId === layerId)) {
        throw new Error("LayerEngine.groupObjects: objects must share a layer");
      }
      const groupId = this.createObject({
        type: "group",
        name,
        layerId,
        transform: createIdentityTransform2()
      });
      const group = this.objects[groupId];
      for (const obj of roots) {
        this.detachObjectFromHierarchy(obj);
        obj.relations.hierarchyParentId = groupId;
        obj.relations.groupIds = [...(_a = obj.relations.groupIds) != null ? _a : [], groupId];
        group.childIds.push(obj.id);
        obj.updatedAt = nowIso();
      }
      this.emit({ type: "object-updated", objectId: groupId });
      this.bump("objects-grouped");
      return groupId;
    }
    ungroup(groupId) {
      var _a;
      const group = this.objects[groupId];
      if (!group || group.type !== "group") return [];
      const childIds = [...group.childIds];
      const layer = this.layers[group.layerId];
      if (!layer) return [];
      for (const childId of childIds) {
        const child = this.objects[childId];
        if (!child) continue;
        child.relations.hierarchyParentId = null;
        child.relations.groupIds = ((_a = child.relations.groupIds) != null ? _a : []).filter(
          (id) => id !== groupId
        );
        layer.objectIds.push(childId);
        child.updatedAt = nowIso();
      }
      group.childIds = [];
      this.deleteObjects([groupId]);
      return childIds;
    }
    deleteObjects(objectIds, options = {}) {
      const toDelete = /* @__PURE__ */ new Set();
      const collect = (id) => {
        if (toDelete.has(id)) return;
        const obj = this.objects[id];
        if (!obj) return;
        toDelete.add(id);
        for (const childId of obj.childIds) collect(childId);
        for (const [otherId, other] of Object.entries(this.objects)) {
          if (other.relations.hostObjectId === id) collect(otherId);
        }
      };
      for (const id of objectIds) collect(id);
      for (const id of toDelete) {
        const obj = this.objects[id];
        if (!obj) continue;
        if (!options.skipLayerCleanup) this.detachObjectFromHierarchy(obj);
        delete this.objects[id];
      }
      if (toDelete.size > 0) {
        this.emit({ type: "object-deleted", objectIds: [...toDelete] });
        this.bump("object-deleted");
      }
    }
    /* ───────── transform session helpers ───────── */
    beginTransform(objectIds, mode) {
      const objects = objectIds.map((id) => this.objects[id]).filter((o) => Boolean(o) && !o.locked);
      return this.transform.begin(objects, mode);
    }
    updateTransform(delta) {
      const results = this.transform.update(this.objects, delta);
      for (const result of results) {
        this.applyObjectTransform(result.objectId, result.transform);
        if (result.geometryPatch) {
          this.patchObjectGeometry(result.objectId, result.geometryPatch);
        }
      }
    }
    commitTransform() {
      const result = this.transform.commit();
      if (!result) return;
      this.emit({
        type: "transform-committed",
        objectIds: result.objectIds,
        mode: result.mode
      });
      this.bump("transform-committed");
    }
    cancelTransform() {
      const session = this.transform.getSession();
      if (!session) return;
      for (const id of session.objectIds) {
        const start = session.startTransforms[id];
        if (start) this.applyObjectTransform(id, start);
      }
      this.transform.cancel();
    }
    /* ───────── panel projection ───────── */
    /**
     * Flatten the scene into layer-panel rows.
     * Same hierarchy as the scene model — not a UI-only tree.
     */
    getPanelRows(options = {}) {
      var _a, _b;
      const includeObjects = (_a = options.includeObjects) != null ? _a : true;
      const hideFloors = (_b = options.hideFloors) != null ? _b : true;
      const rows = [];
      for (const floorId of this.rootFloorIds) {
        const floor = this.floors[floorId];
        if (!floor) continue;
        let layerDepth = 0;
        if (!hideFloors) {
          rows.push({
            id: floor.id,
            nodeKind: "floor",
            name: floor.name,
            depth: 0,
            visible: floor.visible,
            locked: floor.locked,
            opacity: floor.opacity,
            expanded: true,
            hasChildren: floor.layerIds.length > 0,
            parentId: null
          });
          layerDepth = 1;
        }
        for (let i = floor.layerIds.length - 1; i >= 0; i--) {
          this.pushLayerRows(rows, floor.layerIds[i], layerDepth, includeObjects);
        }
      }
      return rows;
    }
    /* ───────── queries ───────── */
    isEffectivelyVisible(objectId) {
      const obj = this.objects[objectId];
      if (!obj || !obj.visible) return false;
      const layer = this.layers[obj.layerId];
      if (!layer || !layer.visible) return false;
      const floor = this.floors[obj.floorId];
      if (!floor || !floor.visible) return false;
      if (obj.relations.hierarchyParentId) {
        return this.isEffectivelyVisible(obj.relations.hierarchyParentId);
      }
      return true;
    }
    isEffectivelyLocked(objectId) {
      const obj = this.objects[objectId];
      if (!obj) return true;
      if (obj.locked) return true;
      const layer = this.layers[obj.layerId];
      if (layer == null ? void 0 : layer.locked) return true;
      const floor = this.floors[obj.floorId];
      if (floor == null ? void 0 : floor.locked) return true;
      return false;
    }
    /* ───────── internals ───────── */
    pushLayerRows(rows, layerId, depth, includeObjects) {
      var _a;
      const layer = this.layers[layerId];
      if (!layer) return;
      const caps = getLayerCapabilities(layer.layerKind);
      const showObjects = includeObjects && caps.showChildrenInPanel && layer.expanded;
      rows.push({
        id: layer.id,
        nodeKind: "layer",
        layerKind: layer.layerKind,
        name: layer.name,
        depth,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        expanded: layer.expanded,
        hasChildren: layer.childLayerIds.length > 0 || caps.showChildrenInPanel && layer.objectIds.length > 0,
        parentId: (_a = layer.parentLayerId) != null ? _a : layer.floorId
      });
      if (layer.expanded) {
        if (showObjects) {
          for (let i = layer.objectIds.length - 1; i >= 0; i--) {
            this.pushObjectRows(rows, layer.objectIds[i], depth + 1);
          }
        }
        for (const childId of layer.childLayerIds) {
          this.pushLayerRows(rows, childId, depth + 1, includeObjects);
        }
      }
    }
    pushObjectRows(rows, objectId, depth) {
      var _a;
      const obj = this.objects[objectId];
      if (!obj) return;
      if (obj.relations.hostObjectId && obj.relations.hierarchyParentId == null) {
      }
      rows.push({
        id: obj.id,
        nodeKind: "object",
        objectType: obj.type,
        name: obj.name,
        depth,
        visible: obj.visible,
        locked: obj.locked,
        opacity: obj.opacity,
        expanded: false,
        hasChildren: obj.childIds.length > 0,
        parentId: (_a = obj.relations.hierarchyParentId) != null ? _a : obj.layerId
      });
      for (const childId of obj.childIds) {
        this.pushObjectRows(rows, childId, depth + 1);
      }
    }
    siblingLayerIds(layer) {
      if (layer.parentLayerId) {
        return this.layers[layer.parentLayerId].childLayerIds;
      }
      return this.floors[layer.floorId].layerIds;
    }
    reindexLayerOrders(ids) {
      ids.forEach((id, index) => {
        const layer = this.layers[id];
        if (layer) layer.order = index;
      });
    }
    detachLayerFromParent(layer) {
      if (layer.parentLayerId) {
        const parent = this.layers[layer.parentLayerId];
        if (parent) {
          parent.childLayerIds = parent.childLayerIds.filter(
            (id) => id !== layer.id
          );
          this.reindexLayerOrders(parent.childLayerIds);
        }
        return;
      }
      const floor = this.floors[layer.floorId];
      if (floor) {
        floor.layerIds = floor.layerIds.filter((id) => id !== layer.id);
        this.reindexLayerOrders(floor.layerIds);
      }
    }
    detachObjectFromHierarchy(obj) {
      const parentId = obj.relations.hierarchyParentId;
      if (parentId) {
        const parent = this.objects[parentId];
        if (parent) {
          parent.childIds = parent.childIds.filter((id) => id !== obj.id);
        }
      } else {
        const layer = this.layers[obj.layerId];
        if (layer) {
          layer.objectIds = layer.objectIds.filter((id) => id !== obj.id);
        }
      }
      const hostId = obj.relations.hostObjectId;
      if (hostId && hostId !== parentId) {
        const host = this.objects[hostId];
        if (host) {
          host.childIds = host.childIds.filter((id) => id !== obj.id);
        }
      }
    }
    collectObjectIdsOnLayer(layerId) {
      return Object.values(this.objects).filter((o) => o.layerId === layerId).map((o) => o.id);
    }
    duplicateObjectTree(objectId, targetLayerId, parentObjectId) {
      const src = this.objects[objectId];
      if (!src) return null;
      const newId = this.createObject({
        type: src.type,
        name: src.name,
        layerId: targetLayerId,
        parentObjectId,
        hostObjectId: null,
        transform: cloneTransform2(src.transform),
        geometry: src.geometry ? { ...src.geometry } : void 0,
        style: src.style ? { ...src.style } : void 0,
        visible: src.visible,
        locked: src.locked,
        opacity: src.opacity,
        metadata: src.metadata ? { ...src.metadata } : void 0
      });
      for (const childId of src.childIds) {
        const child = this.objects[childId];
        if (!child) continue;
        if (child.relations.hostObjectId === objectId) {
          const hostedId = this.duplicateObjectTree(
            childId,
            targetLayerId,
            newId
          );
          if (hostedId) {
            this.objects[hostedId].relations.hostObjectId = newId;
            this.objects[hostedId].transformSpace = src.transformSpace;
          }
        } else if (child.relations.hierarchyParentId === objectId) {
          this.duplicateObjectTree(childId, targetLayerId, newId);
        }
      }
      return newId;
    }
    firstDrawableLayerId() {
      for (const floorId of this.rootFloorIds) {
        const floor = this.floors[floorId];
        if (!floor) continue;
        const walk = (ids) => {
          for (const id of ids) {
            const layer = this.layers[id];
            if (!layer) continue;
            if (getLayerCapabilities(layer.layerKind).canDraw) return id;
            const nested = walk(layer.childLayerIds);
            if (nested) return nested;
          }
          return null;
        };
        const found = walk(floor.layerIds);
        if (found) return found;
        if (floor.layerIds[0]) return floor.layerIds[0];
      }
      return null;
    }
    emit(event) {
      for (const listener of this.listeners) listener(event);
    }
    bump(reason) {
      this.mutationVersion += 1;
      this.emit({ type: "scene-changed", reason });
    }
  };
  function clamp01(n) {
    return Math.max(0, Math.min(1, n));
  }
  function cloneTransform2(t) {
    return {
      position: { ...t.position },
      rotation: { ...t.rotation },
      scale: { ...t.scale }
    };
  }
  function defaultObjectName(type) {
    const label = type.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
    return label;
  }
  function createLayerEngine(options) {
    return new LayerEngine(options);
  }

  // src/engine/brushes/presets.ts
  function preset(seed) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    const engineType = (_a = seed.engineType) != null ? _a : "standard";
    const kind = (_b = seed.kind) != null ? _b : "draw";
    return {
      id: seed.id,
      name: seed.name,
      category: seed.category,
      engineType,
      tipType: (_c = seed.tipType) != null ? _c : "round",
      tipImage: null,
      size: seed.size,
      opacity: (_d = seed.opacity) != null ? _d : 1,
      flow: (_e = seed.flow) != null ? _e : 1,
      spacing: (_f = seed.spacing) != null ? _f : 0.06,
      hardness: (_g = seed.hardness) != null ? _g : 1,
      pressureSize: (_h = seed.pressureSize) != null ? _h : 0,
      pressureOpacity: (_i = seed.pressureOpacity) != null ? _i : 0,
      pressureFlow: (_j = seed.pressureFlow) != null ? _j : 0,
      jitter: (_k = seed.jitter) != null ? _k : 0,
      blend: (_l = seed.blend) != null ? _l : kind === "erase" ? "destination-out" : "source-over",
      maxSize: (_m = seed.maxSize) != null ? _m : Math.max(40, seed.size * 4),
      kind,
      smoothing: (_n = seed.smoothing) != null ? _n : 0.35,
      stabilization: (_o = seed.stabilization) != null ? _o : 0.2,
      scaleAware: seed.scaleAware ? {
        enabled: true,
        lineWeightMm: seed.lineWeightMm,
        class: seed.lineWeightMm && seed.lineWeightMm <= 0.1 ? "extra-fine" : seed.lineWeightMm && seed.lineWeightMm <= 0.18 ? "fine" : seed.lineWeightMm && seed.lineWeightMm <= 0.35 ? "medium" : seed.lineWeightMm && seed.lineWeightMm <= 0.7 ? "heavy" : "extra-heavy"
      } : void 0,
      dash: seed.dash,
      family: seed.family,
      builtIn: true,
      source: "built-in",
      version: 1,
      grain: seed.grain
    };
  }
  var BUILTIN_BRUSH_PRESETS = [
    // Technical
    preset({
      id: "tech-xfine",
      name: "Technical Extra Fine",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 1,
      lineWeightMm: 0.08,
      scaleAware: true,
      pressureSize: 0.1,
      smoothing: 0.45
    }),
    preset({
      id: "tech-fine",
      name: "Technical Fine",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 1.4,
      lineWeightMm: 0.15,
      scaleAware: true,
      smoothing: 0.4
    }),
    preset({
      id: "tech-medium",
      name: "Technical Medium",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 2.2,
      lineWeightMm: 0.3,
      scaleAware: true,
      pressureSize: 0.15
    }),
    preset({
      id: "tech-heavy",
      name: "Technical Heavy",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 3.5,
      lineWeightMm: 0.6,
      scaleAware: true
    }),
    preset({
      id: "scalepen-fine",
      name: "ScalePen Fine",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 1.5,
      lineWeightMm: 0.18,
      scaleAware: true,
      smoothing: 0.5
    }),
    preset({
      id: "scalepen-medium",
      name: "ScalePen Medium",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 2.4,
      lineWeightMm: 0.35,
      scaleAware: true,
      smoothing: 0.5
    }),
    preset({
      id: "scalepen-heavy",
      name: "ScalePen Heavy",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 4,
      lineWeightMm: 0.7,
      scaleAware: true,
      smoothing: 0.45
    }),
    preset({
      id: "tech-dashed",
      name: "Dashed Technical",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 1.6,
      lineWeightMm: 0.25,
      scaleAware: true,
      dash: { enabled: true, pattern: "dashed", dashMm: 4, gapMm: 2 }
    }),
    preset({
      id: "tech-centerline",
      name: "Centerline",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 1.3,
      lineWeightMm: 0.18,
      scaleAware: true,
      dash: { enabled: true, pattern: "centerline", dashMm: 8, gapMm: 2 }
    }),
    preset({
      id: "tech-construction",
      name: "Construction Pen",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 1.2,
      opacity: 0.35,
      lineWeightMm: 0.13,
      scaleAware: true
    }),
    preset({
      id: "tech-revision",
      name: "Revision Pen",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 2.5,
      opacity: 0.95,
      pressureSize: 0.2
    }),
    // Quick-access aliases (rail tools)
    preset({
      id: "pen",
      name: "Fine Pen",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 2,
      pressureSize: 0.8,
      maxSize: 20,
      smoothing: 0.35
    }),
    preset({
      id: "technicalpen",
      name: "Technical Pen",
      category: "technical",
      engineType: "technical",
      family: "pen",
      size: 1.4,
      lineWeightMm: 0.25,
      scaleAware: true,
      maxSize: 12
    }),
    preset({
      id: "fountainpen",
      name: "Fountain Pen",
      category: "ink",
      engineType: "standard",
      family: "pen",
      size: 3.4,
      pressureSize: 0.9,
      pressureOpacity: 0.12,
      maxSize: 22
    }),
    preset({
      id: "ballpoint",
      name: "Ballpoint",
      category: "ink",
      engineType: "standard",
      family: "pen",
      size: 1.1,
      opacity: 0.62,
      pressureSize: 0.35,
      pressureOpacity: 0.35,
      maxSize: 10
    }),
    // Pencil
    preset({
      id: "pencil",
      name: "HB Pencil",
      category: "pencil",
      tipType: "soft",
      family: "pencil",
      size: 1.5,
      opacity: 0.75,
      hardness: 0.5,
      pressureSize: 0.7,
      pressureOpacity: 0.5,
      jitter: 0.15,
      maxSize: 8,
      grain: "fine"
    }),
    preset({
      id: "mechanicalpencil",
      name: "Mechanical Pencil",
      category: "pencil",
      tipType: "soft",
      family: "pencil",
      size: 1.2,
      opacity: 0.7,
      hardness: 0.7,
      pressureSize: 0.35,
      pressureOpacity: 0.4,
      jitter: 0.05,
      maxSize: 8
    }),
    preset({
      id: "pencil-2b",
      name: "2B Pencil",
      category: "pencil",
      tipType: "soft",
      family: "pencil",
      size: 2.2,
      opacity: 0.8,
      hardness: 0.4,
      pressureSize: 0.85,
      pressureOpacity: 0.65,
      jitter: 0.2,
      grain: "fine"
    }),
    preset({
      id: "pencil-4b",
      name: "4B Pencil",
      category: "pencil",
      tipType: "soft",
      family: "pencil",
      size: 3.5,
      opacity: 0.85,
      hardness: 0.3,
      pressureSize: 0.95,
      pressureOpacity: 0.75,
      jitter: 0.25,
      grain: "coarse"
    }),
    preset({
      id: "pencil-rough",
      name: "Rough Pencil",
      category: "pencil",
      tipType: "texture",
      family: "pencil",
      size: 4,
      opacity: 0.7,
      hardness: 0.25,
      pressureSize: 0.8,
      pressureOpacity: 0.6,
      jitter: 0.4,
      grain: "coarse"
    }),
    preset({
      id: "pencil-shading",
      name: "Shading Pencil",
      category: "pencil",
      tipType: "soft",
      family: "pencil",
      size: 12,
      opacity: 0.35,
      hardness: 0.2,
      pressureSize: 0.5,
      pressureOpacity: 0.85,
      spacing: 0.1
    }),
    // Ink
    preset({
      id: "fineliner",
      name: "Fineliner",
      category: "ink",
      engineType: "standard",
      size: 1.3,
      pressureSize: 0.05,
      smoothing: 0.4
    }),
    preset({
      id: "brushpen",
      name: "Brush Pen",
      category: "ink",
      tipType: "soft",
      size: 6,
      pressureSize: 0.95,
      pressureOpacity: 0.15,
      maxSize: 40
    }),
    preset({
      id: "chiselpen",
      name: "Chisel Pen",
      category: "ink",
      tipType: "chisel",
      size: 8,
      pressureSize: 0.3,
      maxSize: 36
    }),
    // Markers
    preset({
      id: "marker",
      name: "Marker",
      category: "marker",
      engineType: "marker",
      size: 14,
      opacity: 0.5,
      pressureSize: 0.1,
      pressureOpacity: 0.2,
      blend: "multiply",
      maxSize: 60
    }),
    preset({
      id: "marker-fine",
      name: "Fine Marker",
      category: "marker",
      engineType: "marker",
      size: 6,
      opacity: 0.55,
      blend: "multiply"
    }),
    preset({
      id: "marker-broad",
      name: "Broad Marker",
      category: "marker",
      engineType: "marker",
      size: 28,
      opacity: 0.45,
      blend: "multiply",
      maxSize: 90
    }),
    preset({
      id: "marker-chisel",
      name: "Chisel Marker",
      category: "marker",
      engineType: "marker",
      tipType: "chisel",
      size: 18,
      opacity: 0.5,
      blend: "multiply"
    }),
    preset({
      id: "marker-transparent",
      name: "Transparent Marker",
      category: "marker",
      engineType: "marker",
      size: 16,
      opacity: 0.28,
      blend: "multiply",
      pressureOpacity: 0.4
    }),
    preset({
      id: "highlighter",
      name: "Highlighter",
      category: "marker",
      engineType: "marker",
      size: 22,
      opacity: 0.22,
      blend: "multiply",
      maxSize: 80
    }),
    preset({
      id: "marker-arch",
      name: "Architectural Marker",
      category: "marker",
      engineType: "marker",
      tipType: "chisel",
      size: 14,
      opacity: 0.4,
      blend: "multiply",
      hardness: 0.85
    }),
    preset({
      id: "marker-alcohol",
      name: "Alcohol Marker",
      category: "marker",
      engineType: "marker",
      tipType: "soft",
      size: 16,
      opacity: 0.32,
      blend: "multiply",
      pressureOpacity: 0.35
    }),
    // Paint / render
    preset({
      id: "brush",
      name: "Round Brush",
      category: "paint",
      engineType: "paint",
      tipType: "soft",
      size: 8,
      opacity: 0.9,
      hardness: 0.7,
      pressureSize: 0.9,
      maxSize: 80
    }),
    preset({
      id: "paint-flat",
      name: "Flat Brush",
      category: "paint",
      engineType: "paint",
      tipType: "flat",
      size: 14,
      hardness: 0.9,
      pressureSize: 0.4
    }),
    preset({
      id: "paint-dry",
      name: "Dry Brush",
      category: "paint",
      engineType: "paint",
      tipType: "texture",
      size: 16,
      opacity: 0.7,
      hardness: 0.35,
      jitter: 0.25,
      grain: "coarse"
    }),
    preset({
      id: "watercolour",
      name: "Watercolour Round",
      category: "watercolor",
      engineType: "watercolor",
      tipType: "soft",
      size: 28,
      opacity: 0.14,
      hardness: 0.2,
      pressureSize: 0.9,
      pressureOpacity: 0.8,
      jitter: 0.08,
      blend: "multiply",
      maxSize: 150
    }),
    preset({
      id: "wc-wash",
      name: "Watercolor Wash",
      category: "watercolor",
      engineType: "watercolor",
      tipType: "soft",
      size: 48,
      opacity: 0.1,
      hardness: 0.1,
      blend: "multiply",
      maxSize: 200
    }),
    preset({
      id: "wc-wet",
      name: "Wet Watercolor",
      category: "watercolor",
      engineType: "watercolor",
      tipType: "soft",
      size: 32,
      opacity: 0.12,
      hardness: 0.08,
      blend: "multiply",
      pressureOpacity: 0.9
    }),
    preset({
      id: "roller",
      name: "Solid Roller",
      category: "paint",
      engineType: "roller",
      tipType: "flat",
      size: 40,
      opacity: 0.85,
      spacing: 0.15,
      pressureSize: 0.1,
      maxSize: 160
    }),
    preset({
      id: "airbrush-soft",
      name: "Soft Airbrush",
      category: "airbrush",
      tipType: "soft",
      size: 36,
      opacity: 0.18,
      hardness: 0.05,
      pressureOpacity: 0.7,
      spacing: 0.08,
      maxSize: 180
    }),
    preset({
      id: "airbrush-hard",
      name: "Hard Airbrush",
      category: "airbrush",
      tipType: "soft",
      size: 24,
      opacity: 0.28,
      hardness: 0.45,
      pressureOpacity: 0.5
    }),
    // Texture / landscape
    preset({
      id: "tex-concrete",
      name: "Concrete",
      category: "texture",
      engineType: "texture",
      tipType: "texture",
      size: 20,
      opacity: 0.55,
      jitter: 0.35,
      grain: "coarse"
    }),
    preset({
      id: "tex-wood",
      name: "Wood Grain",
      category: "texture",
      engineType: "texture",
      tipType: "texture",
      size: 16,
      opacity: 0.6,
      jitter: 0.2,
      grain: "fine"
    }),
    preset({
      id: "tex-stone",
      name: "Stone",
      category: "texture",
      engineType: "texture",
      tipType: "texture",
      size: 18,
      opacity: 0.55,
      grain: "coarse"
    }),
    preset({
      id: "tex-brick",
      name: "Brick",
      category: "architectural",
      engineType: "texture",
      tipType: "texture",
      size: 14,
      opacity: 0.7,
      grain: "coarse"
    }),
    preset({
      id: "tex-grass",
      name: "Grass",
      category: "landscape",
      engineType: "texture",
      tipType: "texture",
      size: 12,
      opacity: 0.65,
      jitter: 0.5,
      grain: "fine"
    }),
    preset({
      id: "tex-foliage",
      name: "Foliage",
      category: "landscape",
      engineType: "texture",
      tipType: "texture",
      size: 22,
      opacity: 0.5,
      jitter: 0.45,
      grain: "coarse"
    }),
    preset({
      id: "tex-speckle",
      name: "Speckle",
      category: "effects",
      engineType: "texture",
      tipType: "texture",
      size: 10,
      opacity: 0.7,
      jitter: 0.6,
      grain: "fine"
    }),
    preset({
      id: "tex-hatch",
      name: "Crosshatch",
      category: "architectural",
      engineType: "texture",
      tipType: "texture",
      size: 8,
      opacity: 0.8,
      spacing: 0.2,
      grain: "fine"
    }),
    // Editing
    preset({
      id: "eraser",
      name: "Hard Eraser",
      category: "eraser",
      engineType: "eraser",
      size: 24,
      hardness: 0.95,
      pressureSize: 0.25,
      kind: "erase",
      maxSize: 100
    }),
    preset({
      id: "eraser-soft",
      name: "Soft Eraser",
      category: "eraser",
      engineType: "eraser",
      tipType: "soft",
      size: 28,
      hardness: 0.25,
      pressureSize: 0.4,
      pressureOpacity: 0.5,
      kind: "erase",
      maxSize: 120
    }),
    preset({
      id: "smudge",
      name: "Smudge",
      category: "blend",
      engineType: "smudge",
      tipType: "soft",
      size: 18,
      opacity: 0.6,
      hardness: 0.3,
      kind: "smudge",
      maxSize: 80
    }),
    preset({
      id: "blend-natural",
      name: "Natural Blend",
      category: "blend",
      engineType: "smudge",
      tipType: "soft",
      size: 22,
      opacity: 0.45,
      hardness: 0.2,
      kind: "smudge"
    })
  ];
  var BRUSH_CATEGORY_LABELS = {
    technical: "Technical",
    pencil: "Pencil",
    ink: "Inking",
    marker: "Markers",
    paint: "Paint",
    watercolor: "Watercolor",
    airbrush: "Airbrush",
    "dry-media": "Dry Media",
    texture: "Texture",
    landscape: "Landscape",
    effects: "Effects",
    blend: "Blending",
    eraser: "Erasers",
    architectural: "Architectural",
    imported: "Imported",
    user: "My Brushes"
  };
  var BRUSH_FAMILIES = {
    pen: [
      "pen",
      "technicalpen",
      "fountainpen",
      "ballpoint",
      "tech-xfine",
      "tech-fine",
      "tech-medium",
      "tech-heavy",
      "scalepen-fine",
      "scalepen-medium",
      "scalepen-heavy",
      "tech-dashed",
      "tech-centerline",
      "tech-construction",
      "tech-revision",
      "fineliner",
      "brushpen",
      "chiselpen"
    ],
    pencil: [
      "pencil",
      "mechanicalpencil",
      "pencil-2b",
      "pencil-4b",
      "pencil-rough",
      "pencil-shading"
    ]
  };

  // src/engine/brushes/library.ts
  var BrushLibrary = class {
    constructor(options = {}) {
      this.favorites = /* @__PURE__ */ new Set();
      this.recent = [];
      var _a;
      this.builtins = BUILTIN_BRUSH_PRESETS.map((b) => ({ ...b }));
      this.custom = ((_a = options.custom) != null ? _a : []).map((b) => ({ ...b }));
    }
    all() {
      return [...this.builtins, ...this.custom];
    }
    get(id) {
      return this.builtins.find((b) => b.id === id) || this.custom.find((b) => b.id === id);
    }
    byCategory(category) {
      return this.all().filter((b) => b.category === category);
    }
    categories() {
      const seen = /* @__PURE__ */ new Set();
      const order = [];
      for (const b of this.all()) {
        if (!seen.has(b.category)) {
          seen.add(b.category);
          order.push(b.category);
        }
      }
      return order;
    }
    categoryLabel(category) {
      var _a;
      return (_a = BRUSH_CATEGORY_LABELS[category]) != null ? _a : category;
    }
    search(query) {
      const q = query.trim().toLowerCase();
      if (!q) return this.all();
      return this.all().filter(
        (b) => b.name.toLowerCase().includes(q) || b.category.includes(q) || b.id.includes(q)
      );
    }
    addCustom(brush) {
      const next = {
        ...brush,
        builtIn: false,
        source: brush.source === "imported" ? "imported" : "user-created",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const idx = this.custom.findIndex((b) => b.id === next.id);
      if (idx >= 0) this.custom[idx] = next;
      else this.custom.push(next);
    }
    removeCustom(id) {
      const before = this.custom.length;
      this.custom = this.custom.filter((b) => b.id !== id);
      this.favorites.delete(id);
      this.recent = this.recent.filter((r) => r !== id);
      return this.custom.length < before;
    }
    setCustom(brushes) {
      this.custom = brushes.map((b) => ({ ...b, builtIn: false }));
    }
    getCustom() {
      return this.custom.slice();
    }
    toggleFavorite(id) {
      if (this.favorites.has(id)) {
        this.favorites.delete(id);
        return false;
      }
      this.favorites.add(id);
      return true;
    }
    isFavorite(id) {
      return this.favorites.has(id);
    }
    markRecent(id) {
      this.recent = [id, ...this.recent.filter((r) => r !== id)].slice(0, 12);
    }
    getRecent() {
      return this.recent.map((id) => this.get(id)).filter((b) => Boolean(b));
    }
    getFavorites() {
      return this.all().filter((b) => this.favorites.has(b.id));
    }
    familyOf(id) {
      for (const [fam, ids] of Object.entries(BRUSH_FAMILIES)) {
        if (ids.includes(id)) return fam;
      }
      return null;
    }
    familyMembers(family) {
      var _a;
      const ids = (_a = BRUSH_FAMILIES[family]) != null ? _a : [];
      return ids.map((id) => this.get(id)).filter((b) => Boolean(b));
    }
  };
  function createBrushLibrary(options) {
    return new BrushLibrary(options);
  }

  // src/engine/brushes/stroke-engine.ts
  function resolveStrokeParams(brush, pressure, ctx) {
    var _a, _b, _c, _d, _e;
    const p = clamp012(pressure);
    let baseSize = ctx.size > 0 ? ctx.size : brush.size;
    if (((_a = brush.scaleAware) == null ? void 0 : _a.enabled) && brush.scaleAware.lineWeightMm && ctx.pxPerMm) {
      const docPx = brush.scaleAware.lineWeightMm * ctx.pxPerMm;
      const zoom = ctx.zoom && ctx.zoom > 0 ? ctx.zoom : 1;
      baseSize = Math.max(0.5, docPx * Math.min(1.5, Math.max(0.35, 1 / Math.sqrt(zoom))));
    }
    const lineWidth = Math.max(
      0.3,
      baseSize * (1 - brush.pressureSize + brush.pressureSize * p)
    );
    const alpha = clamp012(
      ctx.alpha * (1 - brush.pressureOpacity + brush.pressureOpacity * p) * ((_b = brush.flow) != null ? _b : 1) * (1 - ((_c = brush.pressureFlow) != null ? _c : 0) + ((_d = brush.pressureFlow) != null ? _d : 0) * p)
    );
    const isErase = brush.kind === "erase";
    const useBuffer = !isErase && brush.kind !== "smudge" && brush.tipType !== "texture" && brush.engineType !== "texture";
    return {
      lineWidth,
      alpha: isErase ? 1 : Math.max(0.02, alpha),
      flow: (_e = brush.flow) != null ? _e : 1,
      blend: brush.blend,
      composite: isErase ? "destination-out" : brush.blend,
      spacing: brush.spacing,
      useBuffer
    };
  }
  function smoothPoint(prev, next, smoothing) {
    if (!prev || smoothing <= 0) return { ...next };
    const t = clamp012(1 - smoothing);
    return {
      x: prev.x + (next.x - prev.x) * t,
      y: prev.y + (next.y - prev.y) * t
    };
  }
  function stabilizePoint(current, target, stabilization) {
    if (stabilization <= 0) return { ...target };
    const k = clamp012(1 - stabilization * 0.85);
    return {
      x: current.x + (target.x - current.x) * k,
      y: current.y + (target.y - current.y) * k
    };
  }
  function applyBrushToCanvasContext(ctx, brush, params, color, options = {}) {
    var _a, _b, _c;
    ctx.globalCompositeOperation = params.composite;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = brush.tipType === "chisel" || brush.tipType === "flat" ? "butt" : "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = params.lineWidth;
    if (options.skipMasterAlpha) {
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = params.alpha;
    }
    if ((_a = brush.dash) == null ? void 0 : _a.enabled) {
      const dash = (_b = brush.dash.dashMm) != null ? _b : 4;
      const gap = (_c = brush.dash.gapMm) != null ? _c : 2;
      if (brush.dash.pattern === "centerline") {
        ctx.setLineDash([dash * 3, gap, dash, gap]);
      } else {
        ctx.setLineDash([dash, gap]);
      }
    } else {
      ctx.setLineDash([]);
    }
  }
  function clamp012(n) {
    return Math.max(0, Math.min(1, n));
  }

  // src/lib/studio-helpers.ts
  var studio_helpers_exports = {};
  __export(studio_helpers_exports, {
    INSPECTOR_TOOLS: () => INSPECTOR_TOOLS,
    MASSING_TOOLS: () => MASSING_TOOLS,
    MASSING_TOOL_HINTS: () => MASSING_TOOL_HINTS,
    SKETCH_BUILD_TOOLS: () => SKETCH_BUILD_TOOLS,
    SKETCH_DRAW_TOOLS: () => SKETCH_DRAW_TOOLS,
    activeRailHighlight: () => activeRailHighlight,
    applyPanDelta: () => applyPanDelta,
    clampZoom: () => clampZoom,
    fitToScreenTransform: () => fitToScreenTransform,
    isDrawTool: () => isDrawTool,
    massingToolUsesSelection: () => massingToolUsesSelection,
    massingZoomAtCursor: () => massingZoomAtCursor,
    pxPerUnitFromScaleLabel: () => pxPerUnitFromScaleLabel,
    resolveAutoExpandFromMetadata: () => resolveAutoExpandFromMetadata,
    scaleLabelFromPxPerUnit: () => scaleLabelFromPxPerUnit,
    shouldAutoExpandCanvas: () => shouldAutoExpandCanvas,
    shouldExpandAtEdge: () => shouldExpandAtEdge,
    shouldShowBuildPalette: () => shouldShowBuildPalette,
    shouldShowMassInspector: () => shouldShowMassInspector,
    shouldShowOpeningPalette: () => shouldShowOpeningPalette,
    shouldShowWall2dPalette: () => shouldShowWall2dPalette,
    zoomDisplayPercent: () => zoomDisplayPercent,
    zoomIn: () => zoomIn,
    zoomOut: () => zoomOut
  });
  var INSPECTOR_TOOLS = /* @__PURE__ */ new Set([
    "select",
    "move",
    "height",
    "push",
    "material"
  ]);
  var MASSING_TOOLS = [
    "add",
    "build",
    "select",
    "sketch",
    "push",
    "material",
    "remove",
    "orbit",
    "pan",
    "move",
    "height"
  ];
  var SKETCH_DRAW_TOOLS = /* @__PURE__ */ new Set([
    "pen",
    "marker",
    "pencil",
    "brush",
    "watercolour",
    "eraser",
    "fine-pen",
    "chisel",
    "flat"
  ]);
  var SKETCH_BUILD_TOOLS = /* @__PURE__ */ new Set([
    "wall",
    "opening",
    "select",
    "offset",
    "line",
    "area",
    "ruler",
    "hand"
  ]);
  var MASSING_TOOL_HINTS = {
    add: "Drag a footprint on the ground, release to extrude",
    build: "Wall: tap corners. Door/Window: tap a wall to drop one",
    select: "Tap a mass to select \xB7 drag body to move \xB7 grab a handle to edit",
    sketch: "Tap a face to sketch its elevation / plan",
    push: "Tap a face region and drag \u2014 out to extrude, in to recess",
    material: "Pick a material, then tap a face or region",
    remove: "Tap a mass to delete it",
    orbit: "Drag to orbit \xB7 pinch or scroll to zoom",
    pan: "Drag to pan the view",
    move: "Drag sideways to move on ground \xB7 drag up/down to raise/lower",
    height: "Drag up / down to push-pull height"
  };
  function shouldShowMassInspector(massing) {
    if (!massing.active) return false;
    if (massing.selected < 0) return false;
    return INSPECTOR_TOOLS.has(massing.tool);
  }
  function shouldShowBuildPalette(massing) {
    return massing.active && massing.tool === "build";
  }
  function shouldShowWall2dPalette(tool, massingActive) {
    return !massingActive && tool === "wall";
  }
  function shouldShowOpeningPalette(tool, massingActive) {
    return !massingActive && tool === "opening";
  }
  function activeRailHighlight(tool, massingActive) {
    return massingActive ? "massing" : tool;
  }
  function resolveAutoExpandFromMetadata(_meta) {
    return false;
  }
  function shouldAutoExpandCanvas(_flags) {
    return false;
  }
  function shouldExpandAtEdge(x, y, docWidth, docHeight, threshold = 140) {
    return {
      left: x < threshold,
      right: x > docWidth - threshold,
      top: y < threshold,
      bottom: y > docHeight - threshold
    };
  }
  function clampZoom(zoom, min = 0.2, max = 8) {
    return Math.max(min, Math.min(max, zoom));
  }
  function zoomIn(zoom, factor = 1.25) {
    return clampZoom(zoom * factor);
  }
  function zoomOut(zoom, factor = 1.25) {
    return clampZoom(zoom / factor);
  }
  function fitToScreenTransform(areaWidth, areaHeight, docWidthPx, docHeightPx, padding = 60) {
    const aw = areaWidth - padding * 2;
    const ah = areaHeight - padding * 2;
    const aspect = docWidthPx / docHeightPx;
    let w;
    let h;
    if (aw / ah > aspect) {
      h = ah;
      w = h * aspect;
    } else {
      w = aw;
      h = w / aspect;
    }
    return {
      baseZoom: w / docWidthPx,
      zoom: 1,
      panX: 0,
      panY: 0
    };
  }
  function applyPanDelta(startPanX, startPanY, startSx, startSy, currentSx, currentSy) {
    return {
      panX: startPanX + (currentSx - startSx),
      panY: startPanY + (currentSy - startSy)
    };
  }
  function massingZoomAtCursor(scale, deltaY, zoomInFactor = 1.08, zoomOutFactor = 0.93, min = 6, max = 160) {
    const next = scale * (deltaY < 0 ? zoomInFactor : zoomOutFactor);
    return Math.max(min, Math.min(max, next));
  }
  function zoomDisplayPercent(zoom) {
    return `${Math.round(zoom * 100)}%`;
  }
  function isDrawTool(tool) {
    return SKETCH_DRAW_TOOLS.has(tool);
  }
  function massingToolUsesSelection(tool) {
    return INSPECTOR_TOOLS.has(tool);
  }
  var UNIT_MM = {
    mm: 1,
    cm: 10,
    m: 1e3,
    in: 25.4,
    ft: 304.8
  };
  function scaleLabelFromPxPerUnit(pxPerUnit, scaleUnit, docWidthPx, docWidthMm) {
    if (!pxPerUnit || !scaleUnit || docWidthMm <= 0) return null;
    const unitInMm = UNIT_MM[scaleUnit] || 1;
    const realPerPxMm = unitInMm / pxPerUnit;
    const docPxPerMm = docWidthPx / docWidthMm;
    const ratio = realPerPxMm * docPxPerMm;
    if (!ratio || ratio <= 0) return null;
    return `1:${Math.round(ratio)}`;
  }
  function pxPerUnitFromScaleLabel(label, docWidthPx, docWidthMm) {
    const m = String(label).match(/1\s*:\s*(\d+(?:\.\d+)?)/);
    if (!m || docWidthMm <= 0) return null;
    const ratio = parseFloat(m[1]);
    if (!ratio || ratio <= 0) return null;
    const docPxPerMm = docWidthPx / docWidthMm;
    return {
      pxPerUnit: 10 * docPxPerMm / ratio,
      scaleUnit: "cm"
    };
  }

  // src/engine/app/cores.ts
  var brushReady = false;
  var brushWaiters = [];
  var brushPresets = [...BUILTIN_BRUSH_PRESETS];
  var brushLabels = { ...BRUSH_CATEGORY_LABELS };
  var brushFamilies = {
    ...BRUSH_FAMILIES
  };
  function markBrushReady() {
    brushReady = true;
    for (const cb of brushWaiters.splice(0)) {
      try {
        cb();
      } catch (e) {
        console.warn(e);
      }
    }
  }
  async function loadBrushPresets() {
    try {
      const res = await fetch("/engine/brush-presets.json", {
        credentials: "same-origin"
      });
      if (!res.ok) throw new Error("brush presets missing");
      const data = await res.json();
      brushPresets = data.presets || brushPresets;
      brushLabels = data.labels || brushLabels;
      brushFamilies = data.families || brushFamilies;
    } catch (err) {
      console.warn("Brush presets failed to load; using built-in fallback", err);
    } finally {
      markBrushReady();
    }
  }
  function asLegacyBuiltinList() {
    return brushPresets.map((b) => ({ ...b }));
  }
  function initCores() {
    const selectionManager = createSelectionManager({
      capabilities: capabilityRegistry
    });
    S.__ix = {
      ObjectCapabilityRegistry,
      SelectionManager,
      capabilityRegistry,
      selectionManager,
      createSceneObjectId,
      createEmptySelectionState,
      ensureShapeId,
      ensureAllShapeIds,
      sceneTypeFromShapeKind,
      createCapabilityRegistry,
      ensureObjectId(record, prefix) {
        if (record && typeof record.id === "string" && record.id) return record.id;
        const id = createSceneObjectId(prefix || "obj");
        if (record) record.id = id;
        return id;
      }
    };
    S.__layersApi = {
      LayerEngine,
      createLayerEngine,
      getLayerCapabilities,
      getTransformCapabilities,
      getLayerTransformCapabilities
    };
    S.brushes = {
      resolveStrokeParams,
      smoothPoint,
      stabilizePoint,
      applyBrushToCanvasContext,
      BrushLibrary,
      createBrushLibrary,
      asLegacyBuiltinList,
      whenReady(cb) {
        if (brushReady) cb();
        else brushWaiters.push(cb);
      },
      isReady: () => brushReady,
      loadPresets: loadBrushPresets,
      getFamilies: () => brushFamilies,
      getCategoryLabels: () => brushLabels
    };
    S.helpers = studio_helpers_exports;
    void loadBrushPresets();
  }

  // src/engine/app/state-init.ts
  function initState() {
    const state2 = S.state;
    S.LOGO_B64 = "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";
    S._logoEl = document.getElementById("logo");
    if (S._logoEl) S._logoEl.src = "/logo.png";
    S.NM_LINE_B64 = "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";
    S._nmLineImg = new Image();
    S._nmLineImg.src = "data:image/png;base64," + S.NM_LINE_B64;
    S.state = S.state;
    S.ensureShapeId = function ensureShapeId2(shape) {
      if (S.__ix) return S.__ix.ensureShapeId(shape);
      if (shape && typeof shape.id === "string" && shape.id) return shape.id;
      if (!shape) return "shape_" + Date.now().toString(36);
      shape.id = "shape_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      return shape.id;
    };
    S.ensureAllShapeIds = function ensureAllShapeIds2(shapes) {
      if (S.__ix) return S.__ix.ensureAllShapeIds(shapes);
      return (shapes || []).map(S.ensureShapeId);
    };
    S.pushShapeEntity = function pushShapeEntity(entity) {
      S.ensureShapeId(entity);
      if (!entity.name) {
        const kind = entity.kind || "shape";
        const label = kind === "rect" ? "Rectangle" : kind === "ellipse" ? "Ellipse" : kind === "polygon" ? "Polygon" : "Shape";
        const n = (state2.shapes || []).filter((s) => (s.kind || "shape") === kind).length + 1;
        entity.name = label + " " + n;
      }
      state2.shapes.push(entity);
      S.registerShapeInLayerPanel(entity);
      return entity.id;
    };
    S.ensureWallId = function ensureWallId(wall) {
      if (wall && typeof wall.id === "string" && wall.id) return wall.id;
      if (!wall) return null;
      wall.id = "wall_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      return wall.id;
    };
    S.ensureMainObjectLayer = function ensureMainObjectLayer() {
      if (!S.layerEngine) return null;
      let id = typeof S.layerEngine.getMainLayerId === "function" ? S.layerEngine.getMainLayerId() : null;
      if (id && S.layerEngine.getLayer(id)) return id;
      const floorId = S.layerEngine.rootFloorIds[0] || S.layerEngine.createFloor("Canvas");
      id = S.layerEngine.createLayer({
        name: "Layer 1",
        layerKind: "object",
        floorId
      });
      S.layerEngine._mainLayerId = id;
      if (S.layerEngine.layers[id]) S.layerEngine.layers[id].expanded = true;
      return id;
    };
    S.findEngineObjectByLegacy = function findEngineObjectByLegacy(pred) {
      if (!S.layerEngine) return null;
      const objs = S.layerEngine.objects || {};
      for (const id of Object.keys(objs)) {
        const o = objs[id];
        if (o && o.legacyRef && pred(o.legacyRef, o)) return o;
      }
      return null;
    };
    S.upsertEngineObject = function upsertEngineObject(opts) {
      if (!S.layerEngine) return null;
      const ref = opts.legacyRef;
      let existing = null;
      if (ref) {
        existing = S.findEngineObjectByLegacy((r) => {
          if (ref.kind === "wall-face") {
            return r.kind === "wall-face" && r.wallId === ref.wallId && r.seg === ref.seg;
          }
          return r.kind === ref.kind && r.id === ref.id;
        });
      }
      if (existing) {
        if (opts.name && existing.name !== opts.name) {
          S.layerEngine.renameObject(existing.id, opts.name);
        }
        if (opts.parentObjectId != null) {
          const curParent = existing.relations && existing.relations.hierarchyParentId;
          if (!curParent && opts.parentObjectId) {
          }
        }
        if (opts.geometry) existing.geometry = opts.geometry;
        existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        return existing.id;
      }
      return S.layerEngine.createObject(opts);
    };
    S.registerWallInLayerPanel = function registerWallInLayerPanel(wall) {
      if (!S.layerEngine || !wall) return;
      const mainId = S.ensureMainObjectLayer();
      if (!mainId) return;
      S.ensureWallId(wall);
      const wallIndex = (state2.walls || []).indexOf(wall);
      const wallNum = wallIndex >= 0 ? wallIndex + 1 : (state2.walls || []).length;
      const pts = wall.pts || [];
      const segCount = Math.max(0, pts.length - 1);
      if (segCount <= 0) return;
      let parentId = null;
      if (segCount > 1) {
        parentId = S.upsertEngineObject({
          type: "group",
          name: wall.name || "Wall " + wallNum,
          layerId: mainId,
          legacyRef: { kind: "wall", id: wall.id }
        });
      }
      for (let seg = 0; seg < segCount; seg++) {
        const faceName = segCount === 1 ? wall.name || "Wall " + wallNum : "Face " + (seg + 1);
        S.upsertEngineObject({
          type: "wall",
          name: faceName,
          layerId: mainId,
          parentObjectId: parentId || void 0,
          legacyRef: { kind: "wall-face", wallId: wall.id, seg },
          geometry: {
            a: { x: pts[seg].x, y: pts[seg].y },
            b: { x: pts[seg + 1].x, y: pts[seg + 1].y },
            thickMM: wall.thickMM,
            heightM: wall.heightM
          }
        });
      }
      if (S.layerEngine.layers[mainId]) S.layerEngine.layers[mainId].expanded = true;
      S.renderLayers();
    };
    S.registerShapeInLayerPanel = function registerShapeInLayerPanel(shape) {
      if (!S.layerEngine || !shape) return;
      const mainId = S.ensureMainObjectLayer();
      if (!mainId) return;
      S.ensureShapeId(shape);
      S.upsertEngineObject({
        type: "shape",
        name: shape.name || "Shape",
        layerId: mainId,
        legacyRef: { kind: "shape", id: shape.id },
        geometry: shape
      });
      if (S.layerEngine.layers[mainId]) S.layerEngine.layers[mainId].expanded = true;
      S.renderLayers();
    };
    S.syncSceneObjectsToEngine = function syncSceneObjectsToEngine() {
      if (!S.layerEngine) return;
      const mainId = S.ensureMainObjectLayer();
      if (!mainId) return;
      const wanted = /* @__PURE__ */ new Set();
      (state2.walls || []).forEach((wall, wallIndex) => {
        S.ensureWallId(wall);
        const pts = wall.pts || [];
        const segCount = Math.max(0, pts.length - 1);
        if (segCount <= 0) return;
        let parentId = null;
        if (segCount > 1) {
          parentId = S.upsertEngineObject({
            type: "group",
            name: wall.name || "Wall " + (wallIndex + 1),
            layerId: mainId,
            legacyRef: { kind: "wall", id: wall.id }
          });
          if (parentId) wanted.add(parentId);
        }
        for (let seg = 0; seg < segCount; seg++) {
          const faceName = segCount === 1 ? wall.name || "Wall " + (wallIndex + 1) : "Face " + (seg + 1);
          const oid = S.upsertEngineObject({
            type: "wall",
            name: faceName,
            layerId: mainId,
            parentObjectId: parentId || void 0,
            legacyRef: { kind: "wall-face", wallId: wall.id, seg },
            geometry: {
              a: pts[seg] && { x: pts[seg].x, y: pts[seg].y },
              b: pts[seg + 1] && { x: pts[seg + 1].x, y: pts[seg + 1].y },
              thickMM: wall.thickMM,
              heightM: wall.heightM
            }
          });
          if (oid) wanted.add(oid);
        }
      });
      (state2.shapes || []).forEach((sh) => {
        S.ensureShapeId(sh);
        if (!sh.name) {
          const kind = sh.kind || "shape";
          const label = kind === "rect" ? "Rectangle" : kind === "ellipse" ? "Ellipse" : kind === "polygon" ? "Polygon" : "Shape";
          const n = (state2.shapes || []).filter((s) => s !== sh && (s.kind || "shape") === kind).length + 1;
          sh.name = label + " " + n;
        }
        const oid = S.upsertEngineObject({
          type: "shape",
          name: sh.name,
          layerId: mainId,
          legacyRef: { kind: "shape", id: sh.id },
          geometry: sh
        });
        if (oid) wanted.add(oid);
      });
      const toDel = [];
      Object.keys(S.layerEngine.objects || {}).forEach((id) => {
        const o = S.layerEngine.objects[id];
        if (!o || o.layerId !== mainId) return;
        if (wanted.has(id)) return;
        if (o.type === "group" && !o.legacyRef) {
          const kids = o.childIds || [];
          if (kids.some((cid) => wanted.has(cid))) return;
          if (!kids.length) toDel.push(id);
          return;
        }
        if (o.legacyRef) toDel.push(id);
      });
      if (toDel.length) S.layerEngine.deleteObjects(toDel);
    };
    S.syncSelectionManagerFromLegacy = function syncSelectionManagerFromLegacy(source) {
      if (!S.__ix || !S.__ix.selectionManager) return;
      const src = source || "programmatic";
      const sel = state2.sel;
      if (sel && sel.type === "shape" && typeof sel.idx === "number") {
        const sh = state2.shapes[sel.idx];
        if (sh) {
          const id = S.ensureShapeId(sh);
          S.__ix.selectionManager.select(id, src);
          return;
        }
      }
      S.__ix.selectionManager.clear(src);
    };
    S.selectShapeById = function selectShapeById(objectId, source) {
      if (!objectId) {
        state2.sel = null;
        S.syncSelectionManagerFromLegacy(source || "programmatic");
        return false;
      }
      const idx = (state2.shapes || []).findIndex((s) => s && s.id === objectId);
      if (idx < 0) return false;
      state2.sel = { type: "shape", idx, id: objectId };
      state2.selOpening2D = null;
      if (typeof S.showOpeningPalette === "function") S.showOpeningPalette(false);
      if (typeof S.showSelectBar === "function") S.showSelectBar("shape");
      S.syncSelectionManagerFromLegacy(source || "layer-panel");
      if (typeof S.refreshMeasurements === "function") S.refreshMeasurements();
      return true;
    };
    S.selectWallByLegacy = function selectWallByLegacy(wallId, seg, source) {
      const wi = (state2.walls || []).findIndex((w) => w && w.id === wallId);
      if (wi < 0) return false;
      state2.sel = { type: "wall", wi, seg: typeof seg === "number" ? seg : null };
      state2.selOpening2D = null;
      if (typeof S.showOpeningPalette === "function") S.showOpeningPalette(false);
      if (typeof S.showSelectBar === "function") S.showSelectBar("wall");
      S.syncSelectionManagerFromLegacy(source || "layer-panel");
      if (typeof S.refreshMeasurements === "function") S.refreshMeasurements();
      return true;
    };
    S.selectSceneObjectFromPanel = function selectSceneObjectFromPanel(engineObjectId, opts) {
      opts = opts || {};
      if (!S.layerEngine || !engineObjectId) return false;
      const obj = S.layerEngine.getObject(engineObjectId);
      if (!obj) return false;
      state2._panelSelectedObjectId = engineObjectId;
      if (opts.additive) {
        state2._panelMultiSelect = state2._panelMultiSelect || /* @__PURE__ */ new Set();
        if (state2._panelMultiSelect.has(engineObjectId)) {
          state2._panelMultiSelect.delete(engineObjectId);
        } else {
          state2._panelMultiSelect.add(engineObjectId);
        }
      } else {
        state2._panelMultiSelect = /* @__PURE__ */ new Set([engineObjectId]);
      }
      const ref = obj.legacyRef;
      if (ref && ref.kind === "shape") {
        return S.selectShapeById(ref.id, "layer-panel");
      }
      if (ref && ref.kind === "wall-face") {
        return S.selectWallByLegacy(ref.wallId, ref.seg, "layer-panel");
      }
      if (ref && ref.kind === "wall") {
        return S.selectWallByLegacy(ref.id, null, "layer-panel");
      }
      if (obj.type === "group" && obj.childIds && obj.childIds.length) {
        for (const cid of obj.childIds) {
          if (S.selectSceneObjectFromPanel(cid, { additive: false })) return true;
        }
      }
      if (typeof S.showSelectBar === "function") S.showSelectBar("element");
      S.renderLayers();
      return true;
    };
    if (S.__ix && S.__ix.selectionManager) {
      window.addEventListener("sketchtrude-layer-select", (ev) => {
        const id = ev && ev.detail && ev.detail.objectId;
        if (id) S.selectShapeById(id, "layer-panel");
      });
    }
    S.BUILTIN_BRUSHES = [
      { id: "pen", name: "Fine Pen", tipType: "round", size: 2, opacity: 1, spacing: 0.06, hardness: 1, pressureSize: 0.8, pressureOpacity: 0, jitter: 0, blend: "source-over", maxSize: 20, kind: "draw", builtIn: true, category: "technical", engineType: "technical", smoothing: 0.35, stabilization: 0.2, flow: 1 },
      { id: "marker", name: "Marker", tipType: "round", size: 14, opacity: 0.5, spacing: 0.04, hardness: 1, pressureSize: 0.1, pressureOpacity: 0.2, jitter: 0, blend: "multiply", maxSize: 60, kind: "draw", builtIn: true, category: "marker", engineType: "marker", smoothing: 0.25, stabilization: 0.15, flow: 1 },
      { id: "pencil", name: "HB Pencil", tipType: "soft", size: 1.5, opacity: 0.75, spacing: 0.08, hardness: 0.5, pressureSize: 0.7, pressureOpacity: 0.5, jitter: 0.15, blend: "source-over", maxSize: 8, kind: "draw", builtIn: true, category: "pencil", engineType: "standard", smoothing: 0.3, stabilization: 0.15, flow: 1, family: "pencil" },
      { id: "brush", name: "Round Brush", tipType: "soft", size: 8, opacity: 0.9, spacing: 0.05, hardness: 0.7, pressureSize: 0.9, pressureOpacity: 0, jitter: 0, blend: "source-over", maxSize: 80, kind: "draw", builtIn: true, category: "paint", engineType: "paint", smoothing: 0.3, stabilization: 0.2, flow: 1 },
      { id: "watercolour", name: "Watercolour", tipType: "soft", size: 28, opacity: 0.14, spacing: 0.07, hardness: 0.2, pressureSize: 0.9, pressureOpacity: 0.8, jitter: 0.08, blend: "multiply", maxSize: 150, kind: "draw", builtIn: true, category: "watercolor", engineType: "watercolor", smoothing: 0.4, stabilization: 0.25, flow: 0.8 },
      { id: "eraser", name: "Hard Eraser", tipType: "round", size: 24, opacity: 1, spacing: 0.05, hardness: 0.8, pressureSize: 0.3, pressureOpacity: 0, jitter: 0, blend: "destination-out", maxSize: 100, kind: "erase", builtIn: true, category: "eraser", engineType: "eraser", smoothing: 0.2, stabilization: 0.1, flow: 1 },
      { id: "technicalpen", name: "Technical Pen", family: "pen", tipType: "round", size: 1.4, opacity: 1, spacing: 0.05, hardness: 1, pressureSize: 0, pressureOpacity: 0, jitter: 0, blend: "source-over", maxSize: 12, kind: "draw", builtIn: true, category: "technical", engineType: "technical", smoothing: 0.45, stabilization: 0.25, flow: 1 },
      { id: "fountainpen", name: "Fountain Pen", family: "pen", tipType: "round", size: 3.4, opacity: 1, spacing: 0.05, hardness: 1, pressureSize: 0.9, pressureOpacity: 0.12, jitter: 0, blend: "source-over", maxSize: 22, kind: "draw", builtIn: true, category: "ink", engineType: "standard", smoothing: 0.35, stabilization: 0.2, flow: 1 },
      { id: "ballpoint", name: "Ballpoint", family: "pen", tipType: "round", size: 1.1, opacity: 0.62, spacing: 0.05, hardness: 1, pressureSize: 0.35, pressureOpacity: 0.35, jitter: 0, blend: "source-over", maxSize: 10, kind: "draw", builtIn: true, category: "ink", engineType: "standard", smoothing: 0.3, stabilization: 0.15, flow: 1 },
      { id: "mechanicalpencil", name: "Mechanical Pencil", family: "pencil", tipType: "soft", size: 1.2, opacity: 0.7, spacing: 0.07, hardness: 0.7, pressureSize: 0.35, pressureOpacity: 0.4, jitter: 0.05, blend: "source-over", maxSize: 8, kind: "draw", builtIn: true, category: "pencil", engineType: "standard", smoothing: 0.25, stabilization: 0.1, flow: 1 }
    ];
    S.brushLibraryEngine = null;
    S.BRUSH_FAMILIES = {
      pen: ["pen", "technicalpen", "fountainpen", "ballpoint"],
      pencil: ["pencil", "mechanicalpencil"]
    };
    S.syncBuiltinBrushesFromEngine = function syncBuiltinBrushesFromEngine() {
      const api = S.brushes;
      if (!api || !api.isReady || !api.isReady()) return;
      S.BUILTIN_BRUSHES = api.asLegacyBuiltinList();
      S.brushLibraryEngine = api.createBrushLibrary({ custom: state2.customBrushes || [] });
      const fam = api.getFamilies();
      if (fam) {
        for (const k of Object.keys(S.BRUSH_FAMILIES)) delete S.BRUSH_FAMILIES[k];
        Object.assign(S.BRUSH_FAMILIES, fam);
      }
    };
    S.isDrawTool = function isDrawTool2(t) {
      return S.BUILTIN_BRUSHES.some((b) => b.id === t) || !!(S.brushLibraryEngine && S.brushLibraryEngine.get(t));
    };
    S.brushFamilyOf = function brushFamilyOf(id) {
      if (S.brushLibraryEngine) {
        const fam = S.brushLibraryEngine.familyOf(id);
        if (fam) return fam;
      }
      for (const fam in S.BRUSH_FAMILIES) if (S.BRUSH_FAMILIES[fam].includes(id)) return fam;
      return id;
    };
    if (S.brushes) {
      S.brushes.whenReady(() => {
        try {
          S.syncBuiltinBrushesFromEngine();
          S.initGrainTips();
        } catch (_) {
        }
      });
    }
    S.layerEngine = S.__layersApi ? S.__layersApi.createLayerEngine() : null;
    S.layerSurfaces = /* @__PURE__ */ new Map();
    S.layerIdCounter = 1;
    S.surfaceByEngineId = function surfaceByEngineId(engineId) {
      return S.layerSurfaces.get(engineId) || null;
    };
    S.engineIdOfSurface = function engineIdOfSurface(surface) {
      return surface && surface.engineId ? surface.engineId : null;
    };
    S.syncStateLayersFromEngine = function syncStateLayersFromEngine() {
      if (!S.layerEngine) return;
      const ids = S.layerEngine.getRasterLayerIds();
      const next = [];
      for (const id of ids) {
        const surf = S.layerSurfaces.get(id);
        if (surf) {
          const meta = S.layerEngine.getLayer(id);
          if (meta) {
            surf.name = meta.name;
            surf.visible = meta.visible;
            surf.locked = meta.locked;
            surf.opacity = meta.opacity;
            surf.blendMode = meta.blendMode || surf.blendMode;
            if (typeof meta.trace === "number") surf.trace = meta.trace;
          }
          next.push(surf);
        }
      }
      state2.layers = next;
      const activeId = S.layerEngine.getActiveLayerId();
      const ai = next.findIndex((l) => l.engineId === activeId);
      state2.activeLayer = ai >= 0 ? ai : Math.max(0, next.length - 1);
    };
    S.allocateLayerSurface = function allocateLayerSurface(engineId, name) {
      const imageCanvas = document.createElement("canvas");
      imageCanvas.width = S.doc.wPx;
      imageCanvas.height = S.doc.hPx;
      imageCanvas.style.position = "absolute";
      imageCanvas.style.inset = "0";
      imageCanvas.style.width = "100%";
      imageCanvas.style.height = "100%";
      imageCanvas.style.pointerEvents = "none";
      S.paper.insertBefore(imageCanvas, S.rulerOverlay);
      const canvas = document.createElement("canvas");
      canvas.width = S.doc.wPx;
      canvas.height = S.doc.hPx;
      S.paper.insertBefore(canvas, S.rulerOverlay);
      const layer = {
        id: S.layerIdCounter++,
        engineId,
        name: name || "Layer",
        canvas,
        ctx: canvas.getContext("2d"),
        imageCanvas,
        imageCtx: imageCanvas.getContext("2d"),
        visible: true,
        opacity: 1,
        locked: false,
        trace: 0,
        blendMode: "source-over",
        history: [],
        redo: [],
        _cur: null,
        image: null,
        imageSource: null,
        imageTransform: null,
        imageOpacity: 1,
        imageCrop: null,
        imageBaked: false
      };
      layer.ctx.lineCap = "round";
      layer.ctx.lineJoin = "round";
      layer._cur = layer.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
      S.layerSurfaces.set(engineId, layer);
      return layer;
    };
    S.disposeLayerSurface = function disposeLayerSurface(engineId) {
      const surf = S.layerSurfaces.get(engineId);
      if (!surf) return;
      try {
        surf.canvas.remove();
      } catch (_) {
      }
      try {
        if (surf.imageCanvas) surf.imageCanvas.remove();
      } catch (_) {
      }
      S.layerSurfaces.delete(engineId);
    };
    S.ensureRasterSurface = function ensureRasterSurface(engineId) {
      if (!engineId) return null;
      if (S.layerSurfaces.has(engineId)) return S.layerSurfaces.get(engineId);
      const meta = S.layerEngine ? S.layerEngine.getLayer(engineId) : null;
      return S.allocateLayerSurface(engineId, meta ? meta.name : "Layer");
    };
    S.makeGrainTip = function makeGrainTip(kind) {
      const S2 = 64, c = document.createElement("canvas");
      c.width = c.height = S2;
      const x = c.getContext("2d");
      const g = x.createRadialGradient(S2 / 2, S2 / 2, 0, S2 / 2, S2 / 2, S2 / 2);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.6, "rgba(0,0,0,0.85)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.beginPath();
      x.arc(S2 / 2, S2 / 2, S2 / 2, 0, Math.PI * 2);
      x.fill();
      const img = x.getImageData(0, 0, S2, S2), d = img.data;
      const density = kind === "coarse" ? 0.5 : 0.32, cut = kind === "coarse" ? 0.75 : 0.55;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.random() < density) {
          const k = Math.random() * cut;
          d[i + 3] = Math.round(d[i + 3] * (1 - k));
        }
      }
      x.putImageData(img, 0, 0);
      return c;
    };
    S.initGrainTips = function initGrainTips() {
      S.BUILTIN_BRUSHES.forEach((b) => {
        if (b.tipType === "texture" && b.tipImage == null && b.grain) {
          const c = S.makeGrainTip(b.grain);
          const url = c.toDataURL();
          b.tipImage = url;
          state2.tipImageCache[url] = c;
        }
      });
    };
    try {
      S.initGrainTips();
    } catch (e) {
    }
    S.TOOL_PRESETS = {
      pen: S.BUILTIN_BRUSHES[0],
      marker: S.BUILTIN_BRUSHES[1],
      pencil: S.BUILTIN_BRUSHES[2],
      brush: S.BUILTIN_BRUSHES[3],
      watercolour: S.BUILTIN_BRUSHES[4],
      eraser: S.BUILTIN_BRUSHES[5]
    };
    S.SWATCHES = [
      "#0a0a0a",
      "#3a3a3a",
      "#6b6b6b",
      "#a02835",
      "#7a1c27",
      "#d4453d",
      "#e87722",
      "#f1c40f",
      "#2d8a3e",
      "#1d6e8e",
      "#1d4ed8",
      "#5b3a99",
      "#b45285",
      "#8b5a3c",
      "#cda57a",
      "#ffffff"
    ];
    S.BUILTIN_STENCILS = [
      { name: "Chair", draw: (ctx, x, y, s) => {
        ctx.strokeRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
        ctx.beginPath();
        ctx.moveTo(x - s * 0.4, y - s * 0.2);
        ctx.lineTo(x + s * 0.4, y - s * 0.2);
        ctx.stroke();
      } },
      { name: "Sofa", draw: (ctx, x, y, s) => {
        ctx.strokeRect(x - s * 0.5, y - s * 0.25, s, s * 0.5);
        ctx.beginPath();
        ctx.moveTo(x - s * 0.5, y - s * 0.05);
        ctx.lineTo(x + s * 0.5, y - s * 0.05);
        ctx.stroke();
        ctx.strokeRect(x - s * 0.5, y - s * 0.25, s * 0.1, s * 0.5);
        ctx.strokeRect(x + s * 0.4, y - s * 0.25, s * 0.1, s * 0.5);
      } },
      { name: "Table", draw: (ctx, x, y, s) => {
        ctx.strokeRect(x - s * 0.45, y - s * 0.3, s * 0.9, s * 0.6);
        ctx.beginPath();
        ctx.moveTo(x - s * 0.45, y - s * 0.3);
        ctx.lineTo(x + s * 0.45, y + s * 0.3);
        ctx.moveTo(x + s * 0.45, y - s * 0.3);
        ctx.lineTo(x - s * 0.45, y + s * 0.3);
        ctx.stroke();
      } },
      { name: "Bed", draw: (ctx, x, y, s) => {
        ctx.strokeRect(x - s * 0.4, y - s * 0.5, s * 0.8, s);
        ctx.strokeRect(x - s * 0.3, y - s * 0.45, s * 0.6, s * 0.25);
        ctx.beginPath();
        ctx.arc(x - s * 0.15, y - s * 0.32, s * 0.05, 0, Math.PI * 2);
        ctx.arc(x + s * 0.15, y - s * 0.32, s * 0.05, 0, Math.PI * 2);
        ctx.stroke();
      } },
      { name: "Tree", draw: (ctx, x, y, s) => {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          ctx.moveTo(x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.4);
          ctx.lineTo(x + Math.cos(a) * s * 0.25, y + Math.sin(a) * s * 0.25);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, s * 0.08, 0, Math.PI * 2);
        ctx.stroke();
      } },
      { name: "Plant", draw: (ctx, x, y, s) => {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.25, y + s * 0.3);
        ctx.lineTo(x - s * 0.15, y - s * 0.1);
        ctx.lineTo(x + s * 0.15, y - s * 0.1);
        ctx.lineTo(x + s * 0.25, y + s * 0.3);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.1);
        ctx.bezierCurveTo(x - s * 0.3, y - s * 0.3, x - s * 0.1, y - s * 0.5, x, y - s * 0.4);
        ctx.bezierCurveTo(x + s * 0.1, y - s * 0.5, x + s * 0.3, y - s * 0.3, x, y - s * 0.1);
        ctx.stroke();
      } },
      { name: "Person", draw: (ctx, x, y, s) => {
        ctx.beginPath();
        ctx.arc(x, y - s * 0.35, s * 0.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.23);
        ctx.lineTo(x, y + s * 0.15);
        ctx.moveTo(x - s * 0.18, y);
        ctx.lineTo(x + s * 0.18, y);
        ctx.moveTo(x, y + s * 0.15);
        ctx.lineTo(x - s * 0.15, y + s * 0.45);
        ctx.moveTo(x, y + s * 0.15);
        ctx.lineTo(x + s * 0.15, y + s * 0.45);
        ctx.stroke();
      } },
      { name: "Car", draw: (ctx, x, y, s) => {
        ctx.strokeRect(x - s * 0.45, y - s * 0.18, s * 0.9, s * 0.35);
        ctx.beginPath();
        ctx.moveTo(x - s * 0.3, y - s * 0.18);
        ctx.lineTo(x - s * 0.2, y - s * 0.35);
        ctx.lineTo(x + s * 0.2, y - s * 0.35);
        ctx.lineTo(x + s * 0.3, y - s * 0.18);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - s * 0.28, y + s * 0.17, s * 0.08, 0, Math.PI * 2);
        ctx.arc(x + s * 0.28, y + s * 0.17, s * 0.08, 0, Math.PI * 2);
        ctx.stroke();
      } },
      { name: "Door", draw: (ctx, x, y, s) => {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.4, y + s * 0.4);
        ctx.lineTo(x - s * 0.4, y - s * 0.4);
        ctx.lineTo(x + s * 0.4, y - s * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - s * 0.4, y - s * 0.4, s * 0.8, 0, Math.PI * 0.5);
        ctx.stroke();
      } },
      { name: "Window", draw: (ctx, x, y, s) => {
        ctx.strokeRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.4);
        ctx.lineTo(x, y + s * 0.4);
        ctx.moveTo(x - s * 0.4, y);
        ctx.lineTo(x + s * 0.4, y);
        ctx.stroke();
      } },
      { name: "Stairs", draw: (ctx, x, y, s) => {
        ctx.strokeRect(x - s * 0.4, y - s * 0.4, s * 0.8, s * 0.8);
        ctx.beginPath();
        for (let i = 1; i < 6; i++) {
          ctx.moveTo(x - s * 0.4, y - s * 0.4 + i * s * 0.16);
          ctx.lineTo(x + s * 0.4, y - s * 0.4 + i * s * 0.16);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.4);
        ctx.lineTo(x - s * 0.4, y + s * 0.4);
        ctx.lineTo(x + s * 0.4, y + s * 0.4);
        ctx.closePath();
        ctx.stroke();
      } },
      { name: "North", draw: (ctx, x, y, s) => {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.4);
        ctx.lineTo(x - s * 0.1, y + s * 0.1);
        ctx.lineTo(x, y);
        ctx.lineTo(x + s * 0.1, y + s * 0.1);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        ctx.font = `bold ${s * 0.2}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("N", x, y - s * 0.5);
      } }
    ];
  }

  // src/engine/app/viewport.ts
  function initViewport() {
    const state2 = S.state;
    S.paper = document.getElementById("paper");
    S.stage = document.getElementById("canvas-stage");
    S.area = document.getElementById("canvas-area");
    S.bgImg = document.getElementById("bg-image");
    S.layersList = document.getElementById("layers-list");
    S.rulerOverlay = document.getElementById("ruler-overlay");
    S.colorPopover = document.getElementById("color-popover");
    S.stencilPopover = document.getElementById("stencil-popover");
    S.hintEl = document.getElementById("hint");
    S.fileInputImportImage = document.getElementById("file-import-image");
    S.fileInputStencil = document.getElementById("file-stencil");
    S.fileInputHatch = document.createElement("input");
    S.fileInputHatch.type = "file";
    S.fileInputHatch.accept = "image/png,image/jpeg,image/svg+xml,image/webp";
    S.fileInputHatch.multiple = true;
    S.fileInputHatch.style.display = "none";
    document.body.appendChild(S.fileInputHatch);
    S.fileInputHatch.addEventListener("change", (e) => {
      Array.from(e.target.files).forEach(S.addCustomHatchFromFile);
      e.target.value = "";
    });
    S.scalePrompt = document.getElementById("scale-prompt");
    S.imgOverlay = document.getElementById("img-overlay");
    S.applyStageTransform = function applyStageTransform() {
      S.stage.style.transform = `translate(${state2.panX}px, ${state2.panY}px)`;
      S.paper.style.transform = `translate(-50%, -50%) scale(${state2.zoom * state2.baseZoom})`;
      document.getElementById("zoom-level").textContent = Math.round(state2.zoom * 100) + "%";
      S.refreshMeasurements();
    };
    S.fitToScreen = function fitToScreen() {
      const areaRect = S.area.getBoundingClientRect();
      const padding = 60;
      const aw = areaRect.width - padding * 2;
      const ah = areaRect.height - padding * 2;
      const aspect = S.doc.wPx / S.doc.hPx;
      let w, h;
      if (aw / ah > aspect) {
        h = ah;
        w = h * aspect;
      } else {
        w = aw;
        h = w / aspect;
      }
      S.paper.style.width = S.doc.wPx + "px";
      S.paper.style.height = S.doc.hPx + "px";
      state2.baseZoom = w / S.doc.wPx;
      state2.zoom = 1;
      state2.panX = 0;
      state2.panY = 0;
      S.applyStageTransform();
    };
    S.resizeDocument = function resizeDocument(newWmm, newHmm, newDpi) {
      const oldW = S.doc.wPx, oldH = S.doc.hPx;
      S.doc.wMM = newWmm;
      S.doc.hMM = newHmm;
      S.doc.dpi = newDpi;
      S.doc.wPx = Math.round(S.doc.wMM / 25.4 * S.doc.dpi);
      S.doc.hPx = Math.round(S.doc.hMM / 25.4 * S.doc.dpi);
      state2.layers.forEach((layer) => {
        ["canvas", "imageCanvas"].forEach((key) => {
          const src = layer[key];
          if (!src) return;
          const tmp = document.createElement("canvas");
          tmp.width = oldW;
          tmp.height = oldH;
          tmp.getContext("2d").drawImage(src, 0, 0);
          src.width = S.doc.wPx;
          src.height = S.doc.hPx;
          const ctx = key === "canvas" ? layer.ctx : layer.imageCtx;
          ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
          ctx.drawImage(tmp, 0, 0, oldW, oldH, 0, 0, S.doc.wPx, S.doc.hPx);
        });
        layer.history = [];
        layer.redo = [];
      });
      S.strokeCanvas.width = S.doc.wPx;
      S.strokeCanvas.height = S.doc.hPx;
      const gc = document.getElementById("guide-canvas");
      gc.width = S.doc.wPx;
      gc.height = S.doc.hPx;
      const fmt = S.paperFormatName(newWmm, newHmm);
      document.querySelectorAll(".layer-props-title").forEach(() => {
      });
      const infoRows = document.querySelectorAll('#layers-panel [style*="justify-content:space-between"]');
      S.updateDocInfo(fmt);
      S.fitToScreen();
      S.drawDocGrid();
      if (typeof S.drawGuides === "function") S.drawGuides();
      state2.layers.forEach((l) => S.saveSnapshot(l));
      S.renderLayers();
    };
    S.expandDocumentPixels = function expandDocumentPixels(addLeft, addTop, addRight, addBottom) {
      if (!addLeft && !addTop && !addRight && !addBottom) return;
      const oldW = S.doc.wPx, oldH = S.doc.hPx;
      const newW = oldW + addLeft + addRight;
      const newH = oldH + addTop + addBottom;
      if (newW > 24e3 || newH > 24e3) return;
      const shiftLayerCanvases = (layer) => {
        ["canvas", "imageCanvas"].forEach((key) => {
          const src = layer[key];
          if (!src) return;
          const tmp = document.createElement("canvas");
          tmp.width = oldW;
          tmp.height = oldH;
          tmp.getContext("2d").drawImage(src, 0, 0);
          src.width = newW;
          src.height = newH;
          const ctx = key === "canvas" ? layer.ctx : layer.imageCtx;
          ctx.clearRect(0, 0, newW, newH);
          ctx.drawImage(tmp, addLeft, addTop);
        });
        layer.history = [];
        layer.redo = [];
        S.saveSnapshot(layer);
      };
      state2.layers.forEach(shiftLayerCanvases);
      S.strokeCanvas.width = newW;
      S.strokeCanvas.height = newH;
      const gc = document.getElementById("guide-canvas");
      if (gc) {
        gc.width = newW;
        gc.height = newH;
      }
      if (S.gridCanvas) {
        S.gridCanvas.width = newW;
        S.gridCanvas.height = newH;
      }
      S.doc.wPx = newW;
      S.doc.hPx = newH;
      if ((state2.infiniteCanvas || state2.autoExpandCanvas) && oldW > 0 && oldH > 0) {
        const mmPerPxW = S.doc.wMM / oldW;
        const mmPerPxH = S.doc.hMM / oldH;
        S.doc.wMM = newW * mmPerPxW;
        S.doc.hMM = newH * mmPerPxH;
        S.updateDocInfo(S.paperFormatName(S.doc.wMM, S.doc.hMM));
      }
      S.paper.style.width = S.doc.wPx + "px";
      S.paper.style.height = S.doc.hPx + "px";
      state2.vanishingPoints.forEach((vp) => {
        vp.x += addLeft;
        vp.y += addTop;
      });
      state2.measurements.forEach((m) => {
        if (m.x1 != null) {
          m.x1 += addLeft;
          m.y1 += addTop;
        }
        if (m.x2 != null) {
          m.x2 += addLeft;
          m.y2 += addTop;
        }
        if (m.points) m.points.forEach((p) => {
          p.x += addLeft;
          p.y += addTop;
        });
      });
      state2.walls.forEach((w) => {
        if (w.pts) w.pts.forEach((p) => {
          p.x += addLeft;
          p.y += addTop;
        });
      });
      state2.shapes.forEach((s) => {
        if (s.pts) s.pts.forEach((p) => {
          p.x += addLeft;
          p.y += addTop;
        });
        if (s.x != null) s.x += addLeft;
        if (s.y != null) s.y += addTop;
        if (s.cx != null) {
          s.cx += addLeft;
          s.cy += addTop;
        }
      });
      if (S.massing.baseAnchor) {
        S.massing.baseAnchor.px += addLeft;
        S.massing.baseAnchor.py += addTop;
      }
      S.drawDocGrid();
      if (typeof S.drawGuides === "function") S.drawGuides();
      S.refreshMeasurements();
      S.renderLayers();
    };
    S.CANVAS_EXPAND_PX = 900;
    S.CANVAS_EXPAND_THRESHOLD = 140;
    S.maybeExpandCanvas = function maybeExpandCanvas(_x, _y) {
    };
    S.releaseTransientInput = function releaseTransientInput() {
      state2.drawing = false;
      state2.isPanning = false;
      state2.lineDrag = null;
      if (typeof S.massing !== "undefined") S.massing.dragging = null;
      document.body.classList.remove("nm-drawing");
      S.activePointers.forEach((_, id) => {
        try {
          if (S.paper.hasPointerCapture(id)) S.paper.releasePointerCapture(id);
        } catch (_2) {
        }
        try {
          if (S.area.hasPointerCapture(id)) S.area.releasePointerCapture(id);
        } catch (_2) {
        }
        try {
          if (S.massingCanvas && S.massingCanvas.hasPointerCapture(id)) S.massingCanvas.releasePointerCapture(id);
        } catch (_2) {
        }
      });
      S.activePointers.clear();
      state2.pinchStart = null;
    };
    S.dismissSketchOverlays = function dismissSketchOverlays() {
      S.showWall2dPalette(false);
      S.showOpeningPalette(false);
      if (state2.polyActive) {
        state2.polyPoints = [];
        state2.polyActive = false;
        const ph = document.getElementById("poly-hint");
        if (ph) ph.style.display = "none";
      }
      S.closeGroupFlyout();
      if (S._brushFlyout) S._brushFlyout.style.display = "none";
      const selBar = document.getElementById("sel-bar");
      if (S.selBar) S.selBar.classList.remove("show");
    };
    S.paperFormatName = function paperFormatName(w, h) {
      const sizes = {
        "420x297": "A3",
        "297x210": "A4",
        "594x420": "A2",
        "841x594": "A1",
        "279x216": "Letter",
        "432x279": "Tabloid"
      };
      const key = `${Math.round(w)}x${Math.round(h)}`;
      const rev = `${Math.round(h)}x${Math.round(w)}`;
      const name = sizes[key] || sizes[rev];
      const orient = w >= h ? "Landscape" : "Portrait";
      return name ? `${name} ${orient}` : `Custom`;
    };
    S.updateDocInfo = function updateDocInfo(fmt) {
      const panel = document.getElementById("layers-panel");
      const rows = panel.querySelectorAll('div[style*="space-between"]');
      rows.forEach((row) => {
        const label = row.firstElementChild ? row.firstElementChild.textContent.trim() : "";
        const val = row.lastElementChild;
        if (!val) return;
        if (label === "Format") val.textContent = fmt;
        else if (label === "Size") val.textContent = `${S.doc.wMM} \xD7 ${S.doc.hMM} mm`;
        else if (label === "DPI") val.textContent = String(S.doc.dpi);
      });
    };
    S.canvasSizeDialog = document.getElementById("canvas-size-dialog");
    S._modalScrim = null;
    S.ensureModalScrim = function ensureModalScrim() {
      if (S._modalScrim) return S._modalScrim;
      S._modalScrim = document.createElement("div");
      S._modalScrim.id = "modal-scrim";
      S._modalScrim.addEventListener("click", () => S.closeCanvasSizeDialog());
      document.body.appendChild(S._modalScrim);
      return S._modalScrim;
    };
    S.closeCanvasSizeDialog = function closeCanvasSizeDialog() {
      S.canvasSizeDialog.classList.remove("show");
      S.canvasSizeDialog.style.display = "none";
      if (S._modalScrim) S._modalScrim.style.display = "none";
    };
    S.openCanvasSize = function openCanvasSize() {
      S.releaseTransientInput();
      S.dismissSketchOverlays();
      if (typeof window._closeMassMenus === "function") window._closeMassMenus();
      document.getElementById("cs-w").value = S.doc.wMM;
      document.getElementById("cs-h").value = S.doc.hMM;
      document.getElementById("cs-dpi").value = S.doc.dpi;
      S.ensureModalScrim().style.display = "block";
      S.canvasSizeDialog.style.display = "block";
      S.canvasSizeDialog.classList.add("show");
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = S.canvasSizeDialog.offsetWidth || 280;
      S.canvasSizeDialog.style.left = Math.max(12, (vw - w) / 2) + "px";
      S.canvasSizeDialog.style.top = Math.max(72, Math.min(vh * 0.12, 120)) + "px";
      S.syncCsPresets();
    };
    if (S.canvasSizeDialog) {
      S.canvasSizeDialog.addEventListener("pointerdown", (e) => e.stopPropagation());
      S.canvasSizeDialog.addEventListener("click", (e) => e.stopPropagation());
    }
    document.querySelectorAll("#canvas-size-dialog .cs-preset").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("cs-w").value = btn.dataset.w;
        document.getElementById("cs-h").value = btn.dataset.h;
        S.syncCsPresets();
      });
    });
    S.syncCsPresets = function syncCsPresets() {
      const w = document.getElementById("cs-w").value, h = document.getElementById("cs-h").value;
      document.querySelectorAll("#canvas-size-dialog .cs-preset").forEach((b) => b.classList.toggle("active", b.dataset.w === w && b.dataset.h === h));
    };
    document.getElementById("cs-w").addEventListener("input", S.syncCsPresets);
    document.getElementById("cs-h").addEventListener("input", S.syncCsPresets);
    document.getElementById("cs-orient").addEventListener("click", () => {
      const w = document.getElementById("cs-w"), h = document.getElementById("cs-h");
      const tmp = w.value;
      w.value = h.value;
      h.value = tmp;
      S.syncCsPresets();
    });
    document.getElementById("cs-cancel").addEventListener("click", () => {
      S.closeCanvasSizeDialog();
    });
    document.getElementById("cs-apply").addEventListener("click", () => {
      const w = Math.max(50, Math.min(2e3, parseInt(document.getElementById("cs-w").value) || 420));
      const h = Math.max(50, Math.min(2e3, parseInt(document.getElementById("cs-h").value) || 297));
      const dpi = parseInt(document.getElementById("cs-dpi").value) || 150;
      S.closeCanvasSizeDialog();
      S.resizeDocument(w, h, dpi);
      S.showHint(`Canvas resized to ${w} \xD7 ${h} mm @ ${dpi} DPI`);
    });
  }

  // src/engine/app/history.ts
  function capHistory(arr, max = 40) {
    while (arr.length > max) arr.shift();
  }

  // src/engine/app/layers.ts
  function initLayers() {
    const state2 = S.state;
    S.capHistory = capHistory;
    S.createLayer = function createLayer(name, opts) {
      var _a;
      opts = opts || {};
      const layerKind = opts.layerKind || "sketch";
      let engineId = null;
      if (S.layerEngine) {
        if (!S.layerEngine.rootFloorIds.length) {
          S.layerEngine.createFloor("Ground Floor");
        }
        engineId = S.layerEngine.createLayer({
          name: name || void 0,
          layerKind,
          floorId: opts.floorId,
          parentLayerId: opts.parentLayerId || null,
          locked: opts.locked,
          visible: opts.visible,
          opacity: opts.opacity,
          blendMode: opts.blendMode,
          insertAt: opts.insertAt
        });
        S.layerEngine.setActiveLayer(engineId);
      }
      const displayName = name || S.layerEngine && engineId && ((_a = S.layerEngine.getLayer(engineId)) == null ? void 0 : _a.name) || `Layer ${String(state2.layers.length + 1).padStart(2, "0")}`;
      const layer = engineId ? S.allocateLayerSurface(engineId, displayName) : S.allocateLayerSurface("legacy_" + S.layerIdCounter, displayName);
      if (!engineId) {
        state2.layers.push(layer);
        state2.activeLayer = state2.layers.length - 1;
      } else {
        S.syncStateLayersFromEngine();
      }
      S.updateLayerOrder();
      S.renderLayers();
      return layer;
    };
    S.importImageAsLayer = function importImageAsLayer(file, replaceLayer) {
      if (!replaceLayer && state2.replaceImageInLayer) {
        replaceLayer = state2.replaceImageInLayer;
        state2.replaceImageInLayer = null;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const img = new Image();
        img.onload = () => {
          const targetLayer = replaceLayer || S.createLayer(file.name.replace(/\.[^.]+$/, "").slice(0, 32) || "Image");
          const aspect = img.naturalWidth / img.naturalHeight;
          let w, h;
          if (S.doc.wPx / S.doc.hPx > aspect) {
            h = S.doc.hPx * 0.9;
            w = h * aspect;
          } else {
            w = S.doc.wPx * 0.9;
            h = w / aspect;
          }
          targetLayer.image = img;
          targetLayer.imageSource = dataUrl;
          targetLayer.imageTransform = {
            x: S.doc.wPx / 2,
            y: S.doc.hPx / 2,
            w,
            h,
            rotation: 0
          };
          targetLayer.imageOpacity = 1;
          targetLayer.imageCrop = null;
          targetLayer.imageBaked = false;
          S.renderImageCanvas(targetLayer);
          state2.activeLayer = state2.layers.indexOf(targetLayer);
          S.updateLayerOrder();
          S.renderLayers();
          S.updateUI();
          S.showHint("Image imported as layer \xB7 drag to move, corners to scale, top handle to rotate");
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    };
    S.workingImage = function workingImage(layer) {
      if (layer.imageCrop) return layer.image;
      const src = layer.image;
      const long = Math.max(src.naturalWidth, src.naturalHeight);
      const cap = 2200;
      if (long <= cap) return src;
      if (layer._imgWork && layer._imgWorkFor === src) return layer._imgWork;
      const s = cap / long;
      const wc = document.createElement("canvas");
      wc.width = Math.max(1, Math.round(src.naturalWidth * s));
      wc.height = Math.max(1, Math.round(src.naturalHeight * s));
      wc.getContext("2d").drawImage(src, 0, 0, wc.width, wc.height);
      layer._imgWork = wc;
      layer._imgWorkFor = src;
      return wc;
    };
    S.renderImageCanvas = function renderImageCanvas(layer) {
      const ctx = layer.imageCtx;
      ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      if (!layer.image || layer.imageBaked) return;
      const t = layer.imageTransform;
      ctx.save();
      ctx.globalAlpha = layer.imageOpacity;
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation * Math.PI / 180);
      const useImg = layer.imageManipulating ? S.workingImage(layer) : layer.image;
      let sx = 0, sy = 0, sw = useImg.naturalWidth || useImg.width, sh = useImg.naturalHeight || useImg.height;
      if (layer.imageCrop) {
        sx = layer.imageCrop.x;
        sy = layer.imageCrop.y;
        sw = layer.imageCrop.w;
        sh = layer.imageCrop.h;
      }
      ctx.drawImage(useImg, sx, sy, sw, sh, -t.w / 2, -t.h / 2, t.w, t.h);
      ctx.restore();
    };
    S.bakeImageLayer = function bakeImageLayer(layer) {
      if (!layer.image || layer.imageBaked) return;
      layer.ctx.save();
      layer.ctx.globalAlpha = layer.imageOpacity;
      layer.ctx.drawImage(layer.imageCanvas, 0, 0);
      layer.ctx.restore();
      layer.imageCanvas.getContext("2d").clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      layer.imageBaked = true;
      layer.image = null;
      S.saveSnapshot(layer);
      S.hideImageOverlay();
      S.renderLayers();
      S.updateUI();
    };
    S.updateLayerOrder = function updateLayerOrder() {
      state2.layers.forEach((l, i) => {
        if (l.imageCanvas) {
          l.imageCanvas.style.zIndex = (i * 2 + 2).toString();
          l.imageCanvas.style.opacity = l.visible ? 1 : 0;
          l.imageCanvas.style.pointerEvents = "none";
        }
        l.canvas.style.zIndex = (i * 2 + 3).toString();
        l.canvas.style.opacity = l.visible ? l.opacity : 0;
        l.canvas.style.mixBlendMode = l.blendMode && l.blendMode !== "source-over" ? l.blendMode : "";
        if (l.trace > 0) {
          l.canvas.style.filter = `sepia(${l.trace * 0.4}) saturate(${1 + l.trace * 0.5}) hue-rotate(-10deg)`;
        } else {
          l.canvas.style.filter = "";
        }
        const hasUnbakedImage = l.image && !l.imageBaked;
        l.canvas.style.pointerEvents = i === state2.activeLayer && state2.mode === "draw" && !hasUnbakedImage ? "auto" : "none";
      });
      S.rulerOverlay.style.zIndex = "999";
      S.refreshImageOverlay();
    };
    S.activeLayer = function activeLayer() {
      return state2.layers[state2.activeLayer];
    };
    S._capHistory = function _capHistory(layer) {
      const minSteps = 40;
      let budget = 220 * 1024 * 1024;
      let total = 0;
      for (let i = layer.history.length - 1; i >= 0; i--) {
        const e = layer.history[i];
        total += (e.before ? e.before.data.length : 0) + (e.after ? e.after.data.length : 0);
        if (total > budget && layer.history.length > minSteps) {
          layer.history.splice(0, i + 1);
          break;
        }
      }
    };
    S._blitRegion = function _blitRegion(full, region, x, y) {
      if (!full || !region) return;
      const fw = full.width, fh = full.height, rw = region.width, rh = region.height;
      const srcX = Math.max(0, -x), srcY = Math.max(0, -y);
      const dstX = Math.max(0, x), dstY = Math.max(0, y);
      const copyW = Math.min(rw - srcX, fw - dstX);
      const copyH = Math.min(rh - srcY, fh - dstY);
      if (copyW <= 0 || copyH <= 0) return;
      for (let row = 0; row < copyH; row++) {
        const dst = ((dstY + row) * fw + dstX) * 4;
        const src = ((srcY + row) * rw + srcX) * 4;
        full.data.set(region.data.subarray(src, src + copyW * 4), dst);
      }
    };
    S._extractRegion = function _extractRegion(full, x, y, w, h) {
      const out = new ImageData(w, h);
      if (!full) return out;
      const fw = full.width, fh = full.height;
      const srcX = Math.max(0, x), srcY = Math.max(0, y);
      const dstX = Math.max(0, -x), dstY = Math.max(0, -y);
      const copyW = Math.min(w - dstX, fw - srcX);
      const copyH = Math.min(h - dstY, fh - srcY);
      if (copyW <= 0 || copyH <= 0) return out;
      for (let row = 0; row < copyH; row++) {
        const src = ((srcY + row) * fw + srcX) * 4;
        const dst = ((dstY + row) * w + dstX) * 4;
        out.data.set(full.data.subarray(src, src + copyW * 4), dst);
      }
      return out;
    };
    S._bboxRect = function _bboxRect(bb) {
      if (!bb) return null;
      const pad = Math.ceil(bb.maxW) + 4;
      const x = Math.max(0, Math.floor(bb.minX - pad));
      const y = Math.max(0, Math.floor(bb.minY - pad));
      const w = Math.min(S.doc.wPx - x, Math.ceil(bb.maxX + pad) - x);
      const h = Math.min(S.doc.hPx - y, Math.ceil(bb.maxY + pad) - y);
      if (w <= 0 || h <= 0) return null;
      return { x, y, w, h };
    };
    S.saveSnapshot = function saveSnapshot(layer) {
      try {
        const after = layer.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
        const before = layer._cur || after;
        layer.history.push({ x: 0, y: 0, before, after });
        layer.redo = [];
        layer._cur = after;
        S._capHistory(layer);
        layer._dirty = true;
        S.scheduleAutosave();
      } catch (e) {
        console.warn(e);
      }
    };
    S.pushRegionSnapshot = function pushRegionSnapshot(layer, x, y, before, after) {
      try {
        layer.history.push({ x, y, before, after });
        layer.redo = [];
        if (!layer._cur || layer._cur.width !== S.doc.wPx || layer._cur.height !== S.doc.hPx) layer._cur = layer.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
        else S._blitRegion(layer._cur, after, x, y);
        S._capHistory(layer);
        layer._dirty = true;
        S.scheduleAutosave();
      } catch (e) {
        console.warn(e);
      }
    };
    S.vectorSnapshot = function vectorSnapshot() {
      return {
        walls: JSON.parse(JSON.stringify(state2.walls || [])),
        shapes: JSON.parse(JSON.stringify(state2.shapes || [])),
        measurements: JSON.parse(JSON.stringify(state2.measurements || []))
      };
    };
    S.applyVectorSnapshot = function applyVectorSnapshot(s) {
      state2.walls = JSON.parse(JSON.stringify(s.walls || []));
      state2.shapes = JSON.parse(JSON.stringify(s.shapes || []));
      S.ensureAllShapeIds(state2.shapes);
      state2.measurements = JSON.parse(JSON.stringify(s.measurements || []));
      state2.sel = null;
      state2.selOpening2D = null;
      S.syncSelectionManagerFromLegacy("programmatic");
      if (typeof S.showSelectBar === "function") S.showSelectBar(null);
      if (typeof S.showOpeningPalette === "function") S.showOpeningPalette(state2.tool === "opening");
      if (typeof S.refreshMeasurements === "function") S.refreshMeasurements();
      if (typeof S.syncWallsToMasses === "function") S.syncWallsToMasses();
      if (typeof S.renderSchedule === "function") S.renderSchedule();
    };
    S._lastVecPush = 0;
    S.recordVec = function recordVec(before, coalesce) {
      const l = S.activeLayer();
      if (!l) return;
      const after = S.vectorSnapshot();
      const now = Date.now();
      const top = l.history[l.history.length - 1];
      if (coalesce && top && top.vector && now - S._lastVecPush < 800) {
        top.vector.after = after;
      } else {
        l.history.push({ vector: { before, after } });
        l.redo = [];
        S._capHistory(l);
      }
      S._lastVecPush = now;
      l._dirty = true;
      S.scheduleAutosave();
    };
    S.undo = function undo() {
      if (S.massing.active) {
        S.massUndo();
        return;
      }
      const l = S.activeLayer();
      if (!l.history.length) return;
      const e = l.history.pop();
      if (e.vector) {
        S.applyVectorSnapshot(e.vector.before);
        l.redo.push(e);
        l._dirty = true;
        S.scheduleAutosave();
        return;
      }
      l.ctx.putImageData(e.before, e.x, e.y);
      l.redo.push(e);
      if (l._cur) S._blitRegion(l._cur, e.before, e.x, e.y);
      l._dirty = true;
      S.scheduleAutosave();
      S.renderLayers();
    };
    S.redo = function redo() {
      if (S.massing.active) {
        S.massRedo();
        return;
      }
      const l = S.activeLayer();
      if (!l.redo.length) return;
      const e = l.redo.pop();
      if (e.vector) {
        S.applyVectorSnapshot(e.vector.after);
        l.history.push(e);
        l._dirty = true;
        S.scheduleAutosave();
        return;
      }
      l.ctx.putImageData(e.after, e.x, e.y);
      l.history.push(e);
      if (l._cur) S._blitRegion(l._cur, e.after, e.x, e.y);
      l._dirty = true;
      S.scheduleAutosave();
      S.renderLayers();
    };
    S.clearActive = function clearActive() {
      const l = S.activeLayer();
      l.ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      S.saveSnapshot(l);
      S.renderLayers();
    };
    S.setWallsVisible = function setWallsVisible(visible) {
      state2.wallsVisible = !!visible;
      if (!state2.wallsVisible) {
        if (state2.sel && (state2.sel.type === "wall" || state2.sel.type === "opening")) {
          state2.sel = null;
          if (typeof S.showSelectBar === "function") S.showSelectBar(null);
        }
        state2.selOpening2D = null;
        if (typeof S.showOpeningPalette === "function") S.showOpeningPalette(false);
      }
      S.refreshMeasurements();
      S.renderLayers();
      S.scheduleAutosave();
    };
    S.renderLayers = function renderLayers() {
      S.layersList.innerHTML = "";
      const lcEl = document.getElementById("layer-count");
      if (lcEl) lcEl.textContent = state2.layers.length;
      if (S.layerEngine) {
        const rows = S.layerEngine.getPanelRows({ includeObjects: true, hideFloors: true });
        const activeId = S.layerEngine.getActiveLayerId();
        const paintIds = S.layerEngine.getRasterLayerIds();
        const multi = state2._panelMultiSelect || /* @__PURE__ */ new Set();
        const selectedObjId = state2._panelSelectedObjectId;
        for (const row of rows) {
          if (row.nodeKind === "floor") continue;
          if (row.nodeKind === "object") {
            const isSel = multi.has(row.id) || row.id === selectedObjId;
            const div2 = document.createElement("div");
            div2.className = "layer-card layer-card-object" + (isSel ? " active-layer" : "") + (row.visible ? "" : " layer-hidden");
            div2.style.paddingLeft = 12 + row.depth * 12 + "px";
            const typeLabel = (row.objectType || "object").toUpperCase();
            div2.innerHTML = `
            <div class="layer-thumb layer-thumb-vector" aria-hidden="true">
              <svg viewBox="0 0 42 30" width="42" height="30"><rect width="42" height="30" fill="#f7f5f2"/><rect x="8" y="8" width="26" height="14" fill="none" stroke="#1c1a18" stroke-width="1.5"/></svg>
            </div>
            <div class="layer-info">
              <div class="layer-name" data-oid="${row.id}">${S.escapeHtml(row.name)}</div>
              <div class="layer-meta">${typeLabel}${row.locked ? " \xB7 LOCK" : ""}</div>
            </div>
            <div class="layer-actions">
              <button class="layer-act ${row.visible ? "on" : "off"}" data-action="obj-vis" data-id="${row.id}" title="Visibility">
                ${row.visible ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'}
              </button>
              <button class="layer-act" data-action="obj-menu" data-id="${row.id}" title="Element options">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
              </button>
            </div>`;
            div2.addEventListener("click", (e) => {
              if (e.target.closest(".layer-act") || e.target.classList.contains("layer-name")) return;
              S.selectSceneObjectFromPanel(row.id, { additive: e.shiftKey || e.metaKey || e.ctrlKey });
              S.renderLayers();
            });
            const nameEl2 = div2.querySelector(".layer-name");
            nameEl2.addEventListener("dblclick", (e) => {
              e.stopPropagation();
              nameEl2.contentEditable = "true";
              nameEl2.focus();
            });
            nameEl2.addEventListener("blur", () => {
              const next = nameEl2.textContent.trim() || row.name;
              S.layerEngine.renameObject(row.id, next);
              const ref = row.legacyRef || (S.layerEngine.getObject(row.id) || {}).legacyRef;
              if (ref && ref.kind === "shape") {
                const sh = (state2.shapes || []).find((s) => s.id === ref.id);
                if (sh) sh.name = next;
              }
              if (ref && (ref.kind === "wall" || ref.kind === "wall-face")) {
                const wid = ref.kind === "wall" ? ref.id : ref.wallId;
                const w = (state2.walls || []).find((x) => x.id === wid);
                if (w && ref.kind === "wall") w.name = next;
              }
              nameEl2.contentEditable = "false";
              S.renderLayers();
            });
            nameEl2.addEventListener("keydown", (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                nameEl2.blur();
              }
            });
            div2.querySelectorAll(".layer-act").forEach((btn) => {
              btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === "obj-vis") {
                  const obj = S.layerEngine.getObject(id);
                  S.layerEngine.setObjectVisibility(id, !(obj && obj.visible));
                  S.renderLayers();
                  S.refreshMeasurements();
                  return;
                }
                if (action === "obj-menu") {
                  S.openElementMenu(id, btn);
                }
              });
            });
            S.layersList.appendChild(div2);
            continue;
          }
          const meta = S.layerEngine.getLayer(row.id);
          const surf = S.surfaceByEngineId(row.id);
          const idx = surf ? state2.layers.indexOf(surf) : -1;
          const hasUnbakedImage = surf && surf.image && !surf.imageBaked;
          const pad = 10 + row.depth * 12;
          const kindLabel = row.layerKind === "object" ? "LAYER" : (row.layerKind || "layer").toUpperCase();
          const div = document.createElement("div");
          div.className = "layer-card" + (row.id === activeId ? " active-layer" : "") + (row.visible ? "" : " layer-hidden");
          div.style.paddingLeft = pad + "px";
          const expandBtn = row.hasChildren ? `<button class="layer-act" data-action="expand" data-id="${row.id}" title="Expand">${row.expanded ? "\u25BE" : "\u25B8"}</button>` : `<span style="width:28px;flex-shrink:0"></span>`;
          const thumbHtml = surf ? '<canvas width="42" height="30"></canvas>' : '<div class="layer-thumb-vector" style="width:42px;height:30px;display:flex;align-items:center;justify-content:center;background:#f4f2ef;border-radius:4px;font-size:9px;color:#888;">OBJ</div>';
          div.innerHTML = `
          ${expandBtn}
          <div class="layer-thumb">${thumbHtml}</div>
          <div class="layer-info">
            <div class="layer-name" data-id="${row.id}">${S.escapeHtml(row.name)}${hasUnbakedImage ? '<span class="img-badge">IMG</span>' : ""}</div>
            <div class="layer-meta">${Math.round(row.opacity * 100)}% \xB7 ${kindLabel}${row.locked ? " \xB7 LOCK" : ""}${meta && meta.trace > 0 ? " \xB7 TRACE" : ""}</div>
          </div>
          <div class="layer-actions">
            <button class="layer-act ${row.visible ? "on" : "off"}" data-action="vis" data-id="${row.id}" title="Visibility">
              ${row.visible ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'}
            </button>
            <button class="layer-act ${row.locked ? "on" : "off"}" data-action="lock" data-id="${row.id}" title="Lock">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
            </button>
            ${surf ? `<button class="layer-act" data-action="menu" data-idx="${idx}" title="Layer options">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
            </button>` : ""}
            <button class="layer-act" data-action="del" data-id="${row.id}" ${paintIds.length <= 1 && surf || row.layerKind === "object" ? 'style="opacity:.2;pointer-events:none"' : ""}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>`;
          if (surf) {
            const thumb = div.querySelector("canvas");
            if (thumb) {
              const tctx = thumb.getContext("2d");
              if (surf.imageCanvas) tctx.drawImage(surf.imageCanvas, 0, 0, 42, 30);
              tctx.drawImage(surf.canvas, 0, 0, 42, 30);
            }
          }
          div.addEventListener("click", (e) => {
            if (e.target.closest(".layer-act") || e.target.classList.contains("layer-name")) return;
            if (!surf && row.layerKind === "object") {
              S.layerEngine.setLayerExpanded(row.id, true);
              S.renderLayers();
              return;
            }
            S.layerEngine.setActiveLayer(row.id);
            if (surf) S.ensureRasterSurface(row.id);
            S.syncStateLayersFromEngine();
            S.updateLayerOrder();
            S.renderLayers();
            S.updateUI();
          });
          const nameEl = div.querySelector(".layer-name");
          nameEl.addEventListener("dblclick", () => {
            nameEl.contentEditable = "true";
            nameEl.focus();
            const range = document.createRange();
            range.selectNodeContents(nameEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          });
          nameEl.addEventListener("blur", () => {
            const next = nameEl.textContent.trim() || "Layer";
            S.layerEngine.renameLayer(row.id, next);
            if (surf) surf.name = next;
            nameEl.contentEditable = "false";
            S.renderLayers();
          });
          nameEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              nameEl.blur();
            }
          });
          div.querySelectorAll(".layer-act").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const action = btn.dataset.action;
              const id = btn.dataset.id;
              if (action === "expand") {
                S.layerEngine.toggleLayerExpanded(id);
                S.renderLayers();
                return;
              }
              if (action === "vis") {
                const layer = S.layerEngine.getLayer(id);
                S.layerEngine.setLayerVisibility(id, !(layer && layer.visible));
                S.syncStateLayersFromEngine();
              } else if (action === "lock") {
                const layer = S.layerEngine.getLayer(id);
                S.layerEngine.setLayerLocked(id, !(layer && layer.locked));
                S.syncStateLayersFromEngine();
              } else if (action === "menu") {
                const menuIdx = parseInt(btn.dataset.idx, 10);
                if (!Number.isNaN(menuIdx) && menuIdx >= 0) S.openLayerMenu(menuIdx, btn);
                return;
              } else if (action === "del") {
                const layer = S.layerEngine.getLayer(id);
                const nm = layer && layer.name || "Layer";
                if (!confirm('Delete layer "' + nm + '"? This cannot be undone.')) return;
                S.disposeLayerSurface(id);
                S.layerEngine.deleteLayers([id]);
                for (const [eid] of [...S.layerSurfaces.keys()]) {
                  if (!S.layerEngine.getLayer(eid)) S.disposeLayerSurface(eid);
                }
                S.syncStateLayersFromEngine();
              }
              S.updateLayerOrder();
              S.renderLayers();
              S.updateUI();
            });
          });
          S.layersList.appendChild(div);
        }
        return;
      }
      for (let i = state2.layers.length - 1; i >= 0; i--) {
        const l = state2.layers[i];
        const div = document.createElement("div");
        div.className = "layer-card" + (i === state2.activeLayer ? " active-layer" : "");
        const hasUnbakedImage = l.image && !l.imageBaked;
        div.innerHTML = `
        <div class="layer-thumb"><canvas width="42" height="30"></canvas></div>
        <div class="layer-info">
          <div class="layer-name" data-idx="${i}">${S.escapeHtml(l.name)}${hasUnbakedImage ? '<span class="img-badge">IMG</span>' : ""}</div>
          <div class="layer-meta">${Math.round(l.opacity * 100)}% \xB7 ${l.visible ? "VISIBLE" : "HIDDEN"}</div>
        </div>
        <div class="layer-actions">
          <button class="layer-act ${l.visible ? "on" : "off"}" data-action="vis" data-idx="${i}">\u{1F441}</button>
          <button class="layer-act" data-action="menu" data-idx="${i}">\u22EF</button>
          <button class="layer-act" data-action="del" data-idx="${i}">\u{1F5D1}</button>
        </div>`;
        const thumb = div.querySelector("canvas");
        const tctx = thumb.getContext("2d");
        if (l.imageCanvas) tctx.drawImage(l.imageCanvas, 0, 0, 42, 30);
        tctx.drawImage(l.canvas, 0, 0, 42, 30);
        div.addEventListener("click", (e) => {
          if (e.target.closest(".layer-act")) return;
          state2.activeLayer = i;
          S.updateLayerOrder();
          S.renderLayers();
          S.updateUI();
        });
        S.layersList.appendChild(div);
      }
    };
    S.escapeHtml = function escapeHtml(s) {
      return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };
    S.layerCompositeToCtx = function layerCompositeToCtx(src, ctx) {
      if (src.imageCanvas && !src.imageBaked) ctx.drawImage(src.imageCanvas, 0, 0);
      ctx.drawImage(src.canvas, 0, 0);
    };
    S.moveLayer = function moveLayer(idx, dir) {
      const j = idx + dir;
      if (j < 0 || j >= state2.layers.length) return;
      const layer = state2.layers[idx];
      if (S.layerEngine && layer.engineId) {
        const meta = S.layerEngine.getLayer(layer.engineId);
        if (meta) {
          const siblings = meta.parentLayerId ? S.layerEngine.layers[meta.parentLayerId].childLayerIds : S.layerEngine.floors[meta.floorId].layerIds;
          const from = siblings.indexOf(layer.engineId);
          const to = from + dir;
          if (from >= 0 && to >= 0 && to < siblings.length) {
            S.layerEngine.moveLayer(layer.engineId, to);
            S.layerEngine.setActiveLayer(layer.engineId);
            S.syncStateLayersFromEngine();
            S.updateLayerOrder();
            S.renderLayers();
            return;
          }
        }
      }
      const [l] = state2.layers.splice(idx, 1);
      state2.layers.splice(j, 0, l);
      state2.activeLayer = j;
      S.updateLayerOrder();
      S.renderLayers();
    };
    S.duplicateLayer = function duplicateLayer(idx) {
      var _a;
      const src = state2.layers[idx];
      const nl = S.createLayer((src.name || "Layer") + " copy", {
        layerKind: S.layerEngine && src.engineId && ((_a = S.layerEngine.getLayer(src.engineId)) == null ? void 0 : _a.layerKind) || "sketch"
      });
      S.layerCompositeToCtx(src, nl.ctx);
      nl.opacity = src.opacity;
      nl.trace = src.trace;
      nl.blendMode = src.blendMode;
      nl.visible = src.visible;
      if (S.layerEngine && nl.engineId) {
        S.layerEngine.setLayerOpacity(nl.engineId, nl.opacity);
        S.layerEngine.setLayerVisibility(nl.engineId, nl.visible);
        S.layerEngine.setLayerBlendMode(nl.engineId, nl.blendMode);
        const meta = S.layerEngine.getLayer(nl.engineId);
        if (meta) meta.trace = nl.trace;
        if (src.engineId) {
          const srcMeta = S.layerEngine.getLayer(src.engineId);
          if (srcMeta) {
            const siblings = srcMeta.parentLayerId ? S.layerEngine.layers[srcMeta.parentLayerId].childLayerIds : S.layerEngine.floors[srcMeta.floorId].layerIds;
            const srcPos = siblings.indexOf(src.engineId);
            const copyPos = siblings.indexOf(nl.engineId);
            if (srcPos >= 0 && copyPos >= 0) {
              siblings.splice(copyPos, 1);
              siblings.splice(srcPos + 1, 0, nl.engineId);
              siblings.forEach((sid, i) => {
                if (S.layerEngine.layers[sid]) S.layerEngine.layers[sid].order = i;
              });
            }
          }
        }
        S.syncStateLayersFromEngine();
      } else {
        state2.layers.pop();
        state2.layers.splice(idx + 1, 0, nl);
        state2.activeLayer = idx + 1;
      }
      S.saveSnapshot(nl);
      S.updateLayerOrder();
      S.renderLayers();
      S.updateUI();
      S.showHint("Layer duplicated");
    };
    S.flipLayer = function flipLayer(idx, horizontal) {
      const l = state2.layers[idx];
      if (l.image && !l.imageBaked) S.bakeImageLayer(l);
      const tmp = document.createElement("canvas");
      tmp.width = S.doc.wPx;
      tmp.height = S.doc.hPx;
      tmp.getContext("2d").drawImage(l.canvas, 0, 0);
      l.ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      l.ctx.save();
      if (horizontal) {
        l.ctx.translate(S.doc.wPx, 0);
        l.ctx.scale(-1, 1);
      } else {
        l.ctx.translate(0, S.doc.hPx);
        l.ctx.scale(1, -1);
      }
      l.ctx.drawImage(tmp, 0, 0);
      l.ctx.restore();
      S.saveSnapshot(l);
      S.renderLayers();
      S.showHint(horizontal ? "Layer mirrored horizontally" : "Layer mirrored vertically");
    };
    S.mergeDownLayer = function mergeDownLayer(idx) {
      if (idx === 0) {
        S.showHint("Nothing below to merge into");
        return;
      }
      const top = state2.layers[idx], below = state2.layers[idx - 1];
      if (top.image && !top.imageBaked) S.bakeImageLayer(top);
      if (below.image && !below.imageBaked) S.bakeImageLayer(below);
      below.ctx.save();
      below.ctx.globalAlpha = top.visible ? top.opacity : 0;
      below.ctx.drawImage(top.canvas, 0, 0);
      below.ctx.restore();
      const topEngineId = top.engineId;
      S.disposeLayerSurface(topEngineId || "");
      if (top.canvas && top.canvas.parentNode) top.canvas.remove();
      if (top.imageCanvas && top.imageCanvas.parentNode) top.imageCanvas.remove();
      if (S.layerEngine && topEngineId) {
        S.layerEngine.deleteLayers([topEngineId]);
        if (below.engineId) S.layerEngine.setActiveLayer(below.engineId);
        S.syncStateLayersFromEngine();
      } else {
        state2.layers.splice(idx, 1);
        state2.activeLayer = idx - 1;
      }
      S.saveSnapshot(below);
      S.updateLayerOrder();
      S.renderLayers();
      S.updateUI();
      S.showHint("Merged down");
    };
    S.clearLayer = function clearLayer(idx) {
      const l = state2.layers[idx];
      if (!l) return;
      l.ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      if (l.imageCanvas) l.imageCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      l.image = null;
      l.imageBaked = false;
      l.imageTransform = null;
      l._savedBlob = null;
      l._rasterPath = null;
      S.hideImageOverlay();
      S.saveSnapshot(l);
      S.scheduleAutosave();
      S.saveDoc();
      S.renderLayers();
      S.updateUI();
      S.showHint("Layer cleared");
    };
    S.transformLayer = function transformLayer(idx) {
      const l = state2.layers[idx];
      const caps = S.__layersApi && S.__layersApi.getLayerTransformCapabilities ? S.__layersApi.getLayerTransformCapabilities() : { scalable: true, rotatable: true, movable: true };
      if (!caps.movable && !caps.scalable && !caps.rotatable) {
        S.showHint("This layer type does not support free transform");
        return;
      }
      state2.activeLayer = idx;
      if (S.layerEngine && l.engineId) S.layerEngine.setActiveLayer(l.engineId);
      if (l.image && !l.imageBaked) S.bakeImageLayer(l);
      const dataUrl = l.canvas.toDataURL("image/png");
      const img = new Image();
      img.onload = () => {
        l.ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
        l.image = img;
        l.imageSource = dataUrl;
        l.imageTransform = { x: S.doc.wPx / 2, y: S.doc.hPx / 2, w: S.doc.wPx, h: S.doc.hPx, rotation: 0 };
        l.imageOpacity = 1;
        l.imageCrop = null;
        l.imageBaked = false;
        S.renderImageCanvas(l);
        S.updateLayerOrder();
        S.renderLayers();
        S.updateUI();
        S.refreshImageOverlay();
        S.showHint("Transform \xB7 drag to move \xB7 corners to scale \xB7 top handle to rotate \xB7 Apply to commit");
      };
      img.src = dataUrl;
    };
    S.layerMenuEl = null;
    S.openLayerMenu = function openLayerMenu(idx, anchor) {
      S.closeLayerMenu();
      const items = [
        { label: "Move up", fn: () => S.moveLayer(idx, 1), disabled: idx === state2.layers.length - 1 },
        { label: "Move down", fn: () => S.moveLayer(idx, -1), disabled: idx === 0 },
        { label: "Duplicate", fn: () => S.duplicateLayer(idx) },
        { label: "Transform (move / scale / rotate)", fn: () => S.transformLayer(idx) },
        { label: "Mirror horizontal", fn: () => S.flipLayer(idx, true) },
        { label: "Mirror vertical", fn: () => S.flipLayer(idx, false) },
        { label: "Merge down", fn: () => S.mergeDownLayer(idx), disabled: idx === 0 },
        { label: "Clear", fn: () => S.clearLayer(idx) }
      ];
      const menu = document.createElement("div");
      menu.className = "layer-menu";
      items.forEach((it) => {
        const b = document.createElement("button");
        b.className = "layer-menu-item" + (it.disabled ? " disabled" : "");
        b.textContent = it.label;
        if (!it.disabled) b.addEventListener("click", (e) => {
          e.stopPropagation();
          S.closeLayerMenu();
          it.fn();
        });
        menu.appendChild(b);
      });
      document.body.appendChild(menu);
      S.layerMenuEl = menu;
      const r = anchor.getBoundingClientRect();
      const mw = 210;
      let left = r.right - mw;
      if (left < 8) left = 8;
      let top = r.bottom + 4;
      if (top + menu.offsetHeight > window.innerHeight - 8) top = r.top - menu.offsetHeight - 4;
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      setTimeout(() => document.addEventListener("pointerdown", S.closeLayerMenuOnOutside, true), 0);
    };
    S.openElementMenu = function openElementMenu(objectId, anchor) {
      S.closeLayerMenu();
      S.selectSceneObjectFromPanel(objectId, { additive: false });
      const multi = [...state2._panelMultiSelect || /* @__PURE__ */ new Set()];
      const items = [
        { label: "Move", fn: () => S.beginVecXform("move") },
        { label: "Scale", fn: () => S.beginVecXform("scale") },
        { label: "Rotate", fn: () => S.beginVecXform("rotate") },
        { label: "Add background image\u2026", fn: () => S.addBackgroundImageToSelection() },
        {
          label: multi.length >= 2 ? "Group selection\u2026" : "Group (select 2+ with Shift)",
          fn: () => S.groupSelectedElements(),
          disabled: multi.length < 2
        },
        { label: "Delete", fn: () => S.deleteSelectedElement() }
      ];
      const menu = document.createElement("div");
      menu.className = "layer-menu";
      items.forEach((it) => {
        const b = document.createElement("button");
        b.className = "layer-menu-item" + (it.disabled ? " disabled" : "");
        b.textContent = it.label;
        if (!it.disabled) b.addEventListener("click", (e) => {
          e.stopPropagation();
          S.closeLayerMenu();
          it.fn();
        });
        menu.appendChild(b);
      });
      document.body.appendChild(menu);
      S.layerMenuEl = menu;
      const r = anchor.getBoundingClientRect();
      const mw = 220;
      let left = r.right - mw;
      if (left < 8) left = 8;
      let top = r.bottom + 4;
      if (top + menu.offsetHeight > window.innerHeight - 8) top = r.top - menu.offsetHeight - 4;
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      setTimeout(() => document.addEventListener("pointerdown", S.closeLayerMenuOnOutside, true), 0);
    };
    S.groupSelectedElements = function groupSelectedElements() {
      if (!S.layerEngine) return;
      const ids = [...state2._panelMultiSelect || /* @__PURE__ */ new Set()];
      if (ids.length < 2) {
        S.showHint("Shift-click 2+ elements to group");
        return;
      }
      const name = prompt("Group name", "Room 1");
      if (name == null) return;
      try {
        const gid = S.layerEngine.groupObjects(ids, name.trim() || "Group");
        if (gid) {
          state2._panelSelectedObjectId = gid;
          state2._panelMultiSelect = /* @__PURE__ */ new Set([gid]);
          S.renderLayers();
          S.showHint("Grouped as " + (name.trim() || "Group"));
        }
      } catch (err) {
        S.showHint(err && err.message || "Could not group");
      }
    };
    S.deleteSelectedElement = function deleteSelectedElement() {
      const sel = state2.sel;
      if (sel && sel.type === "wall") {
        S.deleteWall(sel.wi);
        S.syncSceneObjectsToEngine();
        S.renderLayers();
        return;
      }
      if (sel && sel.type === "shape") {
        const __b = S.vectorSnapshot();
        state2.shapes.splice(sel.idx, 1);
        state2.sel = null;
        S.syncSelectionManagerFromLegacy("programmatic");
        S.showSelectBar(null);
        S.syncSceneObjectsToEngine();
        S.refreshMeasurements();
        S.recordVec(__b);
        S.scheduleAutosave();
        S.renderLayers();
        return;
      }
      if (S.layerEngine && state2._panelSelectedObjectId) {
        const obj = S.layerEngine.getObject(state2._panelSelectedObjectId);
        if (obj && obj.type === "group" && !obj.legacyRef) {
          S.layerEngine.deleteObjects([obj.id]);
          state2._panelSelectedObjectId = null;
          S.renderLayers();
        }
      }
    };
    S.getSelectedVecEntity = function getSelectedVecEntity() {
      const sel = state2.sel;
      if (!sel) return null;
      if (sel.type === "wall" && state2.walls[sel.wi]) {
        return { kind: "wall", wall: state2.walls[sel.wi], wi: sel.wi };
      }
      if (sel.type === "shape" && state2.shapes[sel.idx]) {
        return { kind: "shape", shape: state2.shapes[sel.idx], idx: sel.idx };
      }
      return null;
    };
    S.entityCentroid = function entityCentroid(ent) {
      if (!ent) return { x: 0, y: 0 };
      if (ent.kind === "wall") {
        const pts2 = ent.wall.pts || [];
        if (!pts2.length) return { x: 0, y: 0 };
        let sx2 = 0, sy2 = 0;
        pts2.forEach((p) => {
          sx2 += p.x;
          sy2 += p.y;
        });
        return { x: sx2 / pts2.length, y: sy2 / pts2.length };
      }
      const sh = ent.shape;
      if (sh.kind === "ellipse") return { x: sh.cx, y: sh.cy };
      const pts = sh.pts || [];
      if (!pts.length) return { x: 0, y: 0 };
      let sx = 0, sy = 0;
      pts.forEach((p) => {
        sx += p.x;
        sy += p.y;
      });
      return { x: sx / pts.length, y: sy / pts.length };
    };
    S.snapshotEntityGeom = function snapshotEntityGeom(ent) {
      if (ent.kind === "wall") {
        return { pts: (ent.wall.pts || []).map((p) => ({ x: p.x, y: p.y })) };
      }
      const sh = ent.shape;
      if (sh.kind === "ellipse") return { cx: sh.cx, cy: sh.cy, rx: sh.rx, ry: sh.ry };
      return { pts: (sh.pts || []).map((p) => ({ x: p.x, y: p.y })) };
    };
    S.applyEntityGeom = function applyEntityGeom(ent, geom) {
      if (ent.kind === "wall") {
        ent.wall.pts = geom.pts.map((p) => ({ x: p.x, y: p.y }));
        return;
      }
      const sh = ent.shape;
      if (sh.kind === "ellipse") {
        sh.cx = geom.cx;
        sh.cy = geom.cy;
        sh.rx = geom.rx;
        sh.ry = geom.ry;
      } else {
        sh.pts = geom.pts.map((p) => ({ x: p.x, y: p.y }));
      }
    };
    S.beginVecXform = function beginVecXform(mode) {
      const ent = S.getSelectedVecEntity();
      if (!ent) {
        S.showHint("Select a wall or shape first");
        return;
      }
      state2.vecXform = {
        mode,
        origin: S.entityCentroid(ent),
        base: S.snapshotEntityGeom(ent),
        start: null,
        before: null
      };
      if (typeof S.setTool === "function") S.setTool("select");
      const labels = { move: "Drag to move", scale: "Drag to scale", rotate: "Drag to rotate" };
      S.showHint((labels[mode] || "Transform") + " \xB7 Esc to cancel");
      S.showSelectBar(ent.kind === "wall" ? "wall" : "shape");
    };
    S.cancelVecXform = function cancelVecXform() {
      state2.vecXform = null;
    };
    S.applyVecXformAt = function applyVecXformAt(p) {
      const xf = state2.vecXform;
      if (!xf || !xf.start) return;
      const ent = S.getSelectedVecEntity();
      if (!ent) return;
      const o = xf.origin;
      const base = xf.base;
      if (xf.mode === "move") {
        const dx = p.x - xf.start.x, dy = p.y - xf.start.y;
        if (ent.kind === "wall" || ent.shape && ent.shape.kind !== "ellipse") {
          S.applyEntityGeom(ent, {
            pts: base.pts.map((q) => ({ x: q.x + dx, y: q.y + dy }))
          });
        } else {
          S.applyEntityGeom(ent, { cx: base.cx + dx, cy: base.cy + dy, rx: base.rx, ry: base.ry });
        }
      } else if (xf.mode === "scale") {
        const d0 = Math.hypot(xf.start.x - o.x, xf.start.y - o.y) || 1;
        const d1 = Math.hypot(p.x - o.x, p.y - o.y);
        const s = Math.max(0.05, d1 / d0);
        if (ent.kind === "wall" || ent.shape && ent.shape.kind !== "ellipse") {
          S.applyEntityGeom(ent, {
            pts: base.pts.map((q) => ({
              x: o.x + (q.x - o.x) * s,
              y: o.y + (q.y - o.y) * s
            }))
          });
        } else {
          S.applyEntityGeom(ent, { cx: base.cx, cy: base.cy, rx: base.rx * s, ry: base.ry * s });
        }
      } else if (xf.mode === "rotate") {
        const a0 = Math.atan2(xf.start.y - o.y, xf.start.x - o.x);
        const a1 = Math.atan2(p.y - o.y, p.x - o.x);
        const da = a1 - a0;
        const cos = Math.cos(da), sin = Math.sin(da);
        if (ent.kind === "wall" || ent.shape && ent.shape.kind !== "ellipse") {
          S.applyEntityGeom(ent, {
            pts: base.pts.map((q) => {
              const dx = q.x - o.x, dy = q.y - o.y;
              return { x: o.x + dx * cos - dy * sin, y: o.y + dx * sin + dy * cos };
            })
          });
        } else {
          S.applyEntityGeom(ent, { cx: base.cx, cy: base.cy, rx: base.rx, ry: base.ry });
          S.showHint("Rotate works on rectangles / polygons / walls");
        }
      }
      if (ent.kind === "wall") S.syncWallsToMasses();
      S.refreshMeasurements();
    };
    S.addBackgroundImageToSelection = function addBackgroundImageToSelection() {
      const ent = S.getSelectedVecEntity();
      if (!ent) {
        S.showHint("Select a wall or shape first");
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        input.remove();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          const img = new Image();
          img.onload = () => {
            const __b = S.vectorSnapshot();
            if (ent.kind === "shape") {
              ent.shape.bgImage = dataUrl;
              ent.shape._bgImg = img;
            } else {
              ent.wall.bgImage = dataUrl;
              ent.wall._bgImg = img;
            }
            S.recordVec(__b);
            S.scheduleAutosave();
            S.refreshMeasurements();
            S.showHint("Background image added \u2014 use Move / Scale / Rotate to transform");
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });
      input.click();
    };
    S.closeLayerMenu = function closeLayerMenu() {
      if (S.layerMenuEl) {
        S.layerMenuEl.remove();
        S.layerMenuEl = null;
      }
      document.removeEventListener("pointerdown", S.closeLayerMenuOnOutside, true);
    };
    S.closeLayerMenuOnOutside = function closeLayerMenuOnOutside(e) {
      if (S.layerMenuEl && !S.layerMenuEl.contains(e.target)) S.closeLayerMenu();
    };
    S.clientToCanvas = function clientToCanvas(clientX, clientY) {
      const rect = S.paper.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width * S.doc.wPx;
      const y = (clientY - rect.top) / rect.height * S.doc.hPx;
      return { x, y };
    };
  }

  // src/engine/app/stroke-input.ts
  function initStrokeInput() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.strokeCanvas = document.createElement("canvas");
    S.strokeCanvas.width = S.doc.wPx;
    S.strokeCanvas.height = S.doc.hPx;
    S.strokeCanvas.id = "stroke-buffer";
    S.strokeCanvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0;will-change:opacity;";
    S.strokeCtx = S.strokeCanvas.getContext("2d");
    S.paper.appendChild(S.strokeCanvas);
    S.replayCanvas = document.createElement("canvas");
    S.replayCtx = S.replayCanvas.getContext("2d");
    S.strokeTarget = function strokeTarget() {
      return state2.usingBuffer ? S.strokeCtx : S.activeLayer().ctx;
    };
    S.pressureFor = function pressureFor(e) {
      if (e.pointerType === "pen" && e.pressure > 0) return e.pressure;
      if (e.pointerType === "touch") return 0.55;
      return 0.5;
    };
    S.activePointers = /* @__PURE__ */ new Map();
    S.paper.addEventListener("pointerdown", (e) => {
      if (typeof S.hideShapeChip === "function") S.hideShapeChip();
      S.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (e.pointerType === "touch") {
        S.gestureState.touchTimes.set(e.pointerId, Date.now());
        S.gestureState.peakCount = Math.max(S.gestureState.peakCount, S.gestureState.touchTimes.size);
      }
      if ((e.pointerType === "pen" || e.pointerType === "mouse") && state2.mode === "draw" && !["hand", "ruler", "area", "wall", "opening", "select", "offset", "fill", "stencil", "brushes", "wand", "lasso"].includes(state2.tool)) {
        S.uiHide();
      }
      if (state2.mode === "navigate" || state2.tool === "hand" || S.activePointers.size > 1) {
        if (S.activePointers.size > 1 && state2.drawing) {
          state2.drawing = false;
          if (typeof S.strokeCanvas !== "undefined" && S.strokeCanvas) {
            S.strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
            S.strokeCtx.clearRect(0, 0, S.strokeCanvas.width, S.strokeCanvas.height);
            S.strokeCanvas.style.opacity = "0";
          }
          state2.strokeSegs = [];
        }
        S.paper.setPointerCapture(e.pointerId);
        if (S.activePointers.size === 2) {
          const pts = Array.from(S.activePointers.values());
          state2.pinchStart = {
            dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
            zoom: state2.zoom,
            midX: (pts[0].x + pts[1].x) / 2,
            midY: (pts[0].y + pts[1].y) / 2,
            panX: state2.panX,
            panY: state2.panY
          };
        } else {
          state2.isPanning = true;
          state2.panStartX = e.clientX - state2.panX;
          state2.panStartY = e.clientY - state2.panY;
        }
        return;
      }
      if (state2.tool === "stencil") {
        S.placeStencil(S.clientToCanvas(e.clientX, e.clientY));
        return;
      }
      if (state2.tool === "area" || state2.tool === "line" || state2.tool === "wall") {
        e.preventDefault();
        const p2 = S.clientToCanvas(e.clientX, e.clientY);
        if (state2.tool === "line") {
          state2.lineDrag = { x1: p2.x, y1: p2.y, x2: p2.x, y2: p2.y, pointerId: e.pointerId };
          S.paper.setPointerCapture && S.paper.setPointerCapture(e.pointerId);
          return;
        }
        state2._lastPolyClient = { x: e.clientX, y: e.clientY };
        state2.smoothedX = p2.x;
        state2.smoothedY = p2.y;
        const now = Date.now();
        if (state2._lastAreaTap && now - state2._lastAreaTap.time < 350 && Math.hypot(e.clientX - state2._lastAreaTap.x, e.clientY - state2._lastAreaTap.y) < 24) {
          const enough = state2.tool === "line" || state2.tool === "wall" ? state2.polyPoints.length >= 2 : state2.polyPoints.length >= 3;
          if (state2.polyActive && enough) {
            state2._lastAreaTap = null;
            S.finishPoly();
            return;
          }
        }
        state2._lastAreaTap = { time: now, x: e.clientX, y: e.clientY };
        S.addPolyVertex(p2);
        return;
      }
      if (state2.tool === "offset") {
        e.preventDefault();
        const p2 = S.clientToCanvas(e.clientX, e.clientY);
        const t = S.offsetTargetAt(p2);
        if (t) {
          state2.offset = { type: t.type, idx: t.idx, mm: state2.offset && state2.offset.mm || 100, dir: state2.offset && state2.offset.dir || -1 };
          S.showOffsetBar(true);
          S.refreshMeasurements();
          S.showHint("Selected \u2014 set distance, In/Out, then Apply");
        } else {
          state2.offset = null;
          S.showOffsetBar(false);
          S.refreshMeasurements();
          S.showHint("Tap a room or a shape to offset its boundary");
        }
        return;
      }
      if (state2.tool === "select") {
        e.preventDefault();
        const p2 = S.clientToCanvas(e.clientX, e.clientY);
        if (state2.vecXform && state2.vecXform.mode) {
          const ent = S.getSelectedVecEntity();
          if (ent) {
            state2.vecXform.start = { x: p2.x, y: p2.y };
            state2.vecXform.origin = S.entityCentroid(ent);
            state2.vecXform.base = S.snapshotEntityGeom(ent);
            state2.vecXform.before = S.vectorSnapshot();
            S.paper.setPointerCapture && S.paper.setPointerCapture(e.pointerId);
            const mv = (ev) => {
              S.applyVecXformAt(S.clientToCanvas(ev.clientX, ev.clientY));
            };
            const up = () => {
              document.removeEventListener("pointermove", mv);
              document.removeEventListener("pointerup", up);
              document.removeEventListener("pointercancel", up);
              if (state2.vecXform && state2.vecXform.before) {
                S.recordVec(state2.vecXform.before);
                S.scheduleAutosave();
              }
              S.syncSceneObjectsToEngine();
              S.renderLayers();
              state2.vecXform = null;
              S.showHint("Transform applied");
            };
            document.addEventListener("pointermove", mv);
            document.addEventListener("pointerup", up);
            document.addEventListener("pointercancel", up);
            return;
          }
        }
        S.selectEntityAt(p2);
        if (S.layerEngine && state2.sel) {
          if (state2.sel.type === "shape" && state2.sel.id) {
            const obj = S.findEngineObjectByLegacy((r) => r.kind === "shape" && r.id === state2.sel.id);
            if (obj) {
              state2._panelSelectedObjectId = obj.id;
              state2._panelMultiSelect = /* @__PURE__ */ new Set([obj.id]);
              S.renderLayers();
            }
          } else if (state2.sel.type === "wall" && state2.walls[state2.sel.wi]) {
            S.ensureWallId(state2.walls[state2.sel.wi]);
            const wid = state2.walls[state2.sel.wi].id;
            const seg = state2.sel.seg;
            const obj = S.findEngineObjectByLegacy(
              (r) => r.kind === "wall-face" && r.wallId === wid && (seg == null || r.seg === seg) || r.kind === "wall" && r.id === wid
            );
            if (obj) {
              state2._panelSelectedObjectId = obj.id;
              state2._panelMultiSelect = /* @__PURE__ */ new Set([obj.id]);
              S.renderLayers();
            }
          }
        }
        return;
      }
      if (state2.tool === "opening") {
        e.preventDefault();
        const p2 = S.clientToCanvas(e.clientX, e.clientY);
        const hit = S.openingHitTest2D(p2);
        if (hit) {
          state2.selOpening2D = hit;
          state2._draggingOpening = true;
          state2._slideBefore = S.vectorSnapshot();
          state2._slideMoved = false;
          S.updateOpeningPalette();
          S.refreshMeasurements();
        } else {
          S.placeOpening2D(p2);
        }
        return;
      }
      if (state2.tool === "wand") {
        e.preventDefault();
        const p2 = S.clientToCanvas(e.clientX, e.clientY);
        if (state2.floating && S.insideFloating(p2)) {
          S.startFloatDrag(e, p2);
          return;
        }
        if (state2.selection && S.maskAt(p2)) {
          S.floatSelection();
          S.startFloatDrag(e, p2);
          return;
        }
        if (state2.floating) {
          S.commitFloating();
        }
        const tol = parseInt($el("fill-tolerance").value) * 3;
        S.magicWandSelect(p2, tol);
        return;
      }
      if (state2.tool === "lasso") {
        e.preventDefault();
        S.commitFloating();
        S.clearSelection();
        const p2 = S.clientToCanvas(e.clientX, e.clientY);
        state2.lassoPoints = [p2];
        S.paper.setPointerCapture && S.paper.setPointerCapture(e.pointerId);
        let raf = false;
        const mv = (ev) => {
          const q = S.clientToCanvas(ev.clientX, ev.clientY);
          state2.lassoPoints.push(q);
          if (raf) return;
          raf = true;
          requestAnimationFrame(() => {
            raf = false;
            S.drawLassoPath();
          });
        };
        const up = () => {
          document.removeEventListener("pointermove", mv);
          document.removeEventListener("pointerup", up);
          document.removeEventListener("pointercancel", up);
          S.finishLasso();
        };
        document.addEventListener("pointermove", mv);
        document.addEventListener("pointerup", up);
        document.addEventListener("pointercancel", up);
        return;
      }
      if (state2.eyedropperActive) {
        e.preventDefault();
        const p2 = S.clientToCanvas(e.clientX, e.clientY);
        const x = Math.round(p2.x), y = Math.round(p2.y);
        const tmp = document.createElement("canvas");
        tmp.width = S.doc.wPx;
        tmp.height = S.doc.hPx;
        const tctx = tmp.getContext("2d");
        tctx.fillStyle = "#ffffff";
        tctx.fillRect(0, 0, S.doc.wPx, S.doc.hPx);
        state2.layers.forEach((l2) => {
          if (!l2.visible) return;
          if (l2.imageCanvas && !l2.imageBaked) tctx.drawImage(l2.imageCanvas, 0, 0);
          tctx.globalAlpha = l2.opacity;
          tctx.drawImage(l2.canvas, 0, 0);
        });
        tctx.globalAlpha = 1;
        const [r, g, b] = tctx.getImageData(x, y, 1, 1).data;
        const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
        S.setColor(hex);
        state2.eyedropperActive = false;
        document.body.style.cursor = "";
        S.showHint(`Picked: ${hex.toUpperCase()}`);
        return;
      }
      if (state2.tool === "fill") {
        e.preventDefault();
        const p2 = S.clientToCanvas(e.clientX, e.clientY);
        const l2 = S.activeLayer();
        const tolerance = parseInt($el("fill-tolerance").value) * 3;
        const expand = parseInt($el("fill-expand").value) || 0;
        const sampleAll = $el("fill-sample-all").checked;
        S.showHint("Filling\u2026");
        setTimeout(() => {
          const sample = S.sampleData(sampleAll);
          let mask = S.computeFillMask(sample, p2.x, p2.y, tolerance);
          const shrinkEl = $el("fill-shrink");
          const shrink = shrinkEl ? parseInt(shrinkEl.value, 10) : 2;
          if (shrink > 0) mask = S.shrinkMask(mask, shrink);
          else if (expand) mask = S.expandMask(mask, expand);
          S.applyFill(l2, mask);
          S.saveSnapshot(l2);
          S.renderLayers();
          S.showHint("Fill complete");
        }, 10);
        return;
      }
      S.paper.setPointerCapture(e.pointerId);
      const p = S.clientToCanvas(e.clientX, e.clientY);
      if (S.measureDeleteAt(e.clientX, e.clientY)) return;
      state2.drawing = true;
      state2.lastX = p.x;
      state2.lastY = p.y;
      state2.startX = p.x;
      state2.startY = p.y;
      state2.lastStampX = p.x;
      state2.lastStampY = p.y;
      state2.stampAccum = 0;
      state2.snapActive = false;
      state2.snapAnchor = { x: p.x, y: p.y };
      state2.smoothedX = p.x;
      state2.smoothedY = p.y;
      state2.velocity = 0;
      state2.strokeAge = 0;
      const l = S.activeLayer();
      if (state2.tool === "ruler") {
        const startX = state2.dimChainMode && state2.dimChainEnd ? state2.dimChainEnd.x : p.x;
        const startY = state2.dimChainMode && state2.dimChainEnd ? state2.dimChainEnd.y : p.y;
        state2.measurePreview = { x1: startX, y1: startY, x2: p.x, y2: p.y };
        return;
      }
      if (["rect", "circle"].includes(state2.tool)) {
        state2._shapeEnd = null;
        state2.snapshot = l.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
        return;
      }
      const brush = S.activeBrush();
      state2.usingBuffer = brush.kind !== "erase" && !(brush.tipType === "texture" && brush.tipImage);
      if (state2.usingBuffer) {
        const dpr = window.devicePixelRatio || 1;
        const longSide = Math.max(S.doc.wPx, S.doc.hPx);
        const sizeCap = Math.min(1, 1600 / longSide);
        const previewScale = Math.max(0.2, Math.min(state2.baseZoom * state2.zoom * dpr, sizeCap));
        state2.bufScale = previewScale;
        const bw = Math.max(1, Math.round(S.doc.wPx * previewScale));
        const bh = Math.max(1, Math.round(S.doc.hPx * previewScale));
        if (S.strokeCanvas.width !== bw || S.strokeCanvas.height !== bh) {
          S.strokeCanvas.width = bw;
          S.strokeCanvas.height = bh;
        } else {
          S.strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
          S.strokeCtx.clearRect(0, 0, bw, bh);
        }
        S.strokeCtx.setTransform(previewScale, 0, 0, previewScale, 0, 0);
        state2.strokeSegs = [];
        state2.strokeStart = { x: p.x, y: p.y };
        state2.strokeColor = state2.color;
        const activeZ = state2.activeLayer * 2 + 3;
        S.strokeCanvas.style.zIndex = (activeZ + 1).toString();
        S.strokeCanvas.style.opacity = state2.alpha;
        S.strokeCanvas.style.mixBlendMode = brush.blend && brush.blend !== "source-over" ? brush.blend : "normal";
      }
      const tgt = S.strokeTarget();
      state2.strokeBBox = { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y, maxW: state2.size };
      if (brush.tipType === "texture" && brush.tipImage) {
        S.stampTexture(l.ctx, brush, p.x, p.y, S.pressureFor(e));
      } else {
        S.configurePen(tgt, S.pressureFor(e), brush, state2.usingBuffer);
        tgt.beginPath();
        tgt.moveTo(p.x, p.y);
      }
    });
    S.paper.addEventListener("pointermove", (e) => {
      if (state2._draggingOpening && state2.selOpening2D) {
        S.slideOpening2D(state2.selOpening2D, S.clientToCanvas(e.clientX, e.clientY));
        state2._slideMoved = true;
        return;
      }
      if (S.activePointers.has(e.pointerId)) {
        S.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (state2.pinchStart && S.activePointers.size === 2) {
        const pts = Array.from(S.activePointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        state2.zoom = Math.max(0.2, Math.min(8, state2.pinchStart.zoom * (dist / state2.pinchStart.dist)));
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        state2.panX = state2.pinchStart.panX + (midX - state2.pinchStart.midX);
        state2.panY = state2.pinchStart.panY + (midY - state2.pinchStart.midY);
        S.applyStageTransform();
        return;
      }
      if (state2.isPanning) {
        state2.panX = e.clientX - state2.panStartX;
        state2.panY = e.clientY - state2.panStartY;
        S.applyStageTransform();
        return;
      }
      if (state2.lineDrag && state2.lineDrag.pointerId === e.pointerId) {
        const p = S.clientToCanvas(e.clientX, e.clientY);
        let x2 = p.x, y2 = p.y;
        if (e.shiftKey) {
          const sn = S.snapToOrtho(x2, y2, state2.lineDrag.x1, state2.lineDrag.y1);
          x2 = sn.x;
          y2 = sn.y;
          $el("snap-badge").classList.add("show");
        } else {
          $el("snap-badge").classList.remove("show");
        }
        state2.lineDrag.x2 = x2;
        state2.lineDrag.y2 = y2;
        state2.measurePreview = { x1: state2.lineDrag.x1, y1: state2.lineDrag.y1, x2, y2 };
        S.refreshMeasurements();
        return;
      }
      if (e.pointerType === "pen") {
        $el("pressure-val").textContent = (e.pressure * 100).toFixed(0) + "%";
      }
      if (!state2.drawing) return;
      const l = S.activeLayer();
      const mainP = S.clientToCanvas(e.clientX, e.clientY);
      if (state2.tool === "ruler") {
        state2.measurePreview.x2 = mainP.x;
        state2.measurePreview.y2 = mainP.y;
        S.refreshMeasurements();
        return;
      }
      if (["rect", "circle"].includes(state2.tool)) {
        let tp = { ...mainP };
        if (e.shiftKey) {
          if (state2.tool === "line") {
            const sn = S.snapToOrtho(tp.x, tp.y, state2.startX, state2.startY);
            tp.x = sn.x;
            tp.y = sn.y;
          } else if (state2.tool === "rect") {
            const dx = tp.x - state2.startX, dy = tp.y - state2.startY;
            const s = Math.sign(dx) * Math.max(Math.abs(dx), Math.abs(dy));
            tp.x = state2.startX + s;
            tp.y = state2.startY + Math.sign(dy) * Math.abs(s);
          }
          $el("snap-badge").classList.add("show");
        } else {
          $el("snap-badge").classList.remove("show");
        }
        state2._shapeEnd = { x: tp.x, y: tp.y };
        l.ctx.putImageData(state2.snapshot, 0, 0);
        l.ctx.globalCompositeOperation = "source-over";
        l.ctx.globalAlpha = state2.alpha;
        l.ctx.strokeStyle = state2.color;
        l.ctx.lineWidth = Math.max(0.5, state2.size);
        l.ctx.lineCap = "round";
        l.ctx.lineJoin = "round";
        l.ctx.beginPath();
        if (state2.tool === "line") {
          l.ctx.moveTo(state2.startX, state2.startY);
          l.ctx.lineTo(tp.x, tp.y);
          l.ctx.stroke();
        } else if (state2.tool === "rect") {
          l.ctx.strokeRect(state2.startX, state2.startY, tp.x - state2.startX, tp.y - state2.startY);
        } else if (state2.tool === "circle") {
          const dx = tp.x - state2.startX, dy = tp.y - state2.startY;
          const r = Math.sqrt(dx * dx + dy * dy);
          l.ctx.arc(state2.startX, state2.startY, r, 0, Math.PI * 2);
          l.ctx.stroke();
        }
        return;
      }
      const coalescedEvents = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      const brush = S.activeBrush();
      function drawFreehandPoint(ce, isPredicted) {
        let p = S.clientToCanvas(ce.clientX, ce.clientY);
        const pr = isPredicted ? S.pressureFor(ce) * 0.85 : S.pressureFor(ce);
        if (e.shiftKey && S.isDrawTool(state2.tool)) {
          p = S.applyOrthoSnap(p, e);
        } else if (state2.snapActive && !e.shiftKey) {
          state2.snapActive = false;
          state2.snapAnchor = null;
          $el("snap-badge").classList.remove("show");
        }
        if (state2.stabilizer > 0) {
          const s = state2.stabilizer;
          state2.smoothedX = p.x + s * (state2.smoothedX - p.x);
          state2.smoothedY = p.y + s * (state2.smoothedY - p.y);
          p = { x: state2.smoothedX, y: state2.smoothedY };
        } else {
          state2.smoothedX = p.x;
          state2.smoothedY = p.y;
        }
        S.maybeExpandCanvas(p.x, p.y);
        const dx = p.x - state2.lastX, dy = p.y - state2.lastY;
        const segDist = Math.sqrt(dx * dx + dy * dy);
        state2.velocity = state2.velocity * 0.72 + segDist * 0.28;
        const velMul = Math.max(0.65, Math.min(1, 1 - (state2.velocity - 1) * 0.04));
        let tiltMul = 1;
        if (ce.altitudeAngle !== void 0 && ce.altitudeAngle < Math.PI / 2) {
          const flatness = 1 - ce.altitudeAngle / (Math.PI / 2);
          tiltMul = 1 + flatness * 0.6;
        }
        state2.strokeAge = (state2.strokeAge || 0) + 1;
        const taperIn = Math.min(1, state2.strokeAge / 8);
        const taperPr = pr * taperIn;
        if (brush.tipType === "texture" && brush.tipImage) {
          const effSize = Math.max(1, brush.size * (1 - brush.pressureSize + brush.pressureSize * taperPr) * velMul * tiltMul);
          const step = Math.max(0.5, brush.spacing * effSize);
          state2.stampAccum += segDist;
          let placed = 0;
          while (state2.stampAccum >= step && placed < 500) {
            const overshoot = state2.stampAccum - step;
            const t = (segDist - overshoot) / Math.max(segDist, 1e-3);
            const sx = state2.lastStampX + dx * t;
            const sy = state2.lastStampY + dy * t;
            const savedSize = brush.size;
            brush.size *= velMul * tiltMul;
            S.stampTexture(l.ctx, brush, sx, sy, taperPr);
            brush.size = savedSize;
            state2.lastStampX = sx;
            state2.lastStampY = sy;
            state2.stampAccum = overshoot;
            placed++;
          }
          state2.lastX = p.x;
          state2.lastY = p.y;
        } else {
          const tgt = S.strokeTarget();
          S.configurePen(tgt, taperPr, brush, state2.usingBuffer);
          tgt.lineWidth = Math.max(0.3, tgt.lineWidth * velMul * tiltMul);
          const mx = (state2.lastX + p.x) / 2;
          const my = (state2.lastY + p.y) / 2;
          tgt.quadraticCurveTo(state2.lastX, state2.lastY, mx, my);
          tgt.stroke();
          if (state2.symmetryAxis === "vertical") {
            const cx = S.doc.wPx / 2;
            const mir = (x) => 2 * cx - x;
            tgt.beginPath();
            tgt.moveTo(mir(state2.lastX), state2.lastY);
            tgt.quadraticCurveTo(mir(state2.lastX), state2.lastY, mir(mx), my);
            tgt.stroke();
          } else if (state2.symmetryAxis === "horizontal") {
            const cy = S.doc.hPx / 2;
            const mirY = (y) => 2 * cy - y;
            tgt.beginPath();
            tgt.moveTo(state2.lastX, mirY(state2.lastY));
            tgt.quadraticCurveTo(state2.lastX, mirY(state2.lastY), mx, mirY(my));
            tgt.stroke();
          }
          tgt.beginPath();
          tgt.moveTo(mx, my);
          const bb = state2.strokeBBox;
          if (bb) {
            const hw = tgt.lineWidth;
            bb.minX = Math.min(bb.minX, state2.lastX, mx);
            bb.minY = Math.min(bb.minY, state2.lastY, my);
            bb.maxX = Math.max(bb.maxX, state2.lastX, mx);
            bb.maxY = Math.max(bb.maxY, state2.lastY, my);
            bb.maxW = Math.max(bb.maxW, hw);
          }
          if (state2.usingBuffer) {
            state2.strokeSegs.push({ cx: state2.lastX, cy: state2.lastY, mx, my, w: tgt.lineWidth });
          }
          state2.lastX = p.x;
          state2.lastY = p.y;
        }
      }
      for (const ce of coalescedEvents) drawFreehandPoint(ce, false);
      if (e.getPredictedEvents && brush.tipType !== "texture" && !state2.usingBuffer) {
        const predicted = e.getPredictedEvents();
        for (const pe of predicted) drawFreehandPoint(pe, true);
      }
      S.updateBrushCursor(e, brush);
    });
    S.gestureState = {
      touchTimes: /* @__PURE__ */ new Map(),
      // pointerId → timestamp of touchstart
      peakCount: 0
    };
    S.showGestureFlash = function showGestureFlash() {
      const el = document.createElement("div");
      el.className = "gesture-flash";
      document.body.appendChild(el);
      el.addEventListener("animationend", () => el.remove());
    };
    S._hideTimer = null;
    S.uiHide = function uiHide() {
      clearTimeout(S._hideTimer);
      document.body.classList.add("nm-drawing");
    };
    S.uiShow = function uiShow(delay = 700) {
      clearTimeout(S._hideTimer);
      S._hideTimer = setTimeout(() => document.body.classList.remove("nm-drawing"), delay);
    };
    S._snapTimer = null;
    S.scheduleSnapshot = function scheduleSnapshot(layer) {
      layer._dirty = true;
      clearTimeout(S._snapTimer);
      S._snapTimer = setTimeout(() => {
        S.saveSnapshot(layer);
        setTimeout(() => S.renderLayers(), 50);
      }, 320);
    };
    S.endPointer = function endPointer(e) {
      S.activePointers.delete(e.pointerId);
      if (S.activePointers.size < 2) state2.pinchStart = null;
      if (e.pointerType === "touch" && S.gestureState.touchTimes.has(e.pointerId)) {
        const elapsed = Date.now() - S.gestureState.touchTimes.get(e.pointerId);
        S.gestureState.touchTimes.delete(e.pointerId);
        if (S.gestureState.touchTimes.size === 0) {
          if (elapsed < 220 && !state2.drawing) {
            if (S.gestureState.peakCount === 2) {
              S.undo();
              S.showGestureFlash();
              S.showHint("\u21B6  Undo");
            } else if (S.gestureState.peakCount === 3) {
              S.redo();
              S.showGestureFlash();
              S.showHint("\u21B7  Redo");
            }
          }
          S.gestureState.peakCount = 0;
        }
      }
      if (state2.isPanning) {
        state2.isPanning = false;
        S.uiShow(200);
      }
      if (state2.lineDrag && state2.lineDrag.pointerId === e.pointerId) {
        const ld = state2.lineDrag;
        state2.lineDrag = null;
        state2.measurePreview = null;
        S.refreshMeasurements();
        $el("snap-badge").classList.remove("show");
        if (Math.hypot(ld.x2 - ld.x1, ld.y2 - ld.y1) > 3) {
          state2.polyPoints = [{ x: ld.x1, y: ld.y1 }, { x: ld.x2, y: ld.y2 }];
          S.commitPolygonShape(false);
        }
        return;
      }
      if (e.pointerType === "pen" || e.pointerType === "mouse") S.uiShow();
      if (!state2.drawing) return;
      state2.drawing = false;
      const l = S.activeLayer();
      if (state2.tool === "ruler") {
        const pending = state2.measurePreview;
        state2.measurePreview = null;
        S.commitMeasurement(pending);
        return;
      }
      if (["rect", "circle"].includes(state2.tool)) {
        if (state2._shapeEnd) {
          const s = { x: state2.startX, y: state2.startY }, en = state2._shapeEnd;
          if (state2.snapshot) l.ctx.putImageData(state2.snapshot, 0, 0);
          let geom = null, entity = null;
          const sw = Math.max(0.5, state2.size);
          if (state2.tool === "rect") {
            const x = Math.min(s.x, en.x), y = Math.min(s.y, en.y), w = Math.abs(en.x - s.x), h = Math.abs(en.y - s.y);
            if (w > 2 && h > 2) {
              geom = { kind: "rect", x, y, w, h };
              entity = { kind: "rect", pts: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], closed: true, stroke: state2.color, width: sw };
            }
          } else {
            const r = Math.hypot(en.x - s.x, en.y - s.y);
            if (r > 2) {
              geom = { kind: "circle", cx: s.x, cy: s.y, r };
              entity = { kind: "ellipse", cx: s.x, cy: s.y, rx: r, ry: r, stroke: state2.color, width: sw };
            }
          }
          state2._shapeEnd = null;
          if (entity) {
            const __b = S.vectorSnapshot();
            S.pushShapeEntity(entity);
            S.recordVec(__b);
            S.scheduleAutosave();
          }
          S.renderLayers();
          S.refreshMeasurements();
          if (geom && typeof S.onShapeCommitted === "function") S.onShapeCommitted(geom, { x: e.clientX, y: e.clientY });
        }
        return;
      }
      if (S.isDrawTool(state2.tool)) {
        const brush = S.activeBrush();
        const tgt = S.strokeTarget();
        if (brush.tipType !== "texture" && !state2.usingBuffer) tgt.stroke();
        const rect = S._bboxRect(state2.strokeBBox);
        if (state2.usingBuffer) {
          const segs = state2.strokeSegs || [];
          let before = null;
          if (rect) before = l._cur ? S._extractRegion(l._cur, rect.x, rect.y, rect.w, rect.h) : l.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
          if (segs.length) {
            if (S.replayCanvas.width !== S.doc.wPx || S.replayCanvas.height !== S.doc.hPx) {
              S.replayCanvas.width = S.doc.wPx;
              S.replayCanvas.height = S.doc.hPx;
            } else {
              S.replayCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
            }
            const fctx = S.replayCtx;
            fctx.strokeStyle = state2.strokeColor || state2.color;
            fctx.lineCap = "round";
            fctx.lineJoin = "round";
            fctx.globalAlpha = 1;
            fctx.beginPath();
            fctx.moveTo(state2.strokeStart.x, state2.strokeStart.y);
            for (const s of segs) {
              fctx.lineWidth = s.w;
              fctx.quadraticCurveTo(s.cx, s.cy, s.mx, s.my);
              fctx.stroke();
              fctx.beginPath();
              fctx.moveTo(s.mx, s.my);
            }
            l.ctx.save();
            l.ctx.globalAlpha = state2.alpha;
            l.ctx.globalCompositeOperation = brush.blend && brush.blend !== "source-over" ? brush.blend : "source-over";
            l.ctx.drawImage(S.replayCanvas, 0, 0);
            l.ctx.restore();
          }
          S.strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
          S.strokeCtx.clearRect(0, 0, S.strokeCanvas.width, S.strokeCanvas.height);
          S.strokeCanvas.style.opacity = "0";
          S.strokeCanvas.style.mixBlendMode = "normal";
          state2.usingBuffer = false;
          state2.strokeSegs = [];
          if (rect && before) {
            const after = l.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
            S.pushRegionSnapshot(l, rect.x, rect.y, before, after);
          } else {
            S.saveSnapshot(l);
          }
        } else {
          if (rect && l._cur) {
            const before = S._extractRegion(l._cur, rect.x, rect.y, rect.w, rect.h);
            const after = l.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
            S.pushRegionSnapshot(l, rect.x, rect.y, before, after);
          } else {
            S.saveSnapshot(l);
          }
          l._rasterPath = null;
        }
        state2.strokeBBox = null;
        clearTimeout(S._thumbTimer);
        S._thumbTimer = setTimeout(() => S.renderLayers(), 400);
        l._dirty = true;
        l._savedBlob = null;
        S.scheduleAutosave();
        S.saveDoc();
      }
    };
    S._thumbTimer = null;
    S.paper.addEventListener("pointerup", S.endPointer);
    S.paper.addEventListener("pointerup", () => {
      if (state2._draggingOpening) {
        state2._draggingOpening = false;
        if (state2._slideMoved && state2._slideBefore) S.recordVec(state2._slideBefore, true);
        state2._slideBefore = null;
        state2._slideMoved = false;
        S.scheduleAutosave();
      }
    });
    S.paper.addEventListener("pointercancel", S.endPointer);
    S.paper.addEventListener("pointerleave", S.endPointer);
    S.paper.addEventListener("dblclick", (e) => {
      if ((state2.tool === "area" || state2.tool === "line" || state2.tool === "wall") && state2.polyActive) {
        e.preventDefault();
        S.finishPoly();
      }
    });
    S.activeBrush = function activeBrush() {
      if (state2.activeBrush) return state2.activeBrush;
      if (S.brushLibraryEngine) {
        const fromLib = S.brushLibraryEngine.get(state2.tool);
        if (fromLib) return fromLib;
      }
      return S.BUILTIN_BRUSHES.find((b) => b.id === state2.tool) || S.BUILTIN_BRUSHES[0];
    };
    S.configurePen = function configurePen(ctx, pressure, brush, skipMaster) {
      brush = brush || S.activeBrush();
      const brushApi = S.brushes;
      const pxPerMm = state2.pxPerUnit ? state2.scaleUnit === "mm" ? state2.pxPerUnit : state2.scaleUnit === "cm" ? state2.pxPerUnit / 10 : state2.pxPerUnit / 1e3 : S.doc.dpi / 25.4;
      if (brushApi && typeof brushApi.resolveStrokeParams === "function") {
        const params = brushApi.resolveStrokeParams(brush, pressure, {
          color: state2.color,
          size: state2.size,
          alpha: state2.alpha,
          pxPerMm,
          zoom: state2.zoom
        });
        if (typeof brushApi.applyBrushToCanvasContext === "function") {
          brushApi.applyBrushToCanvasContext(ctx, brush, params, state2.color, {
            skipMasterAlpha: !!skipMaster
          });
          if (skipMaster) {
            ctx.globalCompositeOperation = brush.kind === "erase" ? "destination-out" : "source-over";
          }
          return params;
        }
      }
      ctx.globalCompositeOperation = brush.kind === "erase" ? "destination-out" : skipMaster ? "source-over" : brush.blend;
      ctx.strokeStyle = state2.color;
      ctx.fillStyle = state2.color;
      ctx.lineCap = brush.tipType === "chisel" || brush.tipType === "flat" ? "butt" : "round";
      ctx.lineJoin = "round";
      let baseSize = state2.size;
      if (brush.scaleAware && brush.scaleAware.enabled && brush.scaleAware.lineWeightMm) {
        baseSize = Math.max(0.5, brush.scaleAware.lineWeightMm * pxPerMm);
      }
      const size = Math.max(0.3, baseSize * (1 - (brush.pressureSize || 0) + (brush.pressureSize || 0) * pressure));
      ctx.lineWidth = size;
      if (skipMaster) {
        ctx.globalAlpha = 1;
      } else {
        const alpha = state2.alpha * (1 - (brush.pressureOpacity || 0) + (brush.pressureOpacity || 0) * pressure);
        ctx.globalAlpha = brush.kind === "erase" ? 1 : Math.min(1, Math.max(0.02, alpha));
      }
      if (brush.dash && brush.dash.enabled) {
        const dash = brush.dash.dashMm || 4;
        const gap = brush.dash.gapMm || 2;
        ctx.setLineDash(brush.dash.pattern === "centerline" ? [dash * 3, gap, dash, gap] : [dash, gap]);
      } else {
        ctx.setLineDash([]);
      }
      return null;
    };
    S.getTipImage = function getTipImage(dataUrl) {
      if (!dataUrl) return null;
      let img = state2.tipImageCache[dataUrl];
      if (img) {
        if (typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement) return img;
        return img.complete ? img : null;
      }
      img = new Image();
      img.src = dataUrl;
      state2.tipImageCache[dataUrl] = img;
      return img.complete ? img : null;
    };
    S.stampTexture = function stampTexture(ctx, brush, x, y, pressure) {
      const img = S.getTipImage(brush.tipImage);
      if (!img) return;
      const effSize = Math.max(2, brush.size * (1 - brush.pressureSize + brush.pressureSize * pressure));
      let jx = 0, jy = 0, sScale = 1;
      if (brush.jitter > 0) {
        jx = (Math.random() - 0.5) * effSize * brush.jitter * 0.5;
        jy = (Math.random() - 0.5) * effSize * brush.jitter * 0.5;
        sScale = 1 - brush.jitter * 0.3 + Math.random() * brush.jitter * 0.6;
      }
      const w = effSize * sScale, h = effSize * sScale;
      const off = document.createElement("canvas");
      off.width = Math.max(2, Math.ceil(w));
      off.height = Math.max(2, Math.ceil(h));
      const oc = off.getContext("2d");
      oc.drawImage(img, 0, 0, off.width, off.height);
      oc.globalCompositeOperation = "source-in";
      oc.fillStyle = state2.color;
      oc.fillRect(0, 0, off.width, off.height);
      const baseAlpha = state2.alpha;
      const alpha = baseAlpha * (1 - brush.pressureOpacity + brush.pressureOpacity * pressure);
      ctx.save();
      ctx.globalCompositeOperation = brush.blend;
      ctx.globalAlpha = brush.kind === "erase" ? 1 : Math.min(1, Math.max(0.02, alpha));
      ctx.drawImage(off, x - w / 2 + jx, y - h / 2 + jy, w, h);
      ctx.restore();
    };
    S.area.addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.metaKey || state2.mode === "navigate" || state2.mode === "draw") {
        e.preventDefault();
        const delta = -e.deltaY * 1e-3;
        const oldZoom = state2.zoom;
        state2.zoom = Math.max(0.2, Math.min(8, state2.zoom * (1 + delta)));
        const areaRect = S.area.getBoundingClientRect();
        const cx = e.clientX - areaRect.left - areaRect.width / 2;
        const cy = e.clientY - areaRect.top - areaRect.height / 2;
        const factor = state2.zoom / oldZoom;
        state2.panX = cx - (cx - state2.panX) * factor;
        state2.panY = cy - (cy - state2.panY) * factor;
        S.applyStageTransform();
      }
    }, { passive: false });
    S.startAreaPan = function startAreaPan(e) {
      if (state2.mode !== "navigate" && state2.tool !== "hand") return false;
      if (!S.area || S.paper && (e.target === S.paper || S.paper.contains(e.target))) return false;
      e.preventDefault();
      S.area.setPointerCapture(e.pointerId);
      S.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      state2.isPanning = true;
      state2.panStartX = e.clientX - state2.panX;
      state2.panStartY = e.clientY - state2.panY;
      S.area.style.cursor = "grabbing";
      return true;
    };
    S.area.addEventListener("pointerdown", (e) => {
      S.startAreaPan(e);
    });
    S.area.addEventListener("pointermove", (e) => {
      if (!state2.isPanning) return;
      if (state2.mode !== "navigate" && state2.tool !== "hand") return;
      if (S.area.hasPointerCapture && !S.area.hasPointerCapture(e.pointerId)) return;
      state2.panX = e.clientX - state2.panStartX;
      state2.panY = e.clientY - state2.panStartY;
      S.applyStageTransform();
    });
    S.area.addEventListener("pointerup", (e) => {
      if (state2.isPanning && S.area.hasPointerCapture && S.area.hasPointerCapture(e.pointerId)) {
        state2.isPanning = false;
        S.area.releasePointerCapture(e.pointerId);
        if (state2.mode === "navigate") S.area.style.cursor = "grab";
        else S.area.style.cursor = "";
      }
    });
    S.area.addEventListener("pointercancel", (e) => {
      if (S.area.hasPointerCapture && S.area.hasPointerCapture(e.pointerId)) {
        state2.isPanning = false;
        S.area.releasePointerCapture(e.pointerId);
        S.area.style.cursor = state2.mode === "navigate" ? "grab" : "";
      }
    });
  }

  // src/engine/app/measure.ts
  function initMeasure() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.refreshMeasurements = function refreshMeasurements() {
      S.rulerOverlay.innerHTML = "";
      S.rulerOverlay.setAttribute("viewBox", `0 0 ${S.doc.wPx} ${S.doc.hPx}`);
      S.renderWalls2D();
      S.renderShapes2D();
      if (state2.tool === "offset" && state2.offset) {
        const ov = S.computeOffsetPreview();
        if (ov) S.drawOffsetPreview(ov);
      }
      if (state2.showMeasurements) {
        state2.measurements.forEach((m, i) => S.addMeasureSVG(m, false, i));
      }
      if (state2.measurePreview) S.addMeasureSVG(state2.measurePreview, true);
      if (state2.dimChainMode && state2.dimChainEnd && state2.tool === "ruler") {
        const svgns = "http://www.w3.org/2000/svg";
        const { x, y } = state2.dimChainEnd;
        const ring = document.createElementNS(svgns, "circle");
        ring.setAttribute("cx", String(x));
        ring.setAttribute("cy", String(y));
        ring.setAttribute("r", "22");
        ring.setAttribute("fill", "rgba(160,40,53,0.12)");
        ring.setAttribute("stroke", "#a02835");
        ring.setAttribute("stroke-width", "3");
        ring.setAttribute("stroke-dasharray", "6 4");
        ring.setAttribute("pointer-events", "none");
        S.rulerOverlay.appendChild(ring);
        const dot = document.createElementNS(svgns, "circle");
        dot.setAttribute("cx", String(x));
        dot.setAttribute("cy", String(y));
        dot.setAttribute("r", "8");
        dot.setAttribute("fill", "#a02835");
        dot.setAttribute("pointer-events", "none");
        S.rulerOverlay.appendChild(dot);
      }
    };
    S.measureDeleteAt = function measureDeleteAt(clientX, clientY) {
      if (!state2.showMeasurements || !state2.measurements.length) return false;
      const hit = document.elementFromPoint(clientX, clientY);
      if (!hit || !S.rulerOverlay.contains(hit)) return false;
      const raw = hit.dataset ? hit.dataset.measureIdx : null;
      if (raw == null || raw === "") return false;
      const idx = parseInt(raw, 10);
      if (Number.isNaN(idx)) return false;
      S.deleteMeasurement(idx);
      return true;
    };
    S.deleteMeasurement = function deleteMeasurement(idx) {
      if (typeof idx !== "number" || idx < 0 || idx >= state2.measurements.length) return;
      const __b = S.vectorSnapshot();
      state2.measurements.splice(idx, 1);
      if (state2.dimChainMode && state2.measurements.length === 0) state2.dimChainEnd = null;
      S.refreshMeasurements();
      S.renderSchedule();
      S.recordVec(__b);
      S.showHint("Measurement deleted");
    };
    S.commitMeasurement = function commitMeasurement(m) {
      if (!m) return;
      const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
      if (Math.sqrt(dx * dx + dy * dy) < 10) return;
      if (state2.pendingScale) {
        state2.pendingScaleStart = { x: m.x1, y: m.y1 };
        state2.pendingScaleEnd = { x: m.x2, y: m.y2 };
        state2.pendingScale = false;
        state2.measurePreview = m;
        S.refreshMeasurements();
        S.openScaleApply();
        return;
      }
      const __b = S.vectorSnapshot();
      state2.measurements.push({ ...m });
      if (state2.dimChainMode) {
        state2.dimChainEnd = { x: m.x2, y: m.y2 };
      }
      S.refreshMeasurements();
      S.recordVec(__b);
    };
    window.addEventListener("resize", () => {
      S.fitToScreen();
    });
    S.startScale = function startScale() {
      S.setTool("ruler");
      state2.pendingScale = true;
      S.showHint("Draw a line on the canvas, then enter its real-world length");
    };
    S.openScaleApply = function openScaleApply() {
      S.scalePrompt.style.display = "block";
      S.scalePrompt.classList.add("show");
      const rect = S.paper.getBoundingClientRect();
      const midX = (state2.pendingScaleStart.x + state2.pendingScaleEnd.x) / 2;
      const midY = (state2.pendingScaleStart.y + state2.pendingScaleEnd.y) / 2;
      const sx = midX / S.doc.wPx * rect.width + rect.left;
      const sy = midY / S.doc.hPx * rect.height + rect.top;
      const areaRect = S.area.getBoundingClientRect();
      S.scalePrompt.style.left = Math.min(areaRect.width - 260, Math.max(20, sx - areaRect.left + 20)) + "px";
      S.scalePrompt.style.top = Math.max(20, sy - areaRect.top - 120) + "px";
      const inp = $el("scale-length");
      inp.value = "";
      setTimeout(() => inp.focus(), 30);
    };
    $el("scale-apply").addEventListener("click", () => {
      const v = parseFloat($el("scale-length").value);
      const u = $el("scale-unit").value;
      if (!v || v <= 0) return;
      const dx = state2.pendingScaleEnd.x - state2.pendingScaleStart.x;
      const dy = state2.pendingScaleEnd.y - state2.pendingScaleStart.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);
      state2.pxPerUnit = distPx / v;
      state2.scaleUnit = u;
      const label = S.updateScaleDisplay();
      S.syncProjectScale(label);
      S.scalePrompt.classList.remove("show");
      S.scalePrompt.style.display = "none";
      state2.measurePreview = null;
      state2.pendingScaleStart = null;
      state2.pendingScaleEnd = null;
      S.refreshMeasurements();
      S.renderSchedule();
      S.scheduleAutosave();
      S.showHint(`Scale set \xB7 ${v} ${u} reference \xB7 measurements now in real units`);
    });
    $el("scale-cancel").addEventListener("click", () => {
      S.scalePrompt.classList.remove("show");
      S.scalePrompt.style.display = "none";
      state2.pendingScale = false;
      state2.pendingScaleStart = null;
      state2.pendingScaleEnd = null;
      state2.measurePreview = null;
      S.refreshMeasurements();
    });
  }

  // src/engine/app/stencils.ts
  function initStencils() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.placeStencil = function placeStencil(p) {
      if (state2.selectedStencil === null) return;
      const rad = (state2.stencilRotation || 0) * Math.PI / 180;
      const l = S.activeLayer();
      const ctx = l.ctx;
      if (state2.stencilCat === "hatch") {
        const hatch = S.hatchList()[state2.selectedStencil];
        if (!hatch) return;
        const size2 = Math.max(200, state2.size * 40) * (state2.stencilScale || 1);
        S.placeHatch(hatch, ctx, p.x, p.y, size2, rad);
        S.saveSnapshot(l);
        S.renderLayers();
        return;
      }
      const baseSize = Math.max(100, state2.size * 40);
      const size = baseSize * (state2.stencilScale || 1);
      const stencil = S.currentStencilList()[state2.selectedStencil];
      if (!stencil) return;
      const drawWith = (drawFn) => {
        const half = size * 0.85;
        const rx = Math.max(0, Math.floor(p.x - half));
        const ry = Math.max(0, Math.floor(p.y - half));
        const rw = Math.min(S.doc.wPx - rx, Math.ceil(half * 2));
        const rh = Math.min(S.doc.hPx - ry, Math.ceil(half * 2));
        let before = null;
        try {
          before = ctx.getImageData(rx, ry, rw, rh);
        } catch (_) {
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        if (rad) ctx.rotate(rad);
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = state2.color;
        ctx.fillStyle = state2.color;
        ctx.lineWidth = Math.max(1, state2.size);
        ctx.globalAlpha = state2.alpha;
        drawFn();
        ctx.restore();
        try {
          const after = ctx.getImageData(rx, ry, rw, rh);
          if (before) S.pushRegionSnapshot(l, rx, ry, before, after);
          else S.saveSnapshot(l);
        } catch (_) {
          S.saveSnapshot(l);
        }
        S.renderLayers();
      };
      if (stencil.dataUrl) {
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          const w = size * 1.5, h = w / ratio;
          drawWith(() => ctx.drawImage(img, -w / 2, -h / 2, w, h));
        };
        img.src = stencil.dataUrl;
      } else if (stencil.draw) {
        drawWith(() => stencil.draw(ctx, 0, 0, size));
      }
    };
    S.currentStencilList = function currentStencilList() {
      return state2.stencilCat === "builtin" ? S.BUILTIN_STENCILS : state2.customStencils;
    };
    S.renderStencils = function renderStencils() {
      const grid = $el("stencil-grid");
      grid.innerHTML = "";
      const list = S.currentStencilList();
      list.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "stencil" + (state2.selectedStencil === i ? " active" : "");
        div.title = s.name;
        if (s.dataUrl) {
          const img = document.createElement("img");
          img.src = s.dataUrl;
          div.appendChild(img);
        } else {
          const tmp = document.createElement("canvas");
          tmp.width = 80;
          tmp.height = 80;
          const tctx = tmp.getContext("2d");
          tctx.strokeStyle = "#0a0a0a";
          tctx.lineWidth = 1.8;
          tctx.lineCap = "round";
          tctx.lineJoin = "round";
          s.draw(tctx, 40, 40, 60);
          const img = document.createElement("img");
          img.src = tmp.toDataURL();
          div.appendChild(img);
        }
        div.addEventListener("click", () => {
          state2.selectedStencil = i;
          S.renderStencils();
          S.showHint(`Tap canvas to place: ${s.name}`);
        });
        if (state2.stencilCat === "custom") {
          const del = document.createElement("button");
          del.className = "del";
          del.textContent = "\xD7";
          del.addEventListener("click", (e) => {
            e.stopPropagation();
            state2.customStencils.splice(i, 1);
            if (state2.selectedStencil === i) state2.selectedStencil = null;
            S.renderStencils();
            S.persistStencils();
          });
          div.appendChild(del);
        }
        grid.appendChild(div);
      });
      if (state2.stencilCat === "custom") {
        const add = document.createElement("div");
        add.className = "stencil add";
        add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        add.title = "Upload stencil";
        add.addEventListener("click", () => S.fileInputStencil.click());
        grid.appendChild(add);
      }
    };
    S.persistStencils = function persistStencils() {
      try {
        const slim = state2.customStencils.map((s) => ({ name: s.name, dataUrl: s.dataUrl }));
        localStorage.setItem("nm-stencils", JSON.stringify(slim));
      } catch (e) {
      }
    };
    S.loadStencils = function loadStencils() {
      try {
        const raw = localStorage.getItem("nm-stencils");
        if (raw) state2.customStencils = JSON.parse(raw);
      } catch (e) {
      }
    };
    S.fileInputStencil.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          state2.customStencils.push({
            name: file.name.replace(/\.[^.]+$/, ""),
            dataUrl: ev.target.result
          });
          S.renderStencils();
          S.persistStencils();
        };
        reader.readAsDataURL(file);
      });
      e.target.value = "";
    });
    $all(".stencil-tab").forEach((t) => {
      t.addEventListener("click", () => {
        $all(".stencil-tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        state2.stencilCat = t.dataset.cat;
        state2.selectedStencil = null;
        S.renderStencils();
      });
    });
  }

  // src/engine/app/measure-stencils.ts
  function initMeasureStencils() {
    initMeasure();
    initStencils();
  }

  // src/engine/app/color.ts
  function initColor() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.hsv = { h: 0, s: 0, v: 0 };
    S.hsvToHex = function hsvToHex(h, s, v) {
      s /= 100;
      v /= 100;
      const c = v * s;
      const x = c * (1 - Math.abs(h / 60 % 2 - 1));
      const m = v - c;
      let r = 0, g = 0, b = 0;
      if (h < 60) {
        r = c;
        g = x;
      } else if (h < 120) {
        r = x;
        g = c;
      } else if (h < 180) {
        g = c;
        b = x;
      } else if (h < 240) {
        g = x;
        b = c;
      } else if (h < 300) {
        r = x;
        b = c;
      } else {
        r = c;
        b = x;
      }
      const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };
    S.hexToHsv = function hexToHsv(hex) {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      let h = 0, s = max === 0 ? 0 : d / max, v = max;
      if (d > 0) {
        if (max === r) h = ((g - b) / d + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
    };
    S.hexToRgba = function hexToRgba(hex, alpha = 255) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b, alpha];
    };
    S.hsvToHarmony = function hsvToHarmony(h, s, v) {
      return [
        S.hsvToHex(h, s, v),
        S.hsvToHex((h + 180) % 360, s, v),
        S.hsvToHex((h + 120) % 360, s, v),
        S.hsvToHex((h + 240) % 360, s, v),
        S.hsvToHex((h + 30) % 360, s, v)
      ];
    };
    S.drawHueWheel = function drawHueWheel() {
      const canvas = $el("hue-wheel");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const cx = canvas.width / 2, cy = canvas.height / 2;
      const outerR = cx - 4, innerR = outerR - 22;
      for (let a = 0; a < 360; a++) {
        const start = (a - 1) * Math.PI / 180;
        const end = (a + 1) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(cx + innerR * Math.cos(start), cy + innerR * Math.sin(start));
        ctx.arc(cx, cy, outerR, start, end);
        ctx.arc(cx, cy, innerR, end, start, true);
        ctx.closePath();
        ctx.fillStyle = `hsl(${a},100%,50%)`;
        ctx.fill();
      }
      S.drawHueMarker();
    };
    S.drawHueMarker = function drawHueMarker() {
      const canvas = $el("hue-wheel");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const cx = canvas.width / 2, cy = canvas.height / 2;
      const outerR = cx - 4, innerR = outerR - 22, midR = (outerR + innerR) / 2;
      const a = (S.hsv.h - 90) * Math.PI / 180;
      const mx = cx + midR * Math.cos(a);
      const my = cy + midR * Math.sin(a);
      ctx.beginPath();
      ctx.arc(mx, my, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    S.drawSVSquare = function drawSVSquare() {
      const canvas = $el("sv-square");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const w = canvas.width, h = canvas.height;
      const gS = ctx.createLinearGradient(0, 0, w, 0);
      gS.addColorStop(0, "#fff");
      gS.addColorStop(1, `hsl(${S.hsv.h},100%,50%)`);
      ctx.fillStyle = gS;
      ctx.fillRect(0, 0, w, h);
      const gV = ctx.createLinearGradient(0, 0, 0, h);
      gV.addColorStop(0, "rgba(0,0,0,0)");
      gV.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = gV;
      ctx.fillRect(0, 0, w, h);
      const mx = S.hsv.s / 100 * w;
      const my = (1 - S.hsv.v / 100) * h;
      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    S.syncWheelFromColor = function syncWheelFromColor(hex) {
      const h = S.hexToHsv(hex);
      S.hsv.h = h.h;
      S.hsv.s = h.s;
      S.hsv.v = h.v;
      S.drawSVSquare();
      S.drawHueWheel();
      S.updateWheelSliders();
      S.updateHarmony();
      $el("color-swatch-display").style.background = hex;
      $el("wheel-hex").value = hex.toUpperCase();
    };
    S.updateWheelSliders = function updateWheelSliders() {
      $el("sl-h").value = S.hsv.h;
      $el("sl-h-v").textContent = Math.round(S.hsv.h);
      $el("sl-s").value = S.hsv.s;
      $el("sl-s-v").textContent = Math.round(S.hsv.s);
      $el("sl-v").value = S.hsv.v;
      $el("sl-v-v").textContent = Math.round(S.hsv.v);
    };
    S.updateHarmony = function updateHarmony() {
      const row = $el("harmony-row");
      if (!row) return;
      row.innerHTML = "";
      S.hsvToHarmony(S.hsv.h, S.hsv.s, S.hsv.v).forEach((c) => {
        const sw = document.createElement("div");
        sw.className = "harmony-swatch";
        sw.style.background = c;
        sw.title = c;
        sw.addEventListener("click", () => {
          S.setColor(c);
        });
        row.appendChild(sw);
      });
    };
    S.initWheelEvents = function initWheelEvents() {
      const hueCanvas = $el("hue-wheel");
      const svCanvas = $el("sv-square");
      if (!hueCanvas || !svCanvas) return;
      function onHueDrag(e) {
        var _a, _b, _c, _d;
        e.preventDefault();
        const rect = hueCanvas.getBoundingClientRect();
        const cx = rect.width / 2, cy = rect.height / 2;
        const ex = (e.clientX || ((_b = (_a = e.touches) == null ? void 0 : _a[0]) == null ? void 0 : _b.clientX)) - rect.left - cx;
        const ey = (e.clientY || ((_d = (_c = e.touches) == null ? void 0 : _c[0]) == null ? void 0 : _d.clientY)) - rect.top - cy;
        S.hsv.h = Math.round((Math.atan2(ey, ex) * 180 / Math.PI + 90 + 360) % 360);
        S.drawHueWheel();
        S.drawSVSquare();
        const hex = S.hsvToHex(S.hsv.h, S.hsv.s, S.hsv.v);
        S.setColor(hex);
        S.updateWheelSliders();
        S.updateHarmony();
      }
      function onSVDrag(e) {
        var _a, _b, _c, _d;
        e.preventDefault();
        const rect = svCanvas.getBoundingClientRect();
        const ex = Math.max(0, Math.min(rect.width, (e.clientX || ((_b = (_a = e.touches) == null ? void 0 : _a[0]) == null ? void 0 : _b.clientX)) - rect.left));
        const ey = Math.max(0, Math.min(rect.height, (e.clientY || ((_d = (_c = e.touches) == null ? void 0 : _c[0]) == null ? void 0 : _d.clientY)) - rect.top));
        S.hsv.s = Math.round(ex / rect.width * 100);
        S.hsv.v = Math.round((1 - ey / rect.height) * 100);
        S.drawSVSquare();
        const hex = S.hsvToHex(S.hsv.h, S.hsv.s, S.hsv.v);
        S.setColor(hex);
        S.updateWheelSliders();
        S.updateHarmony();
      }
      hueCanvas.addEventListener("pointerdown", (e) => {
        hueCanvas.setPointerCapture(e.pointerId);
        onHueDrag(e);
        const move = (ev) => onHueDrag(ev);
        const up = () => {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      });
      svCanvas.addEventListener("pointerdown", (e) => {
        svCanvas.setPointerCapture(e.pointerId);
        onSVDrag(e);
        const move = (ev) => onSVDrag(ev);
        const up = () => {
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", up);
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
      });
      ["h", "s", "v"].forEach((ch) => {
        $el(`sl-${ch}`).addEventListener("input", (e) => {
          S.hsv[ch] = parseInt(e.target.value);
          $el(`sl-${ch}-v`).textContent = S.hsv[ch];
          S.drawSVSquare();
          if (ch === "h") S.drawHueWheel();
          const hex = S.hsvToHex(S.hsv.h, S.hsv.s, S.hsv.v);
          S.setColor(hex);
          S.updateHarmony();
          $el("wheel-hex").value = hex.toUpperCase();
        });
      });
      $el("wheel-hex").addEventListener("change", (e) => {
        let v = e.target.value.trim();
        if (!v.startsWith("#")) v = "#" + v;
        if (/^#[0-9a-f]{6}$/i.test(v)) {
          S.setColor(v);
        }
      });
    };
    S.renderSwatches = function renderSwatches() {
      const cont = $el("swatches");
      if (!cont) return;
      cont.innerHTML = "";
      S.SWATCHES.forEach((c) => {
        const sw = document.createElement("div");
        sw.className = "swatch" + (c.toLowerCase() === state2.color.toLowerCase() ? " active" : "");
        sw.style.background = c;
        sw.addEventListener("click", () => {
          S.setColor(c);
          S.renderSwatches();
        });
        cont.appendChild(sw);
      });
    };
    S.setColor = function setColor(c) {
      state2.color = c;
      $el("puck-color").style.background = c;
      $el("color-swatch-display").style.background = c;
      $el("wheel-hex").value = c.toUpperCase();
      S.syncWheelFromColor(c);
      S.updatePreview();
      S.renderSwatches();
    };
    $el("puck-color").addEventListener("click", (e) => {
      e.stopPropagation();
      const puckRect = $el("puck").getBoundingClientRect();
      const areaRect = S.area.getBoundingClientRect();
      S.colorPopover.style.left = Math.max(8, puckRect.left - areaRect.left - 100) + "px";
      S.colorPopover.style.top = "";
      S.colorPopover.style.bottom = "";
      const spaceBelow = areaRect.bottom - puckRect.bottom;
      const spaceAbove = puckRect.top - areaRect.top;
      if (spaceBelow >= 300 || spaceBelow >= spaceAbove) {
        S.colorPopover.style.bottom = areaRect.height - (puckRect.top - areaRect.top) + 10 + "px";
      } else {
        S.colorPopover.style.top = puckRect.bottom - areaRect.top + 10 + "px";
      }
      S.colorPopover.classList.toggle("show");
      if (S.colorPopover.classList.contains("show")) {
        S.drawHueWheel();
        S.drawSVSquare();
        S.updateHarmony();
        S.renderSwatches();
        $el("fill-tolerance-row").style.display = state2.tool === "fill" || state2.tool === "wand" || state2.tool === "lasso" ? "block" : "none";
      }
    });
    $el("eyedropper-btn").addEventListener("click", () => {
      S.colorPopover.classList.remove("show");
      state2.eyedropperActive = true;
      document.body.style.cursor = "crosshair";
      S.showHint("Tap anywhere on the canvas to pick a colour");
    });
  }

  // src/engine/app/fill.ts
  function initFill() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.flattenVisibleToCtx = function flattenVisibleToCtx(ctx) {
      ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      for (const l of state2.layers) {
        if (l.visible === false) continue;
        ctx.save();
        ctx.globalAlpha = l.opacity != null ? l.opacity : 1;
        if (l.imageCanvas && !l.imageBaked) ctx.drawImage(l.imageCanvas, 0, 0);
        ctx.drawImage(l.canvas, 0, 0);
        ctx.restore();
      }
    };
    S._thumbCanvas = null;
    S.generateThumbnailBlob = async function generateThumbnailBlob(maxW) {
      maxW = maxW != null ? maxW : 420;
      if (!state2.layers.length || S.doc.wPx <= 0 || S.doc.hPx <= 0) return null;
      const tw = Math.min(maxW, S.doc.wPx);
      const th = Math.max(1, Math.round(tw * (S.doc.hPx / S.doc.wPx)));
      if (!S._thumbCanvas) S._thumbCanvas = document.createElement("canvas");
      S._thumbCanvas.width = tw;
      S._thumbCanvas.height = th;
      const tctx = S._thumbCanvas.getContext("2d");
      tctx.fillStyle = state2.paperBg || "#ffffff";
      tctx.fillRect(0, 0, tw, th);
      const full = document.createElement("canvas");
      full.width = S.doc.wPx;
      full.height = S.doc.hPx;
      S.flattenVisibleToCtx(full.getContext("2d"));
      tctx.drawImage(full, 0, 0, tw, th);
      return new Promise((resolve) => S._thumbCanvas.toBlob(resolve, "image/jpeg", 0.84));
    };
    S.saveThumbnailLocal = async function saveThumbnailLocal(blob) {
      if (!blob) return;
      const db = await S.idb();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(S.AUTOSAVE_STORE, "readwrite");
        tx.objectStore(S.AUTOSAVE_STORE).put({ blob, savedAt: Date.now() }, "thumb-" + S.autosaveKey());
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    };
    S._thumbSyncTimer = null;
    S.syncProjectThumbnail = function syncProjectThumbnail(blob) {
      const pid = typeof window !== "undefined" ? window.__SKETCHTRUDE_PROJECT_ID : null;
      if (!pid || pid === "local" || !blob) return;
      clearTimeout(S._thumbSyncTimer);
      S._thumbSyncTimer = setTimeout(async () => {
        try {
          const fd = new FormData();
          fd.append("file", blob, "preview.jpg");
          await fetch("/api/projects/" + pid + "/thumbnail", { method: "POST", body: fd, credentials: "same-origin" });
        } catch (_) {
        }
      }, 1200);
    };
    S._projThumbTimer = null;
    S.scheduleThumbnail = function scheduleThumbnail() {
      clearTimeout(S._projThumbTimer);
      S._projThumbTimer = setTimeout(async () => {
        if (state2.drawing) {
          S.scheduleThumbnail();
          return;
        }
        try {
          const blob = await S.generateThumbnailBlob();
          if (!blob) return;
          await S.saveThumbnailLocal(blob);
          S.syncProjectThumbnail(blob);
        } catch (_) {
        }
      }, 2500);
    };
    S._sampleCanvas = null, S._sampleCtx = null;
    S.sampleData = function sampleData(sampleAll) {
      if (!S._sampleCanvas) {
        S._sampleCanvas = document.createElement("canvas");
        S._sampleCtx = S._sampleCanvas.getContext("2d", { willReadFrequently: true });
      }
      if (S._sampleCanvas.width !== S.doc.wPx || S._sampleCanvas.height !== S.doc.hPx) {
        S._sampleCanvas.width = S.doc.wPx;
        S._sampleCanvas.height = S.doc.hPx;
      }
      if (sampleAll) {
        S.flattenVisibleToCtx(S._sampleCtx);
      } else {
        const l = S.activeLayer();
        S._sampleCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
        if (l.imageCanvas && !l.imageBaked) S._sampleCtx.drawImage(l.imageCanvas, 0, 0);
        S._sampleCtx.drawImage(l.canvas, 0, 0);
      }
      return S._sampleCtx.getImageData(0, 0, S.doc.wPx, S.doc.hPx).data;
    };
    S.computeFillMask = function computeFillMask(sample, startX, startY, tolerance) {
      const w = S.doc.wPx, h = S.doc.hPx;
      startX = Math.max(0, Math.min(w - 1, Math.round(startX)));
      startY = Math.max(0, Math.min(h - 1, Math.round(startY)));
      const seed = (startY * w + startX) * 4;
      const sr = sample[seed], sg = sample[seed + 1], sb = sample[seed + 2], sa = sample[seed + 3];
      const mask = new Uint8Array(w * h);
      const match = (idx) => Math.abs(sample[idx] - sr) + Math.abs(sample[idx + 1] - sg) + Math.abs(sample[idx + 2] - sb) + Math.abs(sample[idx + 3] - sa) <= tolerance;
      const stack = [startX + startY * w];
      mask[startX + startY * w] = 1;
      while (stack.length) {
        const pos = stack.pop();
        let x = pos % w;
        const y = pos / w | 0;
        while (x > 0 && match((y * w + x - 1) * 4) && !mask[y * w + x - 1]) x--;
        let spanA = false, spanB = false;
        while (x < w && match((y * w + x) * 4)) {
          mask[y * w + x] = 1;
          if (y > 0) {
            const a = (y - 1) * w + x;
            if (!mask[a] && match(a * 4)) {
              if (!spanA) {
                stack.push(a);
                mask[a] = 1;
                spanA = true;
              }
            } else spanA = false;
          }
          if (y < h - 1) {
            const b = (y + 1) * w + x;
            if (!mask[b] && match(b * 4)) {
              if (!spanB) {
                stack.push(b);
                mask[b] = 1;
                spanB = true;
              }
            } else spanB = false;
          }
          x++;
        }
      }
      return mask;
    };
    S.expandMask = function expandMask(mask, r) {
      if (!r) return mask;
      const w = S.doc.wPx, h = S.doc.hPx;
      let cur = mask;
      for (let pass = 0; pass < r; pass++) {
        const next = new Uint8Array(cur);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (cur[i]) continue;
            if (x > 0 && cur[i - 1] || x < w - 1 && cur[i + 1] || y > 0 && cur[i - w] || y < h - 1 && cur[i + w]) next[i] = 1;
          }
        }
        cur = next;
      }
      return cur;
    };
    S.shrinkMask = function shrinkMask(mask, r) {
      if (!r) return mask;
      const w = S.doc.wPx, h = S.doc.hPx;
      let cur = mask;
      for (let pass = 0; pass < r; pass++) {
        const next = new Uint8Array(cur);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (!cur[i]) continue;
            if (x > 0 && !cur[i - 1] || x < w - 1 && !cur[i + 1] || y > 0 && !cur[i - w] || y < h - 1 && !cur[i + w]) next[i] = 0;
          }
        }
        cur = next;
      }
      return cur;
    };
    S.paintMaskColor = function paintMaskColor(ctx, mask, fillHex, fa) {
      const w = S.doc.wPx, h = S.doc.hPx;
      const [fr, fg, fb] = S.hexToRgba(fillHex);
      const target = ctx.getImageData(0, 0, w, h);
      const d = target.data;
      for (let i = 0; i < mask.length; i++) {
        if (mask[i]) {
          const o = i * 4;
          d[o] = fr;
          d[o + 1] = fg;
          d[o + 2] = fb;
          d[o + 3] = fa;
        }
      }
      ctx.putImageData(target, 0, 0);
    };
    S.paintMaskWithImage = function paintMaskWithImage(layer, mask, bbox, img, mode, scale) {
      const c = document.createElement("canvas");
      c.width = bbox.w;
      c.height = bbox.h;
      const cx = c.getContext("2d", { willReadFrequently: true });
      if (mode === "stretch") {
        cx.drawImage(img, 0, 0, bbox.w, bbox.h);
      } else {
        const s = scale || 1;
        const tw = Math.max(1, Math.round((img.naturalWidth || img.width) * s));
        const th = Math.max(1, Math.round((img.naturalHeight || img.height) * s));
        let tile = img;
        if (tw !== (img.naturalWidth || img.width) || th !== (img.naturalHeight || img.height)) {
          const tc = document.createElement("canvas");
          tc.width = tw;
          tc.height = th;
          tc.getContext("2d").drawImage(img, 0, 0, tw, th);
          tile = tc;
        }
        const pat = cx.createPattern(tile, "repeat");
        cx.fillStyle = pat;
        cx.fillRect(0, 0, bbox.w, bbox.h);
      }
      const id = cx.getImageData(0, 0, bbox.w, bbox.h);
      const d = id.data, W = S.doc.wPx;
      for (let y = 0; y < bbox.h; y++) {
        for (let x = 0; x < bbox.w; x++) {
          if (!mask[(bbox.y + y) * W + (bbox.x + x)]) d[(y * bbox.w + x) * 4 + 3] = 0;
        }
      }
      cx.putImageData(id, 0, 0);
      layer.ctx.save();
      layer.ctx.globalAlpha = state2.alpha;
      layer.ctx.drawImage(c, bbox.x, bbox.y);
      layer.ctx.restore();
    };
    S.currentFillTexture = function currentFillTexture() {
      if (state2.fillTexIndex == null) return null;
      const t = state2.fillTextures[state2.fillTexIndex];
      return t && t.img && t.img.complete ? t.img : null;
    };
    S.applyFill = function applyFill(layer, mask) {
      if (state2.fillStyle === "image" && S.currentFillTexture()) {
        const bbox = S.computeMaskBBox(mask);
        if (bbox) S.paintMaskWithImage(layer, mask, bbox, S.currentFillTexture(), state2.fillTexMode, state2.fillTexScale);
      } else {
        S.paintMaskColor(layer.ctx, mask, state2.color, Math.round(state2.alpha * 255));
      }
    };
    S.floodFill = function floodFill(ctx, startX, startY, fillHex, tolerance, sampleAll, expand) {
      const sample = S.sampleData(sampleAll);
      let mask = S.computeFillMask(sample, startX, startY, tolerance);
      if (expand) mask = S.expandMask(mask, expand);
      S.paintMaskColor(ctx, mask, fillHex, Math.round(state2.alpha * 255));
    };
    $el("fill-tolerance").addEventListener("input", (e) => {
      $el("fill-tol-v").textContent = e.target.value;
    });
    $el("fill-expand").addEventListener("input", (e) => {
      $el("fill-expand-v").textContent = e.target.value;
    });
    S.fileInputFillTex = document.createElement("input");
    S.fileInputFillTex.type = "file";
    S.fileInputFillTex.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
    S.fileInputFillTex.multiple = true;
    S.fileInputFillTex.style.display = "none";
    document.body.appendChild(S.fileInputFillTex);
    S.fileInputFillTex.addEventListener("change", (e) => {
      Array.from(e.target.files).forEach(S.addFillTexture);
      e.target.value = "";
    });
    S.addFillTexture = function addFillTexture(file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const name = file.name.replace(/\.[^.]+$/, "") || "Texture";
          state2.fillTextures.push({ name, dataUrl: ev.target.result, img });
          state2.fillTexIndex = state2.fillTextures.length - 1;
          state2.fillStyle = "image";
          S.syncFillStyleUI();
          S.renderTexStrip();
          S.persistFillTextures();
          S.showHint("Texture added: " + name);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    S.renderTexStrip = function renderTexStrip() {
      const strip = $el("fill-tex-strip");
      if (!strip) return;
      strip.innerHTML = "";
      state2.fillTextures.forEach((t, i) => {
        const d = document.createElement("div");
        d.className = "tex-thumb" + (i === state2.fillTexIndex ? " active" : "");
        d.style.backgroundImage = `url(${t.dataUrl})`;
        d.title = t.name;
        d.addEventListener("click", () => {
          state2.fillTexIndex = i;
          S.renderTexStrip();
        });
        const del = document.createElement("button");
        del.className = "del";
        del.textContent = "\xD7";
        del.addEventListener("click", (ev) => {
          ev.stopPropagation();
          state2.fillTextures.splice(i, 1);
          if (state2.fillTexIndex === i) state2.fillTexIndex = null;
          else if (state2.fillTexIndex > i) state2.fillTexIndex--;
          S.renderTexStrip();
          S.persistFillTextures();
        });
        d.appendChild(del);
        strip.appendChild(d);
      });
    };
    S.syncFillStyleUI = function syncFillStyleUI() {
      $all("[data-fillstyle]").forEach((b) => b.classList.toggle("active", b.dataset.fillstyle === state2.fillStyle));
      const opts = $el("fill-image-opts");
      if (opts) opts.style.display = state2.fillStyle === "image" ? "block" : "none";
    };
    $all("[data-fillstyle]").forEach((b) => b.addEventListener("click", () => {
      state2.fillStyle = b.dataset.fillstyle;
      S.syncFillStyleUI();
    }));
    $all("[data-texmode]").forEach((b) => b.addEventListener("click", () => {
      state2.fillTexMode = b.dataset.texmode;
      $all("[data-texmode]").forEach((x) => x.classList.toggle("active", x === b));
      $el("fill-tex-scale-row").style.display = state2.fillTexMode === "tile" ? "flex" : "none";
    }));
    $el("fill-tex-scale").addEventListener("input", (e) => {
      state2.fillTexScale = parseFloat(e.target.value);
      $el("fill-tex-scale-v").textContent = state2.fillTexScale.toFixed(1) + "\xD7";
    });
    $el("fill-tex-import").addEventListener("click", () => S.fileInputFillTex.click());
    S.persistFillTextures = function persistFillTextures() {
      try {
        localStorage.setItem("nm-fill-textures", JSON.stringify(state2.fillTextures.map((t) => ({ name: t.name, dataUrl: t.dataUrl }))));
      } catch (e) {
      }
    };
    S.loadFillTextures = function loadFillTextures() {
      try {
        const raw = localStorage.getItem("nm-fill-textures");
        if (!raw) return;
        JSON.parse(raw).forEach((rec) => {
          const img = new Image();
          img.onload = () => {
            state2.fillTextures.push({ name: rec.name, dataUrl: rec.dataUrl, img });
            S.renderTexStrip();
          };
          img.src = rec.dataUrl;
        });
      } catch (e) {
      }
    };
  }

  // src/engine/app/tool-ui.ts
  function initToolUi() {
    var _a;
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.setTool = function setTool(tool) {
      var _a2;
      if (typeof S.hideShapeChip === "function") S.hideShapeChip();
      if (S.massing.active && tool !== "massing") {
        S.massing.active = false;
        S.massingCanvas.style.display = "none";
        S.massingBar.style.display = "none";
        S.massing.dragging = null;
        S.massing.selected = -1;
        $el("mass-inspector").style.display = "none";
        S.massHint("");
        if (typeof S.updateMatPalette === "function") S.updateMatPalette();
        if (typeof S.updateBuildPalette === "function") S.updateBuildPalette();
      }
      state2.tool = tool;
      $all(".tool").forEach((t) => t.classList.toggle("active", t.dataset.tool === S.brushFamilyOf(tool)));
      S.colorPopover.classList.remove("show");
      S.stencilPopover.classList.remove("show");
      if (tool === "brushes") {
        $all(".tool").forEach((t) => t.classList.remove("active"));
        (_a2 = $el("rail-brushes")) == null ? void 0 : _a2.classList.add("active");
        S.openBrushLibrary();
        return;
      }
      {
        const bb = S.BUILTIN_BRUSHES.find((x) => x.id === tool);
        if (bb) S.setActiveBrush(bb);
      }
      if (tool === "massing") {
        S.enterMassing();
        return;
      }
      if (tool === "stencil") {
        S.showStencilPopover();
      }
      if (tool === "hand") {
        S.showHint("Hand tool \u2014 drag to pan, scroll to zoom");
      }
      if (tool === "fill") {
        document.body.classList.add("fill-mode");
        S.showHint("Flood Fill \u2014 tap inside a closed shape to fill. Open colour picker to set tolerance.");
      } else {
        document.body.classList.remove("fill-mode");
      }
      if (tool === "wand") {
        S.showHint("Magic Wand \u2014 tap a region to select. Tolerance is in the colour/fill panel.");
      } else if (tool === "lasso") {
        S.showHint("Lasso \u2014 drag to trace a region. Shows its area; Copy / Cut / Delete / Fill the selection.");
      } else {
        if (state2.floating || state2.selection) {
          S.commitFloating();
          S.clearSelection();
        }
      }
      if (tool === "area") {
        S.startPolyTool();
        S.showHint("Area tool \u2014 click to place vertices \xB7 Double-click near start to close \xB7 Esc to cancel");
      } else if (tool === "wall") {
        if (state2.wallsVisible === false) S.setWallsVisible(true);
        S.startPolyTool();
        S.showHint("Wall \u2014 tap a centreline \xB7 double-tap to finish \xB7 tap the first point to close a room \xB7 snapping on");
      } else if (tool === "opening") {
        if (state2.polyActive) {
          state2.polyPoints = [];
          state2.polyActive = false;
          $el("poly-hint").style.display = "none";
        }
        S.showHint("Door / Window \u2014 tap a wall to place \xB7 drag to slide \xB7 flip & resize in the bar");
      } else if (tool === "select") {
        if (state2.polyActive) {
          state2.polyPoints = [];
          state2.polyActive = false;
          $el("poly-hint").style.display = "none";
        }
        S.showHint("Select \u2014 tap a wall, door, window, or room to edit it \xB7 Delete to remove");
      } else if (tool === "offset") {
        if (state2.polyActive) {
          state2.polyPoints = [];
          state2.polyActive = false;
          $el("poly-hint").style.display = "none";
        }
        S.showHint("Offset \u2014 tap a room, then set the distance and tap Apply");
      } else if (tool === "line") {
        S.startPolyTool();
        S.showHint("Polygon \u2014 tap to place vertices \xB7 tap the first point or double-tap to close \xB7 2 points = a line \xB7 Esc to cancel");
      } else if (state2.polyActive) {
        state2.polyPoints = [];
        state2.polyActive = false;
        $el("poly-hint").style.display = "none";
        S.refreshMeasurements();
      }
      S.showWall2dPalette(tool === "wall");
      S.showOpeningPalette(tool === "opening");
      if (tool !== "opening") {
        state2.selOpening2D = null;
      } else S.updateOpeningPalette();
      const _hadSel = !!state2.sel;
      state2.sel = null;
      S.syncSelectionManagerFromLegacy("programmatic");
      if (typeof S.showSelectBar === "function") S.showSelectBar(null);
      if (tool !== "offset" && state2.offset) {
        state2.offset = null;
        if (typeof S.showOffsetBar === "function") S.showOffsetBar(false);
      }
      if (_hadSel && typeof S.refreshMeasurements === "function") S.refreshMeasurements();
      S.highlightRailGroups();
      S.updatePreview();
      S.updateLayerOrder();
    };
    S.setActiveBrush = function setActiveBrush(brush) {
      state2.activeBrush = brush;
      state2.size = brush.size;
      state2.alpha = brush.opacity;
      if (typeof brush.smoothing === "number") {
        state2.stabilizer = Math.max(state2.stabilizer || 0, brush.smoothing * 0.6);
      }
      if (S.brushLibraryEngine) S.brushLibraryEngine.markRecent(brush.id);
      const maxSize = brush.maxSize || Math.max(40, brush.size * 3);
      $el("puck-name").textContent = (brush.name || "BRUSH").toUpperCase();
      const sizeSlider = $el("puck-size-slider");
      sizeSlider.max = maxSize;
      sizeSlider.value = brush.size;
      $el("puck-size-val").textContent = brush.size;
      $el("puck-alpha-slider").value = Math.round(brush.opacity * 100);
      $el("puck-alpha-val").textContent = Math.round(brush.opacity * 100);
      $all(".tool").forEach((t) => t.classList.remove("active"));
      state2.tool = brush.builtIn !== false ? brush.id : "pen";
      if (brush.id === "tech-revision") state2.color = "#a02835";
      if (typeof S.highlightRailGroups === "function") S.highlightRailGroups();
      S.updatePreview();
    };
    S._lastToolTap = { tool: null, time: 0 };
    $all(".tool").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tool = btn.dataset.tool;
        const now = Date.now();
        const wasActive = state2.tool === tool || tool === "brushes";
        const isDoubleTap = S._lastToolTap.tool === tool && now - S._lastToolTap.time < 400;
        S._lastToolTap = { tool, time: now };
        if (tool === "brushes") {
          S.setTool("brushes");
          return;
        }
        if (S.BRUSH_FAMILIES[tool]) {
          const fam = tool;
          const wasFamActive = S.BRUSH_FAMILIES[fam].includes(state2.tool);
          state2.brushLast = state2.brushLast || {};
          const last = state2.brushLast[fam] || fam;
          S.setTool(last);
          if (wasFamActive || isDoubleTap) S.openBrushFlyout(fam, btn);
          return;
        }
        S.setTool(tool);
        if (wasActive || isDoubleTap) {
          S.openToolSettings(tool);
        }
      });
    });
    S.TOOL_GROUPS = [
      { id: "draw", label: "Draw", tools: ["pen", "marker", "pencil", "brush", "watercolour", "eraser", "brushes"] },
      { id: "shapes", label: "Shapes", tools: ["line", "rect", "circle"] },
      { id: "fillstamp", label: "Fill / Stamp", tools: ["fill", "stencil"] },
      { id: "region", label: "Region", tools: ["wand", "lasso"] },
      { id: "measure", label: "Measure / Area", tools: ["ruler", "area"] },
      { id: "build", label: "Build", tools: ["wall", "opening"] }
    ];
    S._railMeta = {};
    S._groupOf = function _groupOf(toolId) {
      return S.TOOL_GROUPS.find((g) => g.tools.includes(toolId));
    };
    S.activateRailTool = function activateRailTool(t) {
      if (t === "brushes") S.openBrushLibrary();
      else S.setTool(t);
    };
    S.regroupRail = function regroupRail() {
      const rail = $qs(".rail");
      if (!rail || rail.dataset.grouped) return;
      rail.querySelectorAll(".tool").forEach((b) => {
        var _a2;
        const t = b.dataset.tool;
        if (!t) return;
        const svg = b.querySelector("svg");
        const lbl = (((_a2 = b.querySelector(".label")) == null ? void 0 : _a2.textContent) || t).replace(/\s·.*$/, "");
        S._railMeta[t] = { svg: svg ? svg.outerHTML : "", label: lbl };
      });
      if (!$el("grp-flyout-style")) {
        const st = document.createElement("style");
        st.id = "grp-flyout-style";
        st.textContent = "#grp-flyout{position:fixed;z-index:1400;display:flex;flex-direction:column;gap:3px;background:#1c1a18;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:6px;box-shadow:0 12px 34px rgba(0,0,0,0.5);min-width:172px;}#grp-flyout .gfi{display:flex;align-items:center;gap:11px;font:600 12px ui-sans-serif,system-ui;color:#e8e4de;padding:9px 12px;border-radius:8px;cursor:pointer;background:transparent;border:none;text-align:left;width:100%;}#grp-flyout .gfi:hover{background:#2b2826;}#grp-flyout .gfi.on{background:#a02835;color:#fff;}#grp-flyout .gfi svg{width:18px;height:18px;flex:0 0 18px;}";
        document.head.appendChild(st);
      }
      state2.groupLast = {};
      S.TOOL_GROUPS.forEach((g) => state2.groupLast[g.id] = g.tools[0]);
      rail.innerHTML = "";
      rail.dataset.grouped = "1";
      const mkBtn = (iconTool, labelTxt) => {
        var _a2;
        const b = document.createElement("button");
        b.className = "tool";
        b.title = labelTxt;
        b.innerHTML = `${((_a2 = S._railMeta[iconTool]) == null ? void 0 : _a2.svg) || ""}<span class="label">${labelTxt}</span>`;
        rail.appendChild(b);
        return b;
      };
      const selBtn = document.createElement("button");
      selBtn.className = "tool";
      selBtn.dataset.tool = "select";
      selBtn.title = "Select";
      selBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3l6.5 17 2.4-7.1L20 10.5 4 3z"/></svg><span class="label">Select</span>';
      selBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        S.setTool("select");
      });
      rail.appendChild(selBtn);
      const offBtn = document.createElement("button");
      offBtn.className = "tool";
      offBtn.dataset.tool = "offset";
      offBtn.title = "Offset";
      offBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7.5" y="7.5" width="9" height="9" rx="1"/></svg><span class="label">Offset</span>';
      offBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        S.setTool("offset");
      });
      rail.appendChild(offBtn);
      const topDiv = document.createElement("div");
      topDiv.className = "rail-divider";
      rail.appendChild(topDiv);
      S.TOOL_GROUPS.forEach((g) => {
        const btn = mkBtn(g.tools[0], g.label);
        btn.dataset.group = g.id;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const active = g.tools.includes(state2.tool) || g.tools.includes(S.brushFamilyOf(state2.tool));
          if (active && g.tools.length > 1) {
            S.openGroupFlyout(g, btn);
            return;
          }
          S.activateRailTool(state2.groupLast[g.id] || g.tools[0]);
        });
        let lp;
        btn.addEventListener("pointerdown", () => {
          lp = setTimeout(() => S.openGroupFlyout(g, btn), 450);
        });
        ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, () => clearTimeout(lp)));
      });
      const div = document.createElement("div");
      div.className = "rail-divider";
      rail.appendChild(div);
      const b3d = mkBtn("massing", "3D");
      b3d.dataset.tool = "massing";
      b3d.addEventListener("click", (e) => {
        e.stopPropagation();
        S.setTool("massing");
      });
      rail.appendChild(b3d);
      const bpan = mkBtn("hand", "Pan");
      bpan.dataset.tool = "hand";
      bpan.addEventListener("click", (e) => {
        e.stopPropagation();
        S.setTool("hand");
      });
      rail.appendChild(bpan);
      S.highlightRailGroups();
    };
    S.updateGroupIcon = function updateGroupIcon(g) {
      var _a2;
      const btn = $qs(`.rail .tool[data-group="${g.id}"]`);
      if (!btn) return;
      const t = state2.groupLast[g.id] || g.tools[0];
      const lbl = btn.querySelector(".label");
      btn.innerHTML = `${((_a2 = S._railMeta[t]) == null ? void 0 : _a2.svg) || ""}`;
      if (lbl) btn.appendChild(lbl);
    };
    S._grpFlyout = null;
    S.closeGroupFlyout = function closeGroupFlyout() {
      if (S._grpFlyout) {
        S._grpFlyout.remove();
        S._grpFlyout = null;
      }
    };
    S.openGroupFlyout = function openGroupFlyout(g, btn) {
      S.closeGroupFlyout();
      const fly = document.createElement("div");
      fly.id = "grp-flyout";
      g.tools.forEach((t) => {
        var _a2, _b;
        const it = document.createElement("button");
        it.className = "gfi";
        it.innerHTML = `${((_a2 = S._railMeta[t]) == null ? void 0 : _a2.svg) || ""}<span>${((_b = S._railMeta[t]) == null ? void 0 : _b.label) || t}</span>`;
        if (t === state2.tool) it.classList.add("on");
        it.addEventListener("click", (e) => {
          e.stopPropagation();
          if (t === "brushes") {
            S.openBrushLibrary();
          } else {
            state2.groupLast[g.id] = t;
            S.setTool(t);
            S.updateGroupIcon(g);
          }
          S.closeGroupFlyout();
        });
        fly.appendChild(it);
      });
      document.body.appendChild(fly);
      const r = btn.getBoundingClientRect();
      fly.style.left = r.right + 8 + "px";
      fly.style.top = Math.max(8, Math.min(r.top, window.innerHeight - fly.offsetHeight - 8)) + "px";
      S._grpFlyout = fly;
      setTimeout(() => document.addEventListener("click", S.closeGroupFlyout, { once: true }), 0);
    };
    S.highlightRailGroups = function highlightRailGroups() {
      const rail = $qs(".rail");
      if (!rail || !rail.dataset.grouped) return;
      const activeTool = S.massing.active ? "massing" : state2.tool;
      const inGroup = (g, t) => g.tools.includes(t) || g.tools.includes(S.brushFamilyOf(t));
      rail.querySelectorAll(".tool[data-group]").forEach((b) => {
        const g = S.TOOL_GROUPS.find((x) => x.id === b.dataset.group);
        b.classList.toggle("active", !!g && !S.massing.active && inGroup(g, activeTool));
      });
      rail.querySelectorAll(".tool[data-tool]").forEach((b) => b.classList.toggle("active", b.dataset.tool === activeTool));
      S.TOOL_GROUPS.forEach((g) => {
        if (state2.groupLast && g.tools.includes(state2.tool)) {
          state2.groupLast[g.id] = state2.tool;
          S.updateGroupIcon(g);
        }
      });
    };
    S._brushFlyout = null;
    S.ensureBrushFlyout = function ensureBrushFlyout() {
      if (S._brushFlyout) return S._brushFlyout;
      const style = document.createElement("style");
      style.textContent = "#brush-flyout{position:fixed;z-index:1300;display:none;flex-direction:column;gap:3px;background:#1c1a18;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:6px;box-shadow:0 12px 34px rgba(0,0,0,0.5);min-width:170px;}#brush-flyout .bfi{display:flex;align-items:center;gap:11px;font:600 12px ui-sans-serif,system-ui;color:#e8e4de;padding:9px 12px;border-radius:8px;cursor:pointer;background:transparent;border:none;text-align:left;width:100%;}#brush-flyout .bfi:hover{background:#2b2826;}#brush-flyout .bfi.on{background:#a02835;color:#fff;}#brush-flyout .bfi .sw{width:26px;border-radius:3px;background:currentColor;opacity:0.9;flex-shrink:0;}";
      document.head.appendChild(style);
      const el = document.createElement("div");
      el.id = "brush-flyout";
      el.addEventListener("pointerdown", (e) => e.stopPropagation());
      document.body.appendChild(el);
      S._brushFlyout = el;
      document.addEventListener("pointerdown", () => {
        if (S._brushFlyout) S._brushFlyout.style.display = "none";
      });
      return el;
    };
    S.openBrushFlyout = function openBrushFlyout(fam, anchorBtn) {
      const el = S.ensureBrushFlyout();
      el.innerHTML = "";
      (S.BRUSH_FAMILIES[fam] || []).forEach((id) => {
        const b = S.BUILTIN_BRUSHES.find((x) => x.id === id);
        if (!b) return;
        const item = document.createElement("button");
        item.className = "bfi" + (state2.tool === id ? " on" : "");
        const sw = document.createElement("span");
        sw.className = "sw";
        sw.style.height = Math.max(2, Math.min(8, b.size)) + "px";
        const nm = document.createElement("span");
        nm.textContent = b.name;
        item.append(sw, nm);
        item.onclick = (ev) => {
          ev.stopPropagation();
          state2.brushLast = state2.brushLast || {};
          state2.brushLast[fam] = id;
          S.setTool(id);
          el.style.display = "none";
        };
        el.appendChild(item);
      });
      const r = anchorBtn.getBoundingClientRect();
      el.style.display = "flex";
      const fr = el.getBoundingClientRect();
      let top = r.top;
      if (top + fr.height > window.innerHeight - 8) top = window.innerHeight - 8 - fr.height;
      el.style.left = r.right + 8 + "px";
      el.style.top = Math.max(8, top) + "px";
    };
    S.openToolSettings = function openToolSettings(tool) {
      if (S.isDrawTool(tool)) {
        S.openBrushLibrary();
      } else if (tool === "stencil") {
        S.showStencilPopover();
      } else if (tool === "fill" || tool === "wand" || tool === "lasso") {
        $el("puck-color").click();
      }
    };
    S.showStencilPopover = function showStencilPopover() {
      const puckRect = $el("puck").getBoundingClientRect();
      const areaRect = S.area.getBoundingClientRect();
      S.stencilPopover.style.left = "24px";
      S.stencilPopover.style.bottom = "80px";
      S.stencilPopover.style.right = "";
      S.stencilPopover.style.top = "";
      S.stencilPopover.classList.add("show");
      S.renderStencils();
    };
    S.brushLibrary = $el("brush-library");
    S.brushModal = $el("brush-modal");
    S.openBrushLibrary = function openBrushLibrary() {
      const puckRect = $el("puck").getBoundingClientRect();
      const areaRect = S.area.getBoundingClientRect();
      const desiredLeft = puckRect.left + puckRect.width / 2 - 170 - areaRect.left;
      S.brushLibrary.style.left = Math.max(20, Math.min(areaRect.width - 360, desiredLeft)) + "px";
      S.brushLibrary.style.bottom = areaRect.height - (puckRect.top - areaRect.top) + 10 + "px";
      S.brushLibrary.style.display = "block";
      S.brushLibrary.classList.add("show");
      S.renderBrushList();
    };
    S.closeBrushLibrary = function closeBrushLibrary() {
      var _a2;
      S.brushLibrary.style.display = "none";
      S.brushLibrary.classList.remove("show");
      (_a2 = $el("rail-brushes")) == null ? void 0 : _a2.classList.remove("active");
      const cur = S.activeBrush();
      if (cur && cur.builtIn) {
        const btn = $qs(`.tool[data-tool="${cur.id}"]`);
        if (btn) btn.classList.add("active");
      }
    };
    $el("brush-lib-close").addEventListener("click", S.closeBrushLibrary);
    (_a = $el("rail-brushes")) == null ? void 0 : _a.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    document.addEventListener("click", (e) => {
      if (S.brushLibrary.classList.contains("show") && !e.target.closest("#brush-library") && !e.target.closest("#rail-brushes") && !e.target.closest("#puck-name")) {
        S.closeBrushLibrary();
      }
    });
    S.renderBrushList = function renderBrushList() {
      const list = $el("brush-list");
      list.innerHTML = "";
      if (!list.dataset.controlsBound) {
        list.dataset.controlsBound = "1";
      }
      const head = document.createElement("div");
      head.className = "brush-lib-filters";
      head.style.cssText = "display:flex;flex-direction:column;gap:6px;padding:0 0 8px;";
      const search = document.createElement("input");
      search.type = "search";
      search.placeholder = "Search brushes\u2026";
      search.value = state2._brushSearch || "";
      search.style.cssText = "width:100%;border:1px solid var(--line-2);border-radius:8px;padding:7px 10px;font:12px inherit;background:var(--paper);color:var(--ink);";
      search.addEventListener("input", () => {
        state2._brushSearch = search.value;
        S.renderBrushList();
      });
      head.appendChild(search);
      const cats = document.createElement("div");
      cats.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;";
      const activeCat = state2._brushCategory || "all";
      const labels = S.brushes && S.brushes.getCategoryLabels ? S.brushes.getCategoryLabels() : {};
      const catIds = S.brushLibraryEngine ? ["all", "recent", ...S.brushLibraryEngine.categories()] : ["all", "technical", "pencil", "ink", "marker", "paint", "watercolor", "eraser"];
      catIds.forEach((cat) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.textContent = cat === "all" ? "All" : cat === "recent" ? "Recent" : labels[cat] || cat;
        chip.style.cssText = "border:1px solid var(--line-2);background:" + (activeCat === cat ? "var(--brand)" : "transparent") + ";color:" + (activeCat === cat ? "#fff" : "var(--ink)") + ";border-radius:999px;padding:3px 8px;font:600 10px inherit;cursor:pointer;";
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          state2._brushCategory = cat;
          S.renderBrushList();
        });
        cats.appendChild(chip);
      });
      head.appendChild(cats);
      list.appendChild(head);
      let brushes = S.BUILTIN_BRUSHES.slice();
      if (S.brushLibraryEngine) {
        brushes = S.brushLibraryEngine.all().filter((b) => b.builtIn !== false || !b.builtIn);
        brushes = S.brushLibraryEngine.all().filter((b) => b.source === "built-in" || b.builtIn);
      }
      if (state2._brushSearch) {
        const q = state2._brushSearch.toLowerCase();
        brushes = brushes.filter((b) => b.name.toLowerCase().includes(q) || (b.category || "").includes(q));
      }
      if (activeCat === "recent" && S.brushLibraryEngine) {
        brushes = S.brushLibraryEngine.getRecent();
      } else if (activeCat !== "all") {
        brushes = brushes.filter((b) => b.category === activeCat);
      }
      const grouped = {};
      brushes.forEach((b) => {
        const c = b.category || "technical";
        if (!grouped[c]) grouped[c] = [];
        grouped[c].push(b);
      });
      Object.keys(grouped).forEach((cat) => {
        const builtinLabel = document.createElement("div");
        builtinLabel.className = "brush-group-label";
        builtinLabel.textContent = labels[cat] || cat;
        list.appendChild(builtinLabel);
        grouped[cat].forEach((b) => list.appendChild(S.renderBrushCard(b)));
      });
      const customLabel = document.createElement("div");
      customLabel.className = "brush-group-label";
      customLabel.textContent = `My Brushes${state2.customBrushes.length ? " \xB7 " + state2.customBrushes.length : ""}`;
      list.appendChild(customLabel);
      if (state2.customBrushes.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText = "padding:12px;font-size:11px;color:var(--muted);text-align:center;";
        empty.textContent = "No custom brushes yet. Create one below.";
        list.appendChild(empty);
      } else {
        state2.customBrushes.forEach((b, i) => list.appendChild(S.renderBrushCard(b, i)));
      }
    };
    S.renderBrushCard = function renderBrushCard(brush, customIndex) {
      const div = document.createElement("div");
      div.className = "brush-card" + (state2.activeBrush && state2.activeBrush.id === brush.id ? " active" : "");
      const previewWrap = document.createElement("div");
      previewWrap.className = "brush-card-preview";
      const cv = document.createElement("canvas");
      cv.width = 140;
      cv.height = 56;
      cv.style.cssText = "width:100%;height:100%;";
      previewWrap.appendChild(cv);
      div.appendChild(previewWrap);
      const info = document.createElement("div");
      info.className = "brush-card-info";
      const name = document.createElement("div");
      name.className = "brush-card-name";
      name.textContent = brush.name;
      const meta = document.createElement("div");
      meta.className = "brush-card-meta";
      meta.textContent = `${(brush.tipType || brush.engineType || "brush").toString().toUpperCase()} \xB7 ${brush.size}px \xB7 ${Math.round((brush.opacity || 1) * 100)}%`;
      info.appendChild(name);
      info.appendChild(meta);
      div.appendChild(info);
      const acts = document.createElement("div");
      acts.className = "brush-card-actions";
      if (!brush.builtIn) {
        const editBtn = document.createElement("button");
        editBtn.className = "brush-card-act";
        editBtn.title = "Edit";
        editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>';
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          S.openBrushEditor(brush, customIndex);
        });
        acts.appendChild(editBtn);
        const dupBtn = document.createElement("button");
        dupBtn.className = "brush-card-act";
        dupBtn.title = "Duplicate";
        dupBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        dupBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const dup = JSON.parse(JSON.stringify(brush));
          dup.id = "b" + Date.now();
          dup.name = brush.name + " Copy";
          state2.customBrushes.push(dup);
          S.persistBrushes();
          S.renderBrushList();
        });
        acts.appendChild(dupBtn);
        const delBtn = document.createElement("button");
        delBtn.className = "brush-card-act";
        delBtn.title = "Delete";
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>';
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm(`Delete "${brush.name}"?`)) {
            state2.customBrushes.splice(customIndex, 1);
            S.persistBrushes();
            S.renderBrushList();
          }
        });
        acts.appendChild(delBtn);
      }
      div.appendChild(acts);
      div.addEventListener("click", () => {
        S.setActiveBrush(brush);
        S.renderBrushList();
        S.closeBrushLibrary();
        S.showHint(`Brush: ${brush.name}`);
      });
      setTimeout(() => S.drawBrushPreview(cv, brush), 0);
      return div;
    };
    S.drawBrushPreview = function drawBrushPreview(canvas, brush) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const points = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = 8 + t * (canvas.width - 16);
        const y = canvas.height / 2 + Math.sin(t * Math.PI * 2.5) * 14;
        points.push({ x, y, pressure: 0.25 + Math.sin(t * Math.PI) * 0.7 });
      }
      if (brush.tipType === "texture" && brush.tipImage) {
        const img = S.getTipImage(brush.tipImage);
        if (!img) {
          setTimeout(() => S.drawBrushPreview(canvas, brush), 100);
          return;
        }
        const previewBrush = { ...brush, size: Math.min(brush.size, 22) };
        const savedColor = state2.color;
        state2.color = "#0a0a0a";
        let last = points[0];
        let accum = 0;
        for (let i = 1; i < points.length; i++) {
          const p = points[i];
          const dx = p.x - last.x, dy = p.y - last.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const effSize = Math.max(2, previewBrush.size * (1 - previewBrush.pressureSize + previewBrush.pressureSize * p.pressure));
          const step = Math.max(0.5, previewBrush.spacing * effSize);
          accum += d;
          while (accum >= step) {
            const overshoot = accum - step;
            const t2 = (d - overshoot) / d;
            const sx = last.x + dx * t2;
            const sy = last.y + dy * t2;
            S.stampTexture(ctx, previewBrush, sx, sy, p.pressure);
            last = { x: sx, y: sy, pressure: p.pressure };
            accum = overshoot;
          }
          last = p;
        }
        state2.color = savedColor;
      } else {
        const previewBrush = { ...brush, size: Math.min(brush.size, 22) };
        const savedColor = state2.color;
        const savedSize = state2.size;
        const savedAlpha = state2.alpha;
        state2.color = "#0a0a0a";
        state2.size = previewBrush.size;
        state2.alpha = previewBrush.opacity;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < points.length; i++) {
          const p = points[i], q = points[i - 1];
          S.configurePen(ctx, p.pressure, previewBrush);
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        state2.color = savedColor;
        state2.size = savedSize;
        state2.alpha = savedAlpha;
      }
    };
    $el("brush-new-btn").addEventListener("click", () => S.openBrushEditor());
    $el("brush-import-btn").addEventListener("click", () => $el("brush-import-file").click());
    $el("brush-import-file").addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      e.target.value = "";
      let imported = 0;
      for (const file of files) {
        const lower = file.name.toLowerCase();
        try {
          if (lower.endsWith(".abr")) {
            imported += await S.importABR(file);
          } else if (lower.endsWith(".brushset") || lower.endsWith(".brush") || lower.endsWith(".skbrush") || lower.endsWith(".zip")) {
            imported += await S.importBrushArchive(file);
          } else {
            const dataUrl = await S.fileToDataURL(file);
            S.addImportedTipBrush(file.name.replace(/\.[^.]+$/, ""), dataUrl);
            imported++;
          }
        } catch (err) {
          console.warn("Brush import failed for", file.name, err);
        }
      }
      S.persistBrushes();
      S.renderBrushList();
      S.showHint(imported ? `Imported ${imported} brush${imported > 1 ? "es" : ""}` : "No brushes could be read from that file");
    });
    S.fileToDataURL = function fileToDataURL(file) {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    };
    S.addImportedTipBrush = function addImportedTipBrush(name, dataUrl) {
      const brush = {
        id: "imp" + Date.now() + Math.random().toString(36).slice(2, 6),
        name: name.slice(0, 40) || "Imported",
        tipType: "texture",
        tipImage: dataUrl,
        size: 28,
        opacity: 1,
        spacing: 0.08,
        hardness: 0.7,
        pressureSize: 0.6,
        pressureOpacity: 0.2,
        jitter: 0,
        blend: "source-over",
        kind: "draw",
        builtIn: false
      };
      state2.customBrushes.push(brush);
    };
    S.tipPixelsToDataURL = function tipPixelsToDataURL(width, height, getAlpha) {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(width, height);
      for (let i = 0; i < width * height; i++) {
        const a = getAlpha(i);
        img.data[i * 4] = 0;
        img.data[i * 4 + 1] = 0;
        img.data[i * 4 + 2] = 0;
        img.data[i * 4 + 3] = a;
      }
      ctx.putImageData(img, 0, 0);
      return c.toDataURL("image/png");
    };
    S.importABR = async function importABR(file) {
      const buf = await file.arrayBuffer();
      const dv = new DataView(buf);
      let count = 0;
      const version = dv.getUint16(0, false);
      function readBitmapTip(pos) {
        return null;
      }
      if (version === 6 || version === 7 || version === 10) {
        let matchAt2 = function(o, s) {
          for (let i = 0; i < s.length; i++) if (dv.getUint8(o + i) !== s.charCodeAt(i)) return false;
          return true;
        };
        var matchAt = matchAt2;
        let p = 0;
        const sig = "8BIM", tag = "samp";
        while (p < buf.byteLength - 8) {
          if (matchAt2(p, sig) && matchAt2(p + 4, tag)) {
            const len = dv.getUint32(p + 8, false);
            let q = p + 12;
            const end = q + len;
            while (q < end - 4) {
              const blockLen = dv.getUint32(q, false);
              q += 4;
              const blockStart = q;
              q += 37;
              if (q + 24 > end) break;
              const top = dv.getInt32(q, false), left = dv.getInt32(q + 4, false), bottom = dv.getInt32(q + 8, false), right = dv.getInt32(q + 12, false);
              q += 16;
              const depth = dv.getUint16(q, false);
              q += 2;
              const compression = dv.getUint8(q);
              q += 1;
              const w = right - left, h = bottom - top;
              if (w > 0 && h > 0 && w <= 4096 && h <= 4096) {
                const px = new Uint8Array(w * h);
                try {
                  if (compression === 0) {
                    for (let i = 0; i < w * h; i++) px[i] = dv.getUint8(q + i);
                  } else {
                    const rowLens = [];
                    let rp = q;
                    for (let y = 0; y < h; y++) {
                      rowLens.push(dv.getUint16(rp, false));
                      rp += 2;
                    }
                    let out = 0;
                    for (let y = 0; y < h; y++) {
                      let bytes = rowLens[y];
                      let consumed = 0;
                      while (consumed < bytes) {
                        const n = dv.getInt8(rp);
                        rp++;
                        consumed++;
                        if (n >= 0) {
                          for (let k = 0; k <= n; k++) {
                            px[out++] = dv.getUint8(rp);
                            rp++;
                            consumed++;
                          }
                        } else if (n !== -128) {
                          const val = dv.getUint8(rp);
                          rp++;
                          consumed++;
                          for (let k = 0; k < 1 - n; k++) px[out++] = val;
                        }
                      }
                    }
                  }
                  const dataUrl = S.tipPixelsToDataURL(w, h, (i) => px[i]);
                  S.addImportedTipBrush(file.name.replace(/\.abr$/i, "") + " " + (count + 1), dataUrl);
                  count++;
                } catch (_) {
                }
              }
              q = blockStart + blockLen;
              if (blockLen % 2 === 1) q++;
            }
            p = end;
          } else {
            p++;
          }
        }
      } else if (version === 1 || version === 2) {
        let p = 2;
        const n = dv.getUint16(p, false);
        p += 2;
        for (let b = 0; b < n && p < buf.byteLength - 6; b++) {
          const type = dv.getUint16(p, false);
          p += 2;
          const len = dv.getUint32(p, false);
          p += 4;
          const recStart = p;
          if (type === 2) {
            p += 4;
            p += 2;
            try {
            } catch (_) {
            }
          }
          p = recStart + len;
        }
      }
      return count;
    };
    S.importBrushArchive = async function importBrushArchive(file) {
      const buf = await file.arrayBuffer();
      let entries = S.parseZip(new Uint8Array(buf));
      entries = await S.inflateEntries(entries);
      let count = 0;
      for (const ent of entries) {
        const nameLower = ent.name.toLowerCase();
        const isPng = nameLower.endsWith(".png");
        const looksLikeTip = /(shape|grain|tip|brush|stamp|texture)/.test(nameLower);
        if (isPng && (looksLikeTip || ent.data.length > 200)) {
          try {
            const blob = new Blob([ent.data], { type: "image/png" });
            const dataUrl = await S.blobToDataURL(blob);
            const base = file.name.replace(/\.[^.]+$/, "");
            const tipName = ent.name.replace(/.*\//, "").replace(/\.png$/i, "");
            S.addImportedTipBrush(`${base} \xB7 ${tipName}`, dataUrl);
            count++;
            if (count >= 30) break;
          } catch (_) {
          }
        }
      }
      return count;
    };
    S.blobToDataURL = function blobToDataURL(blob) {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
    };
    S.parseZip = function parseZip(bytes) {
      const entries = [];
      const dv = new DataView(bytes.buffer);
      let eocd = -1;
      for (let i = bytes.length - 22; i >= 0; i--) {
        if (dv.getUint32(i, true) === 101010256) {
          eocd = i;
          break;
        }
      }
      if (eocd < 0) return entries;
      const cdOffset = dv.getUint32(eocd + 16, true);
      const cdCount = dv.getUint16(eocd + 10, true);
      let p = cdOffset;
      const pending = [];
      for (let i = 0; i < cdCount; i++) {
        if (dv.getUint32(p, true) !== 33639248) break;
        const method = dv.getUint16(p + 10, true);
        const compSize = dv.getUint32(p + 20, true);
        const nameLen = dv.getUint16(p + 28, true);
        const extraLen = dv.getUint16(p + 30, true);
        const commentLen = dv.getUint16(p + 32, true);
        const localOffset = dv.getUint32(p + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
        pending.push({ name, method, compSize, localOffset });
        p += 46 + nameLen + extraLen + commentLen;
      }
      for (const ent of pending) {
        const lp = ent.localOffset;
        if (dv.getUint32(lp, true) !== 67324752) continue;
        const nameLen = dv.getUint16(lp + 26, true);
        const extraLen = dv.getUint16(lp + 28, true);
        const dataStart = lp + 30 + nameLen + extraLen;
        const raw = bytes.subarray(dataStart, dataStart + ent.compSize);
        if (ent.method === 0) {
          entries.push({ name: ent.name, data: raw });
        } else if (ent.method === 8) {
          entries.push({ name: ent.name, data: raw, deflate: true });
        }
      }
      return entries;
    };
    S.inflateEntries = async function inflateEntries(entries) {
      const out = [];
      for (const e of entries) {
        if (e.deflate && typeof DecompressionStream !== "undefined") {
          try {
            const ds = new DecompressionStream("deflate-raw");
            const stream = new Blob([e.data]).stream().pipeThrough(ds);
            const ab = await new Response(stream).arrayBuffer();
            out.push({ name: e.name, data: new Uint8Array(ab) });
          } catch (_) {
          }
        } else {
          out.push(e);
        }
      }
      return out;
    };
    $el("puck-name").addEventListener("click", (e) => {
      e.stopPropagation();
      if (S.brushLibrary.classList.contains("show")) S.closeBrushLibrary();
      else S.openBrushLibrary();
    });
    S.editorBrush = null;
    S.editorEditIndex = null;
    S.openBrushEditor = function openBrushEditor(brush, customIndex) {
      if (brush) {
        S.editorBrush = JSON.parse(JSON.stringify(brush));
        S.editorEditIndex = typeof customIndex === "number" ? customIndex : null;
        $el("brush-modal-title").textContent = "Edit Brush";
      } else {
        S.editorBrush = {
          id: "b" + Date.now(),
          name: "New Brush",
          tipType: "soft",
          tipImage: null,
          size: 12,
          opacity: 1,
          spacing: 0.05,
          hardness: 0.7,
          pressureSize: 0.7,
          pressureOpacity: 0.3,
          jitter: 0,
          blend: "source-over",
          kind: "draw",
          builtIn: false
        };
        S.editorEditIndex = null;
        $el("brush-modal-title").textContent = "New Brush";
      }
      S.syncEditorUI();
      S.brushModal.classList.add("open");
    };
    S.closeBrushEditor = function closeBrushEditor() {
      S.brushModal.classList.remove("open");
      S.editorBrush = null;
      S.editorEditIndex = null;
    };
    $el("brush-modal-close").addEventListener("click", S.closeBrushEditor);
    $el("be-cancel").addEventListener("click", S.closeBrushEditor);
    S.brushModal.addEventListener("click", (e) => {
      if (e.target === S.brushModal) S.closeBrushEditor();
    });
    S.syncEditorUI = function syncEditorUI() {
      if (!S.editorBrush) return;
      $el("be-name").value = S.editorBrush.name;
      $el("be-tip").value = S.editorBrush.tipType;
      $el("be-size").value = S.editorBrush.size;
      $el("be-size-v").textContent = S.editorBrush.size;
      $el("be-opacity").value = Math.round(S.editorBrush.opacity * 100);
      $el("be-opacity-v").textContent = Math.round(S.editorBrush.opacity * 100);
      $el("be-spacing").value = Math.round(S.editorBrush.spacing * 100);
      $el("be-spacing-v").textContent = Math.round(S.editorBrush.spacing * 100);
      $el("be-hardness").value = Math.round(S.editorBrush.hardness * 100);
      $el("be-hardness-v").textContent = Math.round(S.editorBrush.hardness * 100);
      $el("be-psize").value = Math.round(S.editorBrush.pressureSize * 100);
      $el("be-psize-v").textContent = Math.round(S.editorBrush.pressureSize * 100);
      $el("be-popacity").value = Math.round(S.editorBrush.pressureOpacity * 100);
      $el("be-popacity-v").textContent = Math.round(S.editorBrush.pressureOpacity * 100);
      $el("be-jitter").value = Math.round(S.editorBrush.jitter * 100);
      $el("be-jitter-v").textContent = Math.round(S.editorBrush.jitter * 100);
      $el("be-blend").value = S.editorBrush.blend;
      S.toggleTextureRow();
      S.redrawEditorPreview();
    };
    S.toggleTextureRow = function toggleTextureRow() {
      const row = $el("be-texture-row");
      const hardField = $el("be-hardness-field");
      if (S.editorBrush.tipType === "texture") {
        row.style.display = "flex";
        hardField.style.display = "none";
        const thumb = $el("be-tip-thumb");
        thumb.innerHTML = "";
        if (S.editorBrush.tipImage) {
          const img = document.createElement("img");
          img.src = S.editorBrush.tipImage;
          thumb.appendChild(img);
        } else {
          thumb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>';
        }
      } else {
        row.style.display = "none";
        hardField.style.display = S.editorBrush.tipType === "soft" ? "flex" : "none";
      }
    };
    $el("be-name").addEventListener("input", (e) => {
      S.editorBrush.name = e.target.value.trim() || "Brush";
    });
    $el("be-tip").addEventListener("change", (e) => {
      S.editorBrush.tipType = e.target.value;
      S.toggleTextureRow();
      S.redrawEditorPreview();
    });
    $el("be-size").addEventListener("input", (e) => {
      S.editorBrush.size = parseFloat(e.target.value);
      $el("be-size-v").textContent = S.editorBrush.size;
      S.redrawEditorPreview();
    });
    $el("be-opacity").addEventListener("input", (e) => {
      S.editorBrush.opacity = parseInt(e.target.value) / 100;
      $el("be-opacity-v").textContent = e.target.value;
      S.redrawEditorPreview();
    });
    $el("be-spacing").addEventListener("input", (e) => {
      S.editorBrush.spacing = parseInt(e.target.value) / 100;
      $el("be-spacing-v").textContent = e.target.value;
      S.redrawEditorPreview();
    });
    $el("be-hardness").addEventListener("input", (e) => {
      S.editorBrush.hardness = parseInt(e.target.value) / 100;
      $el("be-hardness-v").textContent = e.target.value;
      S.redrawEditorPreview();
    });
    $el("be-psize").addEventListener("input", (e) => {
      S.editorBrush.pressureSize = parseInt(e.target.value) / 100;
      $el("be-psize-v").textContent = e.target.value;
      S.redrawEditorPreview();
    });
    $el("be-popacity").addEventListener("input", (e) => {
      S.editorBrush.pressureOpacity = parseInt(e.target.value) / 100;
      $el("be-popacity-v").textContent = e.target.value;
      S.redrawEditorPreview();
    });
    $el("be-jitter").addEventListener("input", (e) => {
      S.editorBrush.jitter = parseInt(e.target.value) / 100;
      $el("be-jitter-v").textContent = e.target.value;
      S.redrawEditorPreview();
    });
    $el("be-blend").addEventListener("change", (e) => {
      S.editorBrush.blend = e.target.value;
      S.redrawEditorPreview();
    });
    $el("be-tip-thumb").addEventListener("click", () => $el("be-tip-file").click());
    $el("be-tip-file").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        S.editorBrush.tipImage = ev.target.result;
        S.toggleTextureRow();
        S.redrawEditorPreview();
      };
      reader.readAsDataURL(f);
    });
    S.redrawEditorPreview = function redrawEditorPreview() {
      if (!S.editorBrush) return;
      const c = $el("be-preview-canvas");
      const r = c.getBoundingClientRect();
      c.width = Math.max(200, Math.round(r.width));
      c.height = Math.max(60, Math.round(r.height));
      S.drawBrushPreview(c, S.editorBrush);
    };
    $el("be-save").addEventListener("click", () => {
      if (!S.editorBrush) return;
      if (S.editorBrush.tipType === "texture" && !S.editorBrush.tipImage) {
        alert("Upload a texture image first, or choose a different Tip Shape.");
        return;
      }
      if (S.editorEditIndex !== null) {
        state2.customBrushes[S.editorEditIndex] = S.editorBrush;
      } else {
        state2.customBrushes.push(S.editorBrush);
      }
      const savedBrush = S.editorBrush;
      S.persistBrushes();
      S.closeBrushEditor();
      S.renderBrushList();
      S.setActiveBrush(savedBrush);
      S.showHint(`Saved \xB7 ${savedBrush.name}`);
    });
    S.persistBrushes = function persistBrushes() {
      try {
        localStorage.setItem("nm-brushes", JSON.stringify(state2.customBrushes));
      } catch (e) {
      }
    };
    S.loadBrushes = function loadBrushes() {
      try {
        const raw = localStorage.getItem("nm-brushes");
        if (raw) state2.customBrushes = JSON.parse(raw);
      } catch (e) {
      }
    };
    $all("#mode-group .pill").forEach((b) => {
      b.addEventListener("click", () => {
        $all("#mode-group .pill").forEach((p) => p.classList.remove("active"));
        b.classList.add("active");
        state2.mode = b.dataset.mode;
        S.updateLayerOrder();
        if (state2.mode === "navigate") {
          S.showHint("Navigate mode \u2014 drag to pan, pinch or scroll to zoom");
          S.area.style.cursor = "grab";
          if (S.paper) S.paper.style.cursor = "grab";
        } else {
          S.area.style.cursor = "";
          if (S.paper) S.paper.style.cursor = "";
        }
      });
    });
    state2.stencilScale = 1;
    $el("stencil-scale-slider").addEventListener("input", (e) => {
      state2.stencilScale = parseFloat(e.target.value);
      $el("stencil-scale-val").textContent = state2.stencilScale.toFixed(1) + "\xD7";
    });
    state2.stencilRotation = 0;
    $el("stencil-rot-slider").addEventListener("input", (e) => {
      state2.stencilRotation = parseFloat(e.target.value);
      $el("stencil-rot-val").textContent = Math.round(state2.stencilRotation) + "\xB0";
    });
    initColor();
    initFill();
  }

  // src/engine/app/selection.ts
  function initSelection() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.selOverlay = document.createElement("canvas");
    S.selOverlay.id = "sel-overlay";
    S.selOverlay.width = S.doc.wPx;
    S.selOverlay.height = S.doc.hPx;
    S.paper.appendChild(S.selOverlay);
    S.selCtx = S.selOverlay.getContext("2d");
    S.selBar = $el("sel-bar");
    state2.selection = null;
    state2.clipboard = null;
    state2.floating = null;
    S._selPendingBefore = null;
    S.computeMaskBBox = function computeMaskBBox(mask) {
      const w = S.doc.wPx, h = S.doc.hPx;
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          if (mask[row + x]) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return null;
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    };
    S.maskAreaCentroid = function maskAreaCentroid(mask, bbox) {
      const W = S.doc.wPx;
      let count = 0, sx = 0, sy = 0;
      for (let y = bbox.y; y < bbox.y + bbox.h; y++) {
        const row = y * W;
        for (let x = bbox.x; x < bbox.x + bbox.w; x++) {
          if (mask[row + x]) {
            count++;
            sx += x;
            sy += y;
          }
        }
      }
      return { count, cx: count ? sx / count : bbox.x + bbox.w / 2, cy: count ? sy / count : bbox.y + bbox.h / 2 };
    };
    S.magicWandSelect = function magicWandSelect(p, tolerance) {
      S.commitFloating();
      const l = S.activeLayer();
      if (!S._sampleCanvas) {
        S._sampleCanvas = document.createElement("canvas");
        S._sampleCtx = S._sampleCanvas.getContext("2d", { willReadFrequently: true });
      }
      if (S._sampleCanvas.width !== S.doc.wPx || S._sampleCanvas.height !== S.doc.hPx) {
        S._sampleCanvas.width = S.doc.wPx;
        S._sampleCanvas.height = S.doc.hPx;
      }
      S._sampleCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      if (l.imageCanvas && !l.imageBaked) S._sampleCtx.drawImage(l.imageCanvas, 0, 0);
      S._sampleCtx.drawImage(l.canvas, 0, 0);
      const sample = S._sampleCtx.getImageData(0, 0, S.doc.wPx, S.doc.hPx).data;
      const mask = S.computeFillMask(sample, p.x, p.y, tolerance);
      const bbox = S.computeMaskBBox(mask);
      if (!bbox) {
        S.clearSelection();
        S.showHint("Nothing to select there");
        return;
      }
      const ac = S.maskAreaCentroid(mask, bbox);
      const areaStr = S.formatArea(ac.count);
      state2.selection = { mask, bbox, area: areaStr, centroid: { x: ac.cx, y: ac.cy } };
      S.drawSelectionOverlay();
      S.showSelBar();
      S.showHint("Selected \xB7 " + areaStr + " \xB7 Copy / Cut / Delete / Fill \xB7 drag to move \xB7 Done");
    };
    S.lassoToMask = function lassoToMask(points) {
      if (!S._sampleCanvas) {
        S._sampleCanvas = document.createElement("canvas");
        S._sampleCtx = S._sampleCanvas.getContext("2d", { willReadFrequently: true });
      }
      if (S._sampleCanvas.width !== S.doc.wPx || S._sampleCanvas.height !== S.doc.hPx) {
        S._sampleCanvas.width = S.doc.wPx;
        S._sampleCanvas.height = S.doc.hPx;
      }
      const cx = S._sampleCtx;
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      cx.fillStyle = "#fff";
      cx.beginPath();
      cx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) cx.lineTo(points[i].x, points[i].y);
      cx.closePath();
      cx.fill();
      const d = cx.getImageData(0, 0, S.doc.wPx, S.doc.hPx).data;
      const mask = new Uint8Array(S.doc.wPx * S.doc.hPx);
      for (let i = 0; i < mask.length; i++) if (d[i * 4 + 3] > 128) mask[i] = 1;
      return mask;
    };
    S.drawLassoPath = function drawLassoPath() {
      S.selCtx.setTransform(1, 0, 0, 1, 0, 0);
      S.selCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      S.selOverlay.style.display = "block";
      S.selOverlay.style.zIndex = (state2.layers.length * 2 + 6).toString();
      S.selOverlay.classList.remove("pulse");
      const pts = state2.lassoPoints;
      if (!pts || pts.length < 2) return;
      S.selCtx.strokeStyle = "rgba(160,40,53,0.95)";
      S.selCtx.lineWidth = 2.5;
      S.selCtx.lineJoin = "round";
      S.selCtx.setLineDash([9, 6]);
      S.selCtx.beginPath();
      S.selCtx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) S.selCtx.lineTo(pts[i].x, pts[i].y);
      S.selCtx.stroke();
      S.selCtx.setLineDash([]);
    };
    S.finishLasso = function finishLasso() {
      const pts = state2.lassoPoints || [];
      state2.lassoPoints = null;
      if (pts.length < 3) {
        S.selOverlay.style.display = "none";
        return;
      }
      const mask = S.lassoToMask(pts);
      const bbox = S.computeMaskBBox(mask);
      if (!bbox) {
        S.selOverlay.style.display = "none";
        return;
      }
      const areaStr = S.formatArea(S.shoelaceArea(pts));
      let sx = 0, sy = 0;
      pts.forEach((p) => {
        sx += p.x;
        sy += p.y;
      });
      state2.selection = { mask, bbox, area: areaStr, centroid: { x: sx / pts.length, y: sy / pts.length } };
      state2.floating = null;
      S.drawSelectionOverlay();
      S.showSelBar();
      S.showHint("Lasso area: " + areaStr + " \xB7 Copy / Cut / Delete / Fill \xB7 Done");
    };
    S.drawSelectionOverlay = function drawSelectionOverlay() {
      S.selCtx.setTransform(1, 0, 0, 1, 0, 0);
      S.selCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      S.selOverlay.style.zIndex = (state2.layers.length * 2 + 6).toString();
      if (state2.floating) {
        S.selOverlay.style.display = "block";
        S.selOverlay.classList.remove("pulse");
        S.selCtx.drawImage(state2.floating.canvas, state2.floating.x, state2.floating.y);
        S.selCtx.strokeStyle = "rgba(160,40,53,0.95)";
        S.selCtx.lineWidth = 2.5;
        S.selCtx.setLineDash([11, 7]);
        S.selCtx.strokeRect(state2.floating.x, state2.floating.y, state2.floating.w, state2.floating.h);
        S.selCtx.setLineDash([]);
        return;
      }
      if (!state2.selection) {
        S.selOverlay.style.display = "none";
        S.selOverlay.classList.remove("pulse");
        return;
      }
      S.selOverlay.style.display = "block";
      const { mask, bbox } = state2.selection;
      const W = S.doc.wPx, H = S.doc.hPx;
      const img = S.selCtx.createImageData(bbox.w, bbox.h);
      const d = img.data;
      for (let y = 0; y < bbox.h; y++) {
        const gy = bbox.y + y;
        for (let x = 0; x < bbox.w; x++) {
          const gx = bbox.x + x;
          const gi = gy * W + gx;
          if (!mask[gi]) continue;
          const edge = gx === 0 || gx === W - 1 || gy === 0 || gy === H - 1 || !mask[gi - 1] || !mask[gi + 1] || !mask[gi - W] || !mask[gi + W];
          const o = (y * bbox.w + x) * 4;
          d[o] = 160;
          d[o + 1] = 40;
          d[o + 2] = 53;
          d[o + 3] = edge ? 240 : 48;
        }
      }
      S.selCtx.putImageData(img, bbox.x, bbox.y);
      S.selOverlay.classList.add("pulse");
      if (state2.selection.area && state2.selection.centroid) {
        const c = state2.selection.centroid;
        S.selCtx.font = "700 30px ui-monospace, monospace";
        S.selCtx.textAlign = "center";
        S.selCtx.textBaseline = "middle";
        const txt = state2.selection.area;
        const tw = S.selCtx.measureText(txt).width;
        const bw = tw + 28, bh = 46;
        S.selCtx.fillStyle = "rgba(20,20,22,0.9)";
        const rx = c.x - bw / 2, ry = c.y - bh / 2, r = 10;
        S.selCtx.beginPath();
        S.selCtx.moveTo(rx + r, ry);
        S.selCtx.arcTo(rx + bw, ry, rx + bw, ry + bh, r);
        S.selCtx.arcTo(rx + bw, ry + bh, rx, ry + bh, r);
        S.selCtx.arcTo(rx, ry + bh, rx, ry, r);
        S.selCtx.arcTo(rx, ry, rx + bw, ry, r);
        S.selCtx.closePath();
        S.selCtx.fill();
        S.selCtx.fillStyle = "#fff";
        S.selCtx.fillText(txt, c.x, c.y);
      }
    };
    S.clearSelection = function clearSelection() {
      state2.selection = null;
      S.selOverlay.style.display = "none";
      S.selOverlay.classList.remove("pulse");
      S.selBar.classList.remove("show");
    };
    S.showSelBar = function showSelBar() {
      S.selBar.classList.add("show");
      $el("sel-paste").disabled = !state2.clipboard;
    };
    S.ensureBaked = function ensureBaked(l) {
      if (l.imageCanvas && !l.imageBaked && l.image) S.bakeImageLayer(l);
    };
    S.maskedToCanvas = function maskedToCanvas(l, mask, bbox) {
      const c = document.createElement("canvas");
      c.width = bbox.w;
      c.height = bbox.h;
      const region = l.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
      const rd = region.data, W = S.doc.wPx;
      for (let y = 0; y < bbox.h; y++) {
        for (let x = 0; x < bbox.w; x++) {
          if (!mask[(bbox.y + y) * W + (bbox.x + x)]) region.data[(y * bbox.w + x) * 4 + 3] = 0;
        }
      }
      c.getContext("2d").putImageData(region, 0, 0);
      return c;
    };
    S.clearMaskPixels = function clearMaskPixels(l, mask, bbox) {
      const region = l.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
      const d = region.data, W = S.doc.wPx;
      for (let y = 0; y < bbox.h; y++) {
        for (let x = 0; x < bbox.w; x++) {
          if (mask[(bbox.y + y) * W + (bbox.x + x)]) {
            const o = (y * bbox.w + x) * 4;
            d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0;
          }
        }
      }
      l.ctx.putImageData(region, bbox.x, bbox.y);
    };
    S.selCopy = function selCopy() {
      if (!state2.selection) return;
      const l = S.activeLayer();
      S.ensureBaked(l);
      const { mask, bbox } = state2.selection;
      state2.clipboard = { canvas: S.maskedToCanvas(l, mask, bbox), w: bbox.w, h: bbox.h };
      $el("sel-paste").disabled = false;
      S.showHint("Copied");
    };
    S.selDelete = function selDelete() {
      if (!state2.selection) return;
      const l = S.activeLayer();
      S.ensureBaked(l);
      const { mask, bbox } = state2.selection;
      S.clearMaskPixels(l, mask, bbox);
      S.saveSnapshot(l);
      S.renderLayers();
      S.clearSelection();
      S.showHint("Deleted");
    };
    S.selCut = function selCut() {
      if (!state2.selection) return;
      const l = S.activeLayer();
      S.ensureBaked(l);
      const { mask, bbox } = state2.selection;
      state2.clipboard = { canvas: S.maskedToCanvas(l, mask, bbox), w: bbox.w, h: bbox.h };
      S.clearMaskPixels(l, mask, bbox);
      S.saveSnapshot(l);
      S.renderLayers();
      S.clearSelection();
      S.showHint("Cut");
    };
    S.selPaste = function selPaste() {
      if (!state2.clipboard) return;
      S.commitFloating();
      const cb = state2.clipboard;
      const c = document.createElement("canvas");
      c.width = cb.w;
      c.height = cb.h;
      c.getContext("2d").drawImage(cb.canvas, 0, 0);
      state2.floating = { canvas: c, x: Math.round((S.doc.wPx - cb.w) / 2), y: Math.round((S.doc.hPx - cb.h) / 2), w: cb.w, h: cb.h };
      state2.selection = null;
      S._selPendingBefore = null;
      S.drawSelectionOverlay();
      S.showSelBar();
      S.showHint("Drag to position \xB7 Done to place");
    };
    S.selDuplicate = function selDuplicate() {
      if (!state2.selection) return;
      S.selCopy();
      S.selPaste();
    };
    S.selFill = function selFill() {
      if (!state2.selection) return;
      const l = S.activeLayer();
      S.ensureBaked(l);
      S.applyFill(l, state2.selection.mask);
      S.saveSnapshot(l);
      S.renderLayers();
      S.drawSelectionOverlay();
      S.showHint(state2.fillStyle === "image" && S.currentFillTexture() ? "Filled with texture" : "Filled");
    };
    S.floatSelection = function floatSelection() {
      if (!state2.selection) return;
      const l = S.activeLayer();
      S.ensureBaked(l);
      const { mask, bbox } = state2.selection;
      S._selPendingBefore = l._cur ? new ImageData(new Uint8ClampedArray(l._cur.data), l._cur.width, l._cur.height) : l.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
      const c = S.maskedToCanvas(l, mask, bbox);
      S.clearMaskPixels(l, mask, bbox);
      state2.floating = { canvas: c, x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h };
      state2.selection = null;
      S.renderLayers();
      S.drawSelectionOverlay();
    };
    S.commitFloating = function commitFloating() {
      if (!state2.floating) return;
      const l = S.activeLayer();
      l.ctx.drawImage(state2.floating.canvas, state2.floating.x, state2.floating.y);
      if (S._selPendingBefore) {
        const after = l.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
        l.history.push({ x: 0, y: 0, before: S._selPendingBefore, after });
        l.redo = [];
        l._cur = after;
        S._capHistory(l);
        l._dirty = true;
        S.scheduleAutosave();
        S._selPendingBefore = null;
      } else {
        S.saveSnapshot(l);
      }
      state2.floating = null;
      S.renderLayers();
      S.drawSelectionOverlay();
    };
    S.insideFloating = function insideFloating(p) {
      const f = state2.floating;
      if (!f) return false;
      return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
    };
    S.maskAt = function maskAt(p) {
      const s = state2.selection;
      if (!s) return false;
      const x = Math.round(p.x), y = Math.round(p.y);
      if (x < 0 || y < 0 || x >= S.doc.wPx || y >= S.doc.hPx) return false;
      return !!s.mask[y * S.doc.wPx + x];
    };
    S.startFloatDrag = function startFloatDrag(e, p0) {
      S.paper.setPointerCapture && S.paper.setPointerCapture(e.pointerId);
      const f = state2.floating;
      const sx = f.x, sy = f.y;
      let raf = false, last = p0;
      const mv = (ev) => {
        last = S.clientToCanvas(ev.clientX, ev.clientY);
        if (raf) return;
        raf = true;
        requestAnimationFrame(() => {
          raf = false;
          if (!state2.floating) return;
          state2.floating.x = Math.round(sx + (last.x - p0.x));
          state2.floating.y = Math.round(sy + (last.y - p0.y));
          S.drawSelectionOverlay();
        });
      };
      const up = () => {
        document.removeEventListener("pointermove", mv);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
      };
      document.addEventListener("pointermove", mv);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    };
    S.selBar.querySelectorAll("button").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const a = b.dataset.act;
      if (a === "copy") S.selCopy();
      else if (a === "cut") S.selCut();
      else if (a === "fill") S.selFill();
      else if (a === "delete") S.selDelete();
      else if (a === "duplicate") S.selDuplicate();
      else if (a === "extrude") S.extrudeSelection();
      else if (a === "paste") S.selPaste();
      else if (a === "move") {
        if (state2.selection) {
          S.floatSelection();
          S.showHint("Drag to move \xB7 Done to place");
        }
      } else if (a === "deselect") {
        S.commitFloating();
        S.clearSelection();
      }
    }));
    S.makeErasableMeasurements = function makeErasableMeasurements() {
    };
    S._nmLogoImg = null;
    S.getNmLogo = function getNmLogo() {
      if (S._nmLogoImg) return Promise.resolve(S._nmLogoImg);
      return new Promise((resolve) => {
        const logoEl = $el("logo");
        if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
          S._nmLogoImg = logoEl;
          resolve(S._nmLogoImg);
          return;
        }
        const img = new Image();
        img.onload = () => {
          S._nmLogoImg = img;
          resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = logoEl ? logoEl.src : "";
      });
    };
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".popover") && !e.target.closest("#puck-color") && !e.target.closest('[data-tool="stencil"]')) {
        S.colorPopover.classList.remove("show");
        if (state2.tool !== "stencil") S.stencilPopover.classList.remove("show");
      }
    });
  }

  // src/engine/app/chrome.ts
  function initChrome() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    $el("puck-size-slider").addEventListener("input", (e) => {
      state2.size = parseFloat(e.target.value);
      $el("puck-size-val").textContent = state2.size;
      S.updatePreview();
    });
    $el("puck-alpha-slider").addEventListener("input", (e) => {
      state2.alpha = parseInt(e.target.value) / 100;
      $el("puck-alpha-val").textContent = e.target.value;
      S.updatePreview();
    });
    $el("puck-stab-slider").addEventListener("input", (e) => {
      state2.stabilizer = parseInt(e.target.value) / 100;
      $el("puck-stab-val").textContent = e.target.value;
    });
    S.updatePreview = function updatePreview() {
      const svg = $el("puck-preview-svg");
      svg.innerHTML = "";
      const svgns = "http://www.w3.org/2000/svg";
      const path = document.createElementNS(svgns, "path");
      let d = "M 2 10";
      for (let i = 0; i < 6; i++) {
        const x = 2 + i * 5;
        const y = 10 + Math.sin(i * 0.9) * 4;
        d += ` L ${x} ${y}`;
      }
      path.setAttribute("d", d);
      path.setAttribute("stroke", state2.color);
      path.setAttribute("stroke-width", String(Math.max(1, Math.min(8, state2.size * 0.4))));
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("fill", "none");
      path.setAttribute("opacity", String(state2.alpha));
      svg.appendChild(path);
    };
    $el("layer-opacity").addEventListener("input", (e) => {
      const v = parseInt(e.target.value) / 100;
      const l = S.activeLayer();
      if (!l) return;
      l.opacity = v;
      if (S.layerEngine && l.engineId) S.layerEngine.setLayerOpacity(l.engineId, v);
      S.updateLayerOrder();
      $el("layer-opacity-val").textContent = e.target.value + "%";
      S.renderLayers();
    });
    $el("layer-trace").addEventListener("input", (e) => {
      const v = parseInt(e.target.value) / 100;
      const l = S.activeLayer();
      if (!l) return;
      l.trace = v;
      if (S.layerEngine && l.engineId) {
        const meta = S.layerEngine.getLayer(l.engineId);
        if (meta) meta.trace = v;
      }
      S.updateLayerOrder();
      $el("layer-trace-val").textContent = e.target.value + "%";
      S.renderLayers();
    });
    $el("layer-blend").addEventListener("change", (e) => {
      const l = S.activeLayer();
      if (!l) return;
      l.blendMode = e.target.value;
      if (S.layerEngine && l.engineId) S.layerEngine.setLayerBlendMode(l.engineId, e.target.value);
      S.updateLayerOrder();
      S.renderLayers();
    });
    $el("btn-undo").addEventListener("click", S.undo);
    S.stylusOnly = localStorage.getItem("nm-stylus-only") === "1";
    S._penDown = 0;
    document.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "pen") S._penDown++;
    }, true);
    document.addEventListener("pointerup", (e) => {
      if (e.pointerType === "pen") S._penDown = Math.max(0, S._penDown - 1);
    }, true);
    document.addEventListener("pointercancel", (e) => {
      if (e.pointerType === "pen") S._penDown = Math.max(0, S._penDown - 1);
    }, true);
    S.updateStylusBtn = function updateStylusBtn() {
      const b = $el("btn-stylus");
      if (b) b.classList.toggle("active", S.stylusOnly);
    };
    S._stylusGuard = function _stylusGuard(e) {
      if (!S.stylusOnly || e.pointerType !== "touch" || S._penDown === 0) return;
      const t = e.target;
      if (t && t.closest && t.closest("#paper, #massing-canvas, #fe-canvas")) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    ["pointerdown", "pointermove", "pointerup"].forEach((ev) => document.addEventListener(ev, S._stylusGuard, true));
    $el("btn-stylus").addEventListener("click", () => {
      S.stylusOnly = !S.stylusOnly;
      localStorage.setItem("nm-stylus-only", S.stylusOnly ? "1" : "0");
      S.updateStylusBtn();
      S.showHint(S.stylusOnly ? "Pencil-only ON \u2014 palm ignored while drawing \xB7 2-finger undo still works" : "Pencil-only OFF \u2014 touch enabled");
    });
    S.updateStylusBtn();
    $el("btn-redo").addEventListener("click", S.redo);
    $el("btn-grid").addEventListener("click", () => {
      state2.showGrid = !state2.showGrid;
      if (state2.showGrid && state2.gridType === "off") state2.gridType = "square";
      S.drawDocGrid();
    });
    S.gridCanvas = $el("grid-canvas");
    S.gridCtx = S.gridCanvas.getContext("2d");
    S.mmToDocPx = function mmToDocPx(mm) {
      return mm / 25.4 * S.doc.dpi;
    };
    S.drawDocGrid = function drawDocGrid() {
      S.gridCanvas.width = S.doc.wPx;
      S.gridCanvas.height = S.doc.hPx;
      const show = state2.showGrid && state2.gridType !== "off";
      S.gridCanvas.style.display = show ? "block" : "none";
      if (!show) return;
      const ctx = S.gridCtx;
      ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      const op = state2.gridOpacity;
      let spacing = Math.max(8, S.mmToDocPx(state2.gridSpacingMM));
      const minorW = Math.max(1.5, S.doc.wPx / 1400);
      const majorW = minorW * 2.2;
      const minorColor = `rgba(40,70,140,${op * 0.5})`;
      const majorColor = `rgba(40,70,140,${op})`;
      if (state2.gridType === "square") {
        ctx.strokeStyle = majorColor;
        ctx.lineWidth = minorW;
        for (let x = 0; x <= S.doc.wPx; x += spacing) S.line(ctx, x, 0, x, S.doc.hPx);
        for (let y = 0; y <= S.doc.hPx; y += spacing) S.line(ctx, 0, y, S.doc.wPx, y);
      } else if (state2.gridType === "arch") {
        const major = state2.gridMajor;
        let i = 0;
        for (let x = 0; x <= S.doc.wPx; x += spacing, i++) {
          ctx.strokeStyle = i % major === 0 ? majorColor : minorColor;
          ctx.lineWidth = i % major === 0 ? majorW : minorW;
          S.line(ctx, x, 0, x, S.doc.hPx);
        }
        i = 0;
        for (let y = 0; y <= S.doc.hPx; y += spacing, i++) {
          ctx.strokeStyle = i % major === 0 ? majorColor : minorColor;
          ctx.lineWidth = i % major === 0 ? majorW : minorW;
          S.line(ctx, 0, y, S.doc.wPx, y);
        }
      } else if (state2.gridType === "dot") {
        ctx.fillStyle = majorColor;
        const r = Math.max(1.2, minorW);
        for (let x = spacing / 2; x < S.doc.wPx; x += spacing) {
          for (let y = spacing / 2; y < S.doc.hPx; y += spacing) {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (state2.gridType === "column") {
        const colSpacing = spacing * state2.gridMajor;
        ctx.strokeStyle = majorColor;
        ctx.lineWidth = majorW;
        ctx.setLineDash([majorW * 3, majorW * 2]);
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let ci = 0;
        for (let x = colSpacing; x < S.doc.wPx; x += colSpacing, ci++) {
          S.line(ctx, x, 0, x, S.doc.hPx);
          S.gridBubble(ctx, x, colSpacing * 0.35, letters[ci % 26], majorColor);
        }
        let ri = 0;
        for (let y = colSpacing; y < S.doc.hPx; y += colSpacing, ri++) {
          S.line(ctx, 0, y, S.doc.wPx, y);
          S.gridBubble(ctx, colSpacing * 0.35, y, String(ri + 1), majorColor);
        }
        ctx.setLineDash([]);
      }
    };
    S.line = function line(ctx, x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    S.gridBubble = function gridBubble(ctx, cx, cy, label, color) {
      const r = Math.max(28, S.doc.wPx / 70);
      ctx.save();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, S.doc.wPx / 900);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `700 ${r * 1.1}px Archivo, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, cy);
      ctx.restore();
    };
    S.gridPopover = $el("grid-popover");
    $el("ovf-grid").addEventListener("click", () => {
      S.gridPopover.classList.add("show");
      S.overflowPanel.classList.remove("show");
      S.syncGridUI();
    }, true);
    S.syncGridUI = function syncGridUI() {
      $all("#grid-popover [data-grid]").forEach((b) => b.classList.toggle("active", b.dataset.grid === (state2.showGrid ? state2.gridType : "off")));
      $el("grid-spacing").value = state2.gridSpacingMM;
      $el("grid-spacing-v").textContent = state2.gridSpacingMM + "mm";
      $el("grid-major").value = state2.gridMajor;
      $el("grid-major-v").textContent = "\xD7" + state2.gridMajor;
      $el("grid-opacity").value = Math.round(state2.gridOpacity * 100);
      $el("grid-opacity-v").textContent = Math.round(state2.gridOpacity * 100) + "%";
      $el("grid-major-row").style.display = state2.gridType === "arch" || state2.gridType === "column" ? "flex" : "none";
    };
    $all("#grid-popover [data-grid]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const g = btn.dataset.grid;
        if (g === "off") {
          state2.showGrid = false;
        } else {
          state2.showGrid = true;
          state2.gridType = g;
        }
        S.syncGridUI();
        S.drawDocGrid();
      });
    });
    $el("grid-spacing").addEventListener("input", (e) => {
      state2.gridSpacingMM = parseInt(e.target.value);
      $el("grid-spacing-v").textContent = state2.gridSpacingMM + "mm";
      S.drawDocGrid();
    });
    $el("grid-major").addEventListener("input", (e) => {
      state2.gridMajor = parseInt(e.target.value);
      $el("grid-major-v").textContent = "\xD7" + state2.gridMajor;
      S.drawDocGrid();
    });
    $el("grid-opacity").addEventListener("input", (e) => {
      state2.gridOpacity = parseInt(e.target.value) / 100;
      $el("grid-opacity-v").textContent = e.target.value + "%";
      S.drawDocGrid();
    });
    S.snapToggleEl = $el("snap-toggle");
    if (S.snapToggleEl) S.snapToggleEl.addEventListener("change", (e) => {
      state2.snapEnabled = e.target.checked;
      S.showHint(state2.snapEnabled ? "Snap on \xB7 vertices stick to corners & grid" : "Snap off");
    });
    $el("btn-scale").addEventListener("click", S.startScale);
    $el("btn-measures").addEventListener("click", () => {
      state2.showMeasurements = !state2.showMeasurements;
      const btn = $el("btn-measures");
      btn.style.background = state2.showMeasurements ? "" : "var(--ink)";
      btn.style.color = state2.showMeasurements ? "" : "var(--paper)";
      S.refreshMeasurements();
      S.showHint(state2.showMeasurements ? "Measurements visible" : "Measurements hidden");
    });
    $el("btn-clear-measures").addEventListener("click", () => {
      if (state2.measurements.length === 0) {
        S.showHint("No measurements to clear");
        return;
      }
      if (confirm(`Clear all ${state2.measurements.length} measurement${state2.measurements.length === 1 ? "" : "s"}?`)) {
        state2.measurements = [];
        S.refreshMeasurements();
        S.showHint("Measurements cleared");
      }
    });
    $el("btn-import-image").addEventListener("click", () => S.fileInputImportImage.click());
    $el("btn-add-image-layer").addEventListener("click", () => S.fileInputImportImage.click());
    $el("btn-add-layer").addEventListener("click", () => S.createLayer(void 0, { layerKind: "sketch" }));
    S.fileInputImportImage.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      S.importImageAsLayer(file);
      e.target.value = "";
    });
    $el("btn-export").addEventListener("click", async () => {
      const out = document.createElement("canvas");
      out.width = S.doc.wPx;
      out.height = S.doc.hPx;
      const octx = out.getContext("2d");
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, S.doc.wPx, S.doc.hPx);
      state2.layers.forEach((l) => {
        if (!l.visible) return;
        if (l.imageCanvas && !l.imageBaked) {
          octx.globalAlpha = l.opacity;
          octx.drawImage(l.imageCanvas, 0, 0);
        }
        octx.globalAlpha = l.opacity;
        octx.drawImage(l.canvas, 0, 0);
      });
      octx.globalAlpha = 1;
      try {
        const margin = Math.round(S.doc.wPx * 0.018);
        const fs = Math.max(11, Math.round(S.doc.wPx * 72e-4));
        const now = /* @__PURE__ */ new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const stampText = ["SketchTrude", dateStr, timeStr].join("    \xB7    ");
        octx.save();
        octx.font = `600 ${fs}px 'JetBrains Mono', ui-monospace, monospace`;
        octx.textAlign = "left";
        octx.textBaseline = "alphabetic";
        octx.fillStyle = "rgba(10,10,10,0.62)";
        octx.fillText(stampText, margin, S.doc.hPx - margin);
        octx.restore();
      } catch (e) {
      }
      out.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `SketchTrude-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.png`;
        a.click();
      }, "image/png");
      S.showHint("Exported \xB7 SketchTrude \xB7 date");
    });
    S.updateZoomDisplay = function updateZoomDisplay() {
      const el = $el("zoom-level");
      if (!el) return;
      if (typeof S.massing !== "undefined" && S.massing.active) {
        el.textContent = Math.round(S.massing.cam.scale) + "%";
      } else {
        el.textContent = Math.round(state2.zoom * 100) + "%";
      }
    };
    S.handleZoomIn = function handleZoomIn() {
      if (S.massing.active) {
        S.massing.cam.scale = Math.max(6, Math.min(160, S.massing.cam.scale * 1.08));
        S.renderMassing();
        S.updateZoomDisplay();
        return;
      }
      state2.zoom = window.StudioHelpers ? window.StudioHelpers.zoomIn(state2.zoom) : Math.min(8, state2.zoom * 1.25);
      S.applyStageTransform();
    };
    S.handleZoomOut = function handleZoomOut() {
      if (S.massing.active) {
        S.massing.cam.scale = Math.max(6, Math.min(160, S.massing.cam.scale / 1.08));
        S.renderMassing();
        S.updateZoomDisplay();
        return;
      }
      state2.zoom = window.StudioHelpers ? window.StudioHelpers.zoomOut(state2.zoom) : Math.max(0.2, state2.zoom / 1.25);
      S.applyStageTransform();
    };
    S.handleZoomFit = function handleZoomFit() {
      if (S.massing.active) {
        S.massing.panX = 0;
        S.massing.panY = 0;
        const r = S.area.getBoundingClientRect();
        S.massing.cam.scale = Math.min(r.width, r.height) / 26;
        S.renderMassing();
        S.updateZoomDisplay();
        return;
      }
      S.fitToScreen();
    };
    $el("zoom-in").addEventListener("click", S.handleZoomIn);
    $el("zoom-out").addEventListener("click", S.handleZoomOut);
    $el("zoom-fit").addEventListener("click", S.handleZoomFit);
    let hintTimer;
    S.showHint = function showHint(msg) {
      S.hintEl.textContent = msg;
      S.hintEl.classList.add("show");
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => S.hintEl.classList.remove("show"), 3e3);
    };
    S._lastErrToast = 0;
    S.recoverFromError = function recoverFromError(where, err) {
      console.error("[SketchTrude] recovered from error in", where, err);
      try {
        state2.drawing = false;
        if (state2.usingBuffer) {
          state2.usingBuffer = false;
          if (typeof S.strokeCtx !== "undefined") {
            S.strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
            S.strokeCtx.clearRect(0, 0, S.strokeCanvas.width, S.strokeCanvas.height);
          }
          if (typeof S.strokeCanvas !== "undefined") {
            S.strokeCanvas.style.opacity = "0";
            S.strokeCanvas.style.mixBlendMode = "normal";
          }
        }
        if (typeof S.massing !== "undefined") S.massing.dragging = null;
        document.body.classList.remove("nm-drawing");
      } catch (_) {
      }
      if (Date.now() - S._lastErrToast > 4e3) {
        S._lastErrToast = Date.now();
        S.showHint("Something hiccuped \u2014 your work is safe. Carry on.");
      }
    };
    window.addEventListener("error", (e) => S.recoverFromError("window.error", e.error || e.message));
    window.addEventListener("unhandledrejection", (e) => S.recoverFromError("promise", e.reason));
    S.updateUI = function updateUI() {
      const l = S.activeLayer();
      $el("layer-opacity").value = Math.round(l.opacity * 100);
      $el("layer-opacity-val").textContent = Math.round(l.opacity * 100) + "%";
      $el("layer-trace").value = Math.round(l.trace * 100);
      $el("layer-trace-val").textContent = Math.round(l.trace * 100) + "%";
      S.refreshImageOverlay();
      S.refreshImageProps();
    };
    S.imageProps = $el("image-props");
    S.refreshImageProps = function refreshImageProps() {
      const l = S.activeLayer();
      const hasUnbaked = l && l.image && !l.imageBaked;
      S.imageProps.style.display = hasUnbaked ? "block" : "none";
      if (!hasUnbaked) return;
      const t = l.imageTransform;
      $el("img-x").value = Math.round(S.pxToMm(t.x));
      $el("img-y").value = Math.round(S.pxToMm(t.y));
      $el("img-w").value = Math.round(S.pxToMm(t.w));
      $el("img-h").value = Math.round(S.pxToMm(t.h));
      $el("img-rot").value = Math.round(t.rotation);
      $el("img-opacity").value = Math.round(l.imageOpacity * 100);
      $el("img-crop-toggle").classList.toggle("active", state2.cropMode);
    };
    S.pxToMm = function pxToMm(px) {
      return px / S.doc.wPx * S.doc.wMM;
    };
    S.mmToPx = function mmToPx(mm) {
      return mm / S.doc.wMM * S.doc.wPx;
    };
    S.bindImageInput = function bindImageInput(id, fn) {
      const el = $el(id);
      el.addEventListener("change", () => {
        const l = S.activeLayer();
        if (!l.image || l.imageBaked) return;
        fn(l, parseFloat(el.value));
        S.renderImageCanvas(l);
        S.refreshImageOverlay();
        S.renderLayers();
      });
    };
    S.bindImageInput("img-x", (l, v) => l.imageTransform.x = S.mmToPx(v));
    S.bindImageInput("img-y", (l, v) => l.imageTransform.y = S.mmToPx(v));
    S.bindImageInput("img-w", (l, v) => l.imageTransform.w = Math.max(10, S.mmToPx(v)));
    S.bindImageInput("img-h", (l, v) => l.imageTransform.h = Math.max(10, S.mmToPx(v)));
    S.bindImageInput("img-rot", (l, v) => l.imageTransform.rotation = v);
    S.bindImageInput("img-opacity", (l, v) => l.imageOpacity = Math.max(0, Math.min(100, v)) / 100);
    $el("img-reset").addEventListener("click", () => {
      const l = S.activeLayer();
      if (!l.image || l.imageBaked) return;
      const aspect = l.image.naturalWidth / l.image.naturalHeight;
      let w, h;
      if (S.doc.wPx / S.doc.hPx > aspect) {
        h = S.doc.hPx * 0.9;
        w = h * aspect;
      } else {
        w = S.doc.wPx * 0.9;
        h = w / aspect;
      }
      l.imageTransform = { x: S.doc.wPx / 2, y: S.doc.hPx / 2, w, h, rotation: 0 };
      l.imageOpacity = 1;
      l.imageCrop = null;
      S.renderImageCanvas(l);
      S.refreshImageOverlay();
      S.refreshImageProps();
    });
    $el("img-apply").addEventListener("click", () => {
      const l = S.activeLayer();
      if (!l.image || l.imageBaked) return;
      S.bakeImageLayer(l);
      S.showHint("Image flattened \xB7 paint and erase work normally now");
    });
    $el("img-replace").addEventListener("click", () => {
      state2.replaceImageInLayer = S.activeLayer();
      S.fileInputImportImage.click();
    });
    $el("img-scale-ref").addEventListener("click", () => {
      const l = S.activeLayer();
      if (!l.image || !l.imageTransform) return;
      const wPx = l.imageTransform.w;
      state2.pendingScaleStart = { x: l.imageTransform.x - wPx / 2, y: l.imageTransform.y };
      state2.pendingScaleEnd = { x: l.imageTransform.x + wPx / 2, y: l.imageTransform.y };
      state2.pendingScale = false;
      state2.measurePreview = { x1: state2.pendingScaleStart.x, y1: state2.pendingScaleStart.y, x2: state2.pendingScaleEnd.x, y2: state2.pendingScaleEnd.y };
      S.refreshMeasurements();
      S.openScaleApply();
      S.showHint("Enter the real-world width of this image, then Apply");
    });
    $el("img-crop-toggle").addEventListener("click", () => {
      state2.cropMode = !state2.cropMode;
      $el("img-crop-toggle").classList.toggle("active", state2.cropMode);
      S.refreshImageOverlay();
      if (state2.cropMode) S.showHint("Crop mode \xB7 drag corners on the image to crop");
    });
    S.hideImageOverlay = function hideImageOverlay() {
      S.imgOverlay.style.display = "none";
      S.imgOverlay.classList.remove("active-overlay");
      S.imgOverlay.innerHTML = "";
    };
    S.refreshImageOverlay = function refreshImageOverlay() {
      const l = S.activeLayer();
      if (!l || !l.image || l.imageBaked) {
        S.hideImageOverlay();
        return;
      }
      S.drawImageOverlay(l);
    };
    S.drawImageOverlay = function drawImageOverlay(layer) {
      const t = layer.imageTransform;
      S.imgOverlay.style.display = "block";
      S.imgOverlay.classList.add("active-overlay");
      S.imgOverlay.setAttribute("viewBox", `0 0 ${S.doc.wPx} ${S.doc.hPx}`);
      S.imgOverlay.innerHTML = "";
      const svgns = "http://www.w3.org/2000/svg";
      const group = document.createElementNS(svgns, "g");
      group.setAttribute("transform", `translate(${t.x} ${t.y}) rotate(${t.rotation})`);
      S.imgOverlay.appendChild(group);
      const frame = document.createElementNS(svgns, "rect");
      frame.setAttribute("x", String(-t.w / 2));
      frame.setAttribute("y", String(-t.h / 2));
      frame.setAttribute("width", String(t.w));
      frame.setAttribute("height", String(t.h));
      frame.setAttribute("class", "img-frame" + (state2.cropMode ? " cropping" : ""));
      group.appendChild(frame);
      const handleR = Math.max(14, 30 / (state2.zoom * state2.baseZoom));
      const handles = [
        { x: -t.w / 2, y: -t.h / 2, role: "corner-tl" },
        { x: t.w / 2, y: -t.h / 2, role: "corner-tr" },
        { x: -t.w / 2, y: t.h / 2, role: "corner-bl" },
        { x: t.w / 2, y: t.h / 2, role: "corner-br" }
      ];
      handles.forEach((h) => {
        const c = document.createElementNS(svgns, "circle");
        c.setAttribute("cx", String(h.x));
        c.setAttribute("cy", String(h.y));
        c.setAttribute("r", String(handleR));
        c.setAttribute("class", "img-handle " + h.role);
        c.dataset.role = h.role;
        group.appendChild(c);
      });
      const rotateDist = Math.max(50, 100 / (state2.zoom * state2.baseZoom));
      const topInDoc = t.y - t.h / 2;
      const placeBelow = topInDoc < rotateDist + handleR + 20;
      const rotateY = placeBelow ? t.h / 2 + rotateDist : -t.h / 2 - rotateDist;
      const lineY1 = placeBelow ? t.h / 2 : -t.h / 2;
      const rline = document.createElementNS(svgns, "line");
      rline.setAttribute("x1", String(0));
      rline.setAttribute("y1", String(lineY1));
      rline.setAttribute("x2", String(0));
      rline.setAttribute("y2", String(rotateY));
      rline.setAttribute("class", "img-rotate-line");
      group.appendChild(rline);
      const rc = document.createElementNS(svgns, "circle");
      rc.setAttribute("cx", String(0));
      rc.setAttribute("cy", String(rotateY));
      rc.setAttribute("r", String(handleR));
      rc.setAttribute("class", "img-handle rotate");
      rc.dataset.role = "rotate";
      group.appendChild(rc);
      S.attachImageOverlayHandlers(layer);
    };
    S.attachImageOverlayHandlers = function attachImageOverlayHandlers(layer) {
      const elements = S.imgOverlay.querySelectorAll(".img-frame, .img-handle");
      elements.forEach((el) => {
        el.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const role = el.dataset.role || "move";
          S.startImageManipulation(layer, role, e);
        });
      });
    };
    S.startImageManipulation = function startImageManipulation(layer, role, e) {
      S.imgOverlay.setPointerCapture && S.imgOverlay.setPointerCapture(e.pointerId);
      const start = S.clientToCanvas(e.clientX, e.clientY);
      const t0 = { ...layer.imageTransform };
      layer.imageManipulating = true;
      let rafPending = false, lastEv = e;
      const apply = () => {
        rafPending = false;
        const ev = lastEv;
        const p = S.clientToCanvas(ev.clientX, ev.clientY);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        if (role === "move") {
          layer.imageTransform.x = t0.x + dx;
          layer.imageTransform.y = t0.y + dy;
        } else if (role === "rotate") {
          const a = Math.atan2(p.y - t0.y, p.x - t0.x) * 180 / Math.PI + 90;
          let next = a;
          if (ev.shiftKey) next = Math.round(next / 15) * 15;
          layer.imageTransform.rotation = next;
        } else if (role.startsWith("corner")) {
          const r = -t0.rotation * Math.PI / 180;
          const lx = (p.x - t0.x) * Math.cos(r) - (p.y - t0.y) * Math.sin(r);
          const ly = (p.x - t0.x) * Math.sin(r) + (p.y - t0.y) * Math.cos(r);
          const sx = role.endsWith("tr") || role.endsWith("br") ? 1 : -1;
          const sy = role.endsWith("bl") || role.endsWith("br") ? 1 : -1;
          let newW = Math.max(10, lx * sx * 2);
          let newH = Math.max(10, ly * sy * 2);
          if (!ev.altKey) {
            const rw = newW / t0.w, rh = newH / t0.h;
            const scale = Math.max(rw, rh);
            newW = t0.w * scale;
            newH = t0.h * scale;
          }
          layer.imageTransform.w = newW;
          layer.imageTransform.h = newH;
        }
        S.renderImageCanvas(layer);
        S.drawImageOverlay(layer);
        S.refreshImageProps();
      };
      const onMove = (ev) => {
        lastEv = ev;
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(apply);
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        layer.imageManipulating = false;
        S.renderImageCanvas(layer);
        S.drawImageOverlay(layer);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    };
  }

  // src/engine/app/selection-chrome.ts
  function initSelectionChrome() {
    initSelection();
    initChrome();
  }

  // src/engine/app/features/snap.ts
  function initSnap() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.snapToOrtho = function snapToOrtho(x, y, anchorX, anchorY) {
      const dx = x - anchorX, dy = y - anchorY;
      const angle = Math.atan2(dy, dx);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const dist = Math.sqrt(dx * dx + dy * dy);
      return {
        x: anchorX + dist * Math.cos(snapped),
        y: anchorY + dist * Math.sin(snapped)
      };
    };
    S.applyOrthoSnap = function applyOrthoSnap(p, e) {
      if (!e.shiftKey) {
        if (state2.snapActive) {
          state2.snapActive = false;
          $el("snap-badge").classList.remove("show");
        }
        return p;
      }
      if (!state2.snapActive) {
        state2.snapActive = true;
        state2.snapAnchor = { x: state2.lastX, y: state2.lastY };
        $el("snap-badge").classList.add("show");
      }
      return S.snapToOrtho(p.x, p.y, state2.snapAnchor.x, state2.snapAnchor.y);
    };
    state2.snapActive = false;
    state2.snapAnchor = null;
  }

  // src/engine/app/features/hatch.ts
  function initHatch() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.HATCH_PATTERNS = [
      {
        name: "Brick",
        category: "hatch",
        tile: (ctx, tileW, tileH) => {
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(1, 1, tileW / 2 - 2, tileH / 2 - 1);
          ctx.strokeRect(tileW / 2, 1, tileW / 2 - 1, tileH / 2 - 1);
          ctx.strokeRect(1 - tileW / 4, tileH / 2, tileW / 2 - 2, tileH / 2 - 1);
          ctx.strokeRect(tileW / 4 + 1, tileH / 2, tileW / 2 - 2, tileH / 2 - 1);
          ctx.strokeRect(tileW - tileW / 4 + 1, tileH / 2, tileW / 2 - 2, tileH / 2 - 1);
        },
        tileW: 60,
        tileH: 30
      },
      {
        name: "Concrete",
        category: "hatch",
        tile: (ctx, tileW, tileH) => {
          ctx.fillStyle = "#333";
          const pts = [[8, 8], [20, 15], [35, 5], [45, 20], [55, 10], [12, 22], [30, 25], [48, 28]];
          pts.forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x % tileW, y % tileH, 1.2, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.strokeStyle = "#555";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(0, tileH * 0.6);
          ctx.lineTo(tileW, tileH * 0.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, tileH * 0.2);
          ctx.lineTo(tileW, tileH * 0.35);
          ctx.stroke();
        },
        tileW: 60,
        tileH: 30
      },
      {
        name: "Wood",
        category: "hatch",
        tile: (ctx, tileW, tileH) => {
          ctx.strokeStyle = "#8b5a2b";
          ctx.lineWidth = 1;
          for (let i = 0; i < 4; i++) {
            const y = i / 4 * tileH + 3;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(tileW * 0.25, y - 2, tileW * 0.5, y + 2, tileW * 0.75, y - 1);
            ctx.bezierCurveTo(tileW * 0.85, y, tileW, y + 1, tileW, y);
            ctx.stroke();
          }
        },
        tileW: 80,
        tileH: 20
      },
      {
        name: "Insulation",
        category: "hatch",
        tile: (ctx, tileW, tileH) => {
          ctx.strokeStyle = "#e0a020";
          ctx.lineWidth = 1.5;
          const mid = tileH / 2;
          ctx.beginPath();
          for (let x = 0; x <= tileW; x += 10) {
            ctx.lineTo(x, x % 20 === 0 ? mid - 6 : mid + 6);
          }
          ctx.stroke();
          ctx.strokeStyle = "#555";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(tileW, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, tileH);
          ctx.lineTo(tileW, tileH);
          ctx.stroke();
        },
        tileW: 60,
        tileH: 24
      },
      {
        name: "Earth",
        category: "hatch",
        tile: (ctx, tileW, tileH) => {
          ctx.strokeStyle = "#6b4c2a";
          ctx.lineWidth = 1;
          for (let i = -tileH; i < tileW + tileH; i += 10) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + tileH, tileH);
            ctx.stroke();
          }
          ctx.fillStyle = "#6b4c2a";
          [[15, 10], [35, 6], [55, 15], [10, 20], [45, 22]].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          });
        },
        tileW: 60,
        tileH: 30
      },
      {
        name: "Water",
        category: "hatch",
        tile: (ctx, tileW, tileH) => {
          ctx.strokeStyle = "#1e6fa8";
          ctx.lineWidth = 1.2;
          [0.3, 0.65, 1].forEach((f) => {
            const y = f * tileH;
            ctx.beginPath();
            for (let x = 0; x <= tileW; x += 12) {
              ctx.quadraticCurveTo(x + 3, y - 4, x + 6, y);
              ctx.quadraticCurveTo(x + 9, y + 4, x + 12, y);
            }
            ctx.stroke();
          });
        },
        tileW: 48,
        tileH: 18
      }
    ];
    S._hatchTiles = {};
    S.getHatchTile = function getHatchTile(hatch) {
      const key = hatch._key || hatch.name;
      if (S._hatchTiles[key]) return S._hatchTiles[key];
      const oc = document.createElement("canvas");
      oc.width = hatch.tileW;
      oc.height = hatch.tileH;
      const octx = oc.getContext("2d");
      octx.clearRect(0, 0, hatch.tileW, hatch.tileH);
      hatch.tile(octx, hatch.tileW, hatch.tileH);
      S._hatchTiles[key] = oc;
      return oc;
    };
    S.hatchList = function hatchList() {
      return S.HATCH_PATTERNS.concat(state2.customHatches);
    };
    S.buildCustomHatch = function buildCustomHatch(name, img, dataUrl) {
      const cap = 256;
      const scale = Math.min(1, cap / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      const tileW = Math.max(2, Math.round((img.naturalWidth || img.width) * scale));
      const tileH = Math.max(2, Math.round((img.naturalHeight || img.height) * scale));
      return {
        name,
        category: "hatch",
        custom: true,
        _key: "custom:" + name + ":" + Date.now() + ":" + Math.random().toString(36).slice(2, 6),
        img,
        dataUrl,
        tileW,
        tileH,
        tile: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h)
      };
    };
    S.addCustomHatchFromFile = function addCustomHatchFromFile(file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const name = file.name.replace(/\.[^.]+$/, "") || "Hatch";
          state2.customHatches.push(S.buildCustomHatch(name, img, ev.target.result));
          if (state2.stencilCat === "hatch") S.renderStencilsWithHatch();
          S.persistHatches();
          S.showHint(`Added hatch: ${name}`);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    S.persistHatches = function persistHatches() {
      try {
        const slim = state2.customHatches.map((h) => ({ name: h.name, dataUrl: h.dataUrl }));
        localStorage.setItem("nm-hatches", JSON.stringify(slim));
      } catch (e) {
      }
    };
    S.loadHatches = function loadHatches() {
      try {
        const raw = localStorage.getItem("nm-hatches");
        if (!raw) return;
        JSON.parse(raw).forEach((rec) => {
          const img = new Image();
          img.onload = () => {
            state2.customHatches.push(S.buildCustomHatch(rec.name, img, rec.dataUrl));
            if (state2.stencilCat === "hatch") S.renderStencilsWithHatch();
          };
          img.src = rec.dataUrl;
        });
      } catch (e) {
      }
    };
    S.placeHatch = function placeHatch(hatchPattern, ctx, cx, cy, size, rad) {
      const tile = S.getHatchTile(hatchPattern);
      const pattern = ctx.createPattern(tile, "repeat");
      const s = size;
      ctx.save();
      ctx.globalAlpha = state2.alpha;
      ctx.globalCompositeOperation = "source-over";
      ctx.translate(cx, cy);
      if (rad) ctx.rotate(rad);
      const mat = new DOMMatrix().translate(-s / 2, -s / 2);
      pattern.setTransform(mat);
      ctx.fillStyle = pattern;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    };
    S.addMeasureSVG = function addMeasureSVG(m, isPreview, mIndex) {
      S.addDimSVG(m, isPreview, mIndex);
    };
    S._stencilTabHandler = () => {
      $all(".stencil-tab").forEach((t) => {
        t.dataset.cat && t.addEventListener("click", () => {
          $all(".stencil-tab").forEach((x) => x.classList.remove("active"));
          t.classList.add("active");
          state2.stencilCat = t.dataset.cat;
          state2.selectedStencil = null;
          S.renderStencilsWithHatch();
        });
      });
    };
    S.injectHatchTab = function injectHatchTab() {
      const tabs = $qs(".stencil-tabs");
      if (!tabs) return;
      const tab = document.createElement("button");
      tab.className = "stencil-tab";
      tab.dataset.cat = "hatch";
      tab.textContent = "Hatch";
      tab.addEventListener("click", () => {
        $all(".stencil-tab").forEach((x) => x.classList.remove("active"));
        tab.classList.add("active");
        state2.stencilCat = "hatch";
        state2.selectedStencil = null;
        S.renderStencilsWithHatch();
      });
      tabs.appendChild(tab);
    };
    S.renderStencilsWithHatch = function renderStencilsWithHatch() {
      const grid = $el("stencil-grid");
      grid.innerHTML = "";
      const list = state2.stencilCat === "hatch" ? S.hatchList() : state2.stencilCat === "builtin" ? S.BUILTIN_STENCILS : state2.customStencils;
      list.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "stencil" + (state2.selectedStencil === i ? " active" : "");
        div.title = s.name;
        if (s.category === "hatch") {
          const cv = document.createElement("canvas");
          cv.width = 60;
          cv.height = 60;
          const ctx = cv.getContext("2d");
          const tile = S.getHatchTile(s);
          const pat = ctx.createPattern(tile, "repeat");
          ctx.fillStyle = pat;
          ctx.fillRect(0, 0, 60, 60);
          div.appendChild(cv);
        } else if (s.dataUrl) {
          const img = document.createElement("img");
          img.src = s.dataUrl;
          div.appendChild(img);
        } else {
          const tmp = document.createElement("canvas");
          tmp.width = 80;
          tmp.height = 80;
          const tctx = tmp.getContext("2d");
          tctx.strokeStyle = "#0a0a0a";
          tctx.lineWidth = 1.8;
          tctx.lineCap = "round";
          tctx.lineJoin = "round";
          s.draw(tctx, 40, 40, 60);
          const img = document.createElement("img");
          img.src = tmp.toDataURL();
          div.appendChild(img);
        }
        div.addEventListener("click", () => {
          state2.selectedStencil = i;
          S.renderStencilsWithHatch();
          S.showHint(`Tap canvas to place: ${s.name}`);
        });
        if (state2.stencilCat === "custom") {
          const del = document.createElement("button");
          del.className = "del";
          del.textContent = "\xD7";
          del.addEventListener("click", (ex) => {
            ex.stopPropagation();
            state2.customStencils.splice(i, 1);
            if (state2.selectedStencil === i) state2.selectedStencil = null;
            S.renderStencilsWithHatch();
            S.persistStencils();
          });
          div.appendChild(del);
        }
        if (state2.stencilCat === "hatch" && s.custom) {
          const del = document.createElement("button");
          del.className = "del";
          del.textContent = "\xD7";
          del.addEventListener("click", (ex) => {
            ex.stopPropagation();
            const ci = state2.customHatches.indexOf(s);
            if (ci >= 0) state2.customHatches.splice(ci, 1);
            if (state2.selectedStencil === i) state2.selectedStencil = null;
            S.renderStencilsWithHatch();
            S.persistHatches();
          });
          div.appendChild(del);
        }
        grid.appendChild(div);
      });
      if (state2.stencilCat === "custom") {
        const add = document.createElement("div");
        add.className = "stencil add";
        add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        add.addEventListener("click", () => S.fileInputStencil.click());
        grid.appendChild(add);
      }
      if (state2.stencilCat === "hatch") {
        const add = document.createElement("div");
        add.className = "stencil add";
        add.title = "Import hatch (PNG / JPG / SVG)";
        add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        add.addEventListener("click", () => S.fileInputHatch.click());
        grid.appendChild(add);
      }
    };
  }

  // src/engine/app/features/rooms.ts
  function initRooms() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    state2.polyPoints = [];
    state2.polyActive = false;
    S.startPolyTool = function startPolyTool() {
      state2.polyPoints = [];
      state2.polyActive = true;
      $el("poly-hint").style.display = "block";
      S.refreshAreaOverlay();
    };
    S.snapVertex = function snapVertex(p) {
      if (state2.snapEnabled === false) return { x: p.x, y: p.y, snap: null };
      const scale = (state2.zoom || 1) * (state2.baseZoom || 1);
      const thr = 14 / scale;
      let best = null, bestD = thr;
      const consider = (v) => {
        const d = Math.hypot(p.x - v.x, p.y - v.y);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      };
      state2.measurements.forEach((m) => {
        if (m.type === "area" && m.points) m.points.forEach(consider);
      });
      state2.polyPoints.forEach(consider);
      if (state2.wallsVisible !== false) {
        (state2.walls || []).forEach((w) => {
          if (w.pts) w.pts.forEach(consider);
        });
      }
      if (best) return { x: best.x, y: best.y, snap: "corner" };
      if (state2.showGrid && state2.gridType && state2.gridType !== "off") {
        const sp = S.mmToDocPx(state2.gridSpacingMM);
        if (sp > 1) {
          const gx = Math.round(p.x / sp) * sp, gy = Math.round(p.y / sp) * sp;
          if (Math.hypot(p.x - gx, p.y - gy) < thr) return { x: gx, y: gy, snap: "grid" };
        }
      }
      return { x: p.x, y: p.y, snap: null };
    };
    S.flashSnap = function flashSnap(kind) {
      const b = $el("snap-badge");
      if (!b) return;
      b.textContent = kind === "grid" ? "\u2610 GRID SNAP" : "\u2610 CORNER SNAP";
      b.classList.add("show");
      clearTimeout(state2._snapBadgeT);
      state2._snapBadgeT = setTimeout(() => b.classList.remove("show"), 650);
    };
    S.addPolyVertex = function addPolyVertex(p) {
      if (!state2.polyActive) return;
      const s = S.snapVertex(p);
      p = { x: s.x, y: s.y };
      if (s.snap) S.flashSnap(s.snap);
      if (state2.polyPoints.length >= 3) {
        const first = state2.polyPoints[0];
        const dx = p.x - first.x, dy = p.y - first.y;
        const screenDist = Math.sqrt(dx * dx + dy * dy) * state2.zoom * state2.baseZoom;
        if (screenDist < 22) {
          S.closePoly();
          return;
        }
      }
      state2.polyPoints.push({ x: p.x, y: p.y });
      S.refreshAreaOverlay();
    };
    S.closePoly = function closePoly() {
      if (state2.tool === "wall") {
        S.commitWall(true);
        return;
      }
      if (state2.polyPoints.length < 3) return;
      if (state2.tool === "line") {
        S.commitPolygonShape(true);
        return;
      }
      const area = S.shoelaceArea(state2.polyPoints);
      const areaLabel = S.formatArea(area);
      const roomName = "Room " + (state2.measurements.filter((m) => m.type === "area").length + 1);
      const __b = S.vectorSnapshot();
      state2.measurements.push({
        type: "area",
        name: roomName,
        points: [...state2.polyPoints],
        label: areaLabel,
        x1: state2.polyPoints[0].x,
        y1: state2.polyPoints[0].y,
        x2: state2.polyPoints[0].x,
        y2: state2.polyPoints[0].y
      });
      state2.polyPoints = [];
      state2.polyActive = false;
      $el("poly-hint").style.display = "none";
      S.refreshMeasurements();
      S.renderSchedule();
      S.recordVec(__b);
      S.showHint(`${roomName}: ${areaLabel}`);
    };
    S.finishPoly = function finishPoly() {
      if (state2.tool === "wall") {
        if (state2.polyPoints.length >= 2) S.commitWall(false);
        else S.cancelPoly();
        return;
      }
      if (state2.tool === "line") {
        if (state2.polyPoints.length >= 3) S.commitPolygonShape(true);
        else if (state2.polyPoints.length === 2) S.commitPolygonShape(false);
        else S.cancelPoly();
      } else if (state2.polyPoints.length >= 3) {
        S.closePoly();
      }
    };
    S.commitWall = function commitWall(closed) {
      const pts = state2.polyPoints.slice();
      if (pts.length < 2) {
        S.cancelPoly();
        return;
      }
      if (closed && pts.length >= 3 && (pts[0].x !== pts[pts.length - 1].x || pts[0].y !== pts[pts.length - 1].y)) {
        pts.push({ x: pts[0].x, y: pts[0].y });
      }
      const __b = S.vectorSnapshot();
      const wall = { pts, thickMM: state2.wallThickMM, heightM: state2.wallHeightM };
      S.ensureWallId(wall);
      wall.name = "Wall " + ((state2.walls || []).length + 1);
      state2.walls.push(wall);
      const l = S.activeLayer();
      if (l && l.ctx) {
        l.ctx.save();
        l.ctx.globalCompositeOperation = "source-over";
        l.ctx.globalAlpha = state2.alpha;
        l.ctx.strokeStyle = state2.color;
        l.ctx.lineWidth = Math.max(1, state2.size);
        l.ctx.lineCap = "round";
        l.ctx.lineJoin = "round";
        l.ctx.beginPath();
        l.ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) l.ctx.lineTo(pts[i].x, pts[i].y);
        l.ctx.stroke();
        l.ctx.restore();
        S.saveSnapshot(l);
      }
      state2.polyPoints = [];
      state2.polyActive = false;
      $el("poly-hint").style.display = "none";
      S.refreshMeasurements();
      S.syncWallsToMasses();
      S.registerWallInLayerPanel(wall);
      S.recordVec(__b);
      S.scheduleAutosave();
      S.showHint(`Wall added \xB7 ${state2.wallThickMM} mm \xD7 ${state2.wallHeightM} m \xB7 view in 3D`);
    };
    S.cancelPoly = function cancelPoly() {
      state2.polyPoints = [];
      state2.polyActive = false;
      const ph = $el("poly-hint");
      if (ph) ph.style.display = "none";
      S.refreshMeasurements();
    };
    S.commitPolygonShape = function commitPolygonShape(closed) {
      const pts = state2.polyPoints.slice();
      if (pts.length < 2) {
        S.cancelPoly();
        return;
      }
      const isPolygon = closed && pts.length >= 3;
      const entity = { kind: "polygon", pts: pts.map((p) => ({ x: p.x, y: p.y })), closed: !!closed, stroke: state2.color, width: Math.max(0.5, state2.size) };
      const __b = S.vectorSnapshot();
      S.pushShapeEntity(entity);
      S.recordVec(__b);
      S.scheduleAutosave();
      const l = S.activeLayer();
      l.ctx.save();
      l.ctx.globalCompositeOperation = "source-over";
      l.ctx.globalAlpha = state2.alpha;
      l.ctx.strokeStyle = state2.color;
      l.ctx.lineWidth = Math.max(0.5, state2.size);
      l.ctx.lineCap = "round";
      l.ctx.lineJoin = "round";
      l.ctx.beginPath();
      l.ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) l.ctx.lineTo(pts[i].x, pts[i].y);
      if (isPolygon) l.ctx.closePath();
      l.ctx.stroke();
      l.ctx.restore();
      S.saveSnapshot(l);
      state2.polyPoints = [];
      state2.polyActive = false;
      const ph = $el("poly-hint");
      if (ph) ph.style.display = "none";
      S.refreshMeasurements();
      S.renderLayers();
      if (isPolygon && typeof S.onShapeCommitted === "function") {
        S.onShapeCommitted({ kind: "polygon", pts }, state2._lastPolyClient);
      }
      S.showHint(isPolygon ? "Polygon placed" : "Line placed");
    };
    S.shoelaceArea = function shoelaceArea(pts) {
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
      }
      return Math.abs(area) / 2;
    };
    S.perimeterPx = function perimeterPx(pts, closed = true) {
      if (!pts || pts.length < 2) return 0;
      let per = 0;
      const n = pts.length;
      const last = closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        per += Math.hypot(b.x - a.x, b.y - a.y);
      }
      return per;
    };
    S.formatArea = function formatArea(areaPx2) {
      if (state2.pxPerUnit && state2.scaleUnit) {
        const u = state2.scaleUnit;
        const unitInMm = { mm: 1, cm: 10, m: 1e3, in: 25.4, ft: 304.8 }[u] || 1;
        const mmPerPx = unitInMm / state2.pxPerUnit;
        const areaMm22 = areaPx2 * mmPerPx * mmPerPx;
        if (u === "in" || u === "ft") {
          const ft2 = areaMm22 / 92903.04;
          if (ft2 >= 1) return `${ft2.toFixed(2)} ft\xB2`;
          return `${(areaMm22 / 645.16).toFixed(1)} in\xB2`;
        }
        const m2 = areaMm22 / 1e6;
        if (m2 >= 1) return `${m2.toFixed(2)} m\xB2`;
        const cm2 = areaMm22 / 100;
        if (cm2 >= 1) return `${cm2.toFixed(1)} cm\xB2`;
        return `${areaMm22.toFixed(0)} mm\xB2`;
      }
      const docPxPerMm = S.doc.wPx / S.doc.wMM;
      const areaMm2 = areaPx2 / (docPxPerMm * docPxPerMm);
      return `${(areaMm2 / 100).toFixed(0)} cm\xB2 (est.)`;
    };
    S.formatLen = function formatLen(px) {
      if (state2.pxPerUnit && state2.scaleUnit) {
        const u = state2.scaleUnit;
        const unitInMm = { mm: 1, cm: 10, m: 1e3, in: 25.4, ft: 304.8 }[u] || 1;
        const mm = px / state2.pxPerUnit * unitInMm;
        if (u === "in" || u === "ft") {
          const ft = mm / 304.8;
          if (ft >= 1) return `${ft.toFixed(2)} ft`;
          return `${(mm / 25.4).toFixed(1)} in`;
        }
        const m = mm / 1e3;
        if (m >= 1) return `${m.toFixed(2)} m`;
        const cm = mm / 10;
        if (cm >= 1) return `${cm.toFixed(1)} cm`;
        return `${mm.toFixed(0)} mm`;
      }
      return `${Math.round(px)} px`;
    };
    S.ensureSchedulePanel = function ensureSchedulePanel() {
      if (document.getElementById("room-schedule")) return;
      const style = document.createElement("style");
      style.textContent = `
      #room-schedule{position:fixed;left:68px;bottom:16px;width:290px;max-height:46vh;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.10);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.20);z-index:30;display:none;flex-direction:column;overflow:hidden;}
      #room-schedule.show{display:flex;}
      #rs-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(0,0,0,0.08);}
      #rs-head .t{font-size:12px;font-weight:700;letter-spacing:0.4px;color:#0a0a0a;flex:1;}
      #rs-head button{border:none;background:transparent;cursor:pointer;font-size:14px;color:#666;padding:2px 7px;border-radius:6px;}
      #rs-head button:hover{background:rgba(0,0,0,0.06);}
      #rs-rows{overflow-y:auto;padding:3px 0;}
      .rs-row{display:flex;align-items:center;gap:5px;padding:5px 10px 5px 12px;}
      .rs-row input.nm{flex:1;min-width:0;border:1px solid transparent;background:transparent;font-family:inherit;font-size:12px;font-weight:600;color:#0a0a0a;padding:3px 5px;border-radius:5px;}
      .rs-row input.nm:focus{border-color:#cbcbcb;background:#fff;outline:none;}
      .rs-row .ar{font-family:JetBrains Mono,monospace;font-size:11px;color:#333;white-space:nowrap;}
      .rs-row .vd{font-size:9px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:#888;cursor:pointer;border:1px solid #cbcbcb;border-radius:5px;padding:3px 5px;user-select:none;}
      .rs-row .vd.on{background:#a02835;color:#fff;border-color:#a02835;}
      .rs-row .dl{border:none;background:transparent;color:#b00020;cursor:pointer;font-size:16px;line-height:1;padding:0 3px;}
      .rs-row.void input.nm{text-decoration:line-through;color:#9aa;}
      #rs-foot{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;border-top:1px solid rgba(0,0,0,0.08);}
      #rs-foot .tl{font-size:11px;font-weight:700;letter-spacing:0.6px;color:#666;text-transform:uppercase;}
      #rs-foot .tv{font-family:JetBrains Mono,monospace;font-size:14px;font-weight:700;color:#15803d;}
      #rs-toggle{position:fixed;left:68px;bottom:16px;z-index:29;background:#15803d;color:#fff;border:none;border-radius:20px;padding:9px 15px;font-family:inherit;font-size:12px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(0,0,0,0.22);cursor:pointer;display:none;align-items:center;gap:6px;}
      #rs-toggle.show{display:flex;}
    `;
      document.head.appendChild(style);
      const panel = document.createElement("div");
      panel.id = "room-schedule";
      panel.innerHTML = '<div id="rs-head"><span class="t">Room Schedule</span><button id="rs-collapse" title="Hide">\u25BE</button></div><div id="rs-rows"></div><div id="rs-foot"><span class="tl">Total</span><span class="tv" id="rs-total">\u2014</span></div>';
      document.body.appendChild(panel);
      const toggle = document.createElement("button");
      toggle.id = "rs-toggle";
      document.body.appendChild(toggle);
      $el("rs-collapse").addEventListener("click", () => {
        state2._scheduleHidden = true;
        S.renderSchedule();
      });
      toggle.addEventListener("click", () => {
        state2._scheduleHidden = false;
        S.renderSchedule();
      });
    };
    S.scheduleAreaRooms = function scheduleAreaRooms() {
      return state2.measurements.map((m, i) => ({ m, i })).filter((o) => o.m.type === "area" && o.m.points && o.m.points.length >= 3);
    };
    S.renderSchedule = function renderSchedule() {
      S.ensureSchedulePanel();
      const panel = $el("room-schedule");
      const toggle = $el("rs-toggle");
      const rows = $el("rs-rows");
      const rooms = S.scheduleAreaRooms();
      if (rooms.length === 0) {
        panel.classList.remove("show");
        toggle.classList.remove("show");
        rows.innerHTML = "";
        return;
      }
      rows.innerHTML = "";
      let totalPx2 = 0;
      rooms.forEach(({ m, i }) => {
        const a = S.shoelaceArea(m.points);
        if (!m.void) totalPx2 += a;
        const row = document.createElement("div");
        row.className = "rs-row" + (m.void ? " void" : "");
        const nm = document.createElement("input");
        nm.className = "nm";
        nm.value = m.name || "Room " + (i + 1);
        nm.setAttribute("aria-label", "Room name");
        nm.addEventListener("input", () => {
          m.name = nm.value;
        });
        nm.addEventListener("change", () => {
          m.name = nm.value;
          S.refreshMeasurements();
          S.scheduleAutosave();
        });
        const ar = document.createElement("span");
        ar.className = "ar";
        ar.innerHTML = S.formatArea(a) + ' <span style="color:#9aa;font-weight:400;">\xB7 ' + S.formatLen(S.perimeterPx(m.points)) + "</span>";
        const vd = document.createElement("span");
        vd.className = "vd" + (m.void ? " on" : "");
        vd.textContent = "void";
        vd.title = "Subtract from total (courtyard, shaft, etc.)";
        vd.addEventListener("click", () => {
          m.void = !m.void;
          S.refreshMeasurements();
          S.renderSchedule();
          S.scheduleAutosave();
        });
        const dl = document.createElement("button");
        dl.className = "dl";
        dl.textContent = "\xD7";
        dl.title = "Delete room";
        dl.addEventListener("click", () => {
          S.deleteMeasurement(i);
        });
        row.append(nm, ar, vd, dl);
        rows.appendChild(row);
      });
      $el("rs-total").textContent = S.formatArea(Math.max(0, totalPx2));
      if (state2._scheduleHidden) {
        panel.classList.remove("show");
        toggle.textContent = "Schedule (" + rooms.length + ")";
        toggle.classList.add("show");
      } else {
        panel.classList.add("show");
        toggle.classList.remove("show");
      }
    };
    S.wallThickPx = function wallThickPx(w) {
      return Math.max(2, w.thickMM / 1e3 * S.pxPerMetre());
    };
    S._SVGNS = "http://www.w3.org/2000/svg";
    S._ovLine = function _ovLine(x1, y1, x2, y2, stroke, wdt, dash) {
      const l = document.createElementNS(S._SVGNS, "line");
      l.setAttribute("x1", String(x1));
      l.setAttribute("y1", String(y1));
      l.setAttribute("x2", String(x2));
      l.setAttribute("y2", String(y2));
      l.setAttribute("stroke", stroke);
      l.setAttribute("stroke-width", String(wdt));
      l.setAttribute("stroke-linecap", "round");
      if (dash) l.setAttribute("stroke-dasharray", dash);
      S.rulerOverlay.appendChild(l);
    };
    S.drawDoorSymbol = function drawDoorSymbol(o, J0, J1, px, py, col) {
      const Wpx = Math.hypot(J1.x - J0.x, J1.y - J0.y);
      const hand = o.hand >= 0 ? 1 : -1, sw = o.swing >= 0 ? 1 : -1;
      const H = hand > 0 ? J0 : J1, O = hand > 0 ? J1 : J0;
      const tip = { x: H.x + px * sw * Wpx, y: H.y + py * sw * Wpx };
      S._ovLine(H.x, H.y, tip.x, tip.y, col, 1.6);
      const a0 = Math.atan2(O.y - H.y, O.x - H.x), a1 = Math.atan2(tip.y - H.y, tip.x - H.x);
      let da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      let d = `M ${O.x} ${O.y}`;
      for (let k = 1; k <= 16; k++) {
        const ang = a0 + da * (k / 16);
        d += ` L ${H.x + Math.cos(ang) * Wpx} ${H.y + Math.sin(ang) * Wpx}`;
      }
      const arc = document.createElementNS(S._SVGNS, "path");
      arc.setAttribute("d", d);
      arc.setAttribute("fill", "none");
      arc.setAttribute("stroke", "#9a9a9a");
      arc.setAttribute("stroke-width", "1");
      arc.setAttribute("stroke-dasharray", "4 3");
      S.rulerOverlay.appendChild(arc);
    };
    S.drawWindowSymbol = function drawWindowSymbol(o, J0, J1, px, py, h, col) {
      S._ovLine(J0.x + px * h, J0.y + py * h, J1.x + px * h, J1.y + py * h, col, 1.2);
      S._ovLine(J0.x - px * h, J0.y - py * h, J1.x - px * h, J1.y - py * h, col, 1.2);
      const g = h * 0.42;
      S._ovLine(J0.x + px * g, J0.y + py * g, J1.x + px * g, J1.y + py * g, "#4a6b8a", 1);
      S._ovLine(J0.x - px * g, J0.y - py * g, J1.x - px * g, J1.y - py * g, "#4a6b8a", 1);
    };
    S.renderOneWall = function renderOneWall(w, svgns, wi) {
      const pts = w.pts;
      if (!pts || pts.length < 2) return;
      const tPx = S.wallThickPx(w), h = tPx / 2;
      const n = pts.length;
      const closed = n > 2 && pts[0].x === pts[n - 1].x && pts[0].y === pts[n - 1].y;
      const segs = n - 1;
      const ppm = S.pxPerMetre();
      const selW = state2.sel && state2.sel.type === "wall" && state2.sel.wi === wi;
      const wFill = selW ? "rgba(160,40,53,0.32)" : "rgba(48,48,52,0.82)";
      const wcol = selW ? "#a02835" : "#161616";
      for (let i = 0; i < segs; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, segLen = Math.hypot(dx, dy) || 1e-6;
        const ux = dx / segLen, uy = dy / segLen, px = -uy, py = ux;
        const sIn = closed || i > 0, eIn = closed || i < segs - 1;
        const ops = (w.openings || []).map((o, idx) => ({ o, idx })).filter((x) => x.o.seg === i).map((x) => {
          const half = x.o.wMM / 1e3 * ppm / 2, c = x.o.t * segLen;
          return { o: x.o, idx: x.idx, d0: Math.max(0, c - half), d1: Math.min(segLen, c + half) };
        }).sort((A, B) => A.d0 - B.d0);
        const spans = [];
        let cur = 0;
        ops.forEach((op) => {
          if (op.d0 > cur) spans.push([cur, op.d0]);
          cur = Math.max(cur, op.d1);
        });
        if (cur < segLen) spans.push([cur, segLen]);
        spans.forEach(([s0, s1]) => {
          const startJoint = s0 <= 0.01 && sIn, endJoint = s1 >= segLen - 0.01 && eIn;
          const pax = a.x + ux * (s0 - (startJoint ? h : 0)), pay = a.y + uy * (s0 - (startJoint ? h : 0));
          const pbx = a.x + ux * (s1 + (endJoint ? h : 0)), pby = a.y + uy * (s1 + (endJoint ? h : 0));
          const poly = document.createElementNS(svgns, "polygon");
          poly.setAttribute("points", `${pax + px * h},${pay + py * h} ${pbx + px * h},${pby + py * h} ${pbx - px * h},${pby - py * h} ${pax - px * h},${pay - py * h}`);
          poly.setAttribute("fill", wFill);
          poly.setAttribute("stroke", "none");
          S.rulerOverlay.appendChild(poly);
          const ls = s0 + (startJoint ? h : 0), le = s1 - (endJoint ? h : 0);
          const Ax = a.x + ux * ls, Ay = a.y + uy * ls, Bx = a.x + ux * le, By = a.y + uy * le;
          S._ovLine(Ax + px * h, Ay + py * h, Bx + px * h, By + py * h, wcol, 1.5);
          S._ovLine(Ax - px * h, Ay - py * h, Bx - px * h, By - py * h, wcol, 1.5);
          if (s0 <= 0.01 && !sIn) S._ovLine(a.x + px * h, a.y + py * h, a.x - px * h, a.y - py * h, wcol, 1.5);
          if (s1 >= segLen - 0.01 && !eIn) S._ovLine(b.x + px * h, b.y + py * h, b.x - px * h, b.y - py * h, wcol, 1.5);
        });
        ops.forEach((op) => {
          const sel = state2.selOpening2D && state2.selOpening2D.wi === wi && state2.selOpening2D.idx === op.idx;
          const col = sel ? "#a02835" : "#161616";
          const J0 = { x: a.x + ux * op.d0, y: a.y + uy * op.d0 }, J1 = { x: a.x + ux * op.d1, y: a.y + uy * op.d1 };
          S._ovLine(J0.x + px * h, J0.y + py * h, J0.x - px * h, J0.y - py * h, col, 1.6);
          S._ovLine(J1.x + px * h, J1.y + py * h, J1.x - px * h, J1.y - py * h, col, 1.6);
          if (op.o.kind === "door") S.drawDoorSymbol(op.o, J0, J1, px, py, col);
          else S.drawWindowSymbol(op.o, J0, J1, px, py, h, col);
        });
      }
    };
    S.renderShapes2D = function renderShapes2D() {
      const svgns = "http://www.w3.org/2000/svg";
      (state2.shapes || []).forEach((sh, si) => {
        const selSh = state2.sel && state2.sel.type === "shape" && (state2.sel.idx === si || state2.sel.id && sh.id && state2.sel.id === sh.id);
        const stroke = selSh ? "#a02835" : sh.stroke || "#1c1a18";
        const w = sh.width || 2;
        const clipId = "shclip_" + si;
        if (sh.bgImage) {
          const defs = document.createElementNS(svgns, "defs");
          const clip = document.createElementNS(svgns, "clipPath");
          clip.setAttribute("id", clipId);
          if (sh.kind === "ellipse") {
            const c = document.createElementNS(svgns, "ellipse");
            c.setAttribute("cx", String(sh.cx));
            c.setAttribute("cy", String(sh.cy));
            c.setAttribute("rx", String(sh.rx));
            c.setAttribute("ry", String(sh.ry));
            clip.appendChild(c);
          } else if (sh.pts && sh.pts.length >= 3) {
            const c = document.createElementNS(svgns, "polygon");
            c.setAttribute("points", sh.pts.map((p) => `${p.x},${p.y}`).join(" "));
            clip.appendChild(c);
          }
          defs.appendChild(clip);
          S.rulerOverlay.appendChild(defs);
          let bx, by, bw, bh;
          if (sh.kind === "ellipse") {
            bx = sh.cx - sh.rx;
            by = sh.cy - sh.ry;
            bw = sh.rx * 2;
            bh = sh.ry * 2;
          } else {
            const xs = sh.pts.map((p) => p.x), ys = sh.pts.map((p) => p.y);
            bx = Math.min(...xs);
            by = Math.min(...ys);
            bw = Math.max(...xs) - bx;
            bh = Math.max(...ys) - by;
          }
          const img = document.createElementNS(svgns, "image");
          img.setAttribute("href", sh.bgImage);
          img.setAttributeNS("http://www.w3.org/1999/xlink", "href", sh.bgImage);
          img.setAttribute("x", String(bx));
          img.setAttribute("y", String(by));
          img.setAttribute("width", String(bw));
          img.setAttribute("height", String(bh));
          img.setAttribute("preserveAspectRatio", "xMidYMid slice");
          img.setAttribute("clip-path", "url(#" + clipId + ")");
          S.rulerOverlay.appendChild(img);
        }
        if (sh.kind === "ellipse") {
          const el = document.createElementNS(svgns, "ellipse");
          el.setAttribute("cx", String(sh.cx));
          el.setAttribute("cy", String(sh.cy));
          el.setAttribute("rx", String(sh.rx));
          el.setAttribute("ry", String(sh.ry));
          el.setAttribute("fill", "none");
          el.setAttribute("stroke", stroke);
          el.setAttribute("stroke-width", String(w));
          S.rulerOverlay.appendChild(el);
        } else {
          const pts = sh.pts || [];
          if (pts.length < 2) return;
          const tag = sh.closed || sh.kind === "rect" ? "polygon" : "polyline";
          const el = document.createElementNS(svgns, tag);
          el.setAttribute("points", pts.map((p) => `${p.x},${p.y}`).join(" "));
          el.setAttribute("fill", "none");
          el.setAttribute("stroke", stroke);
          el.setAttribute("stroke-width", String(w));
          el.setAttribute("stroke-linejoin", "round");
          el.setAttribute("stroke-linecap", "round");
          S.rulerOverlay.appendChild(el);
        }
      });
    };
    S.renderWalls2D = function renderWalls2D() {
      if (state2.wallsVisible === false) return;
      if (!state2.walls || !state2.walls.length) return;
      const svgns = S._SVGNS;
      state2.walls.forEach((w, wi) => S.renderOneWall(w, svgns, wi));
    };
    S.syncWallsToMasses = function syncWallsToMasses() {
      if (typeof S.massing === "undefined" || !S.massing.masses) return;
      const anchor = S.massing.baseAnchor || { px: S.doc.wPx / 2, py: S.doc.hPx / 2, ppm: S.pxPerMetre() };
      const ax = anchor.px, ay = anchor.py, ppm = anchor.ppm || S.pxPerMetre();
      const saved = {};
      S.massing.masses.forEach((m) => {
        if (m._fromWall && m._wallKey) saved[m._wallKey] = { faceRegions: m.faceRegions, faceArt: m.faceArt, faceMat: m.faceMat, _faceImg: m._faceImg };
      });
      S.massing.masses = S.massing.masses.filter((m) => !m._fromWall);
      (state2.walls || []).forEach((w, wi) => {
        const tW = (w.thickMM || 230) / 1e3;
        const pts = w.pts;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = { x: (pts[i].x - ax) / ppm, z: (pts[i].y - ay) / ppm };
          const b = { x: (pts[i + 1].x - ax) / ppm, z: (pts[i + 1].y - ay) / ppm };
          const mass = { poly: S.wallSegPoly(a, b, tW), h: w.heightM || 3, _wall: true, _fromWall: true, _wallKey: wi + ":" + i };
          const segOps = (w.openings || []).filter((o) => o.seg === i);
          if (segOps.length) {
            const segLenW = Math.hypot(b.x - a.x, b.z - a.z), massLen = segLenW + tW;
            mass.openings = segOps.map((o) => {
              const u = Math.min(0.97, Math.max(0.03, (o.t * segLenW + tW / 2) / massLen));
              return { kind: o.kind, u, w: o.wMM / 1e3, h: o.hMM / 1e3, sill: o.sillMM / 1e3 };
            });
          }
          const sv = saved[mass._wallKey];
          if (sv) {
            if (sv.faceRegions) mass.faceRegions = sv.faceRegions;
            if (sv.faceArt) mass.faceArt = sv.faceArt;
            if (sv.faceMat) mass.faceMat = sv.faceMat;
            if (sv._faceImg) mass._faceImg = sv._faceImg;
          }
          S.massing.masses.push(mass);
        }
      });
    };
    S.wallSegHit = function wallSegHit(p) {
      if (state2.wallsVisible === false) return null;
      let best = null;
      (state2.walls || []).forEach((w, wi) => {
        const tPx = S.wallThickPx(w);
        for (let i = 0; i < w.pts.length - 1; i++) {
          const a = w.pts[i], b = w.pts[i + 1];
          const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
          let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
          t = Math.max(0, Math.min(1, t));
          const cx = a.x + dx * t, cy = a.y + dy * t, d = Math.hypot(p.x - cx, p.y - cy);
          if (d < tPx / 2 + 14 && (!best || d < best.d)) best = { wi, seg: i, t, d, segLen: Math.hypot(dx, dy) };
        }
      });
      return best;
    };
    S.openingDims = function openingDims(kind) {
      return kind === "door" ? { wMM: state2.doorWMM, hMM: state2.doorHMM, sillMM: 0 } : { wMM: state2.winWMM, hMM: state2.winHMM, sillMM: state2.winSillMM };
    };
    S.placeOpening2D = function placeOpening2D(p) {
      const hit = S.wallSegHit(p);
      if (!hit) {
        S.showHint("Tap on a wall to place a " + state2.openingKind);
        return;
      }
      const w = state2.walls[hit.wi];
      const dims = S.openingDims(state2.openingKind);
      const halfFrac = dims.wMM / 1e3 * S.pxPerMetre() / 2 / Math.max(1, hit.segLen);
      if (halfFrac >= 0.48) {
        S.showHint("Wall segment too short for this " + state2.openingKind);
        return;
      }
      const t = Math.max(halfFrac + 0.02, Math.min(1 - halfFrac - 0.02, hit.t));
      const __b = S.vectorSnapshot();
      w.openings = w.openings || [];
      w.openings.push({ kind: state2.openingKind, seg: hit.seg, t, wMM: dims.wMM, hMM: dims.hMM, sillMM: dims.sillMM, hand: 1, swing: 1 });
      state2.selOpening2D = { wi: hit.wi, idx: w.openings.length - 1 };
      S.refreshMeasurements();
      S.syncWallsToMasses();
      S.updateOpeningPalette();
      S.recordVec(__b);
      S.scheduleAutosave();
      S.showHint(`${state2.openingKind === "door" ? "Door" : "Window"} placed \xB7 drag to slide \xB7 flip & resize in the bar`);
    };
    S.openingHitTest2D = function openingHitTest2D(p) {
      if (state2.wallsVisible === false) return null;
      let best = null;
      (state2.walls || []).forEach((w, wi) => {
        (w.openings || []).forEach((o, idx) => {
          const a = w.pts[o.seg], b = w.pts[o.seg + 1];
          if (!a || !b) return;
          const cx = a.x + (b.x - a.x) * o.t, cy = a.y + (b.y - a.y) * o.t, d = Math.hypot(p.x - cx, p.y - cy);
          if (d < S.wallThickPx(w) / 2 + 12 && (!best || d < best.d)) best = { wi, idx, d };
        });
      });
      return best ? { wi: best.wi, idx: best.idx } : null;
    };
    S.slideOpening2D = function slideOpening2D(sel, p) {
      var _a;
      const w = state2.walls[sel.wi];
      if (!w) return;
      const o = (_a = w.openings) == null ? void 0 : _a[sel.idx];
      if (!o) return;
      const a = w.pts[o.seg], b = w.pts[o.seg + 1];
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1, segLen = Math.sqrt(len2);
      let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
      const halfFrac = o.wMM / 1e3 * S.pxPerMetre() / 2 / Math.max(1, segLen);
      o.t = Math.max(halfFrac + 0.02, Math.min(1 - halfFrac - 0.02, t));
      S.refreshMeasurements();
      S.syncWallsToMasses();
    };
    S.deleteOpening2D = function deleteOpening2D(sel) {
      const w = state2.walls[sel.wi];
      if (!w || !w.openings) return;
      const __b = S.vectorSnapshot();
      w.openings.splice(sel.idx, 1);
      state2.selOpening2D = null;
      S.refreshMeasurements();
      S.syncWallsToMasses();
      S.updateOpeningPalette();
      S.recordVec(__b);
      S.scheduleAutosave();
    };
    S.selectedOpening2D = function selectedOpening2D() {
      const s = state2.selOpening2D;
      if (!s) return null;
      const w = state2.walls[s.wi];
      return w && w.openings ? w.openings[s.idx] : null;
    };
    S._wall2dPaletteEl = null;
    S.ensureWall2dPalette = function ensureWall2dPalette() {
      if (S._wall2dPaletteEl) return S._wall2dPaletteEl;
      const el = document.createElement("div");
      el.id = "wall2d-palette";
      el.style.cssText = "position:fixed;top:64px;left:50%;transform:translateX(-50%);display:none;gap:12px;align-items:center;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.10);border-radius:10px;padding:7px 13px;box-shadow:0 6px 22px rgba(0,0,0,0.16);z-index:31;font-size:11px;";
      el.innerHTML = '<span style="font-weight:700;letter-spacing:0.5px;color:#a02835;">WALL</span><label style="display:flex;align-items:center;gap:5px;color:#555;">Thick <input id="w2-thick" type="number" min="50" max="600" step="10" value="230" style="width:56px;font-family:inherit;font-size:11px;padding:3px 5px;border:1px solid #ccc;border-radius:5px;"> mm</label><label style="display:flex;align-items:center;gap:5px;color:#555;">Height <input id="w2-height" type="number" min="0.5" max="20" step="0.1" value="3" style="width:52px;font-family:inherit;font-size:11px;padding:3px 5px;border:1px solid #ccc;border-radius:5px;"> m</label>';
      document.body.appendChild(el);
      el.querySelector("#w2-thick").addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        if (v > 0) state2.wallThickMM = v;
      });
      el.querySelector("#w2-height").addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        if (v > 0) state2.wallHeightM = v;
      });
      S._wall2dPaletteEl = el;
      return el;
    };
    S.showWall2dPalette = function showWall2dPalette(show) {
      S.ensureWall2dPalette();
      S._wall2dPaletteEl.style.display = show ? "flex" : "none";
      if (show) {
        S._wall2dPaletteEl.querySelector("#w2-thick").value = state2.wallThickMM;
        S._wall2dPaletteEl.querySelector("#w2-height").value = state2.wallHeightM;
      }
    };
    S._openPaletteEl = null;
    S.ensureOpeningPalette = function ensureOpeningPalette() {
      if (S._openPaletteEl) return S._openPaletteEl;
      const st = document.createElement("style");
      st.textContent = ".op-chip{border:1px solid #ccc;background:#fff;border-radius:6px;padding:4px 11px;font-size:11px;font-weight:600;cursor:pointer;color:#333;}.op-chip.on{background:#a02835;color:#fff;border-color:#a02835;}.op-mini{border:1px solid #ccc;background:#fff;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;color:#333;}.op-mini:hover{background:#f2f2f2;}";
      document.head.appendChild(st);
      const el = document.createElement("div");
      el.id = "opening-palette";
      el.style.cssText = "position:fixed;top:64px;left:50%;transform:translateX(-50%);display:none;gap:9px;align-items:center;flex-wrap:wrap;max-width:94vw;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.10);border-radius:10px;padding:7px 12px;box-shadow:0 6px 22px rgba(0,0,0,0.16);z-index:31;font-size:11px;";
      el.innerHTML = '<div style="display:flex;gap:4px;"><button id="op-door" class="op-chip">Door</button><button id="op-window" class="op-chip">Window</button></div><label style="display:flex;align-items:center;gap:4px;color:#555;">W <input id="op-w" type="number" step="10" style="width:54px;font-size:11px;padding:3px 4px;border:1px solid #ccc;border-radius:5px;"> mm</label><label style="display:flex;align-items:center;gap:4px;color:#555;">H <input id="op-h" type="number" step="10" style="width:54px;font-size:11px;padding:3px 4px;border:1px solid #ccc;border-radius:5px;"> mm</label><label id="op-sill-l" style="display:flex;align-items:center;gap:4px;color:#555;">Sill <input id="op-sill" type="number" step="10" style="width:50px;font-size:11px;padding:3px 4px;border:1px solid #ccc;border-radius:5px;"> mm</label><button id="op-hinge" class="op-mini">\u21C4 Hinge</button><button id="op-swing" class="op-mini">\u21C5 Swing</button><button id="op-del" class="op-mini" style="color:#b00020;">Delete</button>';
      document.body.appendChild(el);
      el.querySelector("#op-door").onclick = () => {
        state2.openingKind = "door";
        if (S.selectedOpening2D()) {
          const __b = S.vectorSnapshot();
          S.selectedOpening2D().kind = "door";
          S.refreshMeasurements();
          S.syncWallsToMasses();
          S.recordVec(__b, true);
        }
        S.updateOpeningPalette();
      };
      el.querySelector("#op-window").onclick = () => {
        state2.openingKind = "window";
        if (S.selectedOpening2D()) {
          const __b = S.vectorSnapshot();
          S.selectedOpening2D().kind = "window";
          S.refreshMeasurements();
          S.syncWallsToMasses();
          S.recordVec(__b, true);
        }
        S.updateOpeningPalette();
      };
      el.querySelector("#op-w").addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        if (!(v > 0)) return;
        const o = S.selectedOpening2D();
        const __b = o ? S.vectorSnapshot() : null;
        if (o) o.wMM = v;
        else if (state2.openingKind === "door") state2.doorWMM = v;
        else state2.winWMM = v;
        S.refreshMeasurements();
        S.syncWallsToMasses();
        if (__b) S.recordVec(__b, true);
      });
      el.querySelector("#op-h").addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        if (!(v > 0)) return;
        const o = S.selectedOpening2D();
        const __b = o ? S.vectorSnapshot() : null;
        if (o) o.hMM = v;
        else if (state2.openingKind === "door") state2.doorHMM = v;
        else state2.winHMM = v;
        S.syncWallsToMasses();
        if (__b) S.recordVec(__b, true);
      });
      el.querySelector("#op-sill").addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        if (!(v >= 0)) return;
        const o = S.selectedOpening2D();
        const __b = o ? S.vectorSnapshot() : null;
        if (o) o.sillMM = v;
        else state2.winSillMM = v;
        S.syncWallsToMasses();
        if (__b) S.recordVec(__b, true);
      });
      el.querySelector("#op-hinge").onclick = () => {
        const o = S.selectedOpening2D();
        if (o) {
          const __b = S.vectorSnapshot();
          o.hand = -(o.hand || 1);
          S.refreshMeasurements();
          S.recordVec(__b, true);
        }
      };
      el.querySelector("#op-swing").onclick = () => {
        const o = S.selectedOpening2D();
        if (o) {
          const __b = S.vectorSnapshot();
          o.swing = -(o.swing || 1);
          S.refreshMeasurements();
          S.recordVec(__b, true);
        }
      };
      el.querySelector("#op-del").onclick = () => {
        if (state2.selOpening2D) S.deleteOpening2D(state2.selOpening2D);
      };
      S._openPaletteEl = el;
      return el;
    };
    S.showOpeningPalette = function showOpeningPalette(show) {
      S.ensureOpeningPalette();
      S._openPaletteEl.style.display = show ? "flex" : "none";
      if (show) S.updateOpeningPalette();
    };
    S.updateOpeningPalette = function updateOpeningPalette() {
      if (!S._openPaletteEl) return;
      const o = S.selectedOpening2D();
      const kind = o ? o.kind : state2.openingKind;
      S._openPaletteEl.querySelector("#op-door").classList.toggle("on", kind === "door");
      S._openPaletteEl.querySelector("#op-window").classList.toggle("on", kind === "window");
      const dims = o ? { wMM: o.wMM, hMM: o.hMM, sillMM: o.sillMM } : S.openingDims(kind);
      S._openPaletteEl.querySelector("#op-w").value = dims.wMM;
      S._openPaletteEl.querySelector("#op-h").value = dims.hMM;
      S._openPaletteEl.querySelector("#op-sill").value = dims.sillMM || 0;
      S._openPaletteEl.querySelector("#op-sill-l").style.display = kind === "window" ? "flex" : "none";
      S._openPaletteEl.querySelector("#op-hinge").style.display = kind === "door" ? "inline-block" : "none";
      S._openPaletteEl.querySelector("#op-swing").style.display = kind === "door" ? "inline-block" : "none";
      S._openPaletteEl.querySelector("#op-del").style.display = o ? "inline-block" : "none";
    };
    S._distToSeg = function _distToSeg(p, a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
      let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
    };
    S.measurementHit = function measurementHit(p) {
      let best = null;
      (state2.measurements || []).forEach((m, idx) => {
        if (m.type === "area" || m.x1 == null) return;
        const d = S._distToSeg(p, { x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 });
        if (d < 12 && (!best || d < best.d)) best = { idx, type: "dim", d };
      });
      if (best) return best;
      for (let idx = (state2.measurements || []).length - 1; idx >= 0; idx--) {
        const m = state2.measurements[idx];
        if (m.type === "area" && m.points && m.points.length >= 3 && S.pointInPoly(p.x, p.y, m.points)) return { idx, type: "area" };
      }
      return null;
    };
    S.selectEntityAt = function selectEntityAt(p) {
      const op = S.openingHitTest2D(p);
      if (op) {
        state2.sel = { type: "opening", wi: op.wi, idx: op.idx };
        state2.selOpening2D = op;
        S.showSelectBar(null);
        S.showOpeningPalette(true);
        S.updateOpeningPalette();
        S.syncSelectionManagerFromLegacy("canvas");
        S.refreshMeasurements();
        S.showHint("Door / Window selected \u2014 edit in the bar");
        return true;
      }
      const wh = S.wallSegHit(p);
      if (wh) {
        state2.sel = { type: "wall", wi: wh.wi };
        state2.selOpening2D = null;
        S.showOpeningPalette(false);
        S.showSelectBar("wall");
        S.syncSelectionManagerFromLegacy("canvas");
        S.refreshMeasurements();
        S.showHint("Wall selected \u2014 edit thickness / height or delete");
        return true;
      }
      for (let i = (state2.shapes || []).length - 1; i >= 0; i--) {
        if (S.shapeHit(state2.shapes[i], p)) {
          const sh = state2.shapes[i];
          const id = S.ensureShapeId(sh);
          if (S.__ix && S.__ix.capabilityRegistry && !S.__ix.capabilityRegistry.get("shape").selectable) {
            break;
          }
          state2.sel = { type: "shape", idx: i, id };
          state2.selOpening2D = null;
          S.showOpeningPalette(false);
          S.showSelectBar("shape");
          S.syncSelectionManagerFromLegacy("canvas");
          S.refreshMeasurements();
          S.showHint("Shape selected \u2014 edit width or delete");
          return true;
        }
      }
      const mh = S.measurementHit(p);
      if (mh) {
        state2.selOpening2D = null;
        S.showOpeningPalette(false);
        if (mh.type === "area") {
          state2.sel = { type: "room", idx: mh.idx };
          S.showSelectBar("room");
          S.showHint("Room selected");
        } else {
          state2.sel = { type: "dim", idx: mh.idx };
          S.showSelectBar("dim");
          S.showHint("Dimension selected");
        }
        S.syncSelectionManagerFromLegacy("canvas");
        S.refreshMeasurements();
        return true;
      }
      state2.sel = null;
      state2.selOpening2D = null;
      S.showOpeningPalette(false);
      S.showSelectBar(null);
      S.syncSelectionManagerFromLegacy("canvas");
      S.refreshMeasurements();
      S.showHint("Nothing here \u2014 tap a wall, door, window, or room");
      return false;
    };
    S.deleteWall = function deleteWall(wi) {
      if (!state2.walls || !state2.walls[wi]) return;
      const __b = S.vectorSnapshot();
      state2.walls.splice(wi, 1);
      state2.sel = null;
      state2.selOpening2D = null;
      state2._panelSelectedObjectId = null;
      S.showSelectBar(null);
      S.syncSceneObjectsToEngine();
      S.refreshMeasurements();
      S.syncWallsToMasses();
      S.recordVec(__b);
      S.scheduleAutosave();
      S.renderLayers();
      S.showHint("Wall deleted");
    };
    S._selBarEl = null;
    S.ensureSelectBar = function ensureSelectBar() {
      if (S._selBarEl) return S._selBarEl;
      const el = document.createElement("div");
      el.id = "select-bar";
      el.style.cssText = "position:fixed;top:64px;left:50%;transform:translateX(-50%);display:none;gap:10px;align-items:center;flex-wrap:wrap;max-width:94vw;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.10);border-radius:10px;padding:7px 13px;box-shadow:0 6px 22px rgba(0,0,0,0.16);z-index:1600;font-size:11px;";
      document.body.appendChild(el);
      S._selBarEl = el;
      return el;
    };
    S.showSelectBar = function showSelectBar(type) {
      S.ensureSelectBar();
      const el = S._selBarEl, sel = state2.sel;
      if (!type || type === "opening" || !sel) {
        el.style.display = "none";
        el.innerHTML = "";
        return;
      }
      const inp = "font-family:inherit;font-size:11px;padding:3px 5px;border:1px solid #ccc;border-radius:5px;";
      const tag = (t) => `<span style="font-weight:700;letter-spacing:0.5px;color:#a02835;">${t}</span>`;
      if (type === "wall") {
        const w = state2.walls[sel.wi];
        if (!w) {
          el.style.display = "none";
          return;
        }
        el.innerHTML = tag("WALL") + `<label style="display:flex;align-items:center;gap:5px;color:#555;">Thick <input id="se-thick" type="number" min="50" max="600" step="10" style="width:56px;${inp}"> mm</label><label style="display:flex;align-items:center;gap:5px;color:#555;">Height <input id="se-height" type="number" min="0.5" max="20" step="0.1" style="width:52px;${inp}"> m</label><button id="se-move" class="op-mini">Move</button><button id="se-scale" class="op-mini">Scale</button><button id="se-rotate" class="op-mini">Rotate</button><button id="se-img" class="op-mini">Image</button><button id="se-del" class="op-mini" style="color:#b00020;">Delete</button>`;
        el.querySelector("#se-thick").value = w.thickMM || 230;
        el.querySelector("#se-height").value = w.heightM || 3;
        el.querySelector("#se-thick").addEventListener("input", (e) => {
          const v = parseFloat(e.target.value);
          if (v > 0) {
            const __b = S.vectorSnapshot();
            w.thickMM = v;
            S.refreshMeasurements();
            S.syncWallsToMasses();
            S.recordVec(__b, true);
            S.scheduleAutosave();
          }
        });
        el.querySelector("#se-height").addEventListener("input", (e) => {
          const v = parseFloat(e.target.value);
          if (v > 0) {
            const __b = S.vectorSnapshot();
            w.heightM = v;
            S.syncWallsToMasses();
            S.recordVec(__b, true);
            S.scheduleAutosave();
          }
        });
        el.querySelector("#se-move").onclick = () => S.beginVecXform("move");
        el.querySelector("#se-scale").onclick = () => S.beginVecXform("scale");
        el.querySelector("#se-rotate").onclick = () => S.beginVecXform("rotate");
        el.querySelector("#se-img").onclick = () => S.addBackgroundImageToSelection();
        el.querySelector("#se-del").onclick = () => S.deleteWall(sel.wi);
      } else if (type === "room") {
        const m = state2.measurements[sel.idx];
        if (!m) {
          el.style.display = "none";
          return;
        }
        el.innerHTML = tag("ROOM") + `<input id="se-name" type="text" style="width:120px;${inp}"><label style="display:flex;align-items:center;gap:5px;color:#555;cursor:pointer;"><input id="se-void" type="checkbox"> Void</label><button id="se-del" class="op-mini" style="color:#b00020;">Delete</button>`;
        el.querySelector("#se-name").value = m.name || "";
        el.querySelector("#se-void").checked = !!m.void;
        el.querySelector("#se-name").addEventListener("input", (e) => {
          const __b = S.vectorSnapshot();
          m.name = e.target.value;
          S.refreshMeasurements();
          if (typeof S.renderSchedule === "function") S.renderSchedule();
          S.recordVec(__b, true);
        });
        el.querySelector("#se-void").addEventListener("change", (e) => {
          const __b = S.vectorSnapshot();
          m.void = e.target.checked;
          S.refreshMeasurements();
          if (typeof S.renderSchedule === "function") S.renderSchedule();
          S.recordVec(__b, true);
        });
        el.querySelector("#se-del").onclick = () => {
          S.deleteMeasurement(sel.idx);
          state2.sel = null;
          S.showSelectBar(null);
          if (typeof S.renderSchedule === "function") S.renderSchedule();
        };
      } else if (type === "dim") {
        const m = state2.measurements[sel.idx];
        if (!m) {
          el.style.display = "none";
          return;
        }
        el.innerHTML = tag("DIMENSION") + `<span style="color:#555;">${m.label || ""}</span><button id="se-del" class="op-mini" style="color:#b00020;">Delete</button>`;
        el.querySelector("#se-del").onclick = () => {
          S.deleteMeasurement(sel.idx);
          state2.sel = null;
          S.showSelectBar(null);
        };
      } else if (type === "shape") {
        const sh = state2.shapes[sel.idx];
        if (!sh) {
          el.style.display = "none";
          return;
        }
        el.innerHTML = tag("SHAPE") + `<span style="color:#999;text-transform:capitalize;">${sh.kind}</span><label style="display:flex;align-items:center;gap:5px;color:#555;">Line <input id="se-sw" type="number" min="0.5" max="40" step="0.5" style="width:52px;${inp}"> px</label><button id="se-move" class="op-mini">Move</button><button id="se-scale" class="op-mini">Scale</button><button id="se-rotate" class="op-mini">Rotate</button><button id="se-img" class="op-mini">Image</button><button id="se-del" class="op-mini" style="color:#b00020;">Delete</button>`;
        el.querySelector("#se-sw").value = sh.width || 2;
        el.querySelector("#se-sw").addEventListener("input", (e) => {
          const v = parseFloat(e.target.value);
          if (v > 0) {
            const __b = S.vectorSnapshot();
            sh.width = v;
            S.refreshMeasurements();
            S.recordVec(__b, true);
            S.scheduleAutosave();
          }
        });
        el.querySelector("#se-move").onclick = () => S.beginVecXform("move");
        el.querySelector("#se-scale").onclick = () => S.beginVecXform("scale");
        el.querySelector("#se-rotate").onclick = () => S.beginVecXform("rotate");
        el.querySelector("#se-img").onclick = () => S.addBackgroundImageToSelection();
        el.querySelector("#se-del").onclick = () => {
          const __b = S.vectorSnapshot();
          state2.shapes.splice(sel.idx, 1);
          state2.sel = null;
          S.syncSelectionManagerFromLegacy("programmatic");
          S.showSelectBar(null);
          S.syncSceneObjectsToEngine();
          S.refreshMeasurements();
          S.recordVec(__b);
          S.scheduleAutosave();
          S.renderLayers();
        };
      } else if (type === "element") {
        el.innerHTML = tag("ELEMENT") + '<button id="se-move" class="op-mini">Move</button><button id="se-scale" class="op-mini">Scale</button><button id="se-rotate" class="op-mini">Rotate</button><button id="se-img" class="op-mini">Image</button><button id="se-group" class="op-mini">Group</button>';
        el.querySelector("#se-move").onclick = () => S.beginVecXform("move");
        el.querySelector("#se-scale").onclick = () => S.beginVecXform("scale");
        el.querySelector("#se-rotate").onclick = () => S.beginVecXform("rotate");
        el.querySelector("#se-img").onclick = () => S.addBackgroundImageToSelection();
        el.querySelector("#se-group").onclick = () => S.groupSelectedElements();
      }
      el.style.display = "flex";
    };
    S.refreshAreaOverlay = function refreshAreaOverlay() {
      S.refreshMeasurements();
      if (!state2.polyActive || state2.polyPoints.length === 0) return;
      const svgns = "http://www.w3.org/2000/svg";
      S.rulerOverlay.setAttribute("viewBox", `0 0 ${S.doc.wPx} ${S.doc.hPx}`);
      const pts = state2.polyPoints;
      if (pts.length >= 3) {
        const fill = document.createElementNS(svgns, "polygon");
        fill.setAttribute("points", pts.map((p) => `${p.x},${p.y}`).join(" "));
        fill.setAttribute("class", "area-fill");
        S.rulerOverlay.appendChild(fill);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const l = document.createElementNS(svgns, "line");
        l.setAttribute("x1", String(pts[i].x));
        l.setAttribute("y1", String(pts[i].y));
        l.setAttribute("x2", String(pts[i + 1].x));
        l.setAttribute("y2", String(pts[i + 1].y));
        l.setAttribute("class", "area-edge");
        S.rulerOverlay.appendChild(l);
      }
      pts.forEach((p, i) => {
        const c = document.createElementNS(svgns, "circle");
        c.setAttribute("cx", String(p.x));
        c.setAttribute("cy", String(p.y));
        c.setAttribute("r", String(i === 0 ? 14 : 9));
        c.setAttribute("class", "area-vertex");
        if (i === 0) {
          c.style.cursor = "pointer";
        }
        S.rulerOverlay.appendChild(c);
      });
      if (pts.length >= 3 && state2.tool === "area") {
        const area = S.shoelaceArea(pts);
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const lbl = S.formatArea(area) + "  \xB7  " + S.formatLen(S.perimeterPx(pts));
        const bg = document.createElementNS(svgns, "rect");
        const bw = lbl.length * 16 + 30;
        bg.setAttribute("x", String(cx - bw / 2));
        bg.setAttribute("y", String(cy - 22));
        bg.setAttribute("width", String(bw));
        bg.setAttribute("height", String(36));
        bg.setAttribute("rx", String(6));
        bg.setAttribute("fill", "#15803d");
        S.rulerOverlay.appendChild(bg);
        const txt = document.createElementNS(svgns, "text");
        txt.setAttribute("x", String(cx));
        txt.setAttribute("y", String(cy + 4));
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("fill", "white");
        txt.setAttribute("font-family", "JetBrains Mono,monospace");
        txt.setAttribute("font-weight", "600");
        txt.setAttribute("font-size", "22");
        txt.setAttribute("pointer-events", "none");
        txt.textContent = lbl;
        S.rulerOverlay.appendChild(txt);
      }
    };
  }

  // src/engine/app/features/dimensions.ts
  function initDimensions() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    state2.dimChainMode = false;
    state2.dimChainEnd = null;
    S.toggleDimChain = function toggleDimChain() {
      state2.dimChainMode = !state2.dimChainMode;
      const btn = $el("btn-dim-chain");
      btn.classList.toggle("chain-active", state2.dimChainMode);
      if (!state2.dimChainMode) state2.dimChainEnd = null;
      S.showHint(state2.dimChainMode ? "Dimension Chain ON \u2014 each measurement starts from the last endpoint" : "Dimension Chain OFF");
    };
    S.addDimSVG = function addDimSVG(m, isPreview, mIndex) {
      const svgns = "http://www.w3.org/2000/svg";
      S.rulerOverlay.setAttribute("viewBox", `0 0 ${S.doc.wPx} ${S.doc.hPx}`);
      if (m.type === "area") {
        S.addAreaSVG(m, mIndex);
        return;
      }
      const color = isPreview ? "#a02835" : "#1d4ed8";
      const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 2) return;
      const nx = -dy / len, ny = dx / len;
      const extLen = 28, tickLen = 12;
      [[m.x1, m.y1], [m.x2, m.y2]].forEach(([x, y]) => {
        const el = document.createElementNS(svgns, "line");
        el.setAttribute("x1", String(x + nx * extLen));
        el.setAttribute("y1", String(y + ny * extLen));
        el.setAttribute("x2", String(x - nx * 6));
        el.setAttribute("y2", String(y - ny * 6));
        el.setAttribute("stroke", color);
        el.setAttribute("stroke-width", "1.5");
        el.setAttribute("pointer-events", "none");
        S.rulerOverlay.appendChild(el);
      });
      const dline = document.createElementNS(svgns, "line");
      dline.setAttribute("x1", String(m.x1 + nx * extLen));
      dline.setAttribute("y1", String(m.y1 + ny * extLen));
      dline.setAttribute("x2", String(m.x2 + nx * extLen));
      dline.setAttribute("y2", String(m.y2 + ny * extLen));
      dline.setAttribute("stroke", color);
      dline.setAttribute("stroke-width", "2");
      dline.setAttribute("pointer-events", "none");
      S.rulerOverlay.appendChild(dline);
      [[m.x1, m.y1], [m.x2, m.y2]].forEach(([x, y]) => {
        const tx = x + nx * extLen, ty = y + ny * extLen;
        const ux = dx / len, uy = dy / len;
        const tick = document.createElementNS(svgns, "line");
        tick.setAttribute("x1", String(tx - ux * tickLen - nx * tickLen / 2));
        tick.setAttribute("y1", String(ty - uy * tickLen - ny * tickLen / 2));
        tick.setAttribute("x2", String(tx + ux * tickLen + nx * tickLen / 2));
        tick.setAttribute("y2", String(ty + uy * tickLen + ny * tickLen / 2));
        tick.setAttribute("stroke", color);
        tick.setAttribute("stroke-width", "2.5");
        tick.setAttribute("pointer-events", "none");
        S.rulerOverlay.appendChild(tick);
      });
      [[m.x1, m.y1], [m.x2, m.y2]].forEach(([x, y]) => {
        const c = document.createElementNS(svgns, "circle");
        c.setAttribute("cx", String(x));
        c.setAttribute("cy", String(y));
        c.setAttribute("r", "7");
        c.setAttribute("fill", color);
        c.setAttribute("pointer-events", "none");
        S.rulerOverlay.appendChild(c);
      });
      const distPx = len;
      let text = S.formatLen(distPx);
      const lx = (m.x1 + m.x2) / 2 + nx * (extLen + 20);
      const ly = (m.y1 + m.y2) / 2 + ny * (extLen + 20);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const readableAngle = angle > 90 || angle < -90 ? angle + 180 : angle;
      const pW = text.length * 15 + (isPreview ? 20 : 60);
      const g = document.createElementNS(svgns, "g");
      g.setAttribute("transform", `rotate(${readableAngle} ${lx} ${ly})`);
      const bg = document.createElementNS(svgns, "rect");
      bg.setAttribute("x", String(lx - pW / 2));
      bg.setAttribute("y", String(ly - 18));
      bg.setAttribute("width", String(pW));
      bg.setAttribute("height", String(34));
      bg.setAttribute("rx", String(5));
      bg.setAttribute("fill", isPreview ? "#a02835" : "#1d4ed8");
      bg.setAttribute("pointer-events", isPreview ? "none" : "auto");
      if (!isPreview && typeof mIndex === "number") bg.dataset.measureIdx = String(mIndex);
      if (!isPreview) {
        bg.style.cursor = "pointer";
        bg.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          e.preventDefault();
          S.deleteMeasurement(mIndex);
        });
      }
      g.appendChild(bg);
      const lbl = document.createElementNS(svgns, "text");
      lbl.setAttribute("x", String(lx - (isPreview ? 0 : 14)));
      lbl.setAttribute("y", String(ly + 6));
      lbl.setAttribute("text-anchor", "middle");
      lbl.setAttribute("fill", "white");
      lbl.setAttribute("font-family", "JetBrains Mono,monospace");
      lbl.setAttribute("font-weight", "600");
      lbl.setAttribute("font-size", "19");
      lbl.setAttribute("pointer-events", "none");
      lbl.textContent = text;
      g.appendChild(lbl);
      if (!isPreview && typeof mIndex === "number") {
        const xHit = document.createElementNS(svgns, "circle");
        xHit.setAttribute("cx", String(lx + pW / 2 - 18));
        xHit.setAttribute("cy", String(ly));
        xHit.setAttribute("r", "16");
        xHit.setAttribute("fill", "transparent");
        xHit.setAttribute("pointer-events", "auto");
        xHit.dataset.measureIdx = String(mIndex);
        xHit.style.cursor = "pointer";
        xHit.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          e.preventDefault();
          S.deleteMeasurement(mIndex);
        });
        g.appendChild(xHit);
        const xBtn = document.createElementNS(svgns, "text");
        xBtn.setAttribute("x", String(lx + pW / 2 - 18));
        xBtn.setAttribute("y", String(ly + 8));
        xBtn.setAttribute("text-anchor", "middle");
        xBtn.setAttribute("fill", "rgba(255,255,255,0.8)");
        xBtn.setAttribute("font-size", "26");
        xBtn.setAttribute("font-family", "sans-serif");
        xBtn.setAttribute("pointer-events", "none");
        xBtn.textContent = "\xD7";
        g.appendChild(xBtn);
      }
      S.rulerOverlay.appendChild(g);
    };
    S.addAreaSVG = function addAreaSVG(m, mIndex) {
      const svgns = "http://www.w3.org/2000/svg";
      if (!m.points || m.points.length < 3) return;
      const fill = document.createElementNS(svgns, "polygon");
      fill.setAttribute("points", m.points.map((p) => `${p.x},${p.y}`).join(" "));
      fill.setAttribute("class", "area-fill");
      fill.setAttribute("pointer-events", "none");
      S.rulerOverlay.appendChild(fill);
      for (let i = 0; i < m.points.length; i++) {
        const j = (i + 1) % m.points.length;
        const l = document.createElementNS(svgns, "line");
        l.setAttribute("x1", String(m.points[i].x));
        l.setAttribute("y1", String(m.points[i].y));
        l.setAttribute("x2", String(m.points[j].x));
        l.setAttribute("y2", String(m.points[j].y));
        l.setAttribute("class", "area-edge");
        l.setAttribute("pointer-events", "none");
        S.rulerOverlay.appendChild(l);
      }
      const cx = m.points.reduce((s, p) => s + p.x, 0) / m.points.length;
      const cy = m.points.reduce((s, p) => s + p.y, 0) / m.points.length;
      const liveLabel = S.formatArea(S.shoelaceArea(m.points));
      const display = (m.name ? m.name + " \xB7 " : "") + liveLabel + (m.void ? "  (void)" : "");
      const pW = display.length * 11 + 50;
      const bg = document.createElementNS(svgns, "rect");
      bg.setAttribute("x", String(cx - pW / 2));
      bg.setAttribute("y", String(cy - 20));
      bg.setAttribute("width", String(pW));
      bg.setAttribute("height", String(34));
      bg.setAttribute("rx", String(6));
      bg.setAttribute("fill", m.void ? "#6b7280" : "#15803d");
      bg.setAttribute("pointer-events", "auto");
      bg.dataset.measureIdx = String(mIndex);
      bg.style.cursor = "pointer";
      bg.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        S.deleteMeasurement(mIndex);
      });
      S.rulerOverlay.appendChild(bg);
      const txt = document.createElementNS(svgns, "text");
      txt.setAttribute("x", String(cx - 14));
      txt.setAttribute("y", String(cy + 3));
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("fill", "white");
      txt.setAttribute("font-family", "JetBrains Mono,monospace");
      txt.setAttribute("font-weight", "600");
      txt.setAttribute("font-size", "17");
      txt.setAttribute("pointer-events", "none");
      txt.textContent = display;
      S.rulerOverlay.appendChild(txt);
      const xHit = document.createElementNS(svgns, "circle");
      xHit.setAttribute("cx", String(cx + pW / 2 - 18));
      xHit.setAttribute("cy", String(cy));
      xHit.setAttribute("r", "16");
      xHit.setAttribute("fill", "transparent");
      xHit.setAttribute("pointer-events", "auto");
      xHit.dataset.measureIdx = String(mIndex);
      xHit.style.cursor = "pointer";
      xHit.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        S.deleteMeasurement(mIndex);
      });
      S.rulerOverlay.appendChild(xHit);
      const xBtn = document.createElementNS(svgns, "text");
      xBtn.setAttribute("x", String(cx + pW / 2 - 18));
      xBtn.setAttribute("y", String(cy + 6));
      xBtn.setAttribute("fill", "rgba(255,255,255,0.8)");
      xBtn.setAttribute("font-size", "26");
      xBtn.setAttribute("font-family", "sans-serif");
      xBtn.setAttribute("pointer-events", "none");
      xBtn.textContent = "\xD7";
      S.rulerOverlay.appendChild(xBtn);
    };
    $el("btn-dim-chain").addEventListener("click", S.toggleDimChain);
  }

  // src/engine/app/features/guides.ts
  function initGuides() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    state2.guideType = "none";
    state2.guideOpacity = 0.35;
    state2.vanishingPoints = [
      { x: S.doc.wPx * 0.5, y: S.doc.hPx * 0.35 },
      // 1pt VP (center)
      { x: -S.doc.wPx * 0.12, y: S.doc.hPx * 0.38 },
      // 2pt VP left (off-sheet, draggable)
      { x: S.doc.wPx * 1.12, y: S.doc.hPx * 0.38 }
      // 2pt VP right
    ];
    state2.draggingVP = null;
    S.drawGuideGrid = function drawGuideGrid() {
      const gc = $el("guide-canvas");
      if (!gc) return;
      gc.width = S.doc.wPx;
      gc.height = S.doc.hPx;
      const ctx = gc.getContext("2d");
      ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      gc.style.opacity = state2.guideOpacity;
      if (state2.guideType === "none") return;
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 1.5;
      if (state2.guideType === "iso") {
        const step = 120;
        const w = S.doc.wPx, h = S.doc.hPx;
        const tan30 = Math.tan(Math.PI / 6);
        ctx.strokeStyle = "rgba(29,78,216,0.5)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(29,78,216,0.8)";
        ctx.lineWidth = 1.2;
        const diagonalStep = step;
        for (let offset = -h * 2; offset < w + h * 2; offset += diagonalStep) {
          ctx.beginPath();
          ctx.moveTo(offset, 0);
          ctx.lineTo(offset + h / tan30, h);
          ctx.stroke();
        }
        for (let offset = -h * 2; offset < w + h * 2; offset += diagonalStep) {
          ctx.beginPath();
          ctx.moveTo(offset, 0);
          ctx.lineTo(offset - h / tan30, h);
          ctx.stroke();
        }
      } else if (state2.guideType === "1pt") {
        const vp = state2.vanishingPoints[0];
        const w = S.doc.wPx, h = S.doc.hPx;
        ctx.strokeStyle = "rgba(29,78,216,0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, vp.y);
        ctx.lineTo(w, vp.y);
        ctx.stroke();
        ctx.strokeStyle = "rgba(29,78,216,0.5)";
        ctx.lineWidth = 1;
        const numLines = 16;
        const corners = [[0, 0], [w, 0], [0, h], [w, h]];
        const extras = [];
        for (let i = 1; i < numLines; i++) {
          extras.push([i / numLines * w, 0]);
          extras.push([i / numLines * w, h]);
        }
        [...corners, ...extras].forEach(([cx, cy]) => {
          ctx.beginPath();
          const dx = cx - vp.x, dy = cy - vp.y;
          const ext = 3;
          ctx.moveTo(vp.x - dx * ext, vp.y - dy * ext);
          ctx.lineTo(vp.x + dx * ext, vp.y + dy * ext);
          ctx.stroke();
        });
        ctx.fillStyle = "#a02835";
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("VP", vp.x, vp.y + 6);
        ctx.strokeStyle = "rgba(29,78,216,0.25)";
        ctx.lineWidth = 1;
        const spacing = 160;
        for (let x = 0; x <= w; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y <= h; y += spacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      } else if (state2.guideType === "2pt") {
        const vp1 = state2.vanishingPoints[1];
        const vp2 = state2.vanishingPoints[2];
        const w = S.doc.wPx, h = S.doc.hPx;
        const horizY = (vp1.y + vp2.y) / 2;
        ctx.strokeStyle = "rgba(29,78,216,0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, horizY);
        ctx.lineTo(w, horizY);
        ctx.stroke();
        ctx.strokeStyle = "rgba(160,40,53,0.45)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 12; i++) {
          const ty = i / 12 * h;
          [ty, h - ty].forEach((cy) => {
            ctx.beginPath();
            const dx = cy - vp1.y === 0 ? 1 : w + vp1.x;
            const dy = cy - vp1.y;
            const t = 4;
            ctx.moveTo(vp1.x - w * t, vp1.y - dy * t);
            ctx.lineTo(vp1.x + w * t, vp1.y + dy * t);
            ctx.stroke();
          });
        }
        ctx.strokeStyle = "rgba(29,78,216,0.45)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 12; i++) {
          const ty = i / 12 * h;
          [ty, h - ty].forEach((cy) => {
            ctx.beginPath();
            const dy = cy - vp2.y;
            const t = 4;
            ctx.moveTo(vp2.x - w * t, vp2.y - dy * t);
            ctx.lineTo(vp2.x + w * t, vp2.y + dy * t);
            ctx.stroke();
          });
        }
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x += 180) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        [vp1, vp2].forEach((vp, i) => {
          ctx.fillStyle = i === 0 ? "#a02835" : "#1d4ed8";
          ctx.beginPath();
          ctx.arc(vp.x, vp.y, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "white";
          ctx.font = "bold 16px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`VP${i + 1}`, vp.x, vp.y + 6);
        });
      }
    };
    S.guidePopover = $el("guide-popover");
    $el("btn-guide").addEventListener("click", (e) => {
      e.stopPropagation();
      if (S.guidePopover.classList.contains("show")) {
        S.guidePopover.classList.remove("show");
        return;
      }
      S.guidePopover.classList.add("show");
    });
    $all(".guide-type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        $all(".guide-type-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state2.guideType = btn.dataset.guide;
        S.drawGuideGrid();
        const hasVP = state2.guideType === "1pt" || state2.guideType === "2pt";
        $el("guide-vp-hint").style.display = hasVP ? "block" : "none";
        S.showHint(state2.guideType === "none" ? "Guide grid off" : `Guide: ${btn.textContent.trim()} \u2014 non-printing`);
      });
    });
    $el("guide-opacity").addEventListener("input", (e) => {
      state2.guideOpacity = parseInt(e.target.value) / 100;
      $el("guide-opacity-v").textContent = e.target.value + "%";
      $el("guide-canvas").style.opacity = state2.guideOpacity;
      if (state2.guideType !== "none") S.drawGuideGrid();
    });
    $el("guide-canvas").addEventListener("pointerdown", (e) => {
      if (state2.guideType !== "1pt" && state2.guideType !== "2pt") return;
      const p = S.clientToCanvas(e.clientX, e.clientY);
      const vps = state2.guideType === "1pt" ? [state2.vanishingPoints[0]] : [state2.vanishingPoints[1], state2.vanishingPoints[2]];
      for (const vp of vps) {
        const dx = p.x - vp.x, dy = p.y - vp.y;
        if (Math.sqrt(dx * dx + dy * dy) < 40) {
          state2.draggingVP = vp;
          $el("guide-canvas").setPointerCapture(e.pointerId);
          e.stopPropagation();
          return;
        }
      }
    });
    $el("guide-canvas").addEventListener("pointermove", (e) => {
      if (!state2.draggingVP) return;
      const p = S.clientToCanvas(e.clientX, e.clientY);
      state2.draggingVP.x = p.x;
      state2.draggingVP.y = p.y;
      S.drawGuideGrid();
    });
    $el("guide-canvas").addEventListener("pointerup", () => {
      state2.draggingVP = null;
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#guide-popover") && !e.target.closest("#btn-guide") && !e.target.closest("#ovf-guide")) {
        S.guidePopover.classList.remove("show");
      }
      if (!e.target.closest("#grid-popover") && !e.target.closest("#ovf-grid")) {
        S.gridPopover.classList.remove("show");
      }
    });
  }

  // src/engine/app/features/index.ts
  function initFeatures() {
    initSnap();
    initHatch();
    initRooms();
    initDimensions();
    initGuides();
  }

  // src/engine/app/walls.ts
  function initWalls() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.wallDefaults = function wallDefaults() {
      if (S.massing.wallThick == null) S.massing.wallThick = 0.2;
      if (S.massing.wallHeight == null) S.massing.wallHeight = 3;
    };
    S.wallSegPoly = function wallSegPoly(a, b, t) {
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1e-6;
      const ux = dx / len, uz = dz / len, px = -uz, pz = ux, h = t / 2;
      const a2 = { x: a.x - ux * h, z: a.z - uz * h }, b2 = { x: b.x + ux * h, z: b.z + uz * h };
      return [
        { x: a2.x + px * h, z: a2.z + pz * h },
        { x: b2.x + px * h, z: b2.z + pz * h },
        { x: b2.x - px * h, z: b2.z - pz * h },
        { x: a2.x - px * h, z: a2.z - pz * h }
      ];
    };
    S.pushWallSeg = function pushWallSeg(a, b) {
      S.massing.masses.push({ poly: S.wallSegPoly(a, b, S.massing.wallThick), h: S.massing.wallHeight, _wall: true });
      S.massing.selected = S.massing.masses.length - 1;
    };
    S.addWallVertex = function addWallVertex(sx, sy) {
      S.wallDefaults();
      const w = S.massing.wall = S.massing.wall || { pts: [] };
      const p = S.mGroundPick(sx, sy);
      if (w.pts.length >= 2) {
        const f = w.pts[0], snap = Math.max(S.massing.wallThick * 2, 0.4);
        if (Math.hypot(p.x - f.x, p.z - f.z) < snap) {
          S.pushWallSeg(w.pts[w.pts.length - 1], f);
          S.finishWall();
          return;
        }
      }
      if (w.pts.length === 0) {
        w.pts.push(p);
        S.massHint("Tap each corner \xB7 tap the first dot to close the room \xB7 Done to finish");
      } else {
        if (w.pts.length === 1) S.massSnapshot();
        S.pushWallSeg(w.pts[w.pts.length - 1], p);
        w.pts.push(p);
      }
      S.refreshInspector();
      S.renderMassing();
    };
    S.finishWall = function finishWall() {
      S.massing.wall = null;
      S.massing.wallCursor = null;
      S.refreshInspector();
      S.renderMassing();
      S.massHint("Wall run placed \xB7 Select to edit, or tap to start another");
    };
    S.drawWallOverlay = function drawWallOverlay() {
      const w = S.massing.wall;
      if (!w || !w.pts.length) return;
      w.pts.forEach((p, i) => {
        const s = S.mProject({ x: p.x, y: 0, z: p.z });
        S.mctx.beginPath();
        S.mctx.arc(s.x, s.y, i === 0 ? 7 : 5, 0, Math.PI * 2);
        S.mctx.fillStyle = i === 0 ? "#fff" : "#a02835";
        S.mctx.fill();
        S.mctx.lineWidth = 2;
        S.mctx.strokeStyle = "#a02835";
        S.mctx.stroke();
      });
    };
    S._wallPaletteEl = null;
    S.ensureWallPalette = function ensureWallPalette() {
      if (S._wallPaletteEl) return S._wallPaletteEl;
      const style = document.createElement("style");
      style.textContent = "#wall-palette{position:fixed;z-index:1250;display:none;flex-direction:column;gap:10px;left:50%;transform:translateX(-50%);bottom:120px;background:#1c1a18;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:11px 14px;box-shadow:0 10px 30px rgba(0,0,0,0.45);}#wall-palette .bm-modes{display:flex;gap:5px;}#wall-palette .bm{flex:1;font:600 11px ui-sans-serif,system-ui;letter-spacing:.06em;text-transform:uppercase;padding:8px 14px;background:#2b2826;color:rgba(255,255,255,0.6);border:1px solid #45403c;border-radius:7px;cursor:pointer;}#wall-palette .bm.on{background:#a02835;color:#fff;border-color:#a02835;}#wall-palette .bm-fields{display:flex;gap:12px;align-items:flex-end;}#wall-palette .wf{display:flex;flex-direction:column;gap:5px;}#wall-palette label{font:600 9px ui-sans-serif,system-ui;color:rgba(255,255,255,0.45);letter-spacing:.1em;text-transform:uppercase;}#wall-palette input{width:74px;font:600 13px ui-sans-serif,system-ui;padding:7px 9px;background:#2b2826;border:1px solid #45403c;border-radius:6px;color:#fff;}#wall-palette input:focus{outline:2px solid #a02835;outline-offset:1px;border-color:transparent;}#wall-palette .bm-done{font:600 11px ui-sans-serif,system-ui;letter-spacing:.08em;text-transform:uppercase;padding:9px 16px;background:#a02835;color:#fff;border:none;border-radius:7px;cursor:pointer;align-self:flex-end;}#wall-palette .bm-cut{align-self:flex-end;font:600 10px ui-sans-serif,system-ui;letter-spacing:.05em;text-transform:uppercase;padding:9px 13px;background:#2b2826;color:rgba(255,255,255,0.6);border:1px solid #45403c;border-radius:7px;cursor:pointer;white-space:nowrap;}#wall-palette .bm-cut.on{background:#a02835;color:#fff;border-color:#a02835;}";
      document.head.appendChild(style);
      const el = document.createElement("div");
      el.id = "wall-palette";
      el.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      document.body.appendChild(el);
      S._wallPaletteEl = el;
      return el;
    };
    S.buildDefaults = function buildDefaults() {
      S.wallDefaults();
      if (S.massing.buildMode == null) S.massing.buildMode = "wall";
      if (S.massing.doorW == null) S.massing.doorW = 0.9;
      if (S.massing.doorH == null) S.massing.doorH = 2.1;
      if (S.massing.winW == null) S.massing.winW = 1.2;
      if (S.massing.winH == null) S.massing.winH = 1.2;
      if (S.massing.winSill == null) S.massing.winSill = 0.9;
    };
    S.wallAxes = function wallAxes(b) {
      const p = b.poly;
      const dx = p[1].x - p[0].x, dz = p[1].z - p[0].z, len = Math.hypot(dx, dz) || 1e-6;
      const ux = dx / len, uz = dz / len, px = -uz, pz = ux;
      const thick = Math.hypot(p[2].x - p[1].x, p[2].z - p[1].z);
      const cx = (p[0].x + p[1].x + p[2].x + p[3].x) / 4, cz = (p[0].z + p[1].z + p[2].z + p[3].z) / 4;
      return { ux, uz, px, pz, len, thick, cx, cz };
    };
    S.openingPoly = function openingPoly(ax, W, depth) {
      const hw = W / 2, hd = depth / 2;
      const cr = (s1, s2) => ({ x: ax.cx + ax.ux * hw * s1 + ax.px * hd * s2, z: ax.cz + ax.uz * hw * s1 + ax.pz * hd * s2 });
      return [cr(-1, 1), cr(1, 1), cr(1, -1), cr(-1, -1)];
    };
    S.placeOpening = function placeOpening(bi, kind) {
      const b = S.massing.masses[bi];
      if (!b || !b._wall) {
        S.massHint("Tap a wall to place a " + kind);
        return;
      }
      S.buildDefaults();
      const ax = S.wallAxes(b);
      const W = Math.min(kind === "door" ? S.massing.doorW : S.massing.winW, ax.len * 0.95);
      const H = kind === "door" ? S.massing.doorH : S.massing.winH;
      const sill = kind === "door" ? 0 : S.massing.winSill;
      S.massSnapshot();
      S.massing.masses.push({
        poly: S.openingPoly(ax, W, ax.thick + 0.3),
        h: H,
        baseY: sill,
        color: kind === "door" ? [120, 86, 60] : [150, 178, 196],
        _opening: kind,
        _host: bi
      });
      S.massing.selected = S.massing.masses.length - 1;
      S.refreshInspector();
      S.renderMassing();
      S.massHint(kind[0].toUpperCase() + kind.slice(1) + " placed \xB7 Select to slide it along the wall or scale \xB7 adjust size below");
    };
    S.cutToggle = function cutToggle() {
      S.buildDefaults();
      const b = document.createElement("button");
      b.className = "bm-cut" + (S.massing.cutMode ? " on" : "");
      b.textContent = S.massing.cutMode ? "\u2713 Cut through wall" : "Cut through wall";
      b.onclick = () => {
        S.massing.cutMode = !S.massing.cutMode;
        S.buildBuildPalette();
        S.massHint(S.massing.cutMode ? "Cut mode: tap a wall to punch a real see-through opening" : "Tap a wall to place a represented " + S.massing.buildMode);
      };
      return b;
    };
    S.delOpBtn = function delOpBtn() {
      const b = document.createElement("button");
      b.className = "bm-cut";
      b.style.background = "#3a2326";
      b.style.borderColor = "#5a2a30";
      b.style.color = "#e7b4ba";
      b.textContent = "\u2715 Delete";
      b.onclick = () => S.deleteSelOpening();
      return b;
    };
    S.cutOpening = function cutOpening(sx, sy, bi, kind) {
      const b = S.massing.masses[bi];
      if (!b || !b._wall) {
        S.massHint("Tap a wall to cut a " + kind);
        return;
      }
      S.buildDefaults();
      const g = S.mGroundPick(sx, sy);
      const p = b.poly, dux = p[1].x - p[0].x, duz = p[1].z - p[0].z, Llen = Math.hypot(dux, duz) || 1;
      const u = Math.min(0.97, Math.max(0.03, ((g.x - p[0].x) * dux + (g.z - p[0].z) * duz) / (Llen * Llen)));
      S.massSnapshot();
      b.openings = b.openings || [];
      b.openings.push({
        kind,
        u,
        w: kind === "door" ? S.massing.doorW : S.massing.winW,
        h: kind === "door" ? S.massing.doorH : S.massing.winH,
        sill: kind === "door" ? 0 : S.massing.winSill
      });
      S.massing.selOpening = { bi, idx: b.openings.length - 1 };
      S.massing.selected = -1;
      S.buildBuildPalette();
      S.refreshInspector();
      S.renderMassing();
      S.massHint(kind[0].toUpperCase() + kind.slice(1) + " cut \xB7 resize with the fields \xB7 drag in Select to move \xB7 undo to remove");
    };
    S.openingAt = function openingAt(sx, sy) {
      let best = null, bestDepth = -Infinity;
      S.massing.masses.forEach((b, bi) => {
        if (!(b._wall && b.openings && b.openings.length)) return;
        b.openings.forEach((op, idx) => {
          const c = S.openingCorners3D(b, op);
          const quad = [c.M.Lb, c.M.Rb, c.M.Rt, c.M.Lt].map(S.mProject);
          if (S.pointInPoly(sx, sy, quad)) {
            let d = 0;
            quad.forEach((p) => d += p.depth);
            d /= 4;
            if (d > bestDepth) {
              bestDepth = d;
              best = { bi, idx };
            }
          }
        });
      });
      return best;
    };
    S.selectedOpening = function selectedOpening() {
      const s = S.massing.selOpening;
      if (!s) return null;
      const b = S.massing.masses[s.bi];
      if (!b || !b.openings || !b.openings[s.idx]) {
        S.massing.selOpening = null;
        return null;
      }
      return b.openings[s.idx];
    };
    S.selectOpening = function selectOpening(hit) {
      S.massing.selOpening = hit;
      S.massing.selected = -1;
      const op = S.massing.masses[hit.bi].openings[hit.idx];
      S.massing.buildMode = op.kind;
      S.buildBuildPalette();
      S.refreshInspector();
      S.renderMassing();
      S.massHint(op.kind[0].toUpperCase() + op.kind.slice(1) + " selected \xB7 resize with the fields \xB7 Delete to remove");
    };
    S.deleteSelOpening = function deleteSelOpening() {
      const s = S.massing.selOpening;
      if (!s) return;
      const b = S.massing.masses[s.bi];
      if (!b || !b.openings) return;
      S.massSnapshot();
      b.openings.splice(s.idx, 1);
      S.massing.selOpening = null;
      S.buildBuildPalette();
      S.renderMassing();
      S.massHint("Opening removed");
    };
    S.buildBuildPalette = function buildBuildPalette() {
      S.buildDefaults();
      const el = S.ensureWallPalette();
      el.innerHTML = "";
      const modes = document.createElement("div");
      modes.className = "bm-modes";
      [["wall", "Wall"], ["door", "Door"], ["window", "Window"]].forEach(([m, lab]) => {
        const b = document.createElement("button");
        b.className = "bm" + (S.massing.buildMode === m ? " on" : "");
        b.textContent = lab;
        b.onclick = () => {
          S.massing.buildMode = m;
          S.massing.selOpening = null;
          if (m !== "wall" && S.massing.wall) S.finishWall();
          S.buildBuildPalette();
          S.renderMassing();
          S.massHint(m === "wall" ? "Tap each corner to lay walls \xB7 tap the first dot to close a room" : "Tap a wall to drop a " + m + " \xB7 or tap an existing one to edit");
        };
        modes.appendChild(b);
      });
      el.appendChild(modes);
      const fields = document.createElement("div");
      fields.className = "bm-fields";
      const mk = (lab, val, step, on) => {
        const f = document.createElement("div");
        f.className = "wf";
        const l = document.createElement("label");
        l.textContent = lab;
        const i = document.createElement("input");
        i.type = "number";
        i.step = step;
        i.min = "0.05";
        i.value = val;
        i.inputMode = "decimal";
        i.onchange = () => {
          const v = parseFloat(i.value);
          if (v > 0) on(v);
        };
        f.append(l, i);
        return f;
      };
      if (S.massing.buildMode === "wall") {
        fields.append(
          mk("Thickness (m)", S.massing.wallThick, "0.05", (v) => S.massing.wallThick = v),
          mk("Height (m)", S.massing.wallHeight, "0.1", (v) => S.massing.wallHeight = v)
        );
        const done = document.createElement("button");
        done.className = "bm-done";
        done.textContent = "Done";
        done.onclick = () => S.finishWall();
        fields.appendChild(done);
      } else if (S.massing.buildMode === "door") {
        const t = S.selectedOpening();
        const tgt = t && t.kind === "door" ? t : null;
        fields.append(
          mk("Width (m)", tgt ? tgt.w : S.massing.doorW, "0.05", (v) => {
            if (tgt) {
              S.massSnapshot();
              tgt.w = v;
              S.renderMassing();
            } else S.massing.doorW = v;
          }),
          mk("Height (m)", tgt ? tgt.h : S.massing.doorH, "0.1", (v) => {
            if (tgt) {
              S.massSnapshot();
              tgt.h = v;
              S.renderMassing();
            } else S.massing.doorH = v;
          })
        );
        fields.appendChild(S.cutToggle());
        if (tgt) fields.appendChild(S.delOpBtn());
      } else {
        const t = S.selectedOpening();
        const tgt = t && t.kind === "window" ? t : null;
        fields.append(
          mk("Width (m)", tgt ? tgt.w : S.massing.winW, "0.05", (v) => {
            if (tgt) {
              S.massSnapshot();
              tgt.w = v;
              S.renderMassing();
            } else S.massing.winW = v;
          }),
          mk("Height (m)", tgt ? tgt.h : S.massing.winH, "0.1", (v) => {
            if (tgt) {
              S.massSnapshot();
              tgt.h = v;
              S.renderMassing();
            } else S.massing.winH = v;
          }),
          mk("Sill (m)", tgt ? tgt.sill || 0 : S.massing.winSill, "0.1", (v) => {
            if (tgt) {
              S.massSnapshot();
              tgt.sill = v;
              S.renderMassing();
            } else S.massing.winSill = v;
          })
        );
        fields.appendChild(S.cutToggle());
        if (tgt) fields.appendChild(S.delOpBtn());
      }
      el.appendChild(fields);
    };
    S.updateBuildPalette = function updateBuildPalette() {
      const show = S.massing.active && S.massing.tool === "build";
      if (show) {
        S.buildBuildPalette();
        S.ensureWallPalette().style.display = "flex";
      } else if (S._wallPaletteEl) {
        S._wallPaletteEl.style.display = "none";
        S.massing.selOpening = null;
        if (S.massing.wall) S.finishWall();
      }
    };
  }

  // src/engine/app/massing.ts
  function initMassing() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.massingCanvas = $el("massing-canvas");
    S.mctx = S.massingCanvas.getContext("2d");
    S.massingBar = $el("massing-bar");
    S.massingHintEl = $el("massing-hint");
    S.massing = {
      active: false,
      tool: "add",
      // add | move | height | orbit
      masses: [],
      // [{x,z,w,d,h}] boxes OR {poly:[{x,z}..],h} prisms
      cam: { az: 0.7, el: 0.52, scale: 1, projection: "axon", persp: 900 },
      grid: 1,
      // ground grid spacing in metres
      selected: -1,
      dragging: null,
      // active drag descriptor
      cx: 0,
      cy: 0,
      // screen centre
      panX: 0,
      panY: 0,
      // view pan offset
      undoStack: [],
      redoStack: [],
      showBase: false,
      // project the 2D drawing onto the ground plane
      baseImg: null,
      // cached composite of visible 2D layers
      baseAnchor: null,
      // { px, py, ppm } doc-pixel origin mapped to world 0,0
      baseAlpha: 0.92
    };
    S.massHint = function massHint(t) {
      S.massingHintEl.textContent = t;
      S.massingHintEl.style.display = t ? "block" : "none";
    };
    S.mRotY = function mRotY(p, a) {
      const c = Math.cos(a), s = Math.sin(a);
      return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
    };
    S.mRotX = function mRotX(p, a) {
      const c = Math.cos(a), s = Math.sin(a);
      return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
    };
    S.mProjectC = function mProjectC(p, cx, cy, s) {
      let q = S.mRotY(p, S.massing.cam.az);
      q = S.mRotX(q, S.massing.cam.el);
      if (S.massing.cam.projection === "persp") {
        const d = S.massing.cam.persp;
        const f = d / (d - q.z * s);
        return { x: cx + q.x * s * f, y: cy - q.y * s * f, depth: q.z };
      }
      return { x: cx + q.x * s, y: cy - q.y * s, depth: q.z };
    };
    S.mProject = function mProject(p) {
      return S.mProjectC(p, S.massing.cx, S.massing.cy, S.massing.cam.scale);
    };
    S.mGroundPick = function mGroundPick(sx, sy) {
      const s = S.massing.cam.scale;
      const A = (sx - S.massing.cx) / s;
      const B = (S.massing.cy - sy) / s / Math.max(1e-4, Math.sin(S.massing.cam.el));
      const az = S.massing.cam.az;
      const x = A * Math.cos(az) + B * Math.sin(az);
      const z = A * Math.sin(az) - B * Math.cos(az);
      return { x, z };
    };
    S.mSnap = function mSnap(v) {
      return Math.round(v / S.massing.grid) * S.massing.grid;
    };
    S.mSnapH = function mSnapH(v) {
      return Math.round(v / 0.1) * 0.1;
    };
    S.boxVerts = function boxVerts(b) {
      const { x, z, w, d, h } = b;
      const y0 = b.baseY || 0, y1 = y0 + h;
      return [
        { x, y: y0, z },
        { x: x + w, y: y0, z },
        { x: x + w, y: y0, z: z + d },
        { x, y: y0, z: z + d },
        // base 0-3
        { x, y: y1, z },
        { x: x + w, y: y1, z },
        { x: x + w, y: y1, z: z + d },
        { x, y: y1, z: z + d }
        // top  4-7
      ];
    };
    S.BOX_FACES = [
      { idx: [4, 5, 6, 7], n: [0, 1, 0] },
      // top
      { idx: [0, 1, 2, 3], n: [0, -1, 0] },
      // bottom
      { idx: [0, 1, 5, 4], n: [0, 0, -1] },
      // front (-z)
      { idx: [2, 3, 7, 6], n: [0, 0, 1] },
      // back (+z)
      { idx: [1, 2, 6, 5], n: [1, 0, 0] },
      // right (+x)
      { idx: [3, 0, 4, 7], n: [-1, 0, 0] }
      // left (-x)
    ];
    S.footPoly = function footPoly(b) {
      if (b.poly) return b.poly;
      return [{ x: b.x, z: b.z }, { x: b.x + b.w, z: b.z }, { x: b.x + b.w, z: b.z + b.d }, { x: b.x, z: b.z + b.d }];
    };
    S.massBaseTop = function massBaseTop(b) {
      const poly = S.footPoly(b);
      let cx = 0, cz = 0;
      poly.forEach((p) => {
        cx += p.x;
        cz += p.z;
      });
      cx /= poly.length;
      cz /= poly.length;
      const rot = b.rot || 0, tp = b.taper != null ? b.taper : 1;
      const fsx = b.fsx != null ? b.fsx : b.fscale != null ? b.fscale : 1;
      const fsz = b.fsz != null ? b.fsz : b.fscale != null ? b.fscale : 1;
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const tf = (p, sx, sz) => {
        const dx = (p.x - cx) * sx, dz = (p.z - cz) * sz;
        return { x: cx + dx * cr - dz * sr, z: cz + dx * sr + dz * cr };
      };
      return { base: poly.map((p) => tf(p, fsx, fsz)), top: poly.map((p) => tf(p, fsx * tp, fsz * tp)), cx, cz };
    };
    S.massVerts = function massVerts(b) {
      const { base, top } = S.massBaseTop(b);
      const y0 = b.baseY || 0, y1 = y0 + b.h, out = [];
      for (const p of base) out.push({ x: p.x, y: y0, z: p.z });
      for (const p of top) out.push({ x: p.x, y: y1, z: p.z });
      return out;
    };
    S.massFaces = function massFaces(b) {
      const { base } = S.massBaseTop(b);
      const n = base.length, faces = [];
      let cx = 0, cz = 0;
      base.forEach((p) => {
        cx += p.x;
        cz += p.z;
      });
      cx /= n;
      cz /= n;
      const topIdx = [], botIdx = [];
      for (let i = 0; i < n; i++) {
        topIdx.push(n + i);
        botIdx.push(n - 1 - i);
      }
      faces.push({ idx: topIdx, n: [0, 1, 0], id: "top" });
      faces.push({ idx: botIdx, n: [0, -1, 0], id: "bottom" });
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ex = base[j].x - base[i].x, ez = base[j].z - base[i].z;
        let nx = ez, nz = -ex;
        const len = Math.hypot(nx, nz) || 1;
        nx /= len;
        nz /= len;
        const mx = (base[i].x + base[j].x) / 2 - cx, mz = (base[i].z + base[j].z) / 2 - cz;
        if (nx * mx + nz * mz < 0) {
          nx = -nx;
          nz = -nz;
        }
        faces.push({ idx: [i, j, n + j, n + i], n: [nx, 0, nz], id: "side" + i });
      }
      return faces;
    };
    S.openingCorners3D = function openingCorners3D(b, op) {
      const p = b.poly, y0 = b.baseY || 0, y1 = y0 + b.h;
      const dux = p[1].x - p[0].x, duz = p[1].z - p[0].z, L = Math.hypot(dux, duz) || 1;
      const ux = dux / L, uz = duz / L;
      const s = op.u * L, s0 = Math.max(0, s - op.w / 2), s1 = Math.min(L, s + op.w / 2);
      const sill = op.kind === "door" ? 0 : op.sill || 0;
      const yb = Math.max(y0, y0 + sill), yt = Math.min(y1, y0 + sill + op.h);
      const F = (ss, y) => ({ x: p[0].x + ux * ss, y, z: p[0].z + uz * ss });
      const B = (ss, y) => ({ x: p[3].x + ux * ss, y, z: p[3].z + uz * ss });
      const M = (ss, y) => ({ x: (p[0].x + p[3].x) / 2 + ux * ss, y, z: (p[0].z + p[3].z) / 2 + uz * ss });
      return {
        door: op.kind === "door",
        F: { Lb: F(s0, yb), Rb: F(s1, yb), Rt: F(s1, yt), Lt: F(s0, yt) },
        B: { Lb: B(s0, yb), Rb: B(s1, yb), Rt: B(s1, yt), Lt: B(s0, yt) },
        M: { Lb: M(s0, yb), Rb: M(s1, yb), Rt: M(s1, yt), Lt: M(s0, yt) }
      };
    };
    S._avgDepth = function _avgDepth(pts) {
      let d = 0;
      for (const p of pts) d += p.depth;
      return d / pts.length;
    };
    S.pushWallWithOpenings = function pushWallWithOpenings(b, bi, vs, faces) {
      const sel = bi === S.massing.selected;
      const mf = S.massFaces(b);
      const get = (id) => mf.find((f) => f.id === id);
      ["top", "bottom", "side1", "side3"].forEach((id) => {
        const f = get(id);
        if (!f) return;
        const pts = f.idx.map((i) => vs[i]);
        faces.push({ bi, id, pts, n: f.n, depth: S._avgDepth(pts), selected: sel });
      });
      const proj = (q) => q.map(S.mProject);
      const f0 = get("side0"), f2 = get("side2");
      const n0 = f0.n, n2 = f2.n;
      const selOp = S.massing.selOpening && S.massing.selOpening.bi === bi ? S.massing.selOpening.idx : -1;
      const frontHoles = [], backHoles = [];
      b.openings.forEach((op, oi) => {
        const opSel = oi === selOp;
        const c = S.openingCorners3D(b, op);
        frontHoles.push(proj([c.F.Lb, c.F.Rb, c.F.Rt, c.F.Lt]));
        backHoles.push(proj([c.B.Lb, c.B.Rb, c.B.Rt, c.B.Lt]));
        const rev = (quad) => {
          const pts = proj(quad);
          faces.push({ bi, id: "reveal", pts, n: [0, 1, 0], depth: S._avgDepth(pts), interior: true, selected: opSel });
        };
        rev([c.F.Lt, c.F.Rt, c.B.Rt, c.B.Lt]);
        if (!c.door) rev([c.F.Lb, c.F.Rb, c.B.Rb, c.B.Lb]);
        rev([c.F.Lb, c.F.Lt, c.B.Lt, c.B.Lb]);
        rev([c.F.Rb, c.F.Rt, c.B.Rt, c.B.Rb]);
        const pane = proj([c.M.Lb, c.M.Rb, c.M.Rt, c.M.Lt]);
        const e = { bi, id: "pane", pts: pane, n: n0, depth: S._avgDepth(pane), selected: opSel };
        e[c.door ? "leaf" : "glass"] = true;
        faces.push(e);
      });
      const p0 = f0.idx.map((i) => vs[i]);
      faces.push({ bi, id: "side0", pts: p0, n: n0, depth: S._avgDepth(p0), holes: frontHoles, selected: sel });
      const p2 = f2.idx.map((i) => vs[i]);
      faces.push({ bi, id: "side2", pts: p2, n: n2, depth: S._avgDepth(p2), holes: backHoles, selected: sel });
    };
    S._mid = function _mid(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    S.drawPane = function drawPane(f, glass) {
      const pts = f.pts;
      S.mctx.beginPath();
      S.mctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) S.mctx.lineTo(pts[i].x, pts[i].y);
      S.mctx.closePath();
      if (glass) {
        S.mctx.fillStyle = f.selected ? "rgba(196,120,128,0.45)" : "rgba(150,182,206,0.42)";
        S.mctx.fill();
        S.mctx.strokeStyle = "rgba(60,84,100,0.55)";
        S.mctx.lineWidth = 1;
        const ml = S._mid(pts[0], pts[3]), mr = S._mid(pts[1], pts[2]), mt = S._mid(pts[3], pts[2]), mb = S._mid(pts[0], pts[1]);
        S.mctx.beginPath();
        S.mctx.moveTo(ml.x, ml.y);
        S.mctx.lineTo(mr.x, mr.y);
        S.mctx.moveTo(mt.x, mt.y);
        S.mctx.lineTo(mb.x, mb.y);
        S.mctx.stroke();
      } else {
        S.mctx.fillStyle = f.selected ? "rgb(176,108,116)" : "rgb(120,86,60)";
        S.mctx.fill();
        const hx = pts[1].x * 0.82 + pts[0].x * 0.18, hy = pts[1].y * 0.82 + pts[0].y * 0.18;
        const hx2 = pts[2].x * 0.82 + pts[3].x * 0.18, hy2 = pts[2].y * 0.82 + pts[3].y * 0.18;
        S.mctx.strokeStyle = "rgba(40,30,22,0.5)";
        S.mctx.lineWidth = 1.2;
        S.mctx.beginPath();
        S.mctx.moveTo(hx, hy);
        S.mctx.lineTo(hx2, hy2);
        S.mctx.stroke();
      }
      S.mctx.strokeStyle = f.selected ? "#a02835" : "rgba(40,36,33,0.75)";
      S.mctx.lineWidth = f.selected ? 2 : 1.2;
      S.mctx.stroke();
    };
    S.renderMassing = function renderMassing() {
      if (!S.massing.active) return;
      const rect = S.area.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      if (S.massingCanvas.width !== W || S.massingCanvas.height !== H) {
        S.massingCanvas.width = W;
        S.massingCanvas.height = H;
      }
      S.massing.cx = W / 2 + (S.massing.panX || 0);
      S.massing.cy = H * 0.58 + (S.massing.panY || 0);
      S.mctx.clearRect(0, 0, W, H);
      if (!S.massing._export) {
        S.mctx.fillStyle = "#e9e5e0";
        S.mctx.fillRect(0, 0, W, H);
        S.drawGroundGrid();
      }
      S.drawGroundImage(S.mctx);
      const faces = [];
      S.massing.masses.forEach((b, bi) => {
        const vs = S.massVerts(b).map(S.mProject);
        if (b._wall && b.openings && b.openings.length) {
          S.pushWallWithOpenings(b, bi, vs, faces);
          return;
        }
        const cull = false;
        S.massFaces(b).forEach((f) => {
          const p0 = vs[f.idx[0]], p1 = vs[f.idx[1]], p2 = vs[f.idx[2]];
          const cross = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
          if (cull && cross <= 0) return;
          let depth = 0;
          for (const i of f.idx) depth += vs[i].depth;
          depth /= f.idx.length;
          faces.push({ bi, id: f.id, pts: f.idx.map((i) => vs[i]), n: f.n, depth, selected: bi === S.massing.selected });
        });
      });
      S.massing.masses.forEach((b, bi) => {
        if (!b.faceRegions) return;
        const sel = bi === S.massing.selected;
        Object.keys(b.faceRegions).forEach((faceId) => {
          b.faceRegions[faceId].forEach((region) => {
            const dM = (region.depth || 0) / 1e3;
            if (Math.abs(dM) < 1e-4) return;
            const inward = dM < 0;
            S.extrudeRegionFaces(b, faceId, region, dM).forEach((ff) => {
              const pts = ff.world.map(S.mProject);
              faces.push({ bi, id: ff.id, pts, n: ff.n, depth: S._avgDepth(pts), selected: sel, feature: true, interior: inward, mat: region.mat || null });
            });
            if (inward) {
              const g = S.faceGeom(b, faceId);
              if (g && g.quad) {
                const holeLoop = region.uv.map((p) => S.mProject(S._bilinear(g.quad, p.u, p.v)));
                const bf = faces.find((f) => f.bi === bi && f.id === faceId && !f.feature);
                if (bf) {
                  bf.holes = bf.holes || [];
                  bf.holes.push(holeLoop);
                }
              }
            }
          });
        });
      });
      faces.sort((a, b) => a.depth - b.depth);
      S.massing._faces = faces;
      const L = [-0.4, 0.82, 0.4];
      faces.forEach((f) => {
        const fb = S.massing.masses[f.bi];
        if (f.glass) {
          S.drawPane(f, true);
          return;
        }
        if (f.leaf) {
          S.drawPane(f, false);
          return;
        }
        const fmat = fb.faceMat && fb.faceMat[f.id];
        const ndl = Math.max(0, f.n[0] * L[0] + f.n[1] * L[1] + f.n[2] * L[2]);
        let shade = 0.55 + ndl * 0.45;
        let base = f.selected ? [196, 120, 128] : fb.color || [188, 178, 168];
        if (fmat && fmat.kind === "color" && !f.selected) {
          const c = S.hexToRgba(fmat.hex);
          base = [c[0], c[1], c[2]];
        }
        if (f.interior && !f.selected) {
          base = [150, 142, 132];
          shade = 0.46;
        }
        const r = Math.round(base[0] * shade), g = Math.round(base[1] * shade), bl = Math.round(base[2] * shade);
        S.mctx.beginPath();
        S.mctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (let i = 1; i < f.pts.length; i++) S.mctx.lineTo(f.pts[i].x, f.pts[i].y);
        S.mctx.closePath();
        if (f.holes) f.holes.forEach((loop) => {
          S.mctx.moveTo(loop[0].x, loop[0].y);
          for (let i = 1; i < loop.length; i++) S.mctx.lineTo(loop[i].x, loop[i].y);
          S.mctx.closePath();
        });
        let fillStyle = `rgb(${r},${g},${bl})`;
        if (f.mat) {
          if (f.mat.kind === "texture") {
            const pat = S.regionPattern(f.mat);
            if (pat) fillStyle = pat;
          } else {
            const tr = S.matFill(f.mat);
            if (tr) fillStyle = tr;
            else if (f.mat.kind === "color") {
              const c = S.hexToRgba(f.mat.hex);
              fillStyle = `rgb(${Math.round(c[0] * shade)},${Math.round(c[1] * shade)},${Math.round(c[2] * shade)})`;
            }
          }
        }
        S.mctx.fillStyle = fillStyle;
        S.mctx.fill(f.holes ? "evenodd" : "nonzero");
        S.mctx.lineJoin = "round";
        S.mctx.strokeStyle = f.selected ? "#a02835" : "rgba(40,36,33,0.85)";
        S.mctx.lineWidth = f.selected ? 2 : 1.2;
        S.mctx.stroke();
        if (f.holes) f.holes.forEach((loop) => {
          S.mctx.beginPath();
          S.mctx.moveTo(loop[0].x, loop[0].y);
          for (let i = 1; i < loop.length; i++) S.mctx.lineTo(loop[i].x, loop[i].y);
          S.mctx.closePath();
          S.mctx.stroke();
        });
        if (f.holes || f.interior) return;
        if (fmat && fmat.kind === "texture") {
          const mimg = S.matFaceImg(fb, f.id, fmat);
          if (mimg && mimg.complete && mimg.naturalWidth) {
            const g2 = S.faceGeom(fb, f.id);
            if (g2) S.drawFaceArt(S.mctx, g2.quad, mimg, g2.clip, S.mProject);
          }
        }
        if (fb.faceArt && fb.faceArt[f.id]) {
          S.ensureFaceImg(fb);
          const g2 = S.faceGeom(fb, f.id);
          if (g2) S.drawFaceArt(S.mctx, g2.quad, fb._faceImg[f.id], g2.clip, S.mProject);
        }
        S.renderFaceRegions(S.mctx, fb, f);
      });
      if (S.massing.dragging && S.massing.dragging.type === "foot") {
        const d = S.massing.dragging;
        const corners = [
          { x: d.x0, z: d.z0 },
          { x: d.x1, z: d.z0 },
          { x: d.x1, z: d.z1 },
          { x: d.x0, z: d.z1 }
        ].map((c) => S.mProject({ x: c.x, y: 0, z: c.z }));
        S.mctx.beginPath();
        S.mctx.moveTo(corners[0].x, corners[0].y);
        corners.forEach((c) => S.mctx.lineTo(c.x, c.y));
        S.mctx.closePath();
        S.mctx.fillStyle = "rgba(160,40,53,0.18)";
        S.mctx.fill();
        S.mctx.strokeStyle = "#a02835";
        S.mctx.lineWidth = 1.5;
        S.mctx.stroke();
      }
      if (S.massing.tool === "select" && S.massing.selected >= 0 && S.massing.masses[S.massing.selected]) {
        S.drawGizmo(S.massing.masses[S.massing.selected]);
      }
      if (S.massing.tool === "build" && (S.massing.buildMode || "wall") === "wall") S.drawWallOverlay();
    };
    S.drawGroundGrid = function drawGroundGrid() {
      const N = 20;
      const g = S.massing.grid;
      S.mctx.lineWidth = 1;
      for (let i = -N; i <= N; i++) {
        const major = i % 5 === 0;
        S.mctx.strokeStyle = major ? "rgba(40,36,33,0.28)" : "rgba(40,36,33,0.12)";
        let a = S.mProject({ x: i * g, y: 0, z: -N * g }), b = S.mProject({ x: i * g, y: 0, z: N * g });
        S.mctx.beginPath();
        S.mctx.moveTo(a.x, a.y);
        S.mctx.lineTo(b.x, b.y);
        S.mctx.stroke();
        a = S.mProject({ x: -N * g, y: 0, z: i * g });
        b = S.mProject({ x: N * g, y: 0, z: i * g });
        S.mctx.beginPath();
        S.mctx.moveTo(a.x, a.y);
        S.mctx.lineTo(b.x, b.y);
        S.mctx.stroke();
      }
    };
    S._massBaseCanvas = null;
    S.buildMassingBase = function buildMassingBase() {
      if (!S._massBaseCanvas) S._massBaseCanvas = document.createElement("canvas");
      S._massBaseCanvas.width = S.doc.wPx;
      S._massBaseCanvas.height = S.doc.hPx;
      S.flattenVisibleToCtx(S._massBaseCanvas.getContext("2d"));
      S.massing.baseImg = S._massBaseCanvas;
    };
    S.projectGround = function projectGround(px, py) {
      const a = S.massing.baseAnchor;
      return S.mProject({ x: (px - a.px) / a.ppm, y: 0, z: (py - a.py) / a.ppm });
    };
    S.drawGroundImage = function drawGroundImage(ctx) {
      if (!S.massing.showBase || !S.massing.baseImg || !S.massing.baseAnchor) return;
      const img = S.massing.baseImg, IW = img.width, IH = img.height;
      const N = S.massing.cam.projection === "persp" ? 8 : 1;
      const cw = IW / N, ch = IH / N;
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = S.massing.baseAlpha;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const sx = i * cw, sy = j * ch;
          const P0 = S.projectGround(sx, sy);
          const P1 = S.projectGround(sx + cw, sy);
          const P2 = S.projectGround(sx + cw, sy + ch);
          const P3 = S.projectGround(sx, sy + ch);
          const a = (P1.x - P0.x) / cw, b = (P1.y - P0.y) / cw;
          const c = (P3.x - P0.x) / ch, d = (P3.y - P0.y) / ch;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(P0.x, P0.y);
          ctx.lineTo(P1.x, P1.y);
          ctx.lineTo(P2.x, P2.y);
          ctx.lineTo(P3.x, P3.y);
          ctx.closePath();
          ctx.clip();
          ctx.setTransform(a, b, c, d, P0.x, P0.y);
          ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
          ctx.restore();
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = prevAlpha;
    };
    S.massAt = function massAt(sx, sy) {
      let best = -1, bestDepth = -Infinity;
      S.massing.masses.forEach((b, bi) => {
        const vs = S.massVerts(b).map(S.mProject);
        S.massFaces(b).forEach((f) => {
          const pts = f.idx.map((i) => vs[i]);
          if (S.pointInPoly(sx, sy, pts)) {
            let depth = 0;
            for (const i of f.idx) depth += vs[i].depth;
            depth /= f.idx.length;
            if (depth > bestDepth) {
              bestDepth = depth;
              best = bi;
            }
          }
        });
      });
      return best;
    };
    S.pointInPoly = function pointInPoly(px, py, pts) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
        if (yi > py !== yj > py && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    S._offArea = function _offArea(pts) {
      let a = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        a += p.x * q.y - q.x * p.y;
      }
      return a / 2;
    };
    S._offLineX = function _offLineX(p1, p2, p3, p4) {
      const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
      if (Math.abs(d) < 1e-9) return null;
      const a = p1.x * p2.y - p1.y * p2.x, b = p3.x * p4.y - p3.y * p4.x;
      return { x: (a * (p3.x - p4.x) - (p1.x - p2.x) * b) / d, y: (a * (p3.y - p4.y) - (p1.y - p2.y) * b) / d };
    };
    S.offsetPolygon = function offsetPolygon(pts, dist) {
      const n = pts.length;
      if (n < 3) return null;
      const ccw = S._offArea(pts) > 0;
      const E = [];
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        let dx = b.x - a.x, dy = b.y - a.y;
        const L = Math.hypot(dx, dy) || 1;
        dx /= L;
        dy /= L;
        const nx = ccw ? dy : -dy, ny = ccw ? -dx : dx;
        E.push({ a: { x: a.x + nx * dist, y: a.y + ny * dist }, b: { x: b.x + nx * dist, y: b.y + ny * dist } });
      }
      const out = [];
      for (let i = 0; i < n; i++) {
        const e0 = E[(i - 1 + n) % n], e1 = E[i];
        const p = S._offLineX(e0.a, e0.b, e1.a, e1.b);
        out.push(p || { x: e1.a.x, y: e1.a.y });
      }
      const a0 = S._offArea(pts), a1 = S._offArea(out);
      if (Math.sign(a1) !== Math.sign(a0) || Math.abs(a1) < 1e-6) return null;
      for (let i = 0; i < n; i++) {
        const oa = pts[i], ob = pts[(i + 1) % n], na = out[i], nb = out[(i + 1) % n];
        if ((ob.x - oa.x) * (nb.x - na.x) + (ob.y - oa.y) * (nb.y - na.y) < 0) return null;
      }
      return out;
    };
    S.offsetRoomAt = function offsetRoomAt(p) {
      for (let idx = (state2.measurements || []).length - 1; idx >= 0; idx--) {
        const m = state2.measurements[idx];
        if (m.type === "area" && m.points && m.points.length >= 3 && S.pointInPoly(p.x, p.y, m.points)) return idx;
      }
      return -1;
    };
    S.shapeHitClosed = function shapeHitClosed(sh, p) {
      if (sh.kind === "ellipse") {
        const dx = (p.x - sh.cx) / (sh.rx || 1), dy = (p.y - sh.cy) / (sh.ry || 1);
        return dx * dx + dy * dy <= 1.15;
      }
      if (sh.pts && (sh.closed || sh.kind === "rect") && sh.pts.length >= 3) return S.pointInPoly(p.x, p.y, sh.pts);
      return false;
    };
    S.shapeHit = function shapeHit(sh, p) {
      if (S.shapeHitClosed(sh, p)) return true;
      if (sh.pts) {
        const n = sh.pts.length;
        for (let i = 0; i < n - 1; i++) {
          if (S._distToSeg(p, sh.pts[i], sh.pts[i + 1]) < 10) return true;
        }
        if (sh.closed && n > 2 && S._distToSeg(p, sh.pts[n - 1], sh.pts[0]) < 10) return true;
      }
      return false;
    };
    S.offsetTargetAt = function offsetTargetAt(p) {
      for (let i = (state2.shapes || []).length - 1; i >= 0; i--) {
        if (S.shapeHitClosed(state2.shapes[i], p)) return { type: "shape", idx: i };
      }
      const r = S.offsetRoomAt(p);
      if (r >= 0) return { type: "room", idx: r };
      return null;
    };
    S.offsetDistDocPx = function offsetDistDocPx() {
      const mm = state2.offset && state2.offset.mm || 100;
      return mm / 1e3 * S.pxPerMetre();
    };
    S.computeOffsetPreview = function computeOffsetPreview() {
      if (!state2.offset) return null;
      const d = S.offsetDistDocPx() * (state2.offset.dir || -1);
      if (state2.offset.type === "shape") {
        const sh = state2.shapes[state2.offset.idx];
        if (!sh) return null;
        if (sh.kind === "ellipse") {
          const rx = sh.rx + d, ry = sh.ry + d;
          if (rx <= 1 || ry <= 1) return null;
          return { ellipse: true, cx: sh.cx, cy: sh.cy, rx, ry };
        }
        if (sh.pts && (sh.closed || sh.kind === "rect") && sh.pts.length >= 3) return S.offsetPolygon(sh.pts, d);
        return null;
      }
      const m = state2.measurements[state2.offset.idx];
      if (!m || !m.points) return null;
      return S.offsetPolygon(m.points, d);
    };
    S.drawOffsetPreview = function drawOffsetPreview(prev) {
      const svgns = "http://www.w3.org/2000/svg";
      let el;
      if (prev.ellipse) {
        el = document.createElementNS(svgns, "ellipse");
        el.setAttribute("cx", prev.cx);
        el.setAttribute("cy", prev.cy);
        el.setAttribute("rx", prev.rx);
        el.setAttribute("ry", prev.ry);
      } else {
        el = document.createElementNS(svgns, "polygon");
        el.setAttribute("points", prev.map((p) => `${p.x},${p.y}`).join(" "));
      }
      el.setAttribute("fill", "rgba(160,40,53,0.10)");
      el.setAttribute("stroke", "#a02835");
      el.setAttribute("stroke-width", "2");
      el.setAttribute("stroke-dasharray", "8 5");
      S.rulerOverlay.appendChild(el);
    };
    S._offBarEl = null;
    S.ensureOffsetBar = function ensureOffsetBar() {
      if (S._offBarEl) return S._offBarEl;
      const el = document.createElement("div");
      el.id = "offset-bar";
      el.style.cssText = "position:fixed;top:64px;left:50%;transform:translateX(-50%);display:none;gap:10px;align-items:center;flex-wrap:wrap;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(0,0,0,0.10);border-radius:10px;padding:7px 13px;box-shadow:0 6px 22px rgba(0,0,0,0.16);z-index:31;font-size:11px;";
      document.body.appendChild(el);
      S._offBarEl = el;
      return el;
    };
    S.showOffsetBar = function showOffsetBar(show) {
      S.ensureOffsetBar();
      const el = S._offBarEl;
      if (!show || !state2.offset) {
        el.style.display = "none";
        el.innerHTML = "";
        return;
      }
      const inp = "font-family:inherit;font-size:11px;padding:3px 5px;border:1px solid #ccc;border-radius:5px;";
      el.innerHTML = `<span style="font-weight:700;letter-spacing:0.5px;color:#a02835;">OFFSET</span><label style="display:flex;align-items:center;gap:5px;color:#555;">Dist <input id="of-mm" type="number" min="1" step="10" style="width:64px;${inp}"> mm</label><button id="of-in" class="op-mini">In</button><button id="of-out" class="op-mini">Out</button><button id="of-apply" class="op-mini" style="background:#a02835;color:#fff;">Apply</button><button id="of-cancel" class="op-mini">Cancel</button>`;
      el.querySelector("#of-mm").value = state2.offset.mm || 100;
      const refl = () => {
        el.querySelector("#of-in").style.fontWeight = state2.offset.dir < 0 ? "700" : "400";
        el.querySelector("#of-out").style.fontWeight = state2.offset.dir > 0 ? "700" : "400";
      };
      refl();
      el.querySelector("#of-mm").addEventListener("input", (e) => {
        const v = parseFloat(e.target.value);
        if (v > 0) {
          state2.offset.mm = v;
          S.refreshMeasurements();
        }
      });
      el.querySelector("#of-in").onclick = () => {
        state2.offset.dir = -1;
        refl();
        S.refreshMeasurements();
      };
      el.querySelector("#of-out").onclick = () => {
        state2.offset.dir = 1;
        refl();
        S.refreshMeasurements();
      };
      el.querySelector("#of-apply").onclick = () => S.applyOffset();
      el.querySelector("#of-cancel").onclick = () => {
        state2.offset = null;
        S.showOffsetBar(false);
        S.refreshMeasurements();
        S.showHint("Offset cancelled");
      };
      el.style.display = "flex";
    };
    S.applyOffset = function applyOffset() {
      const prev = S.computeOffsetPreview();
      if (!prev) {
        S.showHint("Offset too large \u2014 reduce the distance");
        return;
      }
      const __b = S.vectorSnapshot();
      if (state2.offset.type === "shape") {
        const src = state2.shapes[state2.offset.idx] || {};
        if (prev.ellipse) {
          S.pushShapeEntity({ kind: "ellipse", cx: prev.cx, cy: prev.cy, rx: prev.rx, ry: prev.ry, stroke: src.stroke, width: src.width });
        } else {
          S.pushShapeEntity({ kind: src.kind === "rect" ? "rect" : "polygon", pts: prev.map((p) => ({ x: p.x, y: p.y })), closed: true, stroke: src.stroke, width: src.width });
        }
        S.showHint("Offset shape created");
      } else {
        const src = state2.measurements[state2.offset.idx];
        const name = (src && src.name ? src.name : "Room") + " offset";
        state2.measurements.push({ type: "area", name, points: prev.map((p) => ({ x: p.x, y: p.y })), label: "", x1: prev[0].x, y1: prev[0].y, x2: prev[0].x, y2: prev[0].y });
        if (typeof S.renderSchedule === "function") S.renderSchedule();
        S.showHint("Offset created as a new room");
      }
      state2.offset = null;
      S.showOffsetBar(false);
      S.refreshMeasurements();
      S.recordVec(__b);
      S.scheduleAutosave();
    };
    S._d3 = function _d3(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    };
    S.massXform = function massXform(b) {
      const poly = S.footPoly(b);
      let cx = 0, cz = 0;
      poly.forEach((p) => {
        cx += p.x;
        cz += p.z;
      });
      cx /= poly.length;
      cz /= poly.length;
      const rot = b.rot || 0, tp = b.taper != null ? b.taper : 1;
      const fsx = b.fsx != null ? b.fsx : b.fscale != null ? b.fscale : 1;
      const fsz = b.fsz != null ? b.fsz : b.fscale != null ? b.fscale : 1;
      const cr = Math.cos(rot), sr = Math.sin(rot), y0 = b.baseY || 0, y1 = y0 + b.h;
      return { cx, cz, fsx, fsz, pt: (lx, lz, which) => {
        const s = which === "top" ? tp : 1;
        const dx = (lx - cx) * fsx * s, dz = (lz - cz) * fsz * s;
        return { x: cx + dx * cr - dz * sr, y: which === "top" ? y1 : y0, z: cz + dx * sr + dz * cr };
      } };
    };
    S.faceGeom = function faceGeom(b, id, planeOverride) {
      const X = S.massXform(b), poly = S.footPoly(b), vs = S.massVerts(b), n = poly.length;
      const base = vs.slice(0, n), top = vs.slice(n);
      if (id === "top" || id === "bottom") {
        const which = planeOverride || (id === "top" ? "top" : "base");
        const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
        const quad = [X.pt(minX, minZ, which), X.pt(maxX, minZ, which), X.pt(maxX, maxZ, which), X.pt(minX, maxZ, which)];
        const clip = which === "top" ? top : base;
        const guide = poly.map((p) => ({ x: (p.x - minX) / (maxX - minX || 1), y: (p.z - minZ) / (maxZ - minZ || 1) }));
        return { quad, clip, w: (maxX - minX) * X.fsx, h: (maxZ - minZ) * X.fsz, guide };
      }
      const i = parseInt(id.slice(4), 10), j = (i + 1) % n;
      return { quad: [top[i], top[j], base[j], base[i]], clip: null, w: S._d3(base[i], base[j]), h: b.h, guide: null };
    };
    S.faceLabel = function faceLabel(id) {
      return id === "top" ? "Roof plan" : id === "bottom" ? "Floor plan" : "Elevation";
    };
    S.massFaceAt = function massFaceAt(sx, sy) {
      let best = null, bd = -Infinity;
      S.massing.masses.forEach((b, bi) => {
        const vs = S.massVerts(b).map(S.mProject);
        S.massFaces(b).forEach((f) => {
          const pts = f.idx.map((i) => vs[i]);
          if (S.pointInPoly(sx, sy, pts)) {
            let depth = 0;
            for (const i of f.idx) depth += vs[i].depth;
            depth /= f.idx.length;
            if (depth > bd) {
              bd = depth;
              best = { bi, id: f.id };
            }
          }
        });
      });
      return best;
    };
    S.ensureFaceImg = function ensureFaceImg(b) {
      if (!b.faceArt) return;
      b._faceImg = b._faceImg || {};
      for (const id in b.faceArt) {
        if (!b._faceImg[id]) {
          const img = new Image();
          img.onload = () => S.renderMassing();
          img.src = b.faceArt[id];
          b._faceImg[id] = img;
        }
      }
    };
    S._bilinear = function _bilinear(quad, u, v) {
      const tx = quad[0].x + (quad[1].x - quad[0].x) * u, ty = quad[0].y + (quad[1].y - quad[0].y) * u, tz = quad[0].z + (quad[1].z - quad[0].z) * u;
      const bx = quad[3].x + (quad[2].x - quad[3].x) * u, by = quad[3].y + (quad[2].y - quad[3].y) * u, bz = quad[3].z + (quad[2].z - quad[3].z) * u;
      return { x: tx + (bx - tx) * v, y: ty + (by - ty) * v, z: tz + (bz - tz) * v };
    };
    S.renderFaceRegions = function renderFaceRegions(mctx, fb, f) {
      const regs = fb.faceRegions && fb.faceRegions[f.id];
      if (!regs || !regs.length) return;
      const g = S.faceGeom(fb, f.id);
      if (!g || !g.quad) return;
      regs.forEach((r) => {
        if (!r.uv || r.uv.length < 3) return;
        if (r.depth && Math.abs(r.depth) >= 1) return;
        const scr = r.uv.map((p) => S.mProject(S._bilinear(g.quad, p.u, p.v)));
        S.mctx.beginPath();
        S.mctx.moveTo(scr[0].x, scr[0].y);
        for (let i = 1; i < scr.length; i++) S.mctx.lineTo(scr[i].x, scr[i].y);
        S.mctx.closePath();
        const m = r.mat;
        if (m && m.kind === "texture") {
          const pat = S.regionPattern(m);
          S.mctx.fillStyle = pat || "rgba(160,40,53,0.14)";
        } else {
          const tr = S.matFill(m);
          if (tr) S.mctx.fillStyle = tr;
          else if (m && m.kind === "color") S.mctx.fillStyle = m.hex;
          else S.mctx.fillStyle = "rgba(160,40,53,0.14)";
        }
        S.mctx.fill();
        S.mctx.strokeStyle = m ? "rgba(40,36,33,0.7)" : "#a02835";
        S.mctx.lineWidth = 2;
        S.mctx.lineJoin = "round";
        S.mctx.stroke();
      });
    };
    S.extrudeRegionFaces = function extrudeRegionFaces(b, faceId, region, depthM) {
      const g = S.faceGeom(b, faceId);
      if (!g || !g.quad || !region.uv || region.uv.length < 3) return [];
      const Q = g.quad;
      const sub = (a, c) => ({ x: a.x - c.x, y: a.y - c.y, z: a.z - c.z });
      const add = (a, c) => ({ x: a.x + c.x, y: a.y + c.y, z: a.z + c.z });
      const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
      const cross = (a, c) => ({ x: a.y * c.z - a.z * c.y, y: a.z * c.x - a.x * c.z, z: a.x * c.y - a.y * c.x });
      const dot = (a, c) => a.x * c.x + a.y * c.y + a.z * c.z;
      const norm = (a) => {
        const L = Math.hypot(a.x, a.y, a.z) || 1;
        return { x: a.x / L, y: a.y / L, z: a.z / L };
      };
      const avg = (arr) => {
        const s = { x: 0, y: 0, z: 0 };
        arr.forEach((p) => {
          s.x += p.x;
          s.y += p.y;
          s.z += p.z;
        });
        return mul(s, 1 / arr.length);
      };
      const C = avg(S.massVerts(b));
      let N = norm(cross(sub(Q[1], Q[0]), sub(Q[3], Q[0])));
      const faceC = S._bilinear(Q, 0.5, 0.5);
      if (dot(N, sub(faceC, C)) < 0) N = mul(N, -1);
      const base = region.uv.map((p) => S._bilinear(Q, p.u, p.v));
      const cap = base.map((p) => add(p, mul(N, depthM)));
      const out = [{ world: cap.slice(), n: [N.x, N.y, N.z], id: "feat:" + faceId + ":cap" }];
      const m = base.length;
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m, wq = [base[i], base[j], cap[j], cap[i]];
        let sn = norm(cross(sub(wq[1], wq[0]), sub(wq[3], wq[0])));
        if (dot(sn, sub(avg(wq), faceC)) < 0) sn = mul(sn, -1);
        out.push({ world: wq, n: [sn.x, sn.y, sn.z], id: "feat:" + faceId + ":s" + i });
      }
      return out;
    };
    S.faceOutwardNormal = function faceOutwardNormal(b, faceId) {
      const g = S.faceGeom(b, faceId);
      if (!g || !g.quad) return { x: 0, y: 1, z: 0 };
      const Q = g.quad;
      const sub = (a, c) => ({ x: a.x - c.x, y: a.y - c.y, z: a.z - c.z });
      const cross = (a, c) => ({ x: a.y * c.z - a.z * c.y, y: a.z * c.x - a.x * c.z, z: a.x * c.y - a.y * c.x });
      const dot = (a, c) => a.x * c.x + a.y * c.y + a.z * c.z;
      const norm = (a) => {
        const L = Math.hypot(a.x, a.y, a.z) || 1;
        return { x: a.x / L, y: a.y / L, z: a.z / L };
      };
      let N = norm(cross(sub(Q[1], Q[0]), sub(Q[3], Q[0])));
      const vs = S.massVerts(b);
      const C = { x: 0, y: 0, z: 0 };
      vs.forEach((p) => {
        C.x += p.x;
        C.y += p.y;
        C.z += p.z;
      });
      C.x /= vs.length;
      C.y /= vs.length;
      C.z /= vs.length;
      if (dot(N, sub(S._bilinear(Q, 0.5, 0.5), C)) < 0) N = { x: -N.x, y: -N.y, z: -N.z };
      return N;
    };
    S._ptPolyNear = function _ptPolyNear(px, py, poly, tol) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
        let t = ((px - a.x) * dx + (py - a.y) * dy) / L2;
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)) <= tol) return true;
      }
      return false;
    };
    S.massPushLimits = function massPushLimits(b) {
      const vs = S.massVerts(b);
      if (!vs || !vs.length) return { hi: 5e3, lo: -5e3 };
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity, mnz = Infinity, mxz = -Infinity;
      vs.forEach((p) => {
        mnx = Math.min(mnx, p.x);
        mxx = Math.max(mxx, p.x);
        mny = Math.min(mny, p.y);
        mxy = Math.max(mxy, p.y);
        mnz = Math.min(mnz, p.z);
        mxz = Math.max(mxz, p.z);
      });
      const dx = mxx - mnx, dy = mxy - mny, dz = mxz - mnz;
      const maxExt = Math.max(dx, dy, dz), minHoriz = Math.min(dx, dz);
      return { hi: Math.round(maxExt * 2 * 1e3), lo: -Math.round(Math.max(0.35, minHoriz * 1.05) * 1e3) };
    };
    S.faceUAt = function faceUAt(sx, sy, b, faceId) {
      const g = S.faceGeom(b, faceId);
      if (!g || !g.quad) return 0.5;
      const TL = S.mProject(g.quad[0]), TR = S.mProject(g.quad[1]);
      const ax = TR.x - TL.x, ay = TR.y - TL.y, L2 = ax * ax + ay * ay || 1;
      const t = ((sx - TL.x) * ax + (sy - TL.y) * ay) / L2;
      return Math.max(0, Math.min(1, t));
    };
    S.placeOpeningOnFace = function placeOpeningOnFace(bi, faceId, uCenter, kind) {
      const b = S.massing.masses[bi];
      if (!b) return false;
      const g = S.faceGeom(b, faceId);
      if (!g || !g.quad) return false;
      const W = g.w || 1, H = g.h || 1;
      if (W <= 0.05 || H <= 0.05) {
        S.massHint("Face too small for an opening");
        return false;
      }
      let w, h, sill;
      if (kind === "door") {
        w = 0.9;
        h = 2.1;
        sill = 0;
      } else {
        w = 1.2;
        h = 1.5;
        sill = 0.9;
      }
      w = Math.min(w, W * 0.92);
      h = Math.min(h, H * 0.92);
      if (sill + h > H) sill = Math.max(0, H - h);
      let uL = uCenter - w / 2 / W, uR = uCenter + w / 2 / W;
      if (uL < 0) {
        uR -= uL;
        uL = 0;
      }
      if (uR > 1) {
        uL -= uR - 1;
        uR = 1;
      }
      uL = Math.max(0, uL);
      uR = Math.min(1, uR);
      const vBot = 1 - sill / H, vTop = 1 - (sill + h) / H;
      const uv = [{ u: uL, v: vTop }, { u: uR, v: vTop }, { u: uR, v: vBot }, { u: uL, v: vBot }];
      const mat = kind === "window" ? { kind: "color", hex: "#7d97a8", id: "glass", glass: true } : { kind: "color", hex: "#3a3330", id: "door" };
      S.massSnapshot();
      b.faceRegions = b.faceRegions || {};
      b.faceRegions[faceId] = b.faceRegions[faceId] || [];
      b.faceRegions[faceId].push({ uv, depth: -100, mat, opening: kind });
      S.renderMassing();
      return true;
    };
    S.regionAt = function regionAt(sx, sy) {
      let best = null, bd = -Infinity;
      S.massing.masses.forEach((b, bi) => {
        if (!b.faceRegions) return;
        Object.keys(b.faceRegions).forEach((faceId) => {
          const g = S.faceGeom(b, faceId);
          if (!g || !g.quad) return;
          let N = null;
          b.faceRegions[faceId].forEach((region, ri) => {
            if (!region.uv || region.uv.length < 3) return;
            let world = region.uv.map((p) => S._bilinear(g.quad, p.u, p.v));
            const dM = (region.depth || 0) / 1e3;
            if (Math.abs(dM) > 1e-4) {
              if (!N) N = S.faceOutwardNormal(b, faceId);
              world = world.map((p) => ({ x: p.x + N.x * dM, y: p.y + N.y * dM, z: p.z + N.z * dM }));
            }
            const scr = world.map(S.mProject);
            if (S.pointInPoly(sx, sy, scr) || S._ptPolyNear(sx, sy, scr, 9)) {
              let depth = 0;
              scr.forEach((p) => depth += p.depth);
              depth /= scr.length;
              if (depth > bd) {
                bd = depth;
                best = { bi, faceId, ri, region };
              }
            }
          });
        });
      });
      return best;
    };
    S.drawFaceArt = function drawFaceArt(ctx, quad, img, clipPoly, project) {
      if (!img || !img.complete || !img.naturalWidth) return;
      project = project || S.mProject;
      const N = S.massing.cam.projection === "persp" ? S.massing.dragging ? 2 : 8 : 1;
      const [TL, TR, BR, BL] = quad, IW = img.width, IH = img.height;
      const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
      const at = (u, v) => lerp(lerp(TL, TR, u), lerp(BL, BR, u), v);
      ctx.save();
      if (clipPoly && clipPoly.length) {
        const cp = clipPoly.map(project);
        ctx.beginPath();
        ctx.moveTo(cp[0].x, cp[0].y);
        for (let k = 1; k < cp.length; k++) ctx.lineTo(cp[k].x, cp[k].y);
        ctx.closePath();
        ctx.clip();
      }
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const u0 = c / N, u1 = (c + 1) / N, v0 = r / N, v1 = (r + 1) / N;
          const sP0 = project(at(u0, v0)), sP1 = project(at(u1, v0)), sP2 = project(at(u1, v1)), sP3 = project(at(u0, v1));
          const sx = u0 * IW, sy = v0 * IH, cw = IW / N, ch = IH / N;
          const a = (sP1.x - sP0.x) / cw, b2 = (sP1.y - sP0.y) / cw, cc = (sP3.x - sP0.x) / ch, d = (sP3.y - sP0.y) / ch;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(sP0.x, sP0.y);
          ctx.lineTo(sP1.x, sP1.y);
          ctx.lineTo(sP2.x, sP2.y);
          ctx.lineTo(sP3.x, sP3.y);
          ctx.closePath();
          ctx.clip();
          ctx.setTransform(a, b2, cc, d, sP0.x, sP0.y);
          ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
          ctx.restore();
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.restore();
    };
    S.gizmoHandles = function gizmoHandles(b) {
      const poly = S.footPoly(b);
      let cx = 0, cz = 0;
      poly.forEach((p) => {
        cx += p.x;
        cz += p.z;
      });
      cx /= poly.length;
      cz /= poly.length;
      const fsx = b.fsx != null ? b.fsx : b.fscale != null ? b.fscale : 1;
      const fsz = b.fsz != null ? b.fsz : b.fscale != null ? b.fscale : 1;
      const rot = b.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot);
      const y0 = b.baseY || 0, y1 = y0 + b.h;
      const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const midX = (minX + maxX) / 2, midZ = (minZ + maxZ) / 2;
      const w2w = (lx, lz, y) => {
        const dx = (lx - cx) * fsx, dz = (lz - cz) * fsz;
        return { x: cx + dx * cr - dz * sr, y, z: cz + dx * sr + dz * cr };
      };
      const scr = (lx, lz, y) => {
        const s = S.mProject(w2w(lx, lz, y));
        return { x: s.x, y: s.y };
      };
      const handles = [];
      [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]].forEach((c) => handles.push({ type: "scale", ...scr(c[0], c[1], y0) }));
      handles.push({ type: "stretch", axis: "x", ...scr(maxX, midZ, y0) });
      handles.push({ type: "stretch", axis: "x", ...scr(minX, midZ, y0) });
      handles.push({ type: "stretch", axis: "z", ...scr(midX, maxZ, y0) });
      handles.push({ type: "stretch", axis: "z", ...scr(midX, minZ, y0) });
      {
        const s = S.mProject({ x: cx, y: y1, z: cz });
        handles.push({ type: "height", x: s.x, y: s.y });
      }
      {
        handles.push({ type: "rotate", ...scr(maxX + (maxX - minX) * 0.4 + 0.6, midZ, y0) });
      }
      return { handles, cx, cz };
    };
    S.gizmoPick = function gizmoPick(sx, sy) {
      if (S.massing.selected < 0 || !S.massing.masses[S.massing.selected]) return null;
      const { handles } = S.gizmoHandles(S.massing.masses[S.massing.selected]);
      let best = null, bd = 20 * 20;
      for (const h of handles) {
        const dx = h.x - sx, dy = h.y - sy, d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = h;
        }
      }
      return best;
    };
    S.drawGizmo = function drawGizmo(b) {
      const { handles } = S.gizmoHandles(b);
      handles.forEach((h) => {
        S.mctx.beginPath();
        if (h.type === "rotate") S.mctx.arc(h.x, h.y, 6.5, 0, Math.PI * 2);
        else S.mctx.rect(h.x - 5.5, h.y - 5.5, 11, 11);
        S.mctx.fillStyle = h.type === "height" ? "#a02835" : h.type === "rotate" ? "#fff" : "#fff";
        S.mctx.fill();
        S.mctx.lineWidth = 2;
        S.mctx.strokeStyle = "#a02835";
        S.mctx.stroke();
      });
    };
    S.massPointerDown = function massPointerDown(e) {
      e.preventDefault();
      S.massingCanvas.setPointerCapture(e.pointerId);
      const r = S.massingCanvas.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const t = S.massing.tool;
      if (t === "orbit") {
        S.massing.dragging = { type: "orbit", sx, sy, az0: S.massing.cam.az, el0: S.massing.cam.el };
        return;
      }
      if (t === "pan") {
        S.massing.dragging = { type: "pan", sx, sy, px0: S.massing.panX || 0, py0: S.massing.panY || 0 };
        return;
      }
      if (t === "add") {
        const g = S.mGroundPick(sx, sy);
        S.massing.dragging = { type: "foot", x0: S.mSnap(g.x), z0: S.mSnap(g.z), x1: S.mSnap(g.x), z1: S.mSnap(g.z) };
        S.massHint("Drag to size the footprint, release to extrude");
        return;
      }
      if (t === "push") {
        const hit2 = S.regionAt(sx, sy);
        if (!hit2) {
          S.massHint("Tap a face region to push or pull \u2014 draw one with Sketch \u2192 Region");
          return;
        }
        const b = S.massing.masses[hit2.bi];
        const fc = (() => {
          const g = S.faceGeom(b, hit2.faceId);
          return S._bilinear(g.quad, 0.5, 0.5);
        })();
        const N = S.faceOutwardNormal(b, hit2.faceId);
        const s0 = S.mProject(fc), s1 = S.mProject({ x: fc.x + N.x, y: fc.y + N.y, z: fc.z + N.z });
        const vx = s1.x - s0.x, vy = s1.y - s0.y, len = Math.hypot(vx, vy) || 1;
        S.massing.dragging = {
          type: "pushpull",
          bi: hit2.bi,
          faceId: hit2.faceId,
          ri: hit2.ri,
          sx0: sx,
          sy0: sy,
          depth0: hit2.region.depth || 0,
          dirX: vx / len,
          dirY: vy / len,
          pxPerM: len,
          moved: false
        };
        S.massing.selected = hit2.bi;
        S.massHint("Drag out to extrude, in to recess");
        return;
      }
      if (t === "sketch") {
        const fp = S.massFaceAt(sx, sy);
        if (fp) S.openFaceEditor(fp.bi, fp.id);
        else S.massHint("Tap a face (wall, roof or floor) to sketch on it");
        return;
      }
      if (t === "material") {
        if (!S.massing.activeMat) {
          S.massHint("Pick a material from the palette first");
          return;
        }
        const rg = S.regionAt(sx, sy);
        if (rg) {
          S.applyMaterialToRegion(rg);
          return;
        }
        const fp = S.massFaceAt(sx, sy);
        if (fp) S.applyMaterialToFace(fp.bi, fp.id);
        else S.massHint("Pick a material, then tap a face or a region");
        return;
      }
      if (t === "build") {
        const mode = S.massing.buildMode || "wall";
        if (mode === "wall") {
          S.addWallVertex(sx, sy);
          return;
        }
        const oh = S.openingAt(sx, sy);
        if (oh) {
          S.selectOpening(oh);
          S.massing.dragging = { type: "openSlide", bi: oh.bi, idx: oh.idx, moved: false };
          return;
        }
        const fp = S.massFaceAt(sx, sy);
        if (fp && S.massing.masses[fp.bi] && !S.massing.masses[fp.bi]._wall) {
          const u = S.faceUAt(sx, sy, S.massing.masses[fp.bi], fp.id);
          if (S.placeOpeningOnFace(fp.bi, fp.id, u, mode)) {
            S.massing.selected = fp.bi;
            S.massHint((mode === "door" ? "Door" : "Window") + " placed \u2014 recessed into the face");
          }
          return;
        }
        const bi = S.massAt(sx, sy);
        if (bi < 0) {
          S.massHint("Tap a wall or mass to " + (S.massing.cutMode ? "cut" : "place") + " a " + mode);
          return;
        }
        if (S.massing.cutMode) S.cutOpening(sx, sy, bi, mode);
        else S.placeOpening(bi, mode);
        return;
      }
      const hit = S.massAt(sx, sy);
      if (t === "select") {
        const hp = S.massing.selected >= 0 ? S.gizmoPick(sx, sy) : null;
        if (hp) {
          S.massSnapshot();
          const b = S.massing.masses[S.massing.selected];
          const bt = S.massBaseTop(b), cx = bt.cx, cz = bt.cz, rot = b.rot || 0;
          const fsx = b.fsx != null ? b.fsx : b.fscale != null ? b.fscale : 1;
          const fsz = b.fsz != null ? b.fsz : b.fscale != null ? b.fscale : 1;
          const gp = S.mGroundPick(sx, sy);
          if (hp.type === "height") {
            S.massing.dragging = { type: "height", bi: S.massing.selected, sy0: sy, h0: b.h };
            S.massHint("Drag up / down to push-pull height");
          } else if (hp.type === "rotate") {
            S.massing.dragging = { type: "grotate", bi: S.massing.selected, cx, cz, rot0: rot, ang0: Math.atan2(gp.z - cz, gp.x - cx) };
            S.massHint("Drag around to rotate");
          } else if (hp.type === "scale") {
            S.massing.dragging = { type: "gscale", bi: S.massing.selected, cx, cz, fsx0: fsx, fsz0: fsz, r0: Math.max(0.05, Math.hypot(gp.x - cx, gp.z - cz)) };
            S.massHint("Drag to scale the footprint");
          } else if (hp.type === "stretch") {
            const cr = Math.cos(rot), sr = Math.sin(rot);
            const proj = hp.axis === "x" ? (gp.x - cx) * cr + (gp.z - cz) * sr : -(gp.x - cx) * sr + (gp.z - cz) * cr;
            S.massing.dragging = { type: "gstretch", bi: S.massing.selected, cx, cz, rot0: rot, axis: hp.axis, fsx0: fsx, fsz0: fsz, ext0: Math.max(0.05, Math.abs(proj)) };
            S.massHint("Drag to push / pull this side");
          }
          return;
        }
        S.massing.selOpening = null;
        S.massing.selected = hit;
        if (hit >= 0) {
          S.massSnapshot();
          const g = S.mGroundPick(sx, sy);
          const b = S.massing.masses[hit];
          S.massing.dragging = { type: "move", axis: "ground", bi: hit, sx, sy, sy0: sy, gx0: g.x, gz0: g.z, bx0: b.x, bz0: b.z, baseY0: b.baseY || 0, poly0: b.poly ? b.poly.map((p) => ({ x: p.x, z: p.z })) : null };
          S.massHint("Drag to move \xB7 grab a handle to push-pull, scale or rotate");
        } else {
          S.massHint("Tap a mass to select it");
        }
        S.refreshInspector();
        S.renderMassing();
        return;
      }
      if (t === "remove") {
        const oh = S.openingAt(sx, sy);
        if (oh) {
          S.massing.selOpening = oh;
          S.deleteSelOpening();
          return;
        }
        if (hit >= 0) {
          S.massSnapshot();
          S.massing.masses.splice(hit, 1);
          if (S.massing.selected === hit) S.massing.selected = -1;
          else if (S.massing.selected > hit) S.massing.selected--;
          if (S.massing.masses.length === 0) S.massing.baseAnchor = null;
          S.massHint(S.massing.masses.length ? "Removed \xB7 tap another to remove" : "All masses removed");
        } else {
          S.massHint("Tap a mass to remove it");
        }
        S.refreshInspector();
        S.renderMassing();
        return;
      }
      if (t === "move") {
        S.massing.selected = hit;
        if (hit >= 0) {
          S.massSnapshot();
          const g = S.mGroundPick(sx, sy);
          const b = S.massing.masses[hit];
          S.massing.dragging = {
            type: "move",
            bi: hit,
            sx,
            sy,
            sy0: sy,
            axis: null,
            gx0: g.x,
            gz0: g.z,
            bx0: b.x,
            bz0: b.z,
            baseY0: b.baseY || 0,
            poly0: b.poly ? b.poly.map((p) => ({ x: p.x, z: p.z })) : null
          };
          S.massHint("Drag sideways to move on ground \xB7 drag up/down to raise/lower");
        }
        S.refreshInspector();
        S.renderMassing();
        return;
      }
      if (t === "height") {
        S.massing.selected = hit;
        if (hit >= 0) {
          S.massSnapshot();
          S.massing.dragging = { type: "height", bi: hit, sy0: sy, h0: S.massing.masses[hit].h };
          S.massHint("Drag up / down to push-pull height");
        }
        S.refreshInspector();
        S.renderMassing();
        return;
      }
    };
    S.massPointerMove = function massPointerMove(e) {
      if (!S.massing.dragging) return;
      const r = S.massingCanvas.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const d = S.massing.dragging;
      if (d.type === "orbit") {
        S.massing.cam.az = d.az0 + (sx - d.sx) * 0.01;
        S.massing.cam.el = Math.max(0.12, Math.min(1.45, d.el0 + (sy - d.sy) * 8e-3));
      } else if (d.type === "pan") {
        S.massing.panX = d.px0 + (sx - d.sx);
        S.massing.panY = d.py0 + (sy - d.sy);
      } else if (d.type === "foot") {
        const g = S.mGroundPick(sx, sy);
        d.x1 = S.mSnap(g.x);
        d.z1 = S.mSnap(g.z);
      } else if (d.type === "move") {
        const b = S.massing.masses[d.bi];
        if (!d.axis) {
          const adx = Math.abs(sx - d.sx), ady = Math.abs(sy - d.sy);
          if (adx + ady > 6) {
            d.axis = ady > adx * 1.7 ? "y" : "ground";
            S.massHint(d.axis === "y" ? "\u2195 elevation" : "move on ground");
          }
        }
        if (d.axis === "y") {
          const dy = S.mSnapH((d.sy0 - sy) / S.massing.cam.scale);
          b.baseY = Math.max(0, d.baseY0 + dy);
        } else if (d.axis === "ground") {
          const g = S.mGroundPick(sx, sy);
          if (b.poly && d.poly0) {
            const dx = S.mSnap(g.x - d.gx0), dz = S.mSnap(g.z - d.gz0);
            b.poly = d.poly0.map((p) => ({ x: p.x + dx, z: p.z + dz }));
          } else {
            b.x = S.mSnap(d.bx0 + (g.x - d.gx0));
            b.z = S.mSnap(d.bz0 + (g.z - d.gz0));
          }
        }
      } else if (d.type === "height") {
        const b = S.massing.masses[d.bi];
        b.h = Math.max(0.1, S.mSnapH(d.h0 + (d.sy0 - sy) / S.massing.cam.scale));
      } else if (d.type === "grotate") {
        const gp = S.mGroundPick(sx, sy);
        const ang = Math.atan2(gp.z - d.cz, gp.x - d.cx);
        S.massing.masses[d.bi].rot = d.rot0 + (ang - d.ang0);
      } else if (d.type === "gscale") {
        const gp = S.mGroundPick(sx, sy);
        const f = Math.max(0.1, Math.hypot(gp.x - d.cx, gp.z - d.cz) / d.r0);
        const b = S.massing.masses[d.bi];
        b.fsx = Math.max(0.1, d.fsx0 * f);
        b.fsz = Math.max(0.1, d.fsz0 * f);
        delete b.fscale;
      } else if (d.type === "gstretch") {
        const gp = S.mGroundPick(sx, sy);
        const cr = Math.cos(d.rot0), sr = Math.sin(d.rot0);
        const proj = d.axis === "x" ? (gp.x - d.cx) * cr + (gp.z - d.cz) * sr : -(gp.x - d.cx) * sr + (gp.z - d.cz) * cr;
        const f = Math.max(0.1, Math.abs(proj) / d.ext0);
        const b = S.massing.masses[d.bi];
        if (d.axis === "x") b.fsx = Math.max(0.1, d.fsx0 * f);
        else b.fsz = Math.max(0.1, d.fsz0 * f);
        delete b.fscale;
      } else if (d.type === "pushpull") {
        const b = S.massing.masses[d.bi];
        const regs = b && b.faceRegions && b.faceRegions[d.faceId];
        if (regs && regs[d.ri]) {
          if (!d.moved) {
            S.massSnapshot();
            d.moved = true;
          }
          const deltaM = ((sx - d.sx0) * d.dirX + (sy - d.sy0) * d.dirY) / d.pxPerM;
          let mm = Math.round((d.depth0 + deltaM * 1e3) / 10) * 10;
          const lim = d.lim || (d.lim = S.massPushLimits(b));
          mm = Math.max(lim.lo, Math.min(lim.hi, mm));
          regs[d.ri].depth = mm;
          S.massHint((mm > 0 ? "Pull +" : mm < 0 ? "Recess " : "Flat ") + (mm !== 0 ? Math.abs(mm) + "mm" : ""));
        }
      } else if (d.type === "openSlide") {
        const b = S.massing.masses[d.bi];
        if (b && b.openings && b.openings[d.idx]) {
          if (!d.moved) {
            S.massSnapshot();
            d.moved = true;
          }
          const op = b.openings[d.idx];
          const p = b.poly, dux = p[1].x - p[0].x, duz = p[1].z - p[0].z;
          const L2 = dux * dux + duz * duz, L = Math.sqrt(L2) || 1;
          const g = S.mGroundPick(sx, sy);
          const u = ((g.x - p[0].x) * dux + (g.z - p[0].z) * duz) / L2;
          const half = Math.min(0.49, op.w / 2 / L);
          op.u = Math.max(half, Math.min(1 - half, u));
        }
      }
      S.renderMassing();
    };
    S.massPointerUp = function massPointerUp(e) {
      try {
        S.massingCanvas.releasePointerCapture(e.pointerId);
      } catch (_) {
      }
      const d = S.massing.dragging;
      if (d && d.type === "foot") {
        let { x0, z0, x1, z1 } = d;
        const x = Math.min(x0, x1), z = Math.min(z0, z1);
        const w = Math.abs(x1 - x0) || S.massing.grid * 3;
        const dd = Math.abs(z1 - z0) || S.massing.grid * 3;
        S.massSnapshot();
        S.massing.masses.push({ x, z, w, d: dd, h: S.massing.grid * 3 });
        S.massing.selected = S.massing.masses.length - 1;
        S.massHint("Use Height to push-pull \xB7 Orbit to spin the view");
      }
      if (d && d.type === "openSlide" && d.moved) S.massHint("Opening moved \xB7 drag again to slide \xB7 resize with the fields");
      if (d && d.type === "pushpull") {
        const b = S.massing.masses[d.bi];
        const regs = b && b.faceRegions && b.faceRegions[d.faceId];
        const mm = regs && regs[d.ri] ? regs[d.ri].depth || 0 : 0;
        if (d.moved) S.massHint(mm > 0 ? "Pulled out " + mm + "mm" : mm < 0 ? "Recessed " + -mm + "mm" : "Flattened");
      }
      S.massing.dragging = null;
      S.refreshInspector();
      S.renderMassing();
    };
    S.massingCanvas.addEventListener("pointerdown", S.massPointerDown);
    S.massingCanvas.addEventListener("pointermove", S.massPointerMove);
    S.massingCanvas.addEventListener("pointerup", S.massPointerUp);
    S.massingCanvas.addEventListener("pointercancel", () => {
      S.massing.dragging = null;
    });
    S.massPinch = null;
    S.massPointers = /* @__PURE__ */ new Map();
    S.massingCanvas.addEventListener("pointerdown", (e) => S.massPointers.set(e.pointerId, e));
    S.massingCanvas.addEventListener("pointermove", (e) => {
      if (S.massPointers.has(e.pointerId)) S.massPointers.set(e.pointerId, e);
      if (S.massPointers.size === 2) {
        const [a, b] = [...S.massPointers.values()];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (S.massPinch) {
          S.massing.cam.scale = Math.max(6, Math.min(160, S.massPinch.s0 * dist / S.massPinch.d0));
          S.renderMassing();
        } else S.massPinch = { d0: dist, s0: S.massing.cam.scale };
      }
    });
    S.massingCanvas.addEventListener("pointerup", (e) => {
      S.massPointers.delete(e.pointerId);
      if (S.massPointers.size < 2) S.massPinch = null;
    });
    S.massingCanvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      S.massing.cam.scale = Math.max(6, Math.min(160, S.massing.cam.scale * (e.deltaY < 0 ? 1.08 : 0.93)));
      S.renderMassing();
    }, { passive: false });
    S._perpDist = function _perpDist(p, a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
      if (!len2) return Math.hypot(p.x - a.x, p.y - a.y);
      let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    };
    S.simplifyPoly = function simplifyPoly(pts, eps) {
      if (pts.length < 3) return pts.slice();
      let dmax = 0, idx = 0;
      const a = pts[0], b = pts[pts.length - 1];
      for (let i = 1; i < pts.length - 1; i++) {
        const d = S._perpDist(pts[i], a, b);
        if (d > dmax) {
          dmax = d;
          idx = i;
        }
      }
      if (dmax > eps) {
        const left = S.simplifyPoly(pts.slice(0, idx + 1), eps);
        const right = S.simplifyPoly(pts.slice(idx), eps);
        return left.slice(0, -1).concat(right);
      }
      return [a, b];
    };
    S.traceMaskContour = function traceMaskContour(mask, bbox) {
      const W = S.doc.wPx, H = S.doc.hPx;
      const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
      let sx = -1, sy = -1;
      outer: for (let y = bbox.y; y < bbox.y + bbox.h; y++)
        for (let x = bbox.x; x < bbox.x + bbox.w; x++)
          if (mask[y * W + x]) {
            sx = x;
            sy = y;
            break outer;
          }
      if (sx < 0) return [];
      const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      const contour = [];
      let cx = sx, cy = sy, bdir = 4;
      const maxSteps = (bbox.w + bbox.h) * 8 + 4e3;
      let steps = 0;
      do {
        contour.push({ x: cx, y: cy });
        let found = false;
        for (let k = 1; k <= 8; k++) {
          const dir = (bdir + k) % 8;
          const nx = cx + dirs[dir][0], ny = cy + dirs[dir][1];
          if (inside(nx, ny)) {
            bdir = (dir + 4 + 1) % 8;
            cx = nx;
            cy = ny;
            found = true;
            break;
          }
        }
        if (!found) break;
        steps++;
      } while ((cx !== sx || cy !== sy) && steps < maxSteps);
      return contour;
    };
    S.pxPerMetre = function pxPerMetre() {
      if (state2.pxPerUnit && state2.scaleUnit) {
        const unitInMm = { mm: 1, cm: 10, m: 1e3, in: 25.4, ft: 304.8 }[state2.scaleUnit] || 1;
        return state2.pxPerUnit / unitInMm * 1e3;
      }
      return S.doc.wPx / S.doc.wMM * 1e3;
    };
    S.extrudeSelection = function extrudeSelection() {
      if (!state2.selection) {
        S.showHint("Make a selection first (wand or lasso)");
        return;
      }
      const { mask, bbox } = state2.selection;
      const contour = S.traceMaskContour(mask, bbox);
      if (contour.length < 3) {
        S.showHint("Could not read a footprint outline");
        return;
      }
      let simp = S.simplifyPoly(contour, 8);
      const TOL = 3;
      simp = simp.filter((p, k) => {
        const q = simp[(k + 1) % simp.length];
        return !(Math.abs(p.x - q.x) < TOL && Math.abs(p.y - q.y) < TOL);
      });
      if (simp.length > 2 && Math.abs(simp[0].x - simp[simp.length - 1].x) < TOL && Math.abs(simp[0].y - simp[simp.length - 1].y) < TOL) simp = simp.slice(0, -1);
      if (simp.length < 3) {
        S.showHint("Footprint too small to extrude");
        return;
      }
      const ppm = S.pxPerMetre();
      let cx = 0, cz = 0;
      simp.forEach((p) => {
        cx += p.x;
        cz += p.y;
      });
      cx /= simp.length;
      cz /= simp.length;
      if (S.massing.masses.length === 0 || !S.massing.baseAnchor) {
        S.massing.baseAnchor = { px: cx, py: cz, ppm };
      }
      const A = S.massing.baseAnchor;
      const poly = simp.map((p) => ({ x: (p.x - A.px) / A.ppm, z: (p.y - A.py) / A.ppm }));
      const hadScale = !!(state2.pxPerUnit && state2.scaleUnit);
      S.clearSelection();
      S.enterMassing();
      S.massing.showBase = true;
      S.updateMassBaseBtn();
      S.massSnapshot();
      S.massing.masses.push({ poly, h: 3 });
      S.massing.selected = S.massing.masses.length - 1;
      S.refreshInspector();
      S.massing.tool = "select";
      S.syncMassToolButtons();
      S.renderMassing();
      S.massHint(hadScale ? "Extruded to 3 m \xB7 grab a handle to push-pull / scale / rotate \xB7 Exit when done" : "Extruded (no drawing scale set \u2014 size approximate) \xB7 use the handles to edit \xB7 Exit");
    };
    S.shapeInteriorMask = function shapeInteriorMask(geom) {
      const W = S.doc.wPx, H = S.doc.hPx;
      const mask = new Uint8Array(W * H);
      if (geom.kind === "rect") {
        const x0 = Math.max(0, Math.floor(Math.min(geom.x, geom.x + geom.w)));
        const y0 = Math.max(0, Math.floor(Math.min(geom.y, geom.y + geom.h)));
        const x1 = Math.min(W, Math.ceil(Math.max(geom.x, geom.x + geom.w)));
        const y1 = Math.min(H, Math.ceil(Math.max(geom.y, geom.y + geom.h)));
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * W + x] = 1;
        return { mask, bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
      }
      if (geom.kind === "circle") {
        const { cx, cy, r } = geom, r2 = r * r;
        const x0 = Math.max(0, Math.floor(cx - r)), y0 = Math.max(0, Math.floor(cy - r));
        const x1 = Math.min(W, Math.ceil(cx + r)), y1 = Math.min(H, Math.ceil(cy + r));
        for (let y = y0; y < y1; y++) {
          const dy = y - cy;
          for (let x = x0; x < x1; x++) {
            const dx = x - cx;
            if (dx * dx + dy * dy <= r2) mask[y * W + x] = 1;
          }
        }
        return { mask, bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
      }
      const pts = geom.pts;
      let minX = W, minY = H, maxX = 0, maxY = 0;
      pts.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      const yLo = Math.max(0, Math.floor(minY)), yHi = Math.min(H - 1, Math.ceil(maxY));
      for (let y = yLo; y <= yHi; y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if (a.y <= y && b.y > y || b.y <= y && a.y > y) {
            xs.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x));
          }
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xa = Math.max(0, Math.ceil(xs[k])), xb = Math.min(W - 1, Math.floor(xs[k + 1]));
          for (let x = xa; x <= xb; x++) mask[y * W + x] = 1;
        }
      }
      return { mask, bbox: { x: Math.max(0, Math.floor(minX)), y: yLo, w: Math.min(W, Math.ceil(maxX) + 1) - Math.max(0, Math.floor(minX)), h: yHi - yLo + 1 } };
    };
    S.shapeFootprint = function shapeFootprint(geom) {
      if (geom.kind === "rect") {
        return [{ x: geom.x, y: geom.y }, { x: geom.x + geom.w, y: geom.y }, { x: geom.x + geom.w, y: geom.y + geom.h }, { x: geom.x, y: geom.y + geom.h }];
      }
      if (geom.kind === "circle") {
        const N = 48, out = [];
        for (let i = 0; i < N; i++) {
          const t = i / N * Math.PI * 2;
          out.push({ x: geom.cx + geom.r * Math.cos(t), y: geom.cy + geom.r * Math.sin(t) });
        }
        return out;
      }
      return geom.pts.map((p) => ({ x: p.x, y: p.y }));
    };
    S.fillShape = function fillShape(geom) {
      const { mask, bbox } = S.shapeInteriorMask(geom);
      if (!bbox || bbox.w <= 0 || bbox.h <= 0) {
        S.showHint("Nothing to fill");
        return;
      }
      const l = S.activeLayer();
      S.applyFill(l, mask);
      S.saveSnapshot(l);
      if (state2.fillStyle === "image" && S.currentFillTexture()) {
        state2._lastShapeFill = { type: "image", img: S.currentFillTexture(), scale: state2.fillTexScale };
      } else {
        const c = S.hexToRgba(state2.color);
        state2._lastShapeFill = { type: "color", rgb: [c[0], c[1], c[2]] };
      }
      S.renderLayers();
      S.showHint(state2.fillStyle === "image" && S.currentFillTexture() ? "Filled with texture" : "Filled");
    };
    S.extrudePolygon = function extrudePolygon(ptsPx, fill) {
      if (!ptsPx || ptsPx.length < 3) {
        S.showHint("Need a closed shape to extrude");
        return;
      }
      const ppm = S.pxPerMetre();
      let cx = 0, cz = 0;
      ptsPx.forEach((p) => {
        cx += p.x;
        cz += p.y;
      });
      cx /= ptsPx.length;
      cz /= ptsPx.length;
      if (S.massing.masses.length === 0 || !S.massing.baseAnchor) {
        S.massing.baseAnchor = { px: cx, py: cz, ppm };
      }
      const A = S.massing.baseAnchor;
      const poly = ptsPx.map((p) => ({ x: (p.x - A.px) / A.ppm, z: (p.y - A.py) / A.ppm }));
      const hadScale = !!(state2.pxPerUnit && state2.scaleUnit);
      S.enterMassing();
      S.massing.showBase = true;
      S.updateMassBaseBtn();
      S.massSnapshot();
      S.massing.masses.push({ poly, h: 3 });
      S.massing.selected = S.massing.masses.length - 1;
      if (fill) S.applyMaterialToMass(S.massing.masses[S.massing.selected], fill);
      S.refreshInspector();
      S.massing.tool = "select";
      S.syncMassToolButtons();
      S.renderMassing();
      S.massHint(hadScale ? "Extruded to 3 m \xB7 grab a handle to push-pull / scale / rotate \xB7 Exit when done" : "Extruded (no drawing scale set \u2014 size approximate) \xB7 use the handles to edit \xB7 Exit");
    };
    S.extrudeShape = function extrudeShape(geom) {
      S.extrudePolygon(S.shapeFootprint(geom), state2._lastShapeFill);
    };
    S.makeMaterialFaceCanvas = function makeMaterialFaceCanvas(wM, hM, texImg, tileM) {
      const MAXDIM = 1024, FA_PPM = 48;
      const maxM = Math.max(wM, hM, 0.1);
      const ppm = Math.min(FA_PPM, MAXDIM / maxM);
      const cw = Math.max(2, Math.round(wM * ppm)), ch = Math.max(2, Math.round(hM * ppm));
      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const cx = c.getContext("2d");
      const iw = texImg.naturalWidth || texImg.width || 1, ih = texImg.naturalHeight || texImg.height || 1;
      const tw = Math.max(2, Math.round(Math.max(0.05, tileM) * ppm));
      const th = Math.max(2, Math.round(tw * (ih / iw)));
      const tc = document.createElement("canvas");
      tc.width = tw;
      tc.height = th;
      tc.getContext("2d").drawImage(texImg, 0, 0, tw, th);
      const pat = cx.createPattern(tc, "repeat");
      cx.fillStyle = pat;
      cx.fillRect(0, 0, cw, ch);
      return c.toDataURL("image/png");
    };
    S.applyMaterialToMass = function applyMaterialToMass(mass, fill) {
      if (!fill || !mass) return;
      if (fill.type === "color") {
        mass.color = fill.rgb.slice(0, 3);
        return;
      }
      if (fill.type === "image" && fill.img && fill.img.complete) {
        const tileM = (fill.img.naturalWidth || fill.img.width) * (fill.scale || 1) / S.pxPerMetre();
        mass.faceArt = mass.faceArt || {};
        const gTop = S.faceGeom(mass, "top");
        if (gTop) mass.faceArt["top"] = S.makeMaterialFaceCanvas(gTop.w, gTop.h, fill.img, tileM);
        const n = mass.poly.length;
        for (let i = 0; i < n; i++) {
          const gs = S.faceGeom(mass, "side" + i);
          if (gs) mass.faceArt["side" + i] = S.makeMaterialFaceCanvas(gs.w, gs.h, fill.img, tileM);
        }
        mass._faceImg = {};
        S.ensureFaceImg(mass);
      }
    };
    S.MAT_COLORS = [
      ["Concrete", "#9a978f"],
      ["Off-white", "#e8e6e1"],
      ["Charcoal", "#3a3a3e"],
      ["Brick", "#9c4a36"],
      ["Timber", "#b07a45"],
      ["Glass", "#7d97a8"]
    ];
    S.MAT_PRESETS = [
      ["Concrete", { kind: "color", hex: "#9a978f", id: "mat-concrete" }],
      ["Wood", { kind: "color", hex: "#a9743f", id: "mat-wood" }],
      ["Glass", { kind: "color", hex: "#7d97a8", id: "mat-glass", glass: true }],
      ["Water", { kind: "color", hex: "#3f7d96", id: "mat-water", alpha: 0.62 }],
      ["Grass", { kind: "color", hex: "#6f8a4e", id: "mat-grass" }]
    ];
    S._matSrcCache = {};
    S.matSrcImage = function matSrcImage(src) {
      if (!src) return null;
      if (S._matSrcCache[src]) return S._matSrcCache[src];
      const img = new Image();
      img.onload = () => {
        if (S.massing.active) S.renderMassing();
      };
      img.src = src;
      S._matSrcCache[src] = img;
      return img;
    };
    S.cloneMat = function cloneMat(m) {
      return m ? { ...m } : null;
    };
    S.matFaceImg = function matFaceImg(mass, faceId, mat) {
      const g = S.faceGeom(mass, faceId);
      if (!g) return null;
      mass._matImg = mass._matImg || {};
      mass._matSig = mass._matSig || {};
      const cached = mass._matImg[faceId] || null;
      if (S.massing.dragging && cached) return cached;
      const sig = `${(g.w || 0).toFixed(2)}x${(g.h || 0).toFixed(2)}x${mat.id}x${mat.scale || 1}`;
      if (cached && mass._matSig[faceId] === sig) return cached;
      const srcImg = S.matSrcImage(mat.src);
      if (!srcImg || !srcImg.complete || !srcImg.naturalWidth) return cached;
      const tileM = srcImg.naturalWidth * (mat.scale || 1) / S.pxPerMetre();
      const img = new Image();
      img.onload = () => {
        if (S.massing.active) S.renderMassing();
      };
      img.src = S.makeMaterialFaceCanvas(g.w, g.h, srcImg, tileM);
      mass._matImg[faceId] = img;
      mass._matSig[faceId] = sig;
      return cached;
    };
    S.applyMaterialToFace = function applyMaterialToFace(bi, id) {
      const mat = S.massing.activeMat;
      if (!mat) {
        S.massHint("Pick a material from the palette first");
        return;
      }
      const b = S.massing.masses[bi];
      if (!b) return;
      S.massSnapshot();
      b.faceMat = b.faceMat || {};
      if ((S.massing.matScope || "face") === "mass") {
        b.faceMat["top"] = S.cloneMat(mat);
        for (let i = 0; i < b.poly.length; i++) b.faceMat["side" + i] = S.cloneMat(mat);
      } else {
        b.faceMat[id] = S.cloneMat(mat);
      }
      b._matImg = {};
      b._matSig = {};
      S.renderMassing();
      S.massHint((S.massing.matScope === "mass" ? "Material on the whole mass" : "Material on " + S.faceLabel(id)) + " \xB7 scale holds on resize");
    };
    S._matPaletteEl = null;
    S.ensureMatPalette = function ensureMatPalette() {
      if (S._matPaletteEl) return S._matPaletteEl;
      const style = document.createElement("style");
      style.textContent = "#mat-palette{position:fixed;z-index:1250;display:none;flex-direction:column;gap:8px;left:50%;transform:translateX(-50%);bottom:120px;background:#1c1a18;border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,0.45);max-width:92vw;}#mat-palette .row{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:center;}#mat-palette .sw{width:30px;height:30px;border-radius:8px;border:2px solid transparent;cursor:pointer;background-size:cover;background-position:center;}#mat-palette .sw.active{border-color:#a02835;}#mat-palette .lab{font:600 10px ui-sans-serif,system-ui;color:rgba(255,255,255,0.45);letter-spacing:.04em;text-transform:uppercase;}#mat-palette .scope{display:flex;border:1px solid rgba(255,255,255,0.14);border-radius:8px;overflow:hidden;}#mat-palette .scope button{font:600 11px ui-sans-serif,system-ui;color:rgba(255,255,255,0.6);background:transparent;border:none;padding:6px 12px;cursor:pointer;}#mat-palette .scope button.on{background:#a02835;color:#fff;}";
      document.head.appendChild(style);
      const el = document.createElement("div");
      el.id = "mat-palette";
      el.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      document.body.appendChild(el);
      S._matPaletteEl = el;
      return el;
    };
    S.markActiveSwatch = function markActiveSwatch(b) {
      if (S._matPaletteEl) S._matPaletteEl.querySelectorAll(".sw").forEach((s) => s.classList.remove("active"));
      if (b) b.classList.add("active");
    };
    S.buildMatPalette = function buildMatPalette() {
      const el = S.ensureMatPalette();
      S.massing.matScope = S.massing.matScope || "face";
      el.innerHTML = "";
      const pr = document.createElement("div");
      pr.className = "row";
      const pl = document.createElement("span");
      pl.className = "lab";
      pl.textContent = "Materials";
      pr.appendChild(pl);
      S.MAT_PRESETS.forEach(([name, mat]) => {
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;";
        const b = document.createElement("div");
        b.className = "sw";
        b.title = name;
        b.style.background = mat.glass ? "linear-gradient(135deg,rgba(150,182,206,0.6),rgba(150,182,206,0.18))" : mat.alpha != null ? (() => {
          const c = S.hexToRgba(mat.hex);
          return `rgba(${c[0]},${c[1]},${c[2]},${mat.alpha})`;
        })() : mat.hex;
        b.addEventListener("click", () => {
          S.massing.activeMat = { ...mat };
          S.markActiveSwatch(b);
        });
        const cap = document.createElement("span");
        cap.style.cssText = "font:600 8px ui-sans-serif,system-ui;color:rgba(255,255,255,0.5);";
        cap.textContent = name;
        wrap.appendChild(b);
        wrap.appendChild(cap);
        pr.appendChild(wrap);
      });
      el.appendChild(pr);
      const cr = document.createElement("div");
      cr.className = "row";
      const cl = document.createElement("span");
      cl.className = "lab";
      cl.textContent = "Colour";
      cr.appendChild(cl);
      S.MAT_COLORS.forEach(([name, hex]) => {
        const b = document.createElement("div");
        b.className = "sw";
        b.title = name;
        b.style.background = hex;
        b.addEventListener("click", () => {
          S.massing.activeMat = { kind: "color", hex, id: "c" + hex };
          S.markActiveSwatch(b);
        });
        cr.appendChild(b);
      });
      el.appendChild(cr);
      const tr = document.createElement("div");
      tr.className = "row";
      const tl = document.createElement("span");
      tl.className = "lab";
      tl.textContent = "Texture";
      tr.appendChild(tl);
      const texes = state2.fillTextures || [];
      if (!texes.length) {
        const hint = document.createElement("span");
        hint.className = "lab";
        hint.style.textTransform = "none";
        hint.style.color = "rgba(255,255,255,0.35)";
        hint.textContent = "\u2014 import in the 2D Fill panel";
        tr.appendChild(hint);
      }
      texes.forEach((t, i) => {
        const b = document.createElement("div");
        b.className = "sw";
        b.title = t.name || "texture " + (i + 1);
        b.style.backgroundImage = `url(${t.dataUrl})`;
        b.addEventListener("click", () => {
          S.massing.activeMat = { kind: "texture", src: t.dataUrl, scale: state2.fillTexScale || 1, id: "t" + i };
          S.markActiveSwatch(b);
        });
        tr.appendChild(b);
      });
      el.appendChild(tr);
      const sr = document.createElement("div");
      sr.className = "row";
      const sl = document.createElement("span");
      sl.className = "lab";
      sl.textContent = "Apply to";
      sr.appendChild(sl);
      const sc = document.createElement("div");
      sc.className = "scope";
      [["face", "Face"], ["mass", "Whole mass"]].forEach(([scope, label]) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.classList.toggle("on", (S.massing.matScope || "face") === scope);
        b.addEventListener("click", () => {
          S.massing.matScope = scope;
          sc.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
          b.classList.add("on");
        });
        sc.appendChild(b);
      });
      sr.appendChild(sc);
      el.appendChild(sr);
    };
    S.applyMaterialToRegion = function applyMaterialToRegion(rg) {
      const mat = S.massing.activeMat;
      if (!mat) return;
      const b = S.massing.masses[rg.bi];
      if (!b) return;
      const regs = b.faceRegions && b.faceRegions[rg.faceId];
      if (!regs || !regs[rg.ri]) return;
      S.massSnapshot();
      regs[rg.ri].mat = S.cloneMat(mat);
      S.renderMassing();
      S.massHint(S.isGlassMat(mat) ? "Glass / translucent on region" : "Material on region");
    };
    S.isGlassMat = function isGlassMat(m) {
      return !!m && m.kind === "color" && (m.hex === "#7d97a8" || m.glass);
    };
    S.matFill = function matFill(m) {
      if (!m || m.kind !== "color") return null;
      if (m.glass || m.hex === "#7d97a8") return "rgba(150,182,206,0.42)";
      if (m.alpha != null) {
        const c = S.hexToRgba(m.hex);
        return `rgba(${c[0]},${c[1]},${c[2]},${m.alpha})`;
      }
      return null;
    };
    S._regionPatCache = {};
    S.regionPattern = function regionPattern(mat) {
      if (!mat || mat.kind !== "texture" || !mat.src) return null;
      if (S._regionPatCache[mat.src] !== void 0) return S._regionPatCache[mat.src];
      const img = S.matSrcImage(mat.src);
      if (!img || !img.complete || !img.naturalWidth) return null;
      const pat = S.mctx.createPattern(img, "repeat");
      S._regionPatCache[mat.src] = pat;
      return pat;
    };
    S.updateMatPalette = function updateMatPalette() {
      const show = S.massing.active && S.massing.tool === "material";
      if (show) {
        S.buildMatPalette();
        S._matPaletteEl.style.display = "flex";
      } else if (S._matPaletteEl) S._matPaletteEl.style.display = "none";
    };
    initWalls();
    S._shapeChipEl = null;
    S.ensureShapeChip = function ensureShapeChip() {
      if (S._shapeChipEl) return S._shapeChipEl;
      const style = document.createElement("style");
      style.textContent = '#shape-chip{position:fixed;z-index:9999;display:none;gap:6px;padding:5px;background:rgba(20,20,22,0.94);border:1px solid rgba(255,255,255,0.12);border-radius:11px;box-shadow:0 8px 24px rgba(0,0,0,0.4);backdrop-filter:blur(6px);}#shape-chip button{font:600 12px/1 ui-sans-serif,system-ui,sans-serif;color:#fff;border:none;border-radius:7px;padding:9px 15px;cursor:pointer;letter-spacing:.02em;}#shape-chip button[data-act="fill"]{background:#2c2c33;}#shape-chip button[data-act="extrude"]{background:#a02835;}#shape-chip button:active{transform:scale(0.96);}';
      document.head.appendChild(style);
      const el = document.createElement("div");
      el.id = "shape-chip";
      el.innerHTML = '<button data-act="fill">Fill</button><button data-act="extrude">Extrude</button>';
      document.body.appendChild(el);
      el.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      el.addEventListener("click", (ev) => {
        const act = ev.target && ev.target.dataset && ev.target.dataset.act;
        if (!act) return;
        const geom = state2._lastShape;
        if (!geom) {
          S.hideShapeChip();
          return;
        }
        if (act === "fill") {
          S.fillShape(geom);
        } else if (act === "extrude") {
          S.hideShapeChip();
          S.extrudeShape(geom);
        }
      });
      S._shapeChipEl = el;
      return el;
    };
    S.showShapeChip = function showShapeChip(geom, screenPt) {
      const el = S.ensureShapeChip();
      state2._lastShape = geom;
      el.style.display = "flex";
      const r = el.getBoundingClientRect();
      const px = screenPt ? screenPt.x : window.innerWidth / 2;
      const py = screenPt ? screenPt.y : window.innerHeight / 2;
      let left = px - r.width / 2, top = py - r.height - 18;
      left = Math.max(8, Math.min(window.innerWidth - r.width - 8, left));
      top = Math.max(8, Math.min(window.innerHeight - r.height - 8, top));
      el.style.left = left + "px";
      el.style.top = top + "px";
    };
    S.hideShapeChip = function hideShapeChip() {
      if (S._shapeChipEl) S._shapeChipEl.style.display = "none";
    };
    S.onShapeCommitted = function onShapeCommitted(geom, screenPt) {
      if (!geom) return;
      state2._lastShapeFill = null;
      S.showShapeChip(geom, screenPt);
    };
    S.massState = function massState() {
      const skipCache = (k, v) => {
        if (typeof v === "function") return void 0;
        if (typeof HTMLImageElement !== "undefined" && v instanceof HTMLImageElement) return void 0;
        if (typeof HTMLCanvasElement !== "undefined" && v instanceof HTMLCanvasElement) return void 0;
        if (typeof ImageBitmap !== "undefined" && v instanceof ImageBitmap) return void 0;
        return v;
      };
      return {
        masses: JSON.parse(JSON.stringify(S.massing.masses, skipCache)),
        selected: S.massing.selected,
        anchor: S.massing.baseAnchor ? { ...S.massing.baseAnchor } : null
      };
    };
    S.massApply = function massApply(s) {
      S.massing.masses = JSON.parse(JSON.stringify(s.masses));
      S.massing.selected = s.selected;
      S.massing.baseAnchor = s.anchor ? { ...s.anchor } : null;
    };
    S.massSnapshot = function massSnapshot() {
      S.massing.undoStack.push(S.massState());
      if (S.massing.undoStack.length > 60) S.massing.undoStack.shift();
      S.massing.redoStack = [];
      if (typeof S.scheduleMassAutosave === "function") S.scheduleMassAutosave();
    };
    S.massUndo = function massUndo() {
      if (!S.massing.undoStack.length) {
        S.massHint("Nothing to undo");
        return;
      }
      S.massing.redoStack.push(S.massState());
      S.massApply(S.massing.undoStack.pop());
      S.renderMassing();
      S.refreshInspector();
      S.massHint("Undo");
    };
    S.massRedo = function massRedo() {
      if (!S.massing.redoStack.length) {
        S.massHint("Nothing to redo");
        return;
      }
      S.massing.undoStack.push(S.massState());
      S.massApply(S.massing.redoStack.pop());
      S.renderMassing();
      S.refreshInspector();
      S.massHint("Redo");
    };
    S.massInspector = $el("mass-inspector");
    S._inspBefore = null;
    S.refreshInspector = function refreshInspector() {
      const b = S.massing.selected >= 0 ? S.massing.masses[S.massing.selected] : null;
      const show = b && S.massing.active && (window.StudioHelpers ? window.StudioHelpers.shouldShowMassInspector(S.massing) : ["select", "move", "height", "push", "material"].includes(S.massing.tool));
      if (!show) {
        S.massInspector.style.display = "none";
        return;
      }
      S.massInspector.style.display = "flex";
      $el("insp-h").value = (+b.h).toFixed(1);
      $el("insp-base").value = (+(b.baseY || 0)).toFixed(1);
      $el("insp-rot").value = Math.round((b.rot || 0) * 180 / Math.PI);
      $el("insp-fscale").value = Math.round((b.fsx != null ? b.fsx : b.fscale != null ? b.fscale : 1) * 100);
      $el("insp-taper").value = Math.round((b.taper != null ? b.taper : 1) * 100);
    };
    S._inspApply = function _inspApply() {
      const b = S.massing.selected >= 0 ? S.massing.masses[S.massing.selected] : null;
      if (!b) return;
      const h = parseFloat($el("insp-h").value);
      const base = parseFloat($el("insp-base").value);
      const rot = parseFloat($el("insp-rot").value);
      const fs = parseFloat($el("insp-fscale").value);
      const tp = parseFloat($el("insp-taper").value);
      if (!isNaN(h)) b.h = Math.max(0.1, h);
      if (!isNaN(base)) b.baseY = Math.max(0, base);
      if (!isNaN(rot)) b.rot = rot * Math.PI / 180;
      if (!isNaN(fs)) {
        b.fsx = Math.max(0.1, fs / 100);
        b.fsz = Math.max(0.1, fs / 100);
        delete b.fscale;
      }
      if (!isNaN(tp)) b.taper = Math.max(0.05, tp / 100);
      S.renderMassing();
    };
    ["insp-h", "insp-base", "insp-rot", "insp-fscale", "insp-taper"].forEach((id) => {
      const el = $el(id);
      el.addEventListener("focus", () => {
        S._inspBefore = S.massState();
      });
      el.addEventListener("input", S._inspApply);
      el.addEventListener("change", () => {
        if (S._inspBefore) {
          S.massing.undoStack.push(S._inspBefore);
          if (S.massing.undoStack.length > 60) S.massing.undoStack.shift();
          S.massing.redoStack = [];
          S._inspBefore = null;
        }
      });
    });
    S.duplicateMass = function duplicateMass() {
      if (S.massing.selected < 0 || !S.massing.masses[S.massing.selected]) {
        S.massHint("Select a mass first (Move-tap), then Duplicate");
        return;
      }
      S.massSnapshot();
      const copy = JSON.parse(JSON.stringify(S.massing.masses[S.massing.selected]));
      const off = 2;
      if (copy.poly) copy.poly = copy.poly.map((p) => ({ x: p.x + off, z: p.z + off }));
      else {
        copy.x += off;
        copy.z += off;
      }
      S.massing.masses.push(copy);
      S.massing.selected = S.massing.masses.length - 1;
      S.renderMassing();
      S.refreshInspector();
      S.massHint("Duplicated \xB7 Move to reposition");
    };
    S.deleteSelectedMass = function deleteSelectedMass() {
      if (S.massing.selected < 0 || !S.massing.masses[S.massing.selected]) {
        S.massHint("Select a mass first (Move-tap), then Delete");
        return;
      }
      S.massSnapshot();
      S.massing.masses.splice(S.massing.selected, 1);
      S.massing.selected = -1;
      if (S.massing.masses.length === 0) S.massing.baseAnchor = null;
      S.renderMassing();
      S.refreshInspector();
      S.massHint("Deleted");
    };
    S.showModeLoading = function showModeLoading(show) {
      const el = $el("studio-mode-loading");
      if (el) {
        if (show) {
          el.hidden = false;
          el.setAttribute("aria-hidden", "false");
        } else {
          el.hidden = true;
          el.setAttribute("aria-hidden", "true");
        }
      }
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "sketchtrude-mode-loading",
          loading: !!show,
          projectId: window.__SKETCHTRUDE_PROJECT_ID
        }, "*");
      }
    };
    S.enterMassing = function enterMassing() {
      S.showModeLoading(true);
      requestAnimationFrame(() => {
        try {
          S.dismissSketchOverlays();
          S.releaseTransientInput();
          state2.tool = "massing";
          S.massing.active = true;
          if (!S.massing.baseAnchor) S.massing.baseAnchor = { px: S.doc.wPx / 2, py: S.doc.hPx / 2, ppm: S.pxPerMetre() };
          S.syncWallsToMasses();
          S.buildMassingBase();
          S.massingCanvas.style.display = "block";
          S.massingBar.style.display = "flex";
          S.updateMassBaseBtn();
          if (S.massing.cam.scale === 1) {
            const r = S.area.getBoundingClientRect();
            S.massing.cam.scale = Math.min(r.width, r.height) / 26;
          }
          S.massHint("Add: drag a footprint on the ground, then use Height");
          S.renderMassing();
          S.updateZoomDisplay();
          S.highlightRailGroups();
          S.syncMassToolButtons();
        } finally {
          requestAnimationFrame(() => S.showModeLoading(false));
        }
      });
    };
    S.exitMassing = function exitMassing() {
      S.showModeLoading(true);
      requestAnimationFrame(() => {
        try {
          S.massing.active = false;
          S.massing.dragging = null;
          S.massing.selected = -1;
          if (window._closeMassMenus) window._closeMassMenus();
          if (typeof S.updateMatPalette === "function") S.updateMatPalette();
          if (typeof S.updateBuildPalette === "function") S.updateBuildPalette();
          $el("mass-inspector").style.display = "none";
          S.massingCanvas.style.display = "none";
          S.massingBar.style.display = "none";
          S.massHint("");
          S.initGrainTips();
          S.regroupRail();
          S.setTool("pen");
          S.fitToScreen();
        } finally {
          requestAnimationFrame(() => S.showModeLoading(false));
        }
      });
    };
    S.drawMassingAligned = function drawMassingAligned(ctx) {
      const A = S.massing.baseAnchor || { px: S.doc.wPx / 2, py: S.doc.hPx / 2, ppm: S.pxPerMetre() };
      S.massing.masses.forEach((b) => {
        const foot = S.massBaseTop(b).base;
        const pts = foot.map((p) => ({ x: A.px + p.x * A.ppm, y: A.py + p.z * A.ppm }));
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.fillStyle = "rgba(160,40,53,0.10)";
        ctx.fill();
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(34,30,28,0.92)";
        ctx.lineWidth = 3;
        ctx.stroke();
        if (b.faceArt && b.faceArt.top) {
          S.ensureFaceImg(b);
          const g = S.faceGeom(b, "top", "base");
          const dp = (p) => ({ x: A.px + p.x * A.ppm, y: A.py + p.z * A.ppm });
          S.drawFaceArt(ctx, g.quad, b._faceImg.top, g.clip, dp);
        }
        let cx = 0, cy = 0;
        pts.forEach((p) => {
          cx += p.x;
          cy += p.y;
        });
        cx /= pts.length;
        cy /= pts.length;
        ctx.fillStyle = "rgba(34,30,28,0.85)";
        ctx.font = "600 30px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${b.h.toFixed(1)} m`, cx, cy);
      });
    };
    S.flattenMassingToLayer = function flattenMassingToLayer() {
      if (!S.massing.masses.length) {
        S.showHint("Add some masses first");
        return;
      }
      const tmp = document.createElement("canvas");
      tmp.width = S.doc.wPx;
      tmp.height = S.doc.hPx;
      S.drawMassingAligned(tmp.getContext("2d"));
      S.createLayer("Massing plan");
      const layer = state2.layers[state2.layers.length - 1];
      state2.activeLayer = state2.layers.length - 1;
      layer.ctx.drawImage(tmp, 0, 0);
      S.saveSnapshot(layer);
      S.updateLayerOrder();
      S.renderLayers();
      S.updateUI();
      S.massHint("Plan added on a new layer \xB7 Exit when done");
    };
    S.exportAngledView = function exportAngledView() {
      if (!S.massing.masses.length) {
        S.showHint("Add some masses first");
        return;
      }
      S.massing._export = true;
      S.renderMassing();
      const src = S.massingCanvas;
      const tmp = document.createElement("canvas");
      tmp.width = S.doc.wPx;
      tmp.height = S.doc.hPx;
      const scale = Math.min(S.doc.wPx / src.width, S.doc.hPx / src.height) * 0.94;
      const dw = src.width * scale, dh = src.height * scale;
      tmp.getContext("2d").drawImage(src, (S.doc.wPx - dw) / 2, (S.doc.hPx - dh) / 2, dw, dh);
      S.massing._export = false;
      S.renderMassing();
      S.createLayer("3D view");
      const layer = state2.layers[state2.layers.length - 1];
      state2.activeLayer = state2.layers.length - 1;
      layer.ctx.drawImage(tmp, 0, 0);
      S.saveSnapshot(layer);
      S.updateLayerOrder();
      S.renderLayers();
      S.updateUI();
      S.massHint("3D view added on a new layer \xB7 Exit when done");
    };
    S.drawElevationInto = function drawElevationInto(ctx, az, scale, ox, groundY) {
      const proj = (p) => {
        const q = S.mRotY(p, az);
        return { x: ox + q.x * scale, y: groundY - q.y * scale, depth: q.z };
      };
      const faces = [];
      S.massing.masses.forEach((b) => {
        const vs = S.massVerts(b).map(proj);
        S.massFaces(b).forEach((f) => {
          let d = 0;
          for (const i of f.idx) d += vs[i].depth;
          d /= f.idx.length;
          faces.push({ b, id: f.id, pts: f.idx.map((i) => vs[i]), n: f.n, depth: d });
        });
      });
      faces.sort((a, b) => a.depth - b.depth);
      faces.forEach((f) => {
        ctx.beginPath();
        ctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
        ctx.closePath();
        ctx.fillStyle = "rgba(236,232,226,0.95)";
        ctx.fill();
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(26,23,21,0.92)";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (f.b.faceArt && f.b.faceArt[f.id]) {
          S.ensureFaceImg(f.b);
          const g = S.faceGeom(f.b, f.id);
          S.drawFaceArt(ctx, g.quad, f.b._faceImg[f.id], g.clip, proj);
        }
      });
    };
    S.generateElevations = function generateElevations() {
      if (!S.massing.masses.length) {
        S.showHint("Add some masses first");
        return;
      }
      const views = [
        { a: 0, label: "FRONT (S)" },
        { a: Math.PI / 2, label: "RIGHT (E)" },
        { a: Math.PI, label: "BACK (N)" },
        { a: -Math.PI / 2, label: "LEFT (W)" }
      ];
      let gW = 0, gH = 0;
      const measured = views.map((o) => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        S.massing.masses.forEach((b) => S.massVerts(b).forEach((p) => {
          const q = S.mRotY(p, o.a);
          if (q.x < minX) minX = q.x;
          if (q.x > maxX) maxX = q.x;
          if (q.y < minY) minY = q.y;
          if (q.y > maxY) maxY = q.y;
        }));
        gW = Math.max(gW, maxX - minX);
        gH = Math.max(gH, maxY - minY);
        return { minX, maxX, maxY };
      });
      const pad = Math.min(S.doc.wPx, S.doc.hPx) * 0.06;
      const cellW = (S.doc.wPx - pad * 3) / 2;
      const cellH = (S.doc.hPx - pad * 3) / 2 - 44;
      const fit = Math.min(cellW / (gW || 1), cellH / (gH || 1)) * 0.82;
      const tmp = document.createElement("canvas");
      tmp.width = S.doc.wPx;
      tmp.height = S.doc.hPx;
      const ctx = tmp.getContext("2d");
      views.forEach((o, i) => {
        const col = i % 2, row = i / 2 | 0;
        const cx0 = pad + col * (cellW + pad), cy0 = pad + row * (cellH + pad + 44);
        const m = measured[i];
        const midX = (m.minX + m.maxX) / 2;
        const ox = cx0 + cellW / 2 - midX * fit;
        const groundY = cy0 + cellH - cellH * 0.08;
        S.drawElevationInto(ctx, o.a, fit, ox, groundY);
        ctx.fillStyle = "rgba(34,30,28,0.82)";
        ctx.font = "600 26px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(o.label, cx0 + cellW / 2, cy0 + cellH + 22);
      });
      S.createLayer("Elevations");
      const layer = state2.layers[state2.layers.length - 1];
      state2.activeLayer = state2.layers.length - 1;
      layer.ctx.drawImage(tmp, 0, 0);
      S.saveSnapshot(layer);
      S.updateLayerOrder();
      S.renderLayers();
      S.updateUI();
      S.massHint("Elevations added on a new layer \xB7 Exit when done");
    };
    S.drawMassingTo = function drawMassingTo(ctx, W, H, bg) {
      const saveCx = S.massing.cx, saveCy = S.massing.cy;
      S.massing.cx = W / 2;
      S.massing.cy = H * 0.58;
      if (bg) {
        ctx.fillStyle = "#e9e5e0";
        ctx.fillRect(0, 0, W, H);
      }
      const faces = [];
      S.massing.masses.forEach((b, bi) => {
        const vs = S.massVerts(b).map(S.mProject);
        const cull = false;
        S.massFaces(b).forEach((f) => {
          const p0 = vs[f.idx[0]], p1 = vs[f.idx[1]], p2 = vs[f.idx[2]];
          const cross = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
          if (cull && cross <= 0) return;
          let depth = 0;
          for (const i of f.idx) depth += vs[i].depth;
          depth /= f.idx.length;
          faces.push({ pts: f.idx.map((i) => vs[i]), n: f.n, depth });
        });
      });
      faces.sort((a, b) => a.depth - b.depth);
      const L = [-0.4, 0.82, 0.4];
      faces.forEach((f) => {
        const ndl = Math.max(0, f.n[0] * L[0] + f.n[1] * L[1] + f.n[2] * L[2]);
        const shade = 0.6 + ndl * 0.4;
        const base = [236, 232, 226];
        const r = Math.round(base[0] * shade), g = Math.round(base[1] * shade), bl = Math.round(base[2] * shade);
        ctx.beginPath();
        ctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
        ctx.closePath();
        ctx.fillStyle = `rgb(${r},${g},${bl})`;
        ctx.fill();
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(20,18,16,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      S.massing.cx = saveCx;
      S.massing.cy = saveCy;
    };
    $all(".mass-tool").forEach((btn) => {
      btn.addEventListener("click", () => {
        $all(".mass-tool").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        S.massing.dragging = null;
        S.massing.tool = btn.dataset.mtool;
        const hints = {
          add: "Drag a footprint on the ground, release to extrude",
          build: "Wall: tap corners (tap first dot to close). Door/Window: tap a wall to drop one. Modes & sizes below.",
          select: "Tap a mass to select \xB7 drag body to move \xB7 grab a handle to push-pull, scale or rotate",
          sketch: "Tap a face \u2014 wall, roof or floor \u2014 to draw its elevation / plan",
          push: "Tap a face region and drag \u2014 out to extrude, in to recess",
          material: "Pick a material, then tap a face \xB7 toggle \u201CWhole mass\u201D to skin all faces",
          remove: "Tap a mass to delete it",
          orbit: "Drag to orbit \xB7 pinch or scroll to zoom",
          pan: "Drag to pan the view"
        };
        S.massHint(hints[S.massing.tool]);
        S.updateMatPalette();
        S.updateBuildPalette();
        S.refreshInspector();
      });
    });
    S.syncMassToolButtons = function syncMassToolButtons() {
      $all(".mass-tool").forEach((b) => b.classList.toggle("active", b.dataset.mtool === S.massing.tool));
      if (typeof S.updateMatPalette === "function") S.updateMatPalette();
      if (typeof S.updateBuildPalette === "function") S.updateBuildPalette();
    };
    (function() {
      const vMenu = $el("mass-view-menu"), eMenu = $el("mass-export-menu");
      const vPop = $el("mass-view-pop"), ePop = $el("mass-export-pop");
      function closeMassMenus() {
        vPop.style.display = "none";
        ePop.style.display = "none";
        vMenu.classList.remove("active");
        eMenu.classList.remove("active");
      }
      function toggle(pop, menu) {
        const open = pop.style.display !== "none";
        closeMassMenus();
        if (!open) {
          pop.style.display = "flex";
          menu.classList.add("active");
        }
      }
      vMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        toggle(vPop, vMenu);
      });
      eMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        toggle(ePop, eMenu);
      });
      ["mass-flatten", "mass-elev", "mass-view"].forEach((id) => $el(id).addEventListener("click", closeMassMenus));
      document.addEventListener("pointerdown", (e) => {
        const t = e.target;
        if (!(t instanceof Element) || !t.closest("#mass-view-pop,#mass-export-pop,#mass-view-menu,#mass-export-menu")) closeMassMenus();
      });
      window._closeMassMenus = closeMassMenus;
    })();
    S.faceEd = { bi: -1, id: null, tool: "pen", color: "#1c1a18", size: 4, drawing: false, last: null, ctx: null, regionPts: [], guide: null, grid: false, snap: false, pxm: 100, gridM: 0.25, fw: 1, fh: 1, openW: 1200, openH: 1500, openSill: 900 };
    S.feCanvas = $el("fe-canvas");
    S.openFaceEditor = function openFaceEditor(bi, id) {
      const b = S.massing.masses[bi];
      if (!b) return;
      const fg = S.faceGeom(b, id);
      if (!fg) return;
      let pxm = 100, wpx = Math.max(64, Math.round(fg.w * pxm)), hpx = Math.max(64, Math.round(fg.h * pxm));
      const cap = 1400, mx = Math.max(wpx, hpx);
      if (mx > cap) {
        const s = cap / mx;
        wpx = Math.round(wpx * s);
        hpx = Math.round(hpx * s);
      }
      S.feCanvas.width = wpx;
      S.feCanvas.height = hpx;
      const ctx = S.feCanvas.getContext("2d");
      S.faceEd.ctx = ctx;
      ctx.clearRect(0, 0, wpx, hpx);
      S.faceEd.guide = fg.guide || null;
      if (b.faceArt && b.faceArt[id]) {
        const im = new Image();
        im.onload = () => ctx.drawImage(im, 0, 0, wpx, hpx);
        im.src = b.faceArt[id];
      }
      S.faceEd.bi = bi;
      S.faceEd.id = id;
      S.faceEd.regionPts = [];
      S.faceEd.pxm = fg.w ? wpx / fg.w : 100;
      S.faceEd.fw = fg.w || 1;
      S.faceEd.fh = fg.h || 1;
      S.faceEd.gridM = S._niceGridM(fg.w || 1, fg.h || 1);
      const gbtn = $el("fe-grid");
      if (gbtn) gbtn.classList.toggle("active", !!S.faceEd.grid);
      const sbtn = $el("fe-snap");
      if (sbtn) sbtn.classList.toggle("active", !!S.faceEd.snap);
      const gmm = $el("fe-gridmm");
      if (gmm) gmm.value = Math.round(S.faceEd.gridM * 1e3);
      if (typeof S._feSyncOpenFields === "function") S._feSyncOpenFields();
      const regs0 = b.faceRegions && b.faceRegions[id];
      const fd = $el("fe-depth");
      if (fd) fd.value = regs0 && regs0.length ? regs0[regs0.length - 1].depth || 0 : 0;
      S.feRedrawOverlay();
      $el("fe-label").textContent = S.faceLabel(id).toUpperCase();
      $el("face-editor").style.display = "flex";
    };
    S.feClose = function feClose() {
      $el("face-editor").style.display = "none";
      S.faceEd.bi = -1;
      S.faceEd.id = null;
      S.faceEd.drawing = false;
      S.faceEd.regionPts = [];
    };
    S.fePos = function fePos(e) {
      const r = S.feCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (S.feCanvas.width / r.width), y: (e.clientY - r.top) * (S.feCanvas.height / r.height) };
    };
    S.feCanvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (S.faceEd.tool === "window" || S.faceEd.tool === "door") {
        const p = S._feSnap(S.fePos(e));
        S.feCommitOpening(p.x / S.feCanvas.width);
        return;
      }
      if (S.faceEd.tool === "region") {
        const p = S._feSnap(S.fePos(e)), pts = S.faceEd.regionPts || (S.faceEd.regionPts = []);
        if (pts.length >= 3 && Math.hypot(p.x - pts[0].x, p.y - pts[0].y) < 14) {
          S.feCommitRegion();
          return;
        }
        pts.push(p);
        S.feRedrawOverlay();
        return;
      }
      S.feCanvas.setPointerCapture(e.pointerId);
      S.faceEd.drawing = true;
      S.faceEd.last = S.fePos(e);
    });
    S.feCanvas.addEventListener("pointermove", (e) => {
      if (S.faceEd.tool === "region" || !S.faceEd.drawing) return;
      const p = S.fePos(e), ctx = S.faceEd.ctx;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = S.faceEd.size;
      if (S.faceEd.tool === "erase") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = S.faceEd.color;
      }
      ctx.beginPath();
      ctx.moveTo(S.faceEd.last.x, S.faceEd.last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      S.faceEd.last = p;
    });
    S.feCommitOpening = function feCommitOpening(uCenter) {
      const b = S.massing.masses[S.faceEd.bi];
      if (!b) return;
      const kind = S.faceEd.tool;
      const W = S.faceEd.fw || 1, H = S.faceEd.fh || 1;
      if (W <= 0.05 || H <= 0.05) {
        if (typeof S.massHint === "function") S.massHint("Face too small for an opening");
        return;
      }
      let w = Math.max(0.1, (S.faceEd.openW || 1200) / 1e3), h = Math.max(0.1, (S.faceEd.openH || 1500) / 1e3);
      let sill = Math.max(0, (S.faceEd.openSill || 0) / 1e3);
      const fitted = w > W * 0.92 || h > H * 0.92 || sill + h > H;
      w = Math.min(w, W * 0.92);
      h = Math.min(h, H * 0.92);
      if (sill + h > H) sill = Math.max(0, H - h);
      let uL = uCenter - w / 2 / W, uR = uCenter + w / 2 / W;
      if (uL < 0) {
        uR -= uL;
        uL = 0;
      }
      if (uR > 1) {
        uL -= uR - 1;
        uR = 1;
      }
      uL = Math.max(0, uL);
      uR = Math.min(1, uR);
      const vBot = 1 - sill / H, vTop = 1 - (sill + h) / H;
      const uv = [{ u: uL, v: vTop }, { u: uR, v: vTop }, { u: uR, v: vBot }, { u: uL, v: vBot }];
      const mat = kind === "window" ? { kind: "color", hex: "#7d97a8", id: "glass", glass: true } : { kind: "color", hex: "#3a3330", id: "door" };
      S.massSnapshot();
      b.faceRegions = b.faceRegions || {};
      b.faceRegions[S.faceEd.id] = b.faceRegions[S.faceEd.id] || [];
      b.faceRegions[S.faceEd.id].push({ uv, depth: -100, mat, opening: kind });
      S.feRedrawOverlay();
      S.renderMassing();
      if (typeof S.massHint === "function") S.massHint((kind === "window" ? "Window placed" : "Door placed") + (fitted ? " \u2014 fitted to face" : " \u2014 adjust depth with Pull"));
    };
    S.feCommitRegion = function feCommitRegion() {
      const b = S.massing.masses[S.faceEd.bi];
      if (!b || !S.faceEd.regionPts || S.faceEd.regionPts.length < 3) {
        S.faceEd.regionPts = [];
        S.feRedrawOverlay();
        return;
      }
      S.massSnapshot();
      b.faceRegions = b.faceRegions || {};
      b.faceRegions[S.faceEd.id] = b.faceRegions[S.faceEd.id] || [];
      b.faceRegions[S.faceEd.id].push({ uv: S.faceEd.regionPts.map((p) => ({ u: p.x / S.feCanvas.width, v: p.y / S.feCanvas.height })) });
      S.faceEd.regionPts = [];
      S.feRedrawOverlay();
      S.renderMassing();
      if (typeof S.massHint === "function") S.massHint("Region added \u2014 it now maps onto the face in 3D");
    };
    S._niceGridM = function _niceGridM(w, h) {
      const big = Math.max(w, h) || 1, target = big / 12;
      const steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5];
      for (const s of steps) if (s >= target) return s;
      return steps[steps.length - 1];
    };
    S._feSnap = function _feSnap(p) {
      if (!S.faceEd.snap || !S.faceEd.pxm || !S.faceEd.gridM) return p;
      const step = S.faceEd.gridM * S.faceEd.pxm;
      return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
    };
    S.facePunctures = function facePunctures(b, faceId) {
      const out = [];
      const regs = b.faceRegions && b.faceRegions[faceId];
      if (regs) regs.forEach((r) => {
        if ((r.depth || 0) < 0 && r.uv && r.uv.length >= 3) out.push(r.uv.map((p) => ({ u: p.u, v: p.v })));
      });
      if ((faceId === "side0" || faceId === "side2") && b.openings && b.h) {
        const L = S.faceEd.fw || 1, H = b.h;
        b.openings.forEach((op) => {
          const halfU = op.w / 2 / L;
          let uc = op.u;
          if (faceId === "side2") uc = 1 - uc;
          const uL = uc - halfU, uR = uc + halfU;
          const sill = op.kind === "door" ? 0 : op.sill || 0;
          const vBot = 1 - sill / H, vTop = 1 - (sill + op.h) / H;
          out.push([{ u: uL, v: vTop }, { u: uR, v: vTop }, { u: uR, v: vBot }, { u: uL, v: vBot }]);
        });
      }
      return out;
    };
    S.feRedrawOverlay = function feRedrawOverlay() {
      const gv = $el("fe-guide");
      if (!gv) return;
      gv.style.display = "block";
      gv.width = S.feCanvas.width;
      gv.height = S.feCanvas.height;
      const gx = gv.getContext("2d");
      gx.clearRect(0, 0, gv.width, gv.height);
      if (S.faceEd.grid && S.faceEd.pxm && S.faceEd.gridM) {
        const step = S.faceEd.gridM * S.faceEd.pxm;
        if (step >= 4) {
          gx.strokeStyle = "rgba(160,40,53,0.13)";
          gx.lineWidth = 1;
          gx.setLineDash([]);
          gx.beginPath();
          for (let x = 0; x <= gv.width + 0.5; x += step) {
            gx.moveTo(x, 0);
            gx.lineTo(x, gv.height);
          }
          for (let y = 0; y <= gv.height + 0.5; y += step) {
            gx.moveTo(0, y);
            gx.lineTo(gv.width, y);
          }
          gx.stroke();
        }
      }
      if (S.faceEd.guide) {
        gx.strokeStyle = "rgba(160,40,53,0.5)";
        gx.setLineDash([8, 6]);
        gx.lineWidth = 2;
        gx.beginPath();
        S.faceEd.guide.forEach((p, k) => {
          const X = p.x * gv.width, Y = p.y * gv.height;
          k ? gx.lineTo(X, Y) : gx.moveTo(X, Y);
        });
        gx.closePath();
        gx.stroke();
      }
      gx.setLineDash([]);
      const b = S.massing.masses[S.faceEd.bi];
      if (b) {
        const punc = S.facePunctures(b, S.faceEd.id);
        punc.forEach((poly) => {
          gx.save();
          gx.beginPath();
          poly.forEach((p, k) => {
            const X = p.u * gv.width, Y = p.v * gv.height;
            k ? gx.lineTo(X, Y) : gx.moveTo(X, Y);
          });
          gx.closePath();
          gx.fillStyle = "rgba(28,26,24,0.16)";
          gx.fill();
          gx.strokeStyle = "rgba(28,26,24,0.65)";
          gx.setLineDash([5, 4]);
          gx.lineWidth = 1.5;
          gx.stroke();
          gx.clip();
          gx.setLineDash([]);
          gx.strokeStyle = "rgba(28,26,24,0.22)";
          gx.lineWidth = 1;
          let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
          poly.forEach((p) => {
            const X = p.u * gv.width, Y = p.v * gv.height;
            mnx = Math.min(mnx, X);
            mny = Math.min(mny, Y);
            mxx = Math.max(mxx, X);
            mxy = Math.max(mxy, Y);
          });
          gx.beginPath();
          for (let d = mny - (mxx - mnx); d <= mxy; d += 9) {
            gx.moveTo(mnx, d);
            gx.lineTo(mxx, d + (mxx - mnx));
          }
          gx.stroke();
          gx.restore();
        });
      }
      const regs = b && b.faceRegions && b.faceRegions[S.faceEd.id] || [];
      regs.forEach((r) => {
        gx.beginPath();
        r.uv.forEach((p, k) => {
          const X = p.u * gv.width, Y = p.v * gv.height;
          k ? gx.lineTo(X, Y) : gx.moveTo(X, Y);
        });
        gx.closePath();
        gx.fillStyle = "rgba(58,110,165,0.18)";
        gx.fill();
        gx.strokeStyle = "#3a6ea5";
        gx.lineWidth = 2;
        gx.stroke();
      });
      const pts = S.faceEd.regionPts || [];
      if (pts.length) {
        gx.strokeStyle = "#a02835";
        gx.lineWidth = 2;
        gx.beginPath();
        pts.forEach((p, k) => {
          k ? gx.lineTo(p.x, p.y) : gx.moveTo(p.x, p.y);
        });
        gx.stroke();
        pts.forEach((p) => {
          gx.fillStyle = "#a02835";
          gx.beginPath();
          gx.arc(p.x, p.y, 4, 0, 6.2832);
          gx.fill();
        });
      }
    };
    S.feCanvas.addEventListener("pointerup", () => {
      S.faceEd.drawing = false;
    });
    S.feCanvas.addEventListener("pointercancel", () => {
      S.faceEd.drawing = false;
    });
    $el("fe-grid").addEventListener("click", () => {
      S.faceEd.grid = !S.faceEd.grid;
      $el("fe-grid").classList.toggle("active", S.faceEd.grid);
      S.feRedrawOverlay();
      if (typeof S.massHint === "function") S.massHint(S.faceEd.grid ? "Grid shown \u2014 " + Math.round(S.faceEd.gridM * 1e3) + "mm" : "Grid hidden");
    });
    $el("fe-snap").addEventListener("click", () => {
      S.faceEd.snap = !S.faceEd.snap;
      $el("fe-snap").classList.toggle("active", S.faceEd.snap);
      if (typeof S.massHint === "function") S.massHint(S.faceEd.snap ? "Snap on \u2014 region taps lock to " + Math.round(S.faceEd.gridM * 1e3) + "mm" : "Snap off");
    });
    $el("fe-gridmm").addEventListener("change", (e) => {
      let mm = Math.round(parseFloat(e.target.value) || 0);
      mm = Math.max(10, Math.min(5e3, mm));
      e.target.value = mm;
      S.faceEd.gridM = mm / 1e3;
      S.faceEd.grid = true;
      $el("fe-grid").classList.add("active");
      S.feRedrawOverlay();
      if (typeof S.massHint === "function") S.massHint("Grid step " + mm + "mm" + (S.faceEd.snap ? " \u2014 snapping" : ""));
    });
    S._feSyncOpenFields = function _feSyncOpenFields() {
      const ow = $el("fe-ow"), oh = $el("fe-oh"), os = $el("fe-osill");
      if (ow) ow.value = S.faceEd.openW;
      if (oh) oh.value = S.faceEd.openH;
      if (os) os.value = S.faceEd.openSill;
    };
    $el("fe-ow").addEventListener("change", (e) => {
      S.faceEd.openW = Math.max(100, Math.min(2e4, Math.round(parseFloat(e.target.value) || 0)));
      e.target.value = S.faceEd.openW;
    });
    $el("fe-oh").addEventListener("change", (e) => {
      S.faceEd.openH = Math.max(100, Math.min(2e4, Math.round(parseFloat(e.target.value) || 0)));
      e.target.value = S.faceEd.openH;
    });
    $el("fe-osill").addEventListener("change", (e) => {
      S.faceEd.openSill = Math.max(0, Math.min(2e4, Math.round(parseFloat(e.target.value) || 0)));
      e.target.value = S.faceEd.openSill;
    });
    $all(".fe-tool").forEach((btn) => btn.addEventListener("click", () => {
      if (!btn.dataset.fetool) return;
      $all(".fe-tool").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      S.faceEd.tool = btn.dataset.fetool;
      if (S.faceEd.tool === "window") {
        S.faceEd.openW = 1200;
        S.faceEd.openH = 1500;
        S.faceEd.openSill = 900;
        S._feSyncOpenFields();
        if (typeof S.massHint === "function") S.massHint("Window \u2014 tap the face to place (W/H/sill set above)");
      } else if (S.faceEd.tool === "door") {
        S.faceEd.openW = 900;
        S.faceEd.openH = 2100;
        S.faceEd.openSill = 0;
        S._feSyncOpenFields();
        if (typeof S.massHint === "function") S.massHint("Door \u2014 tap the face to place");
      }
      const gb = $el("fe-grid");
      if (gb) gb.classList.toggle("active", !!S.faceEd.grid);
      const sb = $el("fe-snap");
      if (sb) sb.classList.toggle("active", !!S.faceEd.snap);
    }));
    $el("fe-size").addEventListener("input", (e) => {
      S.faceEd.size = +e.target.value;
    });
    ["#1c1a18", "#a02835", "#3a6ea5", "#6a6a6a"].forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "fe-sw" + (i === 0 ? " active" : "");
      b.style.background = c;
      b.addEventListener("click", () => {
        $all(".fe-sw").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        S.faceEd.color = c;
        S.faceEd.tool = "pen";
        $all(".fe-tool").forEach((x) => x.classList.toggle("active", x.dataset.fetool === "pen"));
      });
      $el("fe-swatches").appendChild(b);
    });
    $el("fe-clear").addEventListener("click", () => {
      S.faceEd.ctx.clearRect(0, 0, S.feCanvas.width, S.feCanvas.height);
    });
    $el("fe-cancel").addEventListener("click", S.feClose);
    $el("fe-depth").addEventListener("change", (e) => {
      const mm = parseFloat(e.target.value) || 0;
      const b = S.massing.masses[S.faceEd.bi];
      if (!b) return;
      const regs = b.faceRegions && b.faceRegions[S.faceEd.id];
      if (!regs || !regs.length) {
        if (typeof S.massHint === "function") S.massHint("Draw a region first, then set Pull");
        e.target.value = 0;
        return;
      }
      S.massSnapshot();
      regs[regs.length - 1].depth = mm;
      S.feRedrawOverlay();
      S.renderMassing();
      if (typeof S.massHint === "function") S.massHint(mm > 0 ? "Region pulled out " + mm + "mm \u2014 close to see it in 3D" : mm < 0 ? "Region recessed " + -mm + "mm \u2014 close to see it in 3D" : "Region flattened");
    });
    $el("fe-done").addEventListener("click", () => {
      const b = S.massing.masses[S.faceEd.bi];
      if (b) {
        S.massSnapshot();
        b.faceArt = b.faceArt || {};
        b.faceArt[S.faceEd.id] = S.feCanvas.toDataURL("image/png");
        b._faceImg = b._faceImg || {};
        delete b._faceImg[S.faceEd.id];
        S.ensureFaceImg(b);
      }
      S.feClose();
      S.renderMassing();
    });
    $el("mass-proj").addEventListener("click", () => {
      S.massing.cam.projection = S.massing.cam.projection === "axon" ? "persp" : "axon";
      $el("mass-proj").textContent = S.massing.cam.projection === "axon" ? "Axon" : "Persp";
      S.renderMassing();
    });
    S.updateMassBaseBtn = function updateMassBaseBtn() {
      const btn = $el("mass-base");
      if (btn) btn.classList.toggle("active", !!S.massing.showBase);
    };
    $el("mass-base").addEventListener("click", () => {
      S.massing.showBase = !S.massing.showBase;
      if (S.massing.showBase) {
        if (!S.massing.baseAnchor) S.massing.baseAnchor = { px: S.doc.wPx / 2, py: S.doc.hPx / 2, ppm: S.pxPerMetre() };
        S.buildMassingBase();
      }
      S.updateMassBaseBtn();
      S.renderMassing();
      S.massHint(S.massing.showBase ? "Plan shown on ground" : "Plan hidden");
    });
    $el("mass-flatten").addEventListener("click", S.flattenMassingToLayer);
    $el("mass-dup").addEventListener("click", S.duplicateMass);
    $el("mass-del").addEventListener("click", S.deleteSelectedMass);
    $el("mass-elev").addEventListener("click", S.generateElevations);
    $el("mass-view").addEventListener("click", S.exportAngledView);
    $el("mass-clear").addEventListener("click", () => {
      if (S.massing.masses.length && confirm("Delete all masses?")) {
        S.massSnapshot();
        S.massing.masses = [];
        S.massing.selected = -1;
        S.massing.baseAnchor = null;
        S.renderMassing();
      }
    });
    $el("mass-exit").addEventListener("click", S.exitMassing);
    window.addEventListener("resize", () => {
      if (S.massing.active) S.renderMassing();
    });
  }

  // src/engine/app/shell.ts
  function initShell() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.isContentEditable) return;
      if (e.key === "Escape" && typeof S.hideShapeChip === "function") S.hideShapeChip();
      if (e.key === "Escape" && state2.vecXform) {
        S.cancelVecXform();
        S.showHint("Transform cancelled");
        return;
      }
      if (e.key === "Escape" && state2.polyActive) {
        state2.polyPoints = [];
        state2.polyActive = false;
        $el("poly-hint").style.display = "none";
        S.refreshMeasurements();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? S.redo() : S.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        S.redo();
      } else if (e.key === "p") S.setTool("pen");
      else if (e.key === "m") S.setTool("marker");
      else if (e.key === "b") S.setTool("brush");
      else if (e.key === "w") S.setTool("watercolour");
      else if (e.key === "l") S.setTool("pencil");
      else if (e.key === "e") S.setTool("eraser");
      else if (e.key === "r") S.setTool("ruler");
      else if (e.key === "a") S.setTool("area");
      else if (e.key === "s") S.setTool("stencil");
      else if (e.key === "h") S.setTool("hand");
      else if (e.key === "i") S.setTool("brushes");
      else if (e.key === "k") S.setTool("wall");
      else if (e.key === "j") S.setTool("opening");
      else if (e.key === "x") S.setTool("wand");
      else if (e.key === "o") S.setTool("lasso");
      else if (e.key === "f") S.setTool("fill");
      else if (e.key === "g") $el("btn-grid").click();
      else if (e.key === "+" || e.key === "=") S.handleZoomIn();
      else if (e.key === "-") S.handleZoomOut();
      else if (e.key === "0") S.handleZoomFit();
    });
    S.brushCursor = $el("brush-cursor");
    S.updateBrushCursor = function updateBrushCursor(e, brush) {
      if (!S.brushCursor) return;
      const areaRect = S.area.getBoundingClientRect();
      const cx = e.clientX - areaRect.left;
      const cy = e.clientY - areaRect.top;
      S.brushCursor.style.left = cx + "px";
      S.brushCursor.style.top = cy + "px";
      const docToScreen = S.paper.getBoundingClientRect().width / S.doc.wPx;
      const pr = S.pressureFor(e);
      const b = brush || S.activeBrush();
      const effSize = Math.max(1, state2.size * (1 - b.pressureSize + b.pressureSize * pr));
      const screenSize = Math.max(4, effSize * docToScreen * 2);
      S.brushCursor.style.width = screenSize + "px";
      S.brushCursor.style.height = screenSize + "px";
      S.brushCursor.style.borderColor = b.kind === "erase" ? "rgba(160,40,53,0.7)" : "rgba(0,0,0,0.65)";
    };
    S.area.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "pen" && e.pointerType !== "mouse") return;
      const b = S.activeBrush();
      if (S.isDrawTool(state2.tool)) {
        S.brushCursor.style.display = "block";
        S.updateBrushCursor(e, b);
      } else {
        S.brushCursor.style.display = "none";
      }
    }, { passive: true });
    S.area.addEventListener("pointerleave", () => {
      S.brushCursor.style.display = "none";
    });
    state2.canvasRotation = 0;
    S._rotateStart = null;
    S.applyCanvasRotation = function applyCanvasRotation() {
      const r = state2.canvasRotation;
      S.paper.style.transform = `translate(-50%, -50%) scale(${state2.zoom * state2.baseZoom}) rotate(${r}deg)`;
      const badge = $el("rotation-badge");
      if (r === 0) {
        badge.classList.remove("show");
      } else {
        badge.textContent = `${Math.round(r)}\xB0`;
        badge.classList.add("show");
      }
    };
    S._origApplyStageTransform = S.applyStageTransform;
    S.applyStageTransform = function applyStageTransform() {
      S.stage.style.transform = `translate(${state2.panX}px, ${state2.panY}px)`;
      S.paper.style.transform = `translate(-50%, -50%) scale(${state2.zoom * state2.baseZoom}) rotate(${state2.canvasRotation}deg)`;
      $el("zoom-level").textContent = Math.round(state2.zoom * 100) + "%";
      S.refreshMeasurements();
    };
    S.area.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0], t2 = e.touches[1];
        const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
        S._rotateStart = { angle, rotation: state2.canvasRotation };
      }
    }, { passive: true });
    S.area.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && S._rotateStart !== null) {
        const t1 = e.touches[0], t2 = e.touches[1];
        const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
        const delta = angle - S._rotateStart.angle;
        state2.canvasRotation = S._rotateStart.rotation + delta;
        S.applyCanvasRotation();
      }
    }, { passive: true });
    S.area.addEventListener("touchend", () => {
      if (Math.abs(state2.canvasRotation) < 8) {
        state2.canvasRotation = 0;
        S.applyCanvasRotation();
      }
      S._rotateStart = null;
    });
    $el("rotation-badge").addEventListener("click", () => {
      state2.canvasRotation = 0;
      S.applyCanvasRotation();
      S.showHint("Canvas rotation reset to 0\xB0");
    });
    (function initDraggablePuck() {
      const puck = $el("puck");
      const handle = $el("puck-drag-handle");
      if (!handle || !puck) return;
      let dragging = false, ox = 0, oy = 0;
      handle.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
        dragging = true;
        const pr = puck.getBoundingClientRect();
        const ar = S.area.getBoundingClientRect();
        ox = e.clientX - pr.left;
        oy = e.clientY - pr.top;
        puck.style.transition = "none";
        puck.style.bottom = "unset";
        puck.style.left = pr.left - ar.left + "px";
        puck.style.top = pr.top - ar.top + "px";
        puck.style.transform = "none";
      });
      handle.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const ar = S.area.getBoundingClientRect();
        const newLeft = Math.max(0, Math.min(ar.width - puck.offsetWidth, e.clientX - ar.left - ox));
        const newTop = Math.max(0, Math.min(ar.height - puck.offsetHeight, e.clientY - ar.top - oy));
        puck.style.left = newLeft + "px";
        puck.style.top = newTop + "px";
      });
      handle.addEventListener("pointerup", () => {
        dragging = false;
      });
    })();
    $el("btn-fullscreen").addEventListener("click", () => {
      const isFS = document.body.classList.toggle("nm-fullscreen");
      $el("btn-fullscreen").classList.toggle("active", isFS);
      $el("fs-exit").style.display = isFS ? "block" : "none";
      const refit = () => {
        S.fitToScreen();
        if (typeof S.massing !== "undefined" && S.massing.active && typeof S.renderMassing === "function") {
          S.renderMassing();
        }
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(refit);
      });
      setTimeout(refit, 50);
      setTimeout(refit, 100);
      setTimeout(refit, 200);
      S.showHint(isFS ? "Full-screen mode \xB7 Esc or click \u2921 to exit" : "Exited full-screen");
    });
    (function bindCanvasAreaResize() {
      let resizeTimer = null;
      const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          S.fitToScreen();
          if (typeof S.massing !== "undefined" && S.massing.active && typeof S.renderMassing === "function") {
            S.renderMassing();
          }
        }, 50);
      };
      if (typeof ResizeObserver !== "undefined" && S.area) {
        const ro = new ResizeObserver(onResize);
        ro.observe(S.area);
      }
      window.addEventListener("resize", onResize);
    })();
    $el("fs-exit").addEventListener("click", () => {
      $el("btn-fullscreen").click();
    });
    window.addEventListener("keydown", (e) => {
      if ((e.key === "F11" || e.key === "Escape" && document.body.classList.contains("nm-fullscreen")) && e.target.tagName !== "INPUT") {
        e.preventDefault();
        $el("btn-fullscreen").click();
      }
    }, true);
    S.overflowPanel = $el("overflow-panel");
    $el("btn-overflow").addEventListener("click", (e) => {
      e.stopPropagation();
      S.overflowPanel.classList.toggle("show");
    });
    $el("ovf-guide").addEventListener("click", (e) => {
      e.stopPropagation();
      if (S.guidePopover.classList.contains("show")) S.guidePopover.classList.remove("show");
      else S.guidePopover.classList.add("show");
      S.overflowPanel.classList.remove("show");
    });
    $el("ovf-canvas-size").addEventListener("click", () => {
      S.openCanvasSize();
      S.overflowPanel.classList.remove("show");
    });
    $el("ovf-fullscreen").addEventListener("click", () => {
      $el("btn-fullscreen").click();
      S.overflowPanel.classList.remove("show");
    });
    $el("ovf-scale").addEventListener("click", () => {
      $el("btn-scale").click();
      S.overflowPanel.classList.remove("show");
    });
    $el("ovf-measures").addEventListener("click", () => {
      $el("btn-measures").click();
      S.syncOverflowStates();
    });
    $el("ovf-chain").addEventListener("click", () => {
      S.toggleDimChain();
      S.syncOverflowStates();
    });
    $el("ovf-clear-dim").addEventListener("click", () => {
      $el("btn-clear-measures").click();
      S.overflowPanel.classList.remove("show");
    });
    $el("ovf-import").addEventListener("click", () => {
      $el("btn-import-image").click();
      S.overflowPanel.classList.remove("show");
    });
    S.syncOverflowStates = function syncOverflowStates() {
      const chainBtn = $el("ovf-chain");
      chainBtn.classList.toggle("active-state", state2.dimChainMode);
      const measBtn = $el("ovf-measures");
      measBtn.classList.toggle("active-state", state2.showMeasurements);
      const gridBtn = $el("ovf-grid");
      gridBtn.classList.toggle("active-state", state2.showGrid);
    };
    document.addEventListener("click", () => S.overflowPanel.classList.remove("show"));
    S.overflowPanel.addEventListener("click", (e) => e.stopPropagation());
    S.layersPanel = $el("layers-panel");
    S.layersTab = $el("layers-tab");
    S.layersTab.addEventListener("click", () => {
      const isOpen = S.layersPanel.classList.toggle("open");
      S.layersTab.style.transition = "right 0.24s cubic-bezier(0.4,0,0.2,1)";
      S.layersTab.style.right = isOpen ? "280px" : "0";
    });
    $el("canvas-area").addEventListener("pointerdown", () => {
      if (S.layersPanel.classList.contains("open") && window.innerWidth < 900) {
        S.layersPanel.classList.remove("open");
      }
    }, { passive: true });
  }

  // src/engine/app/host-bridge.ts
  function initHostBridge() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.postContentReady = function postContentReady() {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "sketchtrude-content-ready",
          projectId: window.__SKETCHTRUDE_PROJECT_ID
        }, "*");
      }
    };
    S.postEngineReady = function postEngineReady() {
      if (window.parent !== window) {
        window.parent.postMessage({
          type: "sketchtrude-engine-ready",
          projectId: window.__SKETCHTRUDE_PROJECT_ID
        }, "*");
      }
    };
    S.restoreSession = async function restoreSession() {
      let cloudSaved = null, localSaved = null;
      try {
        localSaved = await S.loadSavedDoc();
      } catch (e) {
        localSaved = null;
      }
      try {
        cloudSaved = await S.loadCloudDocument();
      } catch (e) {
        cloudSaved = null;
      }
      const saved = S.chooseSavedDoc(localSaved, cloudSaved);
      if (!saved || !saved.layers || !saved.layers.length) return false;
      S._autosaveSuspended = true;
      S._isHydrating = true;
      try {
        await S.applyLegacyDocument(saved);
        S._hasUnsavedChanges = false;
        return true;
      } catch (e) {
        console.warn("Restore failed, starting fresh:", e);
        return false;
      } finally {
        S._isHydrating = false;
        S._autosaveSuspended = false;
      }
    };
    S.importProjectDocument = async function importProjectDocument(document2) {
      if (!document2 || typeof document2 !== "object") {
        throw new Error("Invalid document");
      }
      S._autosaveSuspended = true;
      S._isHydrating = true;
      try {
        const merged = await S.mergeLocalLayerBlobs(document2);
        await S.applyLegacyDocument(merged);
        S._hasUnsavedChanges = false;
      } finally {
        S._isHydrating = false;
        S._autosaveSuspended = false;
      }
      S.postContentReady();
      setTimeout(() => S.postContentReady(), 80);
    };
    S.exportProjectDocument = async function exportProjectDocument() {
      await S.saveDoc();
      return S._lastDocPayload;
    };
    S.subscribeToDocumentChanges = function subscribeToDocumentChanges(callback) {
      if (typeof callback !== "function") return () => {
      };
      S._documentChangeListeners.add(callback);
      return () => {
        S._documentChangeListeners.delete(callback);
      };
    };
    S.hasUnsavedChanges = function hasUnsavedChanges() {
      return !!S._hasUnsavedChanges;
    };
    S.getMutationVersion = function getMutationVersion() {
      return S._mutationVersion;
    };
    S.applyScaleBlank = function applyScaleBlank() {
      state2.pxPerUnit = null;
      S.updateScaleDisplay();
    };
    S.handleStartFresh = function handleStartFresh() {
      S._isHydrating = true;
      try {
        S.applyScaleBlank();
        state2.autoExpandCanvas = false;
        S.fitToScreen();
      } finally {
        S._isHydrating = false;
        S._hasUnsavedChanges = false;
      }
      S.postContentReady();
      setTimeout(() => S.postContentReady(), 80);
    };
    window.sketchtrudeEngine = {
      exportProjectDocument: S.exportProjectDocument,
      importProjectDocument: S.importProjectDocument,
      subscribeToDocumentChanges: S.subscribeToDocumentChanges,
      hasUnsavedChanges: S.hasUnsavedChanges,
      getMutationVersion: S.getMutationVersion,
      getLayerEngine: () => S.layerEngine,
      getBrushLibrary: () => S.brushLibraryEngine
    };
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        S.saveDoc();
        S.scheduleThumbnail();
      }
    });
    window.addEventListener("pagehide", () => {
      S.saveDoc();
      S.scheduleThumbnail();
    });
    window.addEventListener("message", async (e) => {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      const type = data.type;
      if (type === "sketchtrude-save") {
        try {
          for (let i = 0; i < 30; i++) {
            await S.saveDoc();
            if (S._lastDocPayload && !S._autosaveBusy && !state2.layers.some((l) => l._dirty)) break;
            await new Promise((r) => setTimeout(r, 100));
          }
          S.scheduleThumbnail();
        } catch (_) {
        }
        if (window.parent !== window) {
          window.parent.postMessage({
            type: "sketchtrude-save-done",
            projectId: window.__SKETCHTRUDE_PROJECT_ID
          }, "*");
        }
        return;
      }
      if (type === "sketchtrude-start-fresh") {
        S.handleStartFresh();
        return;
      }
      if (type === "sketchtrude-ping-ready") {
        S.postEngineReady();
        return;
      }
      if (type === "sketchtrude-import-document") {
        try {
          await S.importProjectDocument(data.document);
          if (window.parent !== window) {
            window.parent.postMessage({ type: "sketchtrude-import-document-result", ok: true }, "*");
          }
          S.postContentReady();
        } catch (err) {
          const message = err && err.message ? err.message : String(err);
          console.warn("Import failed:", err);
          try {
            const restored = await S.restoreSession();
            if (restored) {
              if (window.parent !== window) {
                window.parent.postMessage({ type: "sketchtrude-import-document-result", ok: true, recovered: true }, "*");
              }
              S.postContentReady();
              return;
            }
          } catch (_) {
          }
          if (window.parent !== window) {
            window.parent.postMessage({
              type: "sketchtrude-import-document-result",
              ok: false,
              error: message
            }, "*");
          }
        }
        return;
      }
      if (type === "sketchtrude-restore-local") {
        try {
          const restored = await S.restoreSession();
          if (window.parent !== window) {
            window.parent.postMessage({
              type: "sketchtrude-restore-local-result",
              ok: !!restored
            }, "*");
          }
          if (restored) S.postContentReady();
        } catch (err) {
          if (window.parent !== window) {
            window.parent.postMessage({
              type: "sketchtrude-restore-local-result",
              ok: false,
              error: err && err.message ? err.message : String(err)
            }, "*");
          }
        }
        return;
      }
      if (type === "sketchtrude-export-document") {
        try {
          const document2 = await S.exportProjectDocument();
          if (window.parent !== window) {
            window.parent.postMessage({
              type: "sketchtrude-export-document-result",
              document: document2
            }, "*");
          }
        } catch (err) {
          const message = err && err.message ? err.message : String(err);
          if (window.parent !== window) {
            window.parent.postMessage({
              type: "sketchtrude-export-document-result",
              document: null,
              error: message
            }, "*");
          }
        }
      }
    });
  }

  // src/engine/app/persistence.ts
  function initPersistence() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.AUTOSAVE_DB = "nm-trace", S.AUTOSAVE_STORE = "doc";
    S.autosaveKey = function autosaveKey() {
      return typeof window !== "undefined" && window.__SKETCHTRUDE_PROJECT_ID || "current";
    };
    S._autosaveTimer = null, S._autosaveBusy = false, S._autosaveSuspended = false, S._autosaveSerial = 0;
    S._isHydrating = false;
    S._mutationVersion = 0;
    S._hasUnsavedChanges = false;
    S._documentChangeListeners = /* @__PURE__ */ new Set();
    S.makeMutationId = function makeMutationId() {
      try {
        if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
      } catch (_) {
      }
      return "m-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
    };
    S.notifyDocumentChanged = function notifyDocumentChanged() {
      if (S._isHydrating || S._autosaveSuspended) return;
      S._mutationVersion++;
      S._hasUnsavedChanges = true;
      const event = {
        mutationId: S.makeMutationId(),
        mutationVersion: S._mutationVersion,
        type: "bulk-update",
        timestamp: Date.now()
      };
      for (const cb of S._documentChangeListeners) {
        try {
          cb(event);
        } catch (_) {
        }
      }
      if (window.parent !== window) {
        window.parent.postMessage({ type: "sketchtrude-document-changed", event }, "*");
      }
    };
    S._autosaveWaiters = [];
    S._idbPromise = null;
    S.waitForAutosave = function waitForAutosave() {
      return new Promise((resolve) => S._autosaveWaiters.push(resolve));
    };
    S.notifyAutosaveWaiters = function notifyAutosaveWaiters() {
      const waiters = S._autosaveWaiters.splice(0);
      waiters.forEach((resolve) => resolve());
    };
    S.openAutosaveDb = function openAutosaveDb(version) {
      return new Promise((resolve, reject) => {
        const req = version ? indexedDB.open(S.AUTOSAVE_DB, version) : indexedDB.open(S.AUTOSAVE_DB);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(S.AUTOSAVE_STORE)) req.result.createObjectStore(S.AUTOSAVE_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("Autosave database upgrade blocked"));
      });
    };
    S.idb = function idb() {
      if (S._idbPromise) return S._idbPromise;
      S._idbPromise = S.openAutosaveDb().then((db) => {
        if (db.objectStoreNames.contains(S.AUTOSAVE_STORE)) return db;
        const nextVersion = db.version + 1;
        db.close();
        return S.openAutosaveDb(nextVersion);
      }).catch((e) => {
        console.warn("Autosave database unavailable:", e);
        S._idbPromise = null;
        return null;
      });
      return S._idbPromise;
    };
    S._massSaveTimer = null;
    S.scheduleMassAutosave = function scheduleMassAutosave() {
      if (S._autosaveSuspended) return;
      S.notifyDocumentChanged();
      clearTimeout(S._massSaveTimer);
      S._massSaveTimer = setTimeout(() => {
        if (!state2.drawing) S.saveDoc();
      }, 1500);
    };
    S.scheduleAutosave = function scheduleAutosave(opts) {
      if (S._autosaveSuspended) return;
      const fromReschedule = opts && opts.fromReschedule;
      if (!fromReschedule) S.notifyDocumentChanged();
      S._autosaveSerial++;
      clearTimeout(S._autosaveTimer);
      S.scheduleThumbnail();
      S._autosaveTimer = setTimeout(() => {
        if (state2.drawing) {
          S.scheduleAutosave({ fromReschedule: true });
          return;
        }
        if (window.requestIdleCallback) window.requestIdleCallback(() => S.saveDoc(), { timeout: 4e3 });
        else S.saveDoc();
      }, 750);
    };
    setInterval(() => {
      if (S._autosaveSuspended || state2.drawing) return;
      if (!state2.layers.some((l) => l._dirty)) return;
      if (window.requestIdleCallback) window.requestIdleCallback(() => {
        if (!state2.drawing) S.saveDoc();
      }, { timeout: 4e3 });
    }, 45e3);
    S.massesForSave = function massesForSave() {
      const skip = (k, v) => {
        if (typeof v === "function") return void 0;
        if (typeof HTMLImageElement !== "undefined" && v instanceof HTMLImageElement) return void 0;
        if (typeof HTMLCanvasElement !== "undefined" && v instanceof HTMLCanvasElement) return void 0;
        if (typeof ImageBitmap !== "undefined" && v instanceof ImageBitmap) return void 0;
        return v;
      };
      try {
        return JSON.parse(JSON.stringify(S.massing.masses || [], skip));
      } catch (e) {
        return [];
      }
    };
    S.saveDoc = async function saveDoc() {
      if (S._autosaveBusy) return S.waitForAutosave();
      if (S._autosaveSuspended || !state2.layers.length) return;
      if (state2.drawing) {
        S.scheduleAutosave({ fromReschedule: true });
        return;
      }
      S._autosaveBusy = true;
      const saveSerial = S._autosaveSerial;
      try {
        const layerData = [];
        for (const l of state2.layers) {
          if (l._dirty || !l._savedBlob) {
            let sourceCanvas = l.canvas;
            if (l.imageCanvas && !l.imageBaked) {
              const tmp = document.createElement("canvas");
              tmp.width = S.doc.wPx;
              tmp.height = S.doc.hPx;
              const tc = tmp.getContext("2d");
              tc.drawImage(l.imageCanvas, 0, 0);
              tc.drawImage(l.canvas, 0, 0);
              sourceCanvas = tmp;
            }
            l._savedBlob = await new Promise((res) => sourceCanvas.toBlob(res, "image/png"));
            if (l._dirty) l._rasterPath = null;
            if (S._autosaveSerial === saveSerial) l._dirty = false;
            await Promise.resolve();
          }
          layerData.push({
            name: l.name,
            visible: l.visible,
            opacity: l.opacity,
            trace: l.trace,
            blendMode: l.blendMode,
            blob: l._savedBlob,
            raster_path: l._rasterPath || null
          });
        }
        const payload = {
          version: 1,
          savedAt: Date.now(),
          doc: { wmm: S.doc.wMM, hmm: S.doc.hMM, dpi: S.doc.dpi },
          infiniteCanvas: state2.infiniteCanvas,
          autoExpandCanvas: state2.autoExpandCanvas,
          paperBg: state2.paperBg,
          grid: { show: state2.showGrid, type: state2.gridType, spacingMM: state2.gridSpacingMM },
          activeLayer: state2.activeLayer,
          pxPerUnit: state2.pxPerUnit,
          scaleUnit: state2.scaleUnit,
          scaleLabel: S.scaleLabelFromState(),
          measurements: state2.measurements,
          walls: state2.walls,
          wallsVisible: state2.wallsVisible !== false,
          shapes: state2.shapes,
          masses: S.massesForSave(),
          massBaseAnchor: S.massing.baseAnchor || null,
          layers: layerData
        };
        const db = await S.idb();
        if (db) {
          await new Promise((resolve, reject) => {
            const tx = db.transaction(S.AUTOSAVE_STORE, "readwrite");
            tx.objectStore(S.AUTOSAVE_STORE).put(payload, S.autosaveKey());
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
          });
        }
        S._lastDocPayload = payload;
      } catch (e) {
        console.warn("Autosave failed:", e);
      } finally {
        S._autosaveBusy = false;
        S.notifyAutosaveWaiters();
        if (S._autosaveSerial !== saveSerial && !state2.drawing) S.scheduleAutosave({ fromReschedule: true });
      }
    };
    S._lastDocPayload = null;
    S._cloudSyncTimer = null;
    S._cloudSyncInFlight = false;
    S._cloudSyncWaiters = [];
    S.waitForCloudSync = function waitForCloudSync() {
      return new Promise((resolve) => S._cloudSyncWaiters.push(resolve));
    };
    S.notifyCloudSyncWaiters = function notifyCloudSyncWaiters() {
      const waiters = S._cloudSyncWaiters.splice(0);
      waiters.forEach((resolve) => resolve());
    };
    S.scheduleCloudSync = function scheduleCloudSync() {
    };
    S.uploadLayerRaster = async function uploadLayerRaster(pid, index, blob) {
      const fd = new FormData();
      fd.append("layer_index", String(index));
      fd.append("raster", blob, "layer-" + index + ".png");
      const res = await fetch("/api/projects/" + pid + "/document/layer", {
        method: "POST",
        body: fd,
        credentials: "same-origin"
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn("Layer upload failed:", index, res.status, errText);
        return null;
      }
      const data = await res.json();
      return data.raster_path || null;
    };
    S.flushCloudSync = async function flushCloudSync() {
      const pid = typeof window !== "undefined" ? window.__SKETCHTRUDE_PROJECT_ID : null;
      if (S._cloudSyncInFlight) {
        await S.waitForCloudSync();
        return S.flushCloudSync();
      }
      if (!pid || pid === "local" || !S._lastDocPayload) return;
      S._cloudSyncInFlight = true;
      try {
        const payload = S._lastDocPayload;
        const layerMeta = [];
        for (let i = 0; i < payload.layers.length; i++) {
          const l = payload.layers[i];
          let raster_path = l.raster_path || null;
          if (l.blob && l.blob.size > 0) {
            const uploaded = await S.uploadLayerRaster(pid, i, l.blob);
            if (!uploaded) {
              console.warn("Cloud save skipped: missing uploaded raster for layer", i);
              return;
            }
            raster_path = uploaded;
            const live = state2.layers[i];
            if (live) live._rasterPath = uploaded;
            l.raster_path = uploaded;
          }
          layerMeta.push({
            name: l.name,
            visible: l.visible,
            opacity: l.opacity,
            trace: l.trace,
            blendMode: l.blendMode,
            raster_path
          });
        }
        const manifest = {
          version: payload.version,
          savedAt: payload.savedAt,
          doc: payload.doc,
          infiniteCanvas: payload.infiniteCanvas,
          autoExpandCanvas: payload.autoExpandCanvas,
          paperBg: payload.paperBg,
          grid: payload.grid,
          activeLayer: payload.activeLayer,
          pxPerUnit: payload.pxPerUnit,
          scaleUnit: payload.scaleUnit,
          scaleLabel: payload.scaleLabel,
          measurements: payload.measurements,
          walls: payload.walls,
          wallsVisible: payload.wallsVisible,
          shapes: payload.shapes,
          masses: payload.masses,
          massBaseAnchor: payload.massBaseAnchor,
          layers: layerMeta,
          layer_count: layerMeta.length
        };
        const res = await fetch("/api/projects/" + pid + "/document", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(manifest)
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.warn("Cloud save failed:", res.status, errText);
        }
      } catch (e) {
        console.warn("Cloud save failed:", e);
      } finally {
        S._cloudSyncInFlight = false;
        S.notifyCloudSyncWaiters();
      }
    };
    S.loadCloudDocument = async function loadCloudDocument() {
      const pid = typeof window !== "undefined" ? window.__SKETCHTRUDE_PROJECT_ID : null;
      if (!pid || pid === "local") return null;
      try {
        const res = await fetch("/api/projects/" + pid + "/document", { credentials: "same-origin" });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.layers || !data.layers.length) return null;
        const layers = [];
        for (const ld of data.layers) {
          const entry = {
            name: ld.name,
            visible: ld.visible,
            opacity: ld.opacity,
            trace: ld.trace,
            blendMode: ld.blendMode,
            blob: null
          };
          if (ld.raster_url) {
            try {
              const imgRes = await fetch(ld.raster_url);
              if (imgRes.ok) entry.blob = await imgRes.blob();
            } catch (_) {
            }
          }
          layers.push(entry);
        }
        return Object.assign({}, data, { layers });
      } catch (e) {
        console.warn("Cloud load failed:", e);
        return null;
      }
    };
    S.loadSavedDoc = async function loadSavedDoc() {
      const db = await S.idb();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction(S.AUTOSAVE_STORE, "readonly");
        const req = tx.objectStore(S.AUTOSAVE_STORE).get(S.autosaveKey());
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    };
    S.savedDocHasPixels = function savedDocHasPixels(doc2) {
      var _a;
      return !!((_a = doc2 == null ? void 0 : doc2.layers) == null ? void 0 : _a.some((layer) => (layer == null ? void 0 : layer.blob) && layer.blob.size > 0));
    };
    S.savedDocHasVectors = function savedDocHasVectors(doc2) {
      return ["measurements", "walls", "shapes", "masses"].some((key) => Array.isArray(doc2 == null ? void 0 : doc2[key]) && doc2[key].length > 0);
    };
    S.isRestorableDoc = function isRestorableDoc(doc2) {
      var _a;
      return !!((_a = doc2 == null ? void 0 : doc2.layers) == null ? void 0 : _a.length) && (S.savedDocHasPixels(doc2) || S.savedDocHasVectors(doc2));
    };
    S.chooseSavedDoc = function chooseSavedDoc(localDoc, cloudDoc) {
      const localRestorable = S.isRestorableDoc(localDoc);
      const cloudRestorable = S.isRestorableDoc(cloudDoc);
      if (localRestorable && !cloudRestorable) return localDoc;
      if (cloudRestorable && !localRestorable) return cloudDoc;
      if (localRestorable && cloudRestorable) {
        const localSavedAt = Number(localDoc.savedAt) || 0;
        const cloudSavedAt = Number(cloudDoc.savedAt) || 0;
        return cloudSavedAt > localSavedAt ? cloudDoc : localDoc;
      }
      return cloudDoc || localDoc;
    };
    S.clearSavedDoc = async function clearSavedDoc() {
      const db = await S.idb();
      if (!db) return;
      const tx = db.transaction(S.AUTOSAVE_STORE, "readwrite");
      tx.objectStore(S.AUTOSAVE_STORE).delete(S.autosaveKey());
    };
    S.removeAllLayers = function removeAllLayers() {
      for (const [eid] of [...S.layerSurfaces.keys()]) S.disposeLayerSurface(eid);
      state2.layers.forEach((l) => {
        try {
          if (l.canvas && l.canvas.parentNode) l.canvas.parentNode.removeChild(l.canvas);
        } catch (_) {
        }
        try {
          if (l.imageCanvas && l.imageCanvas.parentNode) l.imageCanvas.parentNode.removeChild(l.imageCanvas);
        } catch (_) {
        }
      });
      state2.layers = [];
      S.layerSurfaces.clear();
      if (S.layerEngine) {
        S.layerEngine.floors = {};
        S.layerEngine.layers = {};
        S.layerEngine.objects = {};
        S.layerEngine.rootFloorIds = [];
        S.layerEngine.activeFloorId = null;
        S.layerEngine.activeLayerId = null;
      }
    };
    S.resolveLayerBlob = async function resolveLayerBlob(ld) {
      if (ld && ld.blob && ld.blob.size > 0) return ld.blob;
      const url = ld && (ld.raster_url || ld.rasterUrl);
      if (url) {
        try {
          const imgRes = await fetch(url);
          if (imgRes.ok) return await imgRes.blob();
        } catch (_) {
        }
      }
      return null;
    };
    S.mergeLocalLayerBlobs = async function mergeLocalLayerBlobs(saved) {
      var _a, _b, _c, _d, _e, _f, _g;
      if (!((_a = saved == null ? void 0 : saved.layers) == null ? void 0 : _a.length)) return saved;
      const needsPixels = saved.layers.some((l) => !(l.blob && l.blob.size > 0) && !(l.raster_url || l.rasterUrl));
      if (!needsPixels) return saved;
      try {
        const local = await S.loadSavedDoc();
        if (!((_b = local == null ? void 0 : local.layers) == null ? void 0 : _b.length)) return saved;
        const layers = saved.layers.map((layer, i) => {
          if (layer.blob && layer.blob.size > 0) return layer;
          if (layer.raster_url || layer.rasterUrl) return layer;
          const fromLocal = local.layers[i];
          if ((fromLocal == null ? void 0 : fromLocal.blob) && fromLocal.blob.size > 0) {
            return { ...layer, blob: fromLocal.blob };
          }
          return layer;
        });
        const importedEmpty = !(((_c = saved.walls) == null ? void 0 : _c.length) || ((_d = saved.shapes) == null ? void 0 : _d.length) || ((_e = saved.masses) == null ? void 0 : _e.length) || ((_f = saved.measurements) == null ? void 0 : _f.length));
        const merged = { ...saved, layers };
        if (importedEmpty && local) {
          if (Array.isArray(local.walls)) merged.walls = local.walls;
          if (Array.isArray(local.shapes)) merged.shapes = local.shapes;
          if (Array.isArray(local.masses)) merged.masses = local.masses;
          if (Array.isArray(local.measurements)) merged.measurements = local.measurements;
          if (local.massBaseAnchor) merged.massBaseAnchor = local.massBaseAnchor;
          if (local.pxPerUnit) {
            merged.pxPerUnit = local.pxPerUnit;
            merged.scaleUnit = local.scaleUnit;
            merged.scaleLabel = local.scaleLabel;
          }
          if ((_g = local.doc) == null ? void 0 : _g.wmm) merged.doc = local.doc;
        }
        return merged;
      } catch (_) {
        return saved;
      }
    };
    S.applyLegacyDocument = async function applyLegacyDocument(saved) {
      var _a, _b, _c, _d, _e, _f;
      if (!saved || typeof saved !== "object") {
        throw new Error("Document has no layers");
      }
      const wmm = ((_a = saved.doc) == null ? void 0 : _a.wmm) || S.doc.wMM;
      const hmm = ((_b = saved.doc) == null ? void 0 : _b.hmm) || S.doc.hMM;
      const dpi = ((_c = saved.doc) == null ? void 0 : _c.dpi) || S.doc.dpi;
      if (!saved.layers || !saved.layers.length) {
        throw new Error("Document has no layers");
      }
      S.doc.wMM = wmm;
      S.doc.hMM = hmm;
      S.doc.dpi = dpi;
      S.doc.wPx = Math.round(S.doc.wMM / 25.4 * S.doc.dpi);
      S.doc.hPx = Math.round(S.doc.hMM / 25.4 * S.doc.dpi);
      S.strokeCanvas.width = S.doc.wPx;
      S.strokeCanvas.height = S.doc.hPx;
      const gc = $el("guide-canvas");
      if (gc) {
        gc.width = S.doc.wPx;
        gc.height = S.doc.hPx;
      }
      S.gridCanvas.width = S.doc.wPx;
      S.gridCanvas.height = S.doc.hPx;
      if (S.paper) {
        S.paper.style.width = S.doc.wPx + "px";
        S.paper.style.height = S.doc.hPx + "px";
      }
      S.removeAllLayers();
      const engineIds = S.layerEngine ? S.layerEngine.rebuildFromLegacyLayers(saved.layers, (_d = saved.activeLayer) != null ? _d : 0) : [];
      for (let i = 0; i < saved.layers.length; i++) {
        const ld = saved.layers[i];
        const engineId = engineIds[i];
        const layer = engineId ? S.allocateLayerSurface(engineId, ld.name || `Layer ${i + 1}`) : S.createLayer(ld.name);
        layer.visible = ld.visible !== false;
        layer.opacity = typeof ld.opacity === "number" ? ld.opacity : 1;
        layer.trace = ld.trace || 0;
        layer.blendMode = ld.blendMode || "source-over";
        if (ld.raster_path) layer._rasterPath = ld.raster_path;
        if (S.layerEngine && engineId) {
          const meta = S.layerEngine.getLayer(engineId);
          if (meta) {
            meta.visible = layer.visible;
            meta.opacity = layer.opacity;
            meta.trace = layer.trace;
            meta.blendMode = layer.blendMode;
            meta.rasterPath = ld.raster_path || null;
          }
        }
        const blob = await S.resolveLayerBlob(ld);
        if (blob) {
          try {
            const bmp = await createImageBitmap(blob);
            layer.ctx.drawImage(bmp, 0, 0);
            bmp.close && bmp.close();
            layer._savedBlob = blob;
          } catch (_) {
          }
        }
        layer.history = [];
        layer.redo = [];
        S.saveSnapshot(layer);
      }
      if (S.layerEngine) S.syncStateLayersFromEngine();
      state2.activeLayer = Math.min((_e = saved.activeLayer) != null ? _e : state2.layers.length - 1, state2.layers.length - 1);
      if (S.layerEngine && ((_f = state2.layers[state2.activeLayer]) == null ? void 0 : _f.engineId)) {
        S.layerEngine.setActiveLayer(state2.layers[state2.activeLayer].engineId);
      }
      if (saved.pxPerUnit) {
        state2.pxPerUnit = saved.pxPerUnit;
        state2.scaleUnit = saved.scaleUnit || "cm";
      } else if (saved.scaleLabel) {
        state2.pxPerUnit = null;
        S.applyScaleFromLabel(saved.scaleLabel);
      } else {
        state2.pxPerUnit = null;
      }
      S.updateScaleDisplay();
      if (saved.infiniteCanvas != null) state2.infiniteCanvas = !!saved.infiniteCanvas;
      state2.autoExpandCanvas = false;
      if (saved.paperBg) {
        state2.paperBg = saved.paperBg;
        if (S.paper) S.paper.style.background = saved.paperBg;
      }
      if (saved.grid) {
        state2.showGrid = !!saved.grid.show;
        state2.gridType = saved.grid.type || state2.gridType;
        if (saved.grid.spacingMM) state2.gridSpacingMM = saved.grid.spacingMM;
        S.drawDocGrid();
      }
      if (Array.isArray(saved.measurements)) state2.measurements = saved.measurements;
      if (Array.isArray(saved.walls)) {
        state2.walls = saved.walls;
        state2.walls.forEach(S.ensureWallId);
      }
      state2.wallsVisible = saved.wallsVisible != null ? !!saved.wallsVisible : true;
      if (Array.isArray(saved.shapes)) {
        state2.shapes = saved.shapes;
        S.ensureAllShapeIds(state2.shapes);
      }
      if (Array.isArray(saved.masses)) {
        S.massing.masses = saved.masses;
        S.massing.selected = -1;
      }
      if (saved.massBaseAnchor) S.massing.baseAnchor = saved.massBaseAnchor;
      if (typeof S.syncWallsToMasses === "function") S.syncWallsToMasses();
      if (S.layerEngine) S.syncSceneObjectsToEngine();
      S.fitToScreen();
      S.updateLayerOrder();
      S.renderLayers();
      S.updateUI();
      S.refreshMeasurements();
      S.renderSchedule();
    };
    initHostBridge();
    S._scaleSyncTimer = null;
    S.syncProjectScale = function syncProjectScale(label) {
      const pid = typeof window !== "undefined" ? window.__SKETCHTRUDE_PROJECT_ID : null;
      if (!pid || pid === "local" || !label) return;
      const cfg = window.__SKETCHTRUDE_PROJECT_CONFIG;
      if (cfg) cfg.scale_label = label;
      clearTimeout(S._scaleSyncTimer);
      S._scaleSyncTimer = setTimeout(async () => {
        try {
          await fetch("/api/projects/" + pid, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scale_label: label }),
            credentials: "same-origin"
          });
        } catch (_) {
        }
      }, 400);
    };
    S.scaleLabelFromState = function scaleLabelFromState() {
      if (!state2.pxPerUnit || !state2.scaleUnit) return null;
      const unitInMm = { mm: 1, cm: 10, m: 1e3, in: 25.4, ft: 304.8 }[state2.scaleUnit] || 1;
      const realPerPx_mm = unitInMm / state2.pxPerUnit;
      const docPxPerMm = S.doc.wPx / S.doc.wMM;
      const ratio = realPerPx_mm * docPxPerMm;
      if (!ratio || ratio <= 0) return null;
      return `1:${Math.round(ratio)}`;
    };
    S.updateScaleDisplay = function updateScaleDisplay() {
      const label = S.scaleLabelFromState();
      const el = $el("scale-text");
      if (el) el.textContent = label ? label.replace(/\s+/g, "") : "\u2014";
      return label;
    };
    S.applyScaleFromLabel = function applyScaleFromLabel(label) {
      if (!label || state2.pxPerUnit) return;
      const m = String(label).match(/1\s*:\s*(\d+(?:\.\d+)?)/);
      if (!m) return;
      const ratio = parseFloat(m[1]);
      if (!ratio || ratio <= 0) return;
      const docPxPerMm = S.doc.wPx / S.doc.wMM;
      state2.pxPerUnit = 10 * docPxPerMm / ratio;
      state2.scaleUnit = "cm";
      S.updateScaleDisplay();
    };
    S.applyProjectConfig = function applyProjectConfig() {
      const cfg = typeof window !== "undefined" ? window.__SKETCHTRUDE_PROJECT_CONFIG : null;
      if (!cfg) return;
      const meta = cfg.metadata || {};
      const isInfinite = !!(meta.infinite_canvas || cfg.infinite_canvas);
      state2.autoExpandCanvas = false;
      state2.infiniteCanvas = isInfinite;
      if (cfg.doc_dpi > 0) S.doc.dpi = cfg.doc_dpi;
      if (isInfinite) {
        S.doc.wMM = 1600;
        S.doc.hMM = 1600;
      } else if (cfg.doc_width_mm > 0 && cfg.doc_height_mm > 0) {
        S.doc.wMM = cfg.doc_width_mm;
        S.doc.hMM = cfg.doc_height_mm;
      }
      S.doc.wPx = Math.round(S.doc.wMM / 25.4 * S.doc.dpi);
      S.doc.hPx = Math.round(S.doc.hMM / 25.4 * S.doc.dpi);
      if (S.paper) {
        S.paper.style.width = S.doc.wPx + "px";
        S.paper.style.height = S.doc.hPx + "px";
        if (state2.paperBg) S.paper.style.background = state2.paperBg;
      }
      if (typeof S.strokeCanvas !== "undefined" && S.strokeCanvas) {
        S.strokeCanvas.width = S.doc.wPx;
        S.strokeCanvas.height = S.doc.hPx;
      }
      const gc = $el("guide-canvas");
      if (gc) {
        gc.width = S.doc.wPx;
        gc.height = S.doc.hPx;
      }
      if (typeof S.gridCanvas !== "undefined" && S.gridCanvas) {
        S.gridCanvas.width = S.doc.wPx;
        S.gridCanvas.height = S.doc.hPx;
      }
      S.updateDocInfo(S.paperFormatName(S.doc.wMM, S.doc.hMM));
      const bg = meta.paper_bg;
      if (bg) {
        state2.paperBg = bg;
        if (S.paper) S.paper.style.background = bg;
      }
      if (meta.show_grid) {
        state2.showGrid = true;
        state2.gridType = meta.grid_type || "square";
        if (meta.grid_spacing_mm) state2.gridSpacingMM = meta.grid_spacing_mm;
      }
      if (meta.guide_type) {
        state2.guideType = meta.guide_type;
        if (meta.guide_opacity != null) state2.guideOpacity = meta.guide_opacity;
      }
    };
    S.toggleSymmetry = function toggleSymmetry() {
      const order = [null, "vertical", "horizontal"];
      const idx = order.indexOf(state2.symmetryAxis);
      state2.symmetryAxis = order[(idx + 1) % order.length];
      const labels = { vertical: "Vertical symmetry", horizontal: "Horizontal symmetry" };
      S.showHint(state2.symmetryAxis ? labels[state2.symmetryAxis] + " ON" : "Symmetry off");
      const btn = $el("ovf-symmetry");
      if (btn) btn.classList.toggle("active", !!state2.symmetryAxis);
    };
  }

  // src/engine/app/boot-sequence.ts
  function initBootSequence() {
    const state2 = S.state;
    const $el = (id) => document.getElementById(id);
    const $all = (sel) => document.querySelectorAll(sel);
    const $qs = (sel) => document.querySelector(sel);
    S.applyProjectConfig();
    S.loadStencils();
    S.loadHatches();
    S.loadFillTextures();
    S.loadBrushes();
    S.fitToScreen();
    S.bootDefaultLayers = function bootDefaultLayers() {
      if (S.layerEngine) {
        const boot2 = S.layerEngine.bootstrap({
          floorName: "Canvas",
          mainLayerName: "Layer 1",
          sketchLayerName: "Sketch"
        });
        for (const id of S.layerEngine.getRasterLayerIds()) {
          const meta = S.layerEngine.getLayer(id);
          S.allocateLayerSurface(id, meta ? meta.name : "Layer");
        }
        S.syncStateLayersFromEngine();
        const sketchId = boot2 && boot2.sketchLayerId || typeof S.layerEngine.getSketchLayerId === "function" && S.layerEngine.getSketchLayerId();
        if (sketchId) {
          S.layerEngine.setActiveLayer(sketchId);
          S.syncStateLayersFromEngine();
        }
      } else {
        S.createLayer("Layer 1");
        S.createLayer("Sketch");
        state2.activeLayer = 1;
      }
    };
    try {
      S.bootDefaultLayers();
      S.updateLayerOrder();
      S.renderLayers();
      S.updateUI();
      S.renderSwatches();
      S.setActiveBrush(S.BUILTIN_BRUSHES.find((b) => b.id === "pen") || S.BUILTIN_BRUSHES[0]);
      if (S.brushes) {
        S.brushes.whenReady(() => {
          try {
            S.syncBuiltinBrushesFromEngine();
            const pen = S.BUILTIN_BRUSHES.find((b) => b.id === "pen") || S.BUILTIN_BRUSHES[0];
            if (pen && (!state2.activeBrush || state2.activeBrush.builtIn)) S.setActiveBrush(pen);
            if (typeof S.renderBrushList === "function") S.renderBrushList();
          } catch (_) {
          }
        });
      }
      S.regroupRail();
      S.updatePreview();
      S.initWheelEvents();
      S.syncWheelFromColor(state2.color);
      S.injectHatchTab();
      const _gc = $el("guide-canvas");
      if (_gc) {
        _gc.width = S.doc.wPx;
        _gc.height = S.doc.hPx;
      }
      S.gridCanvas.width = S.doc.wPx;
      S.gridCanvas.height = S.doc.hPx;
      S.drawDocGrid();
      if (state2.guideType && state2.guideType !== "none" && typeof S.drawGuideGrid === "function") S.drawGuideGrid();
      const ovfSym = $el("ovf-symmetry");
      if (ovfSym) ovfSym.addEventListener("click", () => {
        S.toggleSymmetry();
        S.overflowPanel.classList.remove("show");
      });
      S.updateScaleDisplay();
    } catch (bootErr) {
      console.error("Studio boot error:", bootErr);
    } finally {
      S.postEngineReady();
    }
    setTimeout(() => {
      S.showHint("SketchTrude \xB7 2-finger tap = undo \xB7 3-finger tap = redo \xB7 UI hides while drawing");
    }, 600);
    setTimeout(() => S.scheduleThumbnail(), 1800);
  }

  // src/engine/app/boot.ts
  function boot() {
    initDom();
    initCores();
    initState();
    initViewport();
    initLayers();
    initStrokeInput();
    initMeasureStencils();
    initToolUi();
    initSelectionChrome();
    initFeatures();
    initMassing();
    initShell();
    initPersistence();
    initBootSequence();
  }
  try {
    boot();
  } catch (err) {
    console.error("SketchTrude engine boot failed:", err);
    try {
      if (typeof S.postEngineReady === "function") S.postEngineReady();
    } catch (e) {
    }
  }
})();
//# sourceMappingURL=studio.js.map
