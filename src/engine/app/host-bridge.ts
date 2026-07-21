/* Host postMessage / import-export bridge — shared scope S */
import { S } from "./scope";

export function initHostBridge() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);


  S.postContentReady = function postContentReady() {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'sketchtrude-content-ready',
        projectId: (window as any).__SKETCHTRUDE_PROJECT_ID,
      }, '*');
    }
  }

  S.postEngineReady = function postEngineReady() {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'sketchtrude-engine-ready',
        projectId: (window as any).__SKETCHTRUDE_PROJECT_ID,
      }, '*');
    }
  }
  S.restoreSession = async function restoreSession() {
    let cloudSaved: any = null, localSaved: any = null;
    try { localSaved = await S.loadSavedDoc(); } catch { localSaved = null; }
    try { cloudSaved = await S.loadCloudDocument(); } catch { cloudSaved = null; }
    const saved = S.chooseSavedDoc(localSaved, cloudSaved);
    if (!saved || !saved.layers || !saved.layers.length) return false;
    S._autosaveSuspended = true;
    S._isHydrating = true;
    try {
      await S.applyLegacyDocument(saved);
      S._hasUnsavedChanges = false;
      return true;
    } catch (e) {
      console.warn('Restore failed, starting fresh:', e);
      return false;
    } finally {
      S._isHydrating = false;
      S._autosaveSuspended = false;
    }
  }

  S.importProjectDocument = async function importProjectDocument(document: any) {
    if (!document || typeof document !== 'object') {
      throw new Error('Invalid document');
    }
    S._autosaveSuspended = true;
    S._isHydrating = true;
    try {
      const merged = await S.mergeLocalLayerBlobs(document);
      await S.applyLegacyDocument(merged);
      S._hasUnsavedChanges = false;
    } finally {
      S._isHydrating = false;
      S._autosaveSuspended = false;
    }
    S.postContentReady();
    setTimeout(() => S.postContentReady(), 80);
  }

  S.exportProjectDocument = async function exportProjectDocument() {
    // Ensure layer blobs are fresh, then return the same payload shape as saveDoc.
    await S.saveDoc();
    return S._lastDocPayload;
  }

  S.subscribeToDocumentChanges = function subscribeToDocumentChanges(callback: any) {
    if (typeof callback !== 'function') return () => {};
    S._documentChangeListeners.add(callback);
    return () => { S._documentChangeListeners.delete(callback); };
  }

  S.hasUnsavedChanges = function hasUnsavedChanges() {
    return !!S._hasUnsavedChanges;
  }

  S.getMutationVersion = function getMutationVersion() {
    return S._mutationVersion;
  }

  S.applyScaleBlank = function applyScaleBlank() {
    state.pxPerUnit = null;
    S.updateScaleDisplay();
  }

  S.handleStartFresh = function handleStartFresh() {
    S._isHydrating = true;
    try {
      // Keep default layers created at boot; do not apply cfg.scale_label.
      S.applyScaleBlank();
      state.autoExpandCanvas = false;
      S.fitToScreen();
    } finally {
      S._isHydrating = false;
      S._hasUnsavedChanges = false;
    }
    S.postContentReady();
    // Short timeout so parent can hide loading after paint.
    setTimeout(() => S.postContentReady(), 80);
  };

  (window as any).sketchtrudeEngine = {
    exportProjectDocument: S.exportProjectDocument,
    importProjectDocument: S.importProjectDocument,
    subscribeToDocumentChanges: S.subscribeToDocumentChanges,
    hasUnsavedChanges: S.hasUnsavedChanges,
    getMutationVersion: S.getMutationVersion,
    getLayerEngine: () => S.layerEngine,
    getBrushLibrary: () => S.brushLibraryEngine,
  };

  // Save on page hide/close as a final safety net (debounce may not have fired).
  // Local IDB only — parent owns cloud sync.
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      S.saveDoc();
      S.scheduleThumbnail();
    }
  });
  window.addEventListener('pagehide', () => {
    S.saveDoc();
    S.scheduleThumbnail();
  });

  window.addEventListener('message', async (e: any) => {
    const data = e.data;
    if (!data || typeof data !== 'object') return;
    const type = data.type;

    if (type === 'sketchtrude-save') {
      try {
        for (let i = 0; i < 30; i++) {
          await S.saveDoc();
          if (S._lastDocPayload && !S._autosaveBusy && !state.layers.some((l: any) => l._dirty)) break;
          await new Promise((r: any) => setTimeout(r, 100));
        }
        S.scheduleThumbnail();
      } catch (_) {}
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'sketchtrude-save-done',
          projectId: (window as any).__SKETCHTRUDE_PROJECT_ID,
        }, '*');
      }
      return;
    }

    if (type === 'sketchtrude-start-fresh') {
      S.handleStartFresh();
      return;
    }

    if (type === 'sketchtrude-ping-ready') {
      S.postEngineReady();
      return;
    }

    if (type === 'sketchtrude-import-document') {
      try {
        await S.importProjectDocument(data.document);
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'sketchtrude-import-document-result', ok: true }, '*');
        }
        S.postContentReady();
      } catch (err) {
        const message = (err && (err as any).message) ? (err as any).message : String(err);
        console.warn('Import failed:', err);
        // Fall back to local IDB session before reporting failure
        try {
          const restored = await S.restoreSession();
          if (restored) {
            if (window.parent !== window) {
              window.parent.postMessage({ type: 'sketchtrude-import-document-result', ok: true, recovered: true }, '*');
            }
            S.postContentReady();
            return;
          }
        } catch (_) { /* ignore */ }
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'sketchtrude-import-document-result',
            ok: false,
            error: message,
          }, '*');
        }
      }
      return;
    }

    if (type === 'sketchtrude-restore-local') {
      try {
        const restored = await S.restoreSession();
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'sketchtrude-restore-local-result',
            ok: !!restored,
          }, '*');
        }
        if (restored) S.postContentReady();
      } catch (err) {
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'sketchtrude-restore-local-result',
            ok: false,
            error: (err && (err as any).message) ? (err as any).message : String(err),
          }, '*');
        }
      }
      return;
    }

    if (type === 'sketchtrude-export-document') {
      try {
        const document = await S.exportProjectDocument();
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'sketchtrude-export-document-result',
            document,
          }, '*');
        }
      } catch (err) {
        const message = (err && (err as any).message) ? (err as any).message : String(err);
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'sketchtrude-export-document-result',
            document: null,
            error: message,
          }, '*');
        }
      }
      return;
    }

    if (type === 'sketchtrude-save-status') {
      S.renderHostSaveStatus(data);
    }
  });

  S.renderHostSaveStatus = function renderHostSaveStatus(payload: any) {
    const el = $el('host-save-status');
    if (!el) return;
    const label = payload && payload.label ? String(payload.label) : '';
    const st = payload && payload.state ? String(payload.state) : '';
    if (!label) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.className = 'host-save-status'
      + (st === 'conflict' || st === 'error' ? ' is-error'
        : st === 'saving-local' || st === 'saving-cloud' ? ' is-saving'
        : st === 'saved-local' || st === 'saved-cloud' || st === 'ready-clean' ? ' is-saved'
        : '');
    let html = '<span class="hss-label">' + label + '</span>';
    if (st === 'conflict') {
      html += '<span class="hss-actions">'
        + '<button type="button" class="hss-btn" data-action="keep-local">Keep local</button>'
        + '<button type="button" class="hss-btn" data-action="reload-cloud">Reload cloud</button>'
        + '</span>';
    }
    el.innerHTML = html;
    el.querySelectorAll('.hss-btn').forEach((btn: any) => {
      btn.addEventListener('click', (ev: any) => {
        ev.stopPropagation();
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'sketchtrude-conflict-resolve',
            action: btn.dataset.action,
            projectId: (window as any).__SKETCHTRUDE_PROJECT_ID,
          }, '*');
        }
      });
    });
  };
}
