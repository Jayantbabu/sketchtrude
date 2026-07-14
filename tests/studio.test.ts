import {
  activeRailHighlight,
  applyPanDelta,
  clampZoom,
  fitToScreenTransform,
  isDrawTool,
  MASSING_TOOLS,
  MASSING_TOOL_HINTS,
  massingToolUsesSelection,
  massingZoomAtCursor,
  resolveAutoExpandFromMetadata,
  shouldAutoExpandCanvas,
  shouldExpandAtEdge,
  shouldShowBuildPalette,
  shouldShowMassInspector,
  shouldShowOpeningPalette,
  shouldShowWall2dPalette,
  scaleLabelFromPxPerUnit,
  pxPerUnitFromScaleLabel,
  SKETCH_BUILD_TOOLS,
  SKETCH_DRAW_TOOLS,
  zoomDisplayPercent,
  zoomIn,
  zoomOut,
} from "../src/lib/studio-helpers";
import { getPaperTemplate, PAPER_TEMPLATES } from "../src/lib/paper-templates";

describe("paper templates", () => {
  it("includes Morpholio-style template ids", () => {
    const ids = PAPER_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("blank");
    expect(ids).toContain("blueprint");
    expect(ids).toContain("kraft");
    expect(ids).toContain("basic-grid");
    expect(ids).toContain("3d-grid");
  });

  it("resolves templates by id", () => {
    expect(getPaperTemplate("blueprint")?.name).toBe("Blueprint");
    expect(getPaperTemplate("missing")).toBeUndefined();
  });

  it("stores grid metadata on architect templates", () => {
    const scale = getPaperTemplate("scale-grid");
    expect(scale?.metadata.show_grid).toBe(true);
    expect(scale?.metadata.grid_spacing_mm).toBe(5);
    expect(scale?.metadata.auto_expand).toBe(false);
    expect(scale?.scale_label).toBeNull();
  });

  it("disables auto-expand on all papers including infinite", () => {
    expect(resolveAutoExpandFromMetadata(getPaperTemplate("basic-grid")!.metadata)).toBe(false);
    expect(resolveAutoExpandFromMetadata(getPaperTemplate("infinite")!.metadata)).toBe(false);
    expect(resolveAutoExpandFromMetadata(getPaperTemplate("blank")!.metadata)).toBe(false);
    expect(getPaperTemplate("infinite")?.infinite_canvas).toBe(true);
  });
});

describe("2D zoom helpers", () => {
  it("clamps zoom within bounds", () => {
    expect(clampZoom(0.05)).toBe(0.2);
    expect(clampZoom(20)).toBe(8);
    expect(clampZoom(1)).toBe(1);
  });

  it("zooms in and out by factor", () => {
    expect(zoomIn(1)).toBeCloseTo(1.25);
    expect(zoomOut(1)).toBeCloseTo(0.8);
  });

  it("computes fit-to-screen transform", () => {
    const fit = fitToScreenTransform(1200, 800, 4200, 2970);
    expect(fit.zoom).toBe(1);
    expect(fit.panX).toBe(0);
    expect(fit.panY).toBe(0);
    expect(fit.baseZoom).toBeGreaterThan(0);
    expect(fit.baseZoom).toBeLessThan(1);
  });

  it("formats zoom percentage", () => {
    expect(zoomDisplayPercent(0.62)).toBe("62%");
  });
});

describe("canvas auto-expand", () => {
  it("never auto-expands (feature removed)", () => {
    expect(shouldAutoExpandCanvas({ infiniteCanvas: true })).toBe(false);
    expect(shouldAutoExpandCanvas({ autoExpandCanvas: true })).toBe(false);
    expect(shouldAutoExpandCanvas({})).toBe(false);
  });

  it("still detects edges within threshold for tooling", () => {
    const edges = shouldExpandAtEdge(100, 3400, 2480, 3508, 140);
    expect(edges.left).toBe(true);
    expect(edges.right).toBe(false);
    expect(edges.bottom).toBe(true);
  });
});

describe("3D massing UI visibility", () => {
  const base = { active: true, tool: "select", selected: 0 };

  it("shows inspector only for editable tools with a selection", () => {
    expect(shouldShowMassInspector(base)).toBe(true);
    expect(shouldShowMassInspector({ ...base, tool: "pan" })).toBe(false);
    expect(shouldShowMassInspector({ ...base, tool: "orbit" })).toBe(false);
    expect(shouldShowMassInspector({ ...base, tool: "build" })).toBe(false);
    expect(shouldShowMassInspector({ ...base, selected: -1 })).toBe(false);
    expect(shouldShowMassInspector({ ...base, active: false })).toBe(false);
  });

  it("shows build palette only in build mode", () => {
    expect(shouldShowBuildPalette({ active: true, tool: "build" })).toBe(true);
    expect(shouldShowBuildPalette({ active: true, tool: "select" })).toBe(false);
    expect(shouldShowBuildPalette({ active: false, tool: "build" })).toBe(false);
  });

  it("covers every 3D toolbar tool for inspector rules", () => {
    MASSING_TOOLS.forEach((tool) => {
      const usesSelection = massingToolUsesSelection(tool);
      const show = shouldShowMassInspector({ active: true, tool, selected: 0 });
      if (usesSelection) expect(show).toBe(true);
      else expect(show).toBe(false);
    });
  });

  it("documents hints for all 3D tools", () => {
    MASSING_TOOLS.forEach((tool) => {
      expect(MASSING_TOOL_HINTS[tool]?.length).toBeGreaterThan(5);
    });
  });
});

describe("sketch mode UI visibility", () => {
  it("shows wall palette only in sketch wall mode", () => {
    expect(shouldShowWall2dPalette("wall", false)).toBe(true);
    expect(shouldShowWall2dPalette("wall", true)).toBe(false);
    expect(shouldShowWall2dPalette("pen", false)).toBe(false);
  });

  it("shows opening palette only in sketch opening mode", () => {
    expect(shouldShowOpeningPalette("opening", false)).toBe(true);
    expect(shouldShowOpeningPalette("opening", true)).toBe(false);
    expect(shouldShowOpeningPalette("select", false)).toBe(false);
  });

  it("highlights massing on the rail when 3D is active", () => {
    expect(activeRailHighlight("wall", true)).toBe("massing");
    expect(activeRailHighlight("pen", false)).toBe("pen");
  });

  it("classifies sketch draw and build tools", () => {
    expect(isDrawTool("pen")).toBe(true);
    expect(isDrawTool("marker")).toBe(true);
    expect(isDrawTool("wall")).toBe(false);
    expect(SKETCH_BUILD_TOOLS.has("wall")).toBe(true);
    expect(SKETCH_DRAW_TOOLS.has("eraser")).toBe(true);
  });
});

describe("3D pan and zoom", () => {
  it("applies pan delta from pointer drag", () => {
    expect(applyPanDelta(10, 20, 100, 200, 130, 250)).toEqual({
      panX: 40,
      panY: 70,
    });
  });

  it("zooms massing camera with wheel direction", () => {
    expect(massingZoomAtCursor(40, -100)).toBeGreaterThan(40);
    expect(massingZoomAtCursor(40, 100)).toBeLessThan(40);
    expect(massingZoomAtCursor(5, 100)).toBeGreaterThanOrEqual(6);
    expect(massingZoomAtCursor(200, -100)).toBeLessThanOrEqual(160);
  });
});

describe("drawing and navigation scenarios", () => {
  it("supports sketching on blank and trace papers", () => {
    expect(getPaperTemplate("blank")?.metadata.paper_bg).toBe("#ffffff");
    expect(getPaperTemplate("trace-yellow")?.metadata.paper_bg).toBe("#fff8e1");
  });

  it("supports 3D grid paper for massing workflows", () => {
    const grid = getPaperTemplate("3d-grid");
    expect(grid?.metadata.guide_type).toBe("iso");
    expect(grid?.metadata.show_grid).toBe(true);
    expect(grid?.metadata.auto_expand).toBe(false);
  });

  it("keeps pan math stable for repeated drags", () => {
    const first = applyPanDelta(0, 0, 0, 0, 50, 30);
    const second = applyPanDelta(first.panX, first.panY, 50, 30, 80, 60);
    expect(second).toEqual({ panX: 80, panY: 60 });
  });

  it("hides sketch palettes when entering 3D from wall tool", () => {
    expect(shouldShowWall2dPalette("wall", true)).toBe(false);
    expect(shouldShowOpeningPalette("opening", true)).toBe(false);
    expect(activeRailHighlight("wall", true)).toBe("massing");
  });
});

describe("3D tool workflow matrix", () => {
  const navTools = ["orbit", "pan", "remove", "sketch", "add"] as const;
  const editTools = ["select", "move", "height", "push", "material"] as const;

  it("navigation and creation tools never show the mass inspector", () => {
    navTools.forEach((tool) => {
      expect(shouldShowMassInspector({ active: true, tool, selected: 0 })).toBe(false);
    });
  });

  it("edit tools show inspector only with a selection", () => {
    editTools.forEach((tool) => {
      expect(shouldShowMassInspector({ active: true, tool, selected: 0 })).toBe(true);
      expect(shouldShowMassInspector({ active: true, tool, selected: -1 })).toBe(false);
    });
  });

  it("build mode shows build palette not inspector", () => {
    expect(shouldShowBuildPalette({ active: true, tool: "build" })).toBe(true);
    expect(shouldShowMassInspector({ active: true, tool: "build", selected: 0 })).toBe(false);
  });
});

describe("scale persistence", () => {
  it("derives scale label from px per unit", () => {
    const label = scaleLabelFromPxPerUnit(12.5, "cm", 2480, 420);
    expect(label).toMatch(/^1:\d+$/);
  });

  it("parses scale label into px per unit", () => {
    const parsed = pxPerUnitFromScaleLabel("1:100", 2480, 420);
    expect(parsed?.scaleUnit).toBe("cm");
    expect(parsed?.pxPerUnit).toBeGreaterThan(0);
  });

  it("round-trips a scale label", () => {
    const parsed = pxPerUnitFromScaleLabel("1:50", 2480, 420);
    expect(parsed).not.toBeNull();
    const label = scaleLabelFromPxPerUnit(
      parsed!.pxPerUnit,
      parsed!.scaleUnit,
      2480,
      420,
    );
    expect(label).toBe("1:50");
  });
});

describe("sketch tool workflow matrix", () => {
  const drawTools = ["pen", "marker", "pencil", "brush", "watercolour", "eraser"] as const;
  const buildTools = ["wall", "opening", "select", "offset", "line", "area"] as const;

  it("draw tools stay in sketch mode without build palettes", () => {
    drawTools.forEach((tool) => {
      expect(isDrawTool(tool)).toBe(true);
      expect(shouldShowWall2dPalette(tool, false)).toBe(false);
      expect(shouldShowOpeningPalette(tool, false)).toBe(false);
      expect(activeRailHighlight(tool, false)).toBe(tool);
    });
  });

  it("build tools show the correct sketch palette", () => {
    buildTools.forEach((tool) => {
      expect(SKETCH_BUILD_TOOLS.has(tool)).toBe(true);
      expect(shouldShowWall2dPalette(tool, false)).toBe(tool === "wall");
      expect(shouldShowOpeningPalette(tool, false)).toBe(tool === "opening");
    });
  });
});
