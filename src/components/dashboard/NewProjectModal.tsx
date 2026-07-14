"use client";

import { useEffect, useState } from "react";
import { PAPER_TEMPLATES, type PaperTemplate } from "@/lib/paper-templates";

type Props = {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onCreate: (template: PaperTemplate, title: string) => void;
};

export function NewProjectModal({ open, loading, onClose, onCreate }: Props) {
  const [selectedId, setSelectedId] = useState(PAPER_TEMPLATES[0].id);
  const [title, setTitle] = useState("Untitled");
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(PAPER_TEMPLATES[0].id);
    setTitle("Untitled");
    setTitleError(null);
  }, [open]);

  if (!open) return null;

  const selected =
    PAPER_TEMPLATES.find((t) => t.id === selectedId) ?? PAPER_TEMPLATES[0];

  function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("Enter a project name");
      return;
    }
    setTitleError(null);
    onCreate(selected, trimmed);
  }

  return (
    <div
      className="modal-backdrop papers-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
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
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            placeholder="Untitled"
            disabled={loading}
            aria-invalid={!!titleError}
          />
          {titleError && <small className="papers-field-error">{titleError}</small>}
        </label>

        <p className="papers-scale-note">
          Scale starts blank — set it with the ruler while sketching.
        </p>

        <ul className="papers-list" role="listbox" aria-label="Paper templates">
          {PAPER_TEMPLATES.map((template) => {
            const isSelected = template.id === selectedId;
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
                  onClick={() => setSelectedId(template.id)}
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
            disabled={loading}
            onClick={handleCreate}
          >
            {loading ? "Creating project…" : "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}
