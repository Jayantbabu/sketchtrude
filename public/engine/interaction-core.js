/**
 * Phase 2B — shared selection + capability core for the studio iframe.
 * Mirrors src/engine/interaction (TypeScript source of truth).
 * Loaded before legacy-app.js.
 */
(function (global) {
  "use strict";

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
    resizeHandleMode: "corners",
  };

  var REGISTRY = {
    shape: Object.assign({}, DEFAULT_CAPABILITIES, {
      supportsFill: true,
      supportsStroke: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "corners-and-edges",
    }),
    line: Object.assign({}, DEFAULT_CAPABILITIES, {
      supportsStroke: true,
      scalable: false,
      boundingBoxMode: "path-bounds",
      resizeHandleMode: "custom",
    }),
    "sketch-stroke": Object.assign({}, DEFAULT_CAPABILITIES, {
      supportsStroke: true,
      resizable: false,
      boundingBoxMode: "path-bounds",
      resizeHandleMode: "none",
    }),
    stencil: Object.assign({}, DEFAULT_CAPABILITIES, {
      supportsFill: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "corners-and-edges",
    }),
    image: Object.assign({}, DEFAULT_CAPABILITIES, {
      supportsOpacity: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "corners-and-edges",
    }),
    wall: Object.assign({}, DEFAULT_CAPABILITIES, {
      scalable: false,
      supportsFill: true,
      supportsStroke: true,
      supportsMaterial: true,
      supportsChildren: true,
      selectableChildren: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom",
    }),
    window: Object.assign({}, DEFAULT_CAPABILITIES, {
      reorderable: false,
      groupable: false,
      scalable: false,
      rotatable: false,
      supportsMaterial: true,
      constrainedToParent: true,
      moveConstraint: "along-host-wall",
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom",
    }),
    door: Object.assign({}, DEFAULT_CAPABILITIES, {
      reorderable: false,
      groupable: false,
      scalable: false,
      rotatable: false,
      supportsMaterial: true,
      constrainedToParent: true,
      moveConstraint: "along-host-wall",
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom",
    }),
    group: Object.assign({}, DEFAULT_CAPABILITIES, {
      supportsChildren: true,
      selectableChildren: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "corners-and-edges",
    }),
    measurement: Object.assign({}, DEFAULT_CAPABILITIES, {
      scalable: false,
      supportsStroke: true,
      boundingBoxMode: "axis-aligned",
      resizeHandleMode: "custom",
    }),
    floor: Object.assign({}, DEFAULT_CAPABILITIES, {
      supportsChildren: true,
      selectableChildren: true,
      supportsMaterial: true,
      boundingBoxMode: "axis-aligned",
      resizeHandleMode: "none",
    }),
    mass: Object.assign({}, DEFAULT_CAPABILITIES, {
      supportsMaterial: true,
      supportsChildren: true,
      selectableChildren: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom",
    }),
    "mass-face": Object.assign({}, DEFAULT_CAPABILITIES, {
      reorderable: false,
      groupable: false,
      movable: false,
      constrainedToParent: true,
      boundingBoxMode: "face-bounds",
      resizeHandleMode: "custom",
    }),
    region: Object.assign({}, DEFAULT_CAPABILITIES, {
      supportsFill: true,
      supportsStroke: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom",
    }),
    guide: Object.assign({}, DEFAULT_CAPABILITIES, {
      groupable: false,
      resizable: false,
      scalable: false,
      boundingBoxMode: "none",
      resizeHandleMode: "none",
    }),
    light: Object.assign({}, DEFAULT_CAPABILITIES, {
      boundingBoxMode: "axis-aligned",
      resizeHandleMode: "none",
    }),
    roof: Object.assign({}, DEFAULT_CAPABILITIES, {
      supportsMaterial: true,
      boundingBoxMode: "oriented",
      resizeHandleMode: "custom",
    }),
  };

  function createSceneObjectId(prefix) {
    prefix = prefix || "obj";
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return prefix + "_" + crypto.randomUUID();
    }
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function ObjectCapabilityRegistry(seed) {
    this._map = Object.assign({}, seed || REGISTRY);
  }
  ObjectCapabilityRegistry.prototype.get = function (type) {
    return (
      this._map[type] ||
      Object.assign({}, DEFAULT_CAPABILITIES, { selectable: false })
    );
  };
  ObjectCapabilityRegistry.prototype.register = function (type, caps) {
    this._map[type] = caps;
  };
  ObjectCapabilityRegistry.prototype.has = function (type) {
    return Object.prototype.hasOwnProperty.call(this._map, type);
  };

  function createEmptySelectionState() {
    return {
      selectedIds: [],
      primarySelectedId: null,
      hoveredId: null,
      focusedLayerId: null,
      selectionSource: "programmatic",
      isolationRootId: null,
      editingPathId: null,
      selectedFaceId: null,
    };
  }

  function SelectionManager(options) {
    options = options || {};
    this._state = createEmptySelectionState();
    this._listeners = [];
    this._capabilities = options.capabilities || new ObjectCapabilityRegistry();
    this._canSelect = options.canSelect || function () {
      return true;
    };
  }

  SelectionManager.prototype.getState = function () {
    return Object.assign({}, this._state, {
      selectedIds: this._state.selectedIds.slice(),
    });
  };

  SelectionManager.prototype.subscribe = function (listener) {
    var self = this;
    this._listeners.push(listener);
    return function () {
      self._listeners = self._listeners.filter(function (l) {
        return l !== listener;
      });
    };
  };

  SelectionManager.prototype.select = function (objectId, source) {
    source = source || "programmatic";
    if (objectId == null) {
      this.clear(source);
      return;
    }
    if (!this._canSelect(objectId, source)) return;
    this._commit([objectId], objectId, source);
  };

  SelectionManager.prototype.toggle = function (objectId, source) {
    source = source || "canvas";
    if (!this._canSelect(objectId, source)) return;
    var set = {};
    this._state.selectedIds.forEach(function (id) {
      set[id] = true;
    });
    if (set[objectId]) {
      delete set[objectId];
      var next = Object.keys(set);
      this._commit(next, next.length ? next[next.length - 1] : null, source);
      return;
    }
    set[objectId] = true;
    this._commit(Object.keys(set), objectId, source);
  };

  SelectionManager.prototype.add = function (objectIds, source) {
    source = source || "canvas";
    var set = {};
    this._state.selectedIds.forEach(function (id) {
      set[id] = true;
    });
    var primary = this._state.primarySelectedId;
    var self = this;
    (objectIds || []).forEach(function (id) {
      if (!self._canSelect(id, source)) return;
      set[id] = true;
      primary = id;
    });
    this._commit(Object.keys(set), primary, source);
  };

  SelectionManager.prototype.setMany = function (objectIds, source, primaryId) {
    source = source || "programmatic";
    var self = this;
    var allowed = (objectIds || []).filter(function (id) {
      return self._canSelect(id, source);
    });
    var primary =
      primaryId && allowed.indexOf(primaryId) >= 0
        ? primaryId
        : allowed.length
          ? allowed[allowed.length - 1]
          : null;
    this._commit(allowed, primary, source);
  };

  SelectionManager.prototype.clear = function (source) {
    this._commit([], null, source || "programmatic");
  };

  SelectionManager.prototype.setHovered = function (objectId) {
    if (this._state.hoveredId === objectId) return;
    this._state.hoveredId = objectId;
  };

  SelectionManager.prototype.isSelected = function (objectId) {
    return this._state.selectedIds.indexOf(objectId) >= 0;
  };

  SelectionManager.prototype.isSelectableType = function (type) {
    return !!this._capabilities.get(type).selectable;
  };

  SelectionManager.prototype._commit = function (
    selectedIds,
    primarySelectedId,
    source,
  ) {
    var same =
      this._state.primarySelectedId === primarySelectedId &&
      this._state.selectionSource === source &&
      this._state.selectedIds.length === selectedIds.length &&
      this._state.selectedIds.every(function (id, i) {
        return id === selectedIds[i];
      });
    if (same) return;

    this._state.selectedIds = selectedIds;
    this._state.primarySelectedId = primarySelectedId;
    this._state.selectionSource = source;

    var event = {
      type: "selection-changed",
      selectedIds: selectedIds.slice(),
      primarySelectedId: primarySelectedId,
      source: source,
    };
    this._listeners.forEach(function (listener) {
      listener(event);
    });
    try {
      global.dispatchEvent(
        new CustomEvent("sketchtrude-selection-changed", { detail: event }),
      );
    } catch (_) {
      /* older browsers */
    }
  };

  function ensureShapeId(shape) {
    if (shape && typeof shape.id === "string" && shape.id.length) return shape.id;
    if (!shape) return createSceneObjectId("shape");
    shape.id = createSceneObjectId("shape");
    return shape.id;
  }

  function ensureAllShapeIds(shapes) {
    return (shapes || []).map(ensureShapeId);
  }

  function sceneTypeFromShapeKind(kind) {
    return kind === "line" ? "line" : "shape";
  }

  /**
   * Canvas ↔ layer panel sync contract (Phase 2B).
   * Selection-only changes must not mark the project dirty.
   */
  var SelectionSyncContract = {
    /** Canvas selected an object — layer panel should highlight the same id. */
    CANVAS_TO_LAYER: "canvas-to-layer",
    /** Layer panel selected a row — canvas should select the same id. */
    LAYER_TO_CANVAS: "layer-to-canvas",
    /** True when this selection change must not dirty autosave. */
    isSelectionOnly: function (event) {
      return event && event.type === "selection-changed";
    },
  };

  var capabilityRegistry = new ObjectCapabilityRegistry();
  var selectionManager = new SelectionManager({
    capabilities: capabilityRegistry,
  });

  global.SketchtrudeInteraction = {
    ObjectCapabilityRegistry: ObjectCapabilityRegistry,
    SelectionManager: SelectionManager,
    capabilityRegistry: capabilityRegistry,
    selectionManager: selectionManager,
    createSceneObjectId: createSceneObjectId,
    createEmptySelectionState: createEmptySelectionState,
    ensureShapeId: ensureShapeId,
    ensureAllShapeIds: ensureAllShapeIds,
    sceneTypeFromShapeKind: sceneTypeFromShapeKind,
    SelectionSyncContract: SelectionSyncContract,
    DEFAULT_CAPABILITIES: DEFAULT_CAPABILITIES,
    ensureObjectId: function (record, prefix) {
      if (record && typeof record.id === "string" && record.id) return record.id;
      var id = createSceneObjectId(prefix || "obj");
      if (record) record.id = id;
      return id;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
