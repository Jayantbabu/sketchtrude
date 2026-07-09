export type PaperTemplate = {
  id: string;
  name: string;
  description: string;
  doc_width_mm: number;
  doc_height_mm: number;
  doc_dpi: number;
  scale_label: string;
  infinite_canvas?: boolean;
  auto_expand?: boolean;
  preview?: string;
  previewStyle?: string;
  metadata: Record<string, unknown>;
};

export const PAPER_TEMPLATES: PaperTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start with a blank template",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#ffffff",
    metadata: { template: "blank", paper_bg: "#ffffff" },
  },
  {
    id: "infinite",
    name: "Infinite Canvas",
    description: "Borderless sketch space — expands as you draw",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    infinite_canvas: true,
    auto_expand: true,
    preview: "#ffffff",
    previewStyle:
      "repeating-linear-gradient(45deg,#f5f5f5 0,#f5f5f5 2px,#ffffff 2px,#ffffff 8px)",
    metadata: { template: "infinite", infinite_canvas: true, paper_bg: "#ffffff" },
  },
  {
    id: "blueprint",
    name: "Blueprint",
    description: "A set of 4K blueprint backgrounds for Architects",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#1e3a5f",
    metadata: {
      template: "blueprint",
      paper_bg: "#1e3a5f",
      show_grid: true,
      grid_type: "square",
      grid_spacing_mm: 5,
      guide_opacity: 0.25,
    },
  },
  {
    id: "charcoal-blueprint",
    name: "Charcoal Blueprint",
    description: "A set of 4K charcoal blueprint backgrounds for Architects",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#2a2a2e",
    metadata: {
      template: "charcoal-blueprint",
      paper_bg: "#2a2a2e",
      show_grid: true,
      grid_type: "square",
      grid_spacing_mm: 5,
      guide_opacity: 0.2,
    },
  },
  {
    id: "kraft",
    name: "Kraft",
    description: "A set of 4K kraft backgrounds for Architects",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#c4a574",
    metadata: { template: "kraft", paper_bg: "#c4a574" },
  },
  {
    id: "trace-yellow",
    name: "Trace Paper",
    description: "Warm yellow trace overlay like Morpholio Trace",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#fff8e1",
    metadata: { template: "trace-yellow", paper_bg: "#fff8e1", trace_tint: 0.35 },
  },
  {
    id: "basic-grid",
    name: "Basic Grids",
    description: "A simple set of square grids",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#ffffff",
    previewStyle:
      "linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)",
    metadata: {
      template: "basic-grid",
      paper_bg: "#ffffff",
      auto_expand: true,
      show_grid: true,
      grid_type: "square",
      grid_spacing_mm: 10,
    },
  },
  {
    id: "scale-grid",
    name: "Scale Grids",
    description: "Templates for Architects",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#ffffff",
    previewStyle:
      "linear-gradient(#333 1px,transparent 1px),linear-gradient(90deg,#333 1px,transparent 1px)",
    metadata: {
      template: "scale-grid",
      paper_bg: "#ffffff",
      auto_expand: true,
      show_grid: true,
      grid_type: "square",
      grid_spacing_mm: 5,
    },
  },
  {
    id: "perspective-grid",
    name: "Perspective Grids",
    description:
      "Helpful templates for creating both one and two-point perspectives",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#ffffff",
    previewStyle:
      "linear-gradient(135deg,transparent 48%,#666 49%,#666 51%,transparent 52%)",
    metadata: {
      template: "perspective-grid",
      paper_bg: "#ffffff",
      auto_expand: true,
      guide_type: "perspective",
      guide_opacity: 0.35,
    },
  },
  {
    id: "iso-grid",
    name: "Axon Grids",
    description:
      "Isometric grids help you generate accurate 3D depictions by extruding 2D artwork",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#ffffff",
    previewStyle:
      "linear-gradient(30deg,transparent 48%,#888 49%,#888 51%,transparent 52%),linear-gradient(150deg,transparent 48%,#888 49%,#888 51%,transparent 52%)",
    metadata: {
      template: "iso-grid",
      paper_bg: "#ffffff",
      auto_expand: true,
      guide_type: "iso",
      guide_opacity: 0.35,
    },
  },
  {
    id: "3d-grid",
    name: "3D Grids",
    description: "Grids for developing 3D designs and plotting 3D information",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#ffffff",
    previewStyle:
      "linear-gradient(#555 1px,transparent 1px),linear-gradient(90deg,#555 1px,transparent 1px),linear-gradient(135deg,transparent 48%,#555 49%,#555 51%,transparent 52%)",
    metadata: {
      template: "3d-grid",
      paper_bg: "#ffffff",
      auto_expand: true,
      guide_type: "iso",
      show_grid: true,
      grid_type: "square",
      grid_spacing_mm: 10,
      guide_opacity: 0.3,
    },
  },
  {
    id: "a4-portrait",
    name: "A4 Portrait",
    description: "Standard A4 sheet, portrait",
    doc_width_mm: 210,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#ffffff",
    metadata: { template: "a4-portrait", paper_bg: "#ffffff" },
  },
  {
    id: "a3-landscape",
    name: "A3 Landscape",
    description: "Architectural A3 — default Trace size",
    doc_width_mm: 420,
    doc_height_mm: 297,
    doc_dpi: 150,
    scale_label: "1:50",
    preview: "#ffffff",
    metadata: { template: "a3-landscape", paper_bg: "#ffffff" },
  },
];

export function getPaperTemplate(id: string): PaperTemplate | undefined {
  return PAPER_TEMPLATES.find((t) => t.id === id);
}
