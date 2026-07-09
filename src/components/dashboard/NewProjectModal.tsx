"use client";

import { useState } from "react";
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

  if (!open) return null;

  const selected =
    PAPER_TEMPLATES.find((t) => t.id === selectedId) ?? PAPER_TEMPLATES[0];

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
          <h2 id="new-project-title">Papers</h2>
          <span className="papers-header-spacer" aria-hidden="true" />
        </header>

        <label className="modal-field papers-name-field">
          <span>Project name</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            disabled={loading}
          />
        </label>

        <ul className="papers-list" role="listbox" aria-label="Paper templates">
          {PAPER_TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                role="option"
                aria-selected={template.id === selectedId}
                className={
                  "papers-row" + (template.id === selectedId ? " selected" : "")
                }
                onClick={() => setSelectedId(template.id)}
                disabled={loading}
              >
                <span
                  className="papers-thumb"
                  style={{
                    background: template.previewStyle
                      ? undefined
                      : template.preview || (template.metadata.paper_bg as string) || "#ffffff",
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
              </button>
            </li>
          ))}
        </ul>

        <div className="modal-actions papers-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={loading}
            onClick={() => onCreate(selected, title.trim() || "Untitled")}
          >
            {loading ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
