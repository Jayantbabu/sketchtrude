"use client";

import { useRef, useState } from "react";
import { PAPER_TEMPLATES, type PaperTemplate } from "@/lib/paper-templates";
import {
  CANVAS_SOURCE_DPI,
  pdfPointsToMillimeters,
  pixelsToMillimeters,
  type CanvasSourceSelection,
} from "@/lib/projects/pending-canvas-source";

type Props = {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onCreate: (
    template: PaperTemplate,
    title: string,
    source: CanvasSourceSelection | null,
  ) => void;
};

export function NewProjectModal({ open, loading, onClose, onCreate }: Props) {
  const [selectedId, setSelectedId] = useState(PAPER_TEMPLATES[0].id);
  const [title, setTitle] = useState("Untitled");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [source, setSource] = useState<CanvasSourceSelection | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const selected =
    PAPER_TEMPLATES.find((template) => template.id === selectedId) ??
    PAPER_TEMPLATES[0];

  function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("Enter a project name");
      return;
    }
    setTitleError(null);
    onCreate(selected, trimmed, source);
  }

  async function inspectCanvasSource(file: File) {
    setSourceLoading(true);
    setSourceError(null);
    try {
      const isPdf =
        file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      let selection: CanvasSourceSelection;

      if (isPdf) {
        if (file.size > 50 * 1024 * 1024) {
          throw new Error("PDF exceeds the 50 MiB limit");
        }
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/engine/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
        });
        const pdf = await loadingTask.promise;
        let pageNumber = 1;
        if (pdf.numPages > 1) {
          const answer = window.prompt(
            `This PDF has ${pdf.numPages} pages. Which page should become the canvas?`,
            "1",
          );
          if (answer == null) {
            await loadingTask.destroy();
            return;
          }
          pageNumber = Math.max(
            1,
            Math.min(pdf.numPages, Math.round(Number(answer) || 1)),
          );
        }
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const docWidthMm = pdfPointsToMillimeters(viewport.width);
        const docHeightMm = pdfPointsToMillimeters(viewport.height);
        selection = {
          sourceId: crypto.randomUUID(),
          file,
          kind: "pdf",
          pageNumber,
          pageCount: pdf.numPages,
          widthPx: Math.round((docWidthMm / 25.4) * CANVAS_SOURCE_DPI),
          heightPx: Math.round((docHeightMm / 25.4) * CANVAS_SOURCE_DPI),
          docWidthMm,
          docHeightMm,
          dpi: CANVAS_SOURCE_DPI,
        };
        await loadingTask.destroy();
      } else {
        if (!file.type.startsWith("image/")) {
          throw new Error("Choose a PDF or image file");
        }
        const bitmap = await createImageBitmap(file);
        const widthPx = bitmap.width;
        const heightPx = bitmap.height;
        bitmap.close();
        if (!widthPx || !heightPx) {
          throw new Error("The image dimensions could not be read");
        }
        selection = {
          sourceId: crypto.randomUUID(),
          file,
          kind: "image",
          pageNumber: 1,
          pageCount: 1,
          widthPx,
          heightPx,
          docWidthMm: pixelsToMillimeters(widthPx),
          docHeightMm: pixelsToMillimeters(heightPx),
          dpi: CANVAS_SOURCE_DPI,
        };
      }

      setSource(selection);
      const baseName = file.name.replace(/\.[^.]+$/, "").trim();
      if (title.trim() === "" || title === "Untitled") {
        setTitle(baseName || "Untitled");
      }
    } catch (error) {
      setSource(null);
      setSourceError(
        error instanceof Error ? error.message : "Could not read this file",
      );
    } finally {
      setSourceLoading(false);
      if (sourceInputRef.current) sourceInputRef.current.value = "";
    }
  }

  return (
    <div
      className="modal-backdrop papers-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div className="modal-panel papers-modal">
        <header className="papers-modal-header">
          <button
            type="button"
            className="papers-back"
            onClick={onClose}
            disabled={loading}
            aria-label="Back"
          >
            ‹
          </button>
          <h2 id="new-project-title">New project</h2>
          <span className="papers-header-spacer" aria-hidden="true" />
        </header>

        <label className="modal-field papers-name-field">
          <span>Project name</span>
          <input
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (titleError) setTitleError(null);
            }}
            placeholder="Untitled"
            disabled={loading}
            aria-invalid={!!titleError}
          />
          {titleError && (
            <small className="papers-field-error">{titleError}</small>
          )}
        </label>

        <p className="papers-scale-note">
          {source
            ? "The canvas and sketch layer will match this source exactly."
            : "Scale starts blank — set it with the ruler while sketching."}
        </p>

        <ul className="papers-list" role="listbox" aria-label="Paper templates">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!!source}
              className={
                "papers-row papers-source-row" +
                (source ? " selected" : "") +
                (loading || sourceLoading ? " disabled" : "")
              }
              onClick={() => sourceInputRef.current?.click()}
              disabled={loading || sourceLoading}
            >
              <span className="papers-thumb papers-source-thumb" aria-hidden="true">
                {source?.kind === "pdf" ? "PDF" : source ? "IMG" : "+"}
              </span>
              <span className="papers-copy">
                <strong>
                  {sourceLoading
                    ? "Reading file…"
                    : source?.file.name || "Use a PDF or image"}
                </strong>
                <small>
                  {source
                    ? `${source.widthPx} × ${source.heightPx} px${
                        source.kind === "pdf"
                          ? ` · page ${source.pageNumber} of ${source.pageCount}`
                          : ""
                      }`
                    : "Create the project at the source page dimensions"}
                </small>
              </span>
              {source && (
                <span className="papers-selected-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
            <input
              ref={sourceInputRef}
              className="papers-source-input"
              type="file"
              accept="image/*,application/pdf,.pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void inspectCanvasSource(file);
              }}
              disabled={loading || sourceLoading}
            />
            {sourceError && (
              <small className="papers-source-error">{sourceError}</small>
            )}
          </li>

          {PAPER_TEMPLATES.map((template) => {
            const isSelected = !source && template.id === selectedId;
            return (
              <li key={template.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={
                    "papers-row" +
                    (isSelected ? " selected" : "") +
                    (loading ? " disabled" : "")
                  }
                  onClick={() => {
                    setSource(null);
                    setSourceError(null);
                    setSelectedId(template.id);
                  }}
                  disabled={loading}
                >
                  <span
                    className="papers-thumb"
                    style={{
                      background: template.previewStyle
                        ? undefined
                        : template.preview ||
                          (template.metadata.paper_bg as string) ||
                          "#ffffff",
                      backgroundImage: template.previewStyle,
                      backgroundSize: template.previewStyle
                        ? "12px 12px, 12px 12px"
                        : undefined,
                    }}
                  />
                  <span className="papers-copy">
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </span>
                  {isSelected && (
                    <span className="papers-selected-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="modal-actions papers-actions">
          <button
            type="button"
            className="btn-ghost papers-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary papers-create"
            disabled={loading || sourceLoading}
            onClick={handleCreate}
          >
            {loading
              ? "Creating project…"
              : sourceLoading
                ? "Reading source…"
                : "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}
