import type { EngineInitOptions } from "./types";

let engineScriptEl: HTMLScriptElement | null = null;
let initialized = false;

export async function initStudioEngine(options: EngineInitOptions): Promise<void> {
  const { projectId, container } = options;

  if (initialized) return;

  // Load studio HTML shell
  const htmlRes = await fetch("/engine/studio-body.html");
  const html = await htmlRes.text();
  container.innerHTML = html;

  // Set logo
  const logo = container.querySelector("#logo") as HTMLImageElement | null;
  if (logo) logo.src = "/logo.png";

  // Patch IndexedDB key to be project-scoped
  (window as Window & { __SKETCHTRUDE_PROJECT_ID?: string }).__SKETCHTRUDE_PROJECT_ID =
    projectId;

  // Load Phase 2B interaction core, then legacy engine
  await new Promise<void>((resolve, reject) => {
    const interactionEl = document.createElement("script");
    interactionEl.src = "/engine/interaction-core.js";
    interactionEl.async = false;
    interactionEl.onload = () => {
      engineScriptEl = document.createElement("script");
      engineScriptEl.src = "/engine/legacy-app.js";
      engineScriptEl.async = false;
      engineScriptEl.onload = () => {
        initialized = true;
        resolve();
      };
      engineScriptEl.onerror = () =>
        reject(new Error("Failed to load studio engine"));
      document.body.appendChild(engineScriptEl);
    };
    interactionEl.onerror = () =>
      reject(new Error("Failed to load interaction core"));
    document.body.appendChild(interactionEl);
  });

  options.onSave?.();
}

export function destroyStudioEngine(): void {
  if (engineScriptEl) {
    engineScriptEl.remove();
    engineScriptEl = null;
  }
  initialized = false;
}

export function getDocumentData(): unknown {
  const win = window as Window & { state?: unknown };
  if (win.state) {
    return {
      state: win.state,
      savedAt: Date.now(),
    };
  }
  return { savedAt: Date.now() };
}
