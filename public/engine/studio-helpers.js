/** Browser build of studio helpers — kept in sync with src/lib/studio-helpers.ts */
(function (global) {
  const INSPECTOR_TOOLS = new Set([
    "select",
    "move",
    "height",
    "push",
    "material",
  ]);

  const MASSING_TOOLS = [
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
    "height",
  ];

  const SKETCH_DRAW_TOOLS = new Set([
    "pen",
    "marker",
    "pencil",
    "brush",
    "watercolour",
    "eraser",
    "fine-pen",
    "chisel",
    "flat",
  ]);

  const SKETCH_BUILD_TOOLS = new Set([
    "wall",
    "opening",
    "select",
    "offset",
    "line",
    "area",
    "ruler",
    "hand",
  ]);

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
    // Phase 1: never auto-expand; infinite is a large fixed world.
    return false;
  }

  function shouldAutoExpandCanvas(_flags) {
    return false;
  }

  function shouldExpandAtEdge(x, y, docWidth, docHeight, threshold) {
    threshold = threshold != null ? threshold : 140;
    return {
      left: x < threshold,
      right: x > docWidth - threshold,
      top: y < threshold,
      bottom: y > docHeight - threshold,
    };
  }

  function clampZoom(zoom, min, max) {
    min = min != null ? min : 0.2;
    max = max != null ? max : 8;
    return Math.max(min, Math.min(max, zoom));
  }

  function zoomIn(zoom, factor) {
    factor = factor != null ? factor : 1.25;
    return clampZoom(zoom * factor);
  }

  function zoomOut(zoom, factor) {
    factor = factor != null ? factor : 1.25;
    return clampZoom(zoom / factor);
  }

  function fitToScreenTransform(areaWidth, areaHeight, docWidthPx, docHeightPx, padding) {
    padding = padding != null ? padding : 60;
    const aw = areaWidth - padding * 2;
    const ah = areaHeight - padding * 2;
    const aspect = docWidthPx / docHeightPx;
    let w, h;
    if (aw / ah > aspect) {
      h = ah;
      w = h * aspect;
    } else {
      w = aw;
      h = w / aspect;
    }
    return { baseZoom: w / docWidthPx, zoom: 1, panX: 0, panY: 0 };
  }

  function applyPanDelta(startPanX, startPanY, startSx, startSy, currentSx, currentSy) {
    return {
      panX: startPanX + (currentSx - startSx),
      panY: startPanY + (currentSy - startSy),
    };
  }

  function massingZoomAtCursor(scale, deltaY) {
    const next = scale * (deltaY < 0 ? 1.08 : 0.93);
    return Math.max(6, Math.min(160, next));
  }

  function zoomDisplayPercent(zoom) {
    return Math.round(zoom * 100) + "%";
  }

  function isDrawTool(tool) {
    return SKETCH_DRAW_TOOLS.has(tool);
  }

  function massingToolUsesSelection(tool) {
    return INSPECTOR_TOOLS.has(tool);
  }

  global.StudioHelpers = {
    INSPECTOR_TOOLS,
    MASSING_TOOLS,
    SKETCH_DRAW_TOOLS,
    SKETCH_BUILD_TOOLS,
    shouldShowMassInspector,
    shouldShowBuildPalette,
    shouldShowWall2dPalette,
    shouldShowOpeningPalette,
    activeRailHighlight,
    resolveAutoExpandFromMetadata,
    shouldAutoExpandCanvas,
    shouldExpandAtEdge,
    clampZoom,
    zoomIn,
    zoomOut,
    fitToScreenTransform,
    applyPanDelta,
    massingZoomAtCursor,
    zoomDisplayPercent,
    isDrawTool,
    massingToolUsesSelection,
  };
})(typeof window !== "undefined" ? window : globalThis);
