/* Auto-converted from public/engine/app/11-persistence.js — shared scope S */
import { S } from "./scope";
import { initHostBridge } from "./host-bridge";

export function shouldPaintPersistedLayerRaster(
  hasPdf: boolean,
  pdfRestored: boolean,
  rasterMode?: string,
): boolean {
  return !hasPdf || !pdfRestored || rasterMode === 'drawing-only';
}

async function blobFingerprint(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, '0')).join('');
  }
  // Browser fallback for environments without SubtleCrypto.
  let hash = 2166136261;
  for (const value of bytes) {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  }
  return `${bytes.length}:${hash >>> 0}`;
}

export async function findDuplicateLegacyPdfRasterIndexes(
  layers: Array<{ pdf?: { rasterMode?: string } | null; raster_path?: string | null }>,
  blobs: Array<Blob | null>,
): Promise<Set<number>> {
  const legacyPdfIndexes = layers
    .map((layer, index) => ({ layer, index }))
    .filter(({ layer, index }) =>
      Boolean(layer.pdf) &&
      layer.pdf?.rasterMode !== 'drawing-only' &&
      Boolean(blobs[index]));
  if (!legacyPdfIndexes.length) return new Set();

  const duplicateIndexes = new Set<number>();
  const pdfFingerprints = new Map<number, string>();
  for (const { index } of legacyPdfIndexes) {
    pdfFingerprints.set(index, await blobFingerprint(blobs[index]!));
  }

  for (let index = 0; index < layers.length; index++) {
    if (layers[index]?.pdf || !blobs[index]) continue;
    for (const pdfEntry of legacyPdfIndexes) {
      const samePath =
        Boolean(layers[index]?.raster_path) &&
        layers[index]?.raster_path === pdfEntry.layer.raster_path;
      const sameBytes =
        blobs[index]!.size === blobs[pdfEntry.index]!.size &&
        await blobFingerprint(blobs[index]!) === pdfFingerprints.get(pdfEntry.index);
      if (samePath || sameBytes) {
        duplicateIndexes.add(index);
        break;
      }
    }
  }
  return duplicateIndexes;
}

export function pdfRasterContentSimilarity(
  candidate: Uint8ClampedArray,
  reference: Uint8ClampedArray,
): number {
  const length = Math.min(candidate.length, reference.length);
  let contentPixels = 0;
  let matchingPixels = 0;
  for (let offset = 0; offset + 3 < length; offset += 4) {
    const refAlpha = reference[offset + 3]!;
    const refLuma =
      reference[offset]! * 0.299 +
      reference[offset + 1]! * 0.587 +
      reference[offset + 2]! * 0.114;
    // Ignore transparent and near-white page background; compare actual PDF
    // linework/text so an ordinary blank/white sketch cannot be misidentified.
    if (refAlpha < 64 || refLuma > 242) continue;
    contentPixels += 1;
    if (candidate[offset + 3]! < 64) continue;
    const difference =
      Math.abs(candidate[offset]! - reference[offset]!) +
      Math.abs(candidate[offset + 1]! - reference[offset + 1]!) +
      Math.abs(candidate[offset + 2]! - reference[offset + 2]!);
    if (difference <= 90) matchingPixels += 1;
  }
  return contentPixels >= 100 ? matchingPixels / contentPixels : 0;
}

export function clearMatchingPdfPixels(
  candidate: Uint8ClampedArray,
  reference: Uint8ClampedArray,
): number {
  const length = Math.min(candidate.length, reference.length);
  let cleared = 0;
  for (let offset = 0; offset + 3 < length; offset += 4) {
    if (reference[offset + 3]! < 64 || candidate[offset + 3]! < 64) continue;
    const difference =
      Math.abs(candidate[offset]! - reference[offset]!) +
      Math.abs(candidate[offset + 1]! - reference[offset + 1]!) +
      Math.abs(candidate[offset + 2]! - reference[offset + 2]!);
    if (difference > 90) continue;
    candidate[offset] = 0;
    candidate[offset + 1] = 0;
    candidate[offset + 2] = 0;
    candidate[offset + 3] = 0;
    cleared += 1;
  }
  return cleared;
}

export function initPersistence() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);


  /* =================================================================
     AUTOSAVE — debounced persistence to IndexedDB so a crash, refresh,
     or accidental close never loses work. Stores a raster per layer
     plus document metadata; PDF sources remain separate live assets.
     ================================================================= */
  S.AUTOSAVE_DB = 'nm-trace', S.AUTOSAVE_STORE = 'doc';
  S.autosaveKey = function autosaveKey() {
    return (typeof window !== 'undefined' && (window as any).__SKETCHTRUDE_PROJECT_ID) || 'current';
  }
  S._autosaveTimer = null, S._autosaveBusy = false, S._autosaveSuspended = false, S._autosaveSerial = 0;
  S._isHydrating = false;
  S._mutationVersion = 0;
  S._hasUnsavedChanges = false;
  S._documentChangeListeners = new Set();

  S.makeMutationId = function makeMutationId() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (_) { /* ignore */ }
    return 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  S.notifyDocumentChanged = function notifyDocumentChanged() {
    if (S._isHydrating || S._autosaveSuspended) return;
    S._mutationVersion++;
    S._hasUnsavedChanges = true;
    const event = {
      mutationId: S.makeMutationId(),
      mutationVersion: S._mutationVersion,
      type: 'bulk-update',
      timestamp: Date.now(),
    };
    for (const cb of S._documentChangeListeners) {
      try { cb(event); } catch (_) { /* listener errors must not break drawing */ }
    }
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'sketchtrude-document-changed', event }, '*');
    }
  }

  S._autosaveWaiters = [];
  S._idbPromise = null;

  S.waitForAutosave = function waitForAutosave() {
    return new Promise((resolve: any) => S._autosaveWaiters.push(resolve));
  }

  S.notifyAutosaveWaiters = function notifyAutosaveWaiters() {
    const waiters = S._autosaveWaiters.splice(0);
    waiters.forEach((resolve: any) => resolve());
  }

  S.openAutosaveDb = function openAutosaveDb(version: any) {
    return new Promise((resolve: any, reject: any) => {
      const req = version ? indexedDB.open(S.AUTOSAVE_DB, version) : indexedDB.open(S.AUTOSAVE_DB);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(S.AUTOSAVE_STORE)) req.result.createObjectStore(S.AUTOSAVE_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Autosave database upgrade blocked'));
    });
  }

  S.idb = function idb() {
    if (S._idbPromise) return S._idbPromise;
    S._idbPromise = S.openAutosaveDb()
      .then((db: any) => {
        if (db.objectStoreNames.contains(S.AUTOSAVE_STORE)) return db;
        const nextVersion = db.version + 1;
        db.close();
        return S.openAutosaveDb(nextVersion);
      })
      .catch((e: any) => {
        console.warn('Autosave database unavailable:', e);
        S._idbPromise = null;
        return null;
      });
    return S._idbPromise;
  }

  // Discrete 3D S.massing edits (push/pull, regions, materials) are not continuous strokes,
  // so they get a short debounce — a quick mid-session save, far safer than waiting for the
  // 10s sketch debounce or the unreliable pagehide flush on a force-quit.
  S._massSaveTimer = null;
  S.scheduleMassAutosave = function scheduleMassAutosave() {
    if (S._autosaveSuspended) return;
    S.notifyDocumentChanged();
    clearTimeout(S._massSaveTimer);
    S._massSaveTimer = setTimeout(() => { if (!state.drawing) S.saveDoc(); }, 1500);
  }

  S.scheduleAutosave = function scheduleAutosave(opts: any) {
    if (S._autosaveSuspended) return;
    const fromReschedule = opts && opts.fromReschedule;
    if (!fromReschedule) S.notifyDocumentChanged();
    S._autosaveSerial++;
    clearTimeout(S._autosaveTimer);
    S.scheduleThumbnail();
    // Long idle debounce: during active sketching (changes every few seconds) this
    // keeps resetting, so autosave never fires in the gaps between strokes. It only
    // runs after a real pause. visibilitychange/pagehide + the periodic timer below
    // cover crash safety during long continuous sessions.
    S._autosaveTimer = setTimeout(() => {
      if (state.drawing) { S.scheduleAutosave({ fromReschedule: true }); return; }
      if ((window as any).requestIdleCallback) (window as any).requestIdleCallback(() => S.saveDoc(), { timeout: 4000 });
      else S.saveDoc();
    }, 750);
  }

  // Periodic safety net for long pause-free sessions — only runs when idle and
  // not drawing, so it can't stall a stroke.
  setInterval(() => {
    if (S._autosaveSuspended || state.drawing) return;
    if (!state.layers.some((l: any) => l._dirty)) return;   // nothing changed since last save
    if ((window as any).requestIdleCallback) (window as any).requestIdleCallback(() => { if (!state.drawing) S.saveDoc(); }, { timeout: 4000 });
  }, 45000);

  // Strip live DOM/caches that break IndexedDB + postMessage structured clone.
  // Keep plain data (including bgImage data-URLs). Drop `_bgImg`, canvases, functions.
  S.cloneForSave = function cloneForSave(value: any, fallback: any) {
    const skip = (k: any, v: any) => {
      // Drop runtime caches (_bgImg, etc). Keep public fields like bgImage data-URLs.
      if (typeof k === 'string' && k.startsWith('_')) return undefined;
      if (typeof v === 'function') return undefined;
      if (typeof HTMLImageElement !== 'undefined' && v instanceof HTMLImageElement) return undefined;
      if (typeof HTMLCanvasElement !== 'undefined' && v instanceof HTMLCanvasElement) return undefined;
      if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return undefined;
      return v;
    };
    try { return JSON.parse(JSON.stringify(value, skip)); } catch (_e) { return fallback; }
  };

  // Masses: keep semantic flags (_wall, _fromWall, _wallKey, …). Drop only live image caches.
  // Wall masses from 2D (`_fromWall`) are omitted — syncWallsToMasses rebuilds them.
  S.massesForSave = function massesForSave() {
    const skipCache = (_k: any, v: any) => {
      if (typeof v === 'function') return undefined;
      if (typeof HTMLImageElement !== 'undefined' && v instanceof HTMLImageElement) return undefined;
      if (typeof HTMLCanvasElement !== 'undefined' && v instanceof HTMLCanvasElement) return undefined;
      if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return undefined;
      return v;
    };
    const masses = (S.massing.masses || []).filter((m: any) => !m._fromWall);
    try { return JSON.parse(JSON.stringify(masses, skipCache)); } catch (_e) { return []; }
  };

  S.shapesForSave = function shapesForSave() {
    return S.cloneForSave(state.shapes || [], []);
  };

  S.wallsForSave = function wallsForSave() {
    return S.cloneForSave(state.walls || [], []);
  };

  S.saveDoc = async function saveDoc() {
    if (S._autosaveBusy) return S.waitForAutosave();
    if (S._autosaveSuspended || !state.layers.length) return;
    if (state.drawing) { S.scheduleAutosave({ fromReschedule: true }); return; }   // defer until not drawing
    S._autosaveBusy = true;
    const saveSerial = S._autosaveSerial;
    try {
      // Only re-encode layers that actually changed since the last save.
      const layerData = [];
      for (const l of state.layers) {
        const engineLayer = l.engineId && S.layerEngine
          ? S.layerEngine.getLayer(l.engineId)
          : null;
        if (l.pdf && !l.pdf.storagePath && l.pdfBlob && typeof S.uploadPdfAsset === 'function') {
          try {
            const asset = await S.uploadPdfAsset(l.pdfBlob);
            if (asset) {
              l.pdf.storagePath = asset.storagePath;
              l.pdfUrl = asset.signedUrl;
            }
          } catch (_) { /* remain local and retry on the next save */ }
        }
        if (
          l.imageReference &&
          !l.imageReference.storagePath &&
          l.imageBlob &&
          typeof S.uploadImageAsset === 'function'
        ) {
          try {
            const asset = await S.uploadImageAsset(l.imageBlob);
            if (asset) {
              l.imageReference.storagePath = asset.storagePath;
              l.imageUrl = asset.signedUrl;
            }
          } catch (_) { /* remain local and retry on the next save */ }
        }
        let hybridRendering = null;
        if (l.tileStore) {
          const tiles = await l.tileStore.persistedTiles(false);
          hybridRendering = {
            architecture: 'hybrid-v1',
            tileSize: l.tileStore.tileSize,
            strokes: l.strokeStore?.serialize?.() || null,
            tiles,
          };
          l._savedBlob = null;
          l._rasterPath = null;
          if (S._autosaveSerial === saveSerial) l._dirty = false;
        } else if (l.imageReference) {
          l._savedBlob = null;
          l._rasterPath = null;
          if (S._autosaveSerial === saveSerial) l._dirty = false;
        } else if (l._dirty || !l._savedBlob) {
          // Skip the temp-composite when the layer has no live (un-baked) image —
          // encode the drawing canvas directly. Most layers take this fast path.
          let sourceCanvas = l.canvas;
          if (l.imageCanvas && !l.imageBaked && !l.pdf) {
            const tmp = document.createElement('canvas');
            tmp.width = S.doc.wPx; tmp.height = S.doc.hPx;
            const tc = tmp.getContext('2d') as any;
            tc.drawImage(l.imageCanvas, 0, 0);
            tc.drawImage(l.canvas, 0, 0);
            sourceCanvas = tmp;
          }
          l._savedBlob = await new Promise((res: any) => sourceCanvas.toBlob(res, 'image/png'));
          // Dirty encode → parent must re-upload; drop stale cloud path.
          if (l._dirty) l._rasterPath = null;
          if (S._autosaveSerial === saveSerial) l._dirty = false;
          await Promise.resolve();   // yield between layers
        }
        layerData.push({
          layer_id: l.engineId,
          name: l.name, visible: l.visible, opacity: l.opacity,
          locked: engineLayer?.locked ?? l.locked ?? false,
          layerKind: engineLayer?.layerKind ?? 'sketch',
          canvasSourceId: l.canvasSourceId || null,
          trace: l.trace, blendMode: l.blendMode,
          blob: l._savedBlob, raster_path: l._rasterPath || null,
          rendering: hybridRendering,
          pdf: l.pdf ? {
            ...l.pdf,
            transform: { ...l.imageTransform },
            opacity: l.imageOpacity ?? 1,
            rasterMode: 'drawing-only',
          } : null,
          pdfBlob: l.pdfBlob || null,
          imageReference: l.imageReference ? {
            ...l.imageReference,
            transform: { ...l.imageTransform },
            opacity: l.imageOpacity ?? 1,
          } : null,
          imageBlob: l.imageBlob || null,
        });
      }
      const payload = {
        version: 1, savedAt: Date.now(),
        doc: { wmm: S.doc.wMM, hmm: S.doc.hMM, dpi: S.doc.dpi },
        infiniteCanvas: state.infiniteCanvas,
        autoExpandCanvas: state.autoExpandCanvas,
        paperBg: state.paperBg,
        grid: { show: state.showGrid, type: state.gridType, spacingMM: state.gridSpacingMM },
        activeLayer: state.activeLayer,
        scaleCalibration: S.serializeScaleCalibration(),
        pxPerUnit: state.pxPerUnit, scaleUnit: state.scaleUnit,
        scaleLabel: S.scaleLabelFromState(),
        measurements: S.cloneForSave(state.measurements || [], []),
        walls: S.wallsForSave(),
        wallRooms: S.cloneForSave(state.wallRooms || [], []),
        wallsVisible: state.wallsVisible !== false,
        shapes: S.shapesForSave(),
        masses: S.massesForSave(),
        massBaseAnchor: S.massing.baseAnchor || null,
        layers: layerData,
      };
      const db = await S.idb();
      if (db) {
        await new Promise((resolve: any, reject: any) => {
          const tx = db.transaction(S.AUTOSAVE_STORE, 'readwrite');
          tx.objectStore(S.AUTOSAVE_STORE).put(payload, S.autosaveKey());
          tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
        });
      }
      S._lastDocPayload = payload;
      // Cloud sync is owned by the parent ProjectSaveController — do not scheduleCloudSync here.
    } catch (e) {
      console.warn('Autosave failed:', e);
    } finally {
      S._autosaveBusy = false;
      S.notifyAutosaveWaiters();
      if (S._autosaveSerial !== saveSerial && !state.drawing) S.scheduleAutosave({ fromReschedule: true });
    }
  }

  S._lastDocPayload = null;
  S._cloudSyncTimer = null;
  S._cloudSyncInFlight = false;
  S._cloudSyncWaiters = [];

  S.waitForCloudSync = function waitForCloudSync() {
    return new Promise((resolve: any) => S._cloudSyncWaiters.push(resolve));
  }

  S.notifyCloudSyncWaiters = function notifyCloudSyncWaiters() {
    const waiters = S._cloudSyncWaiters.splice(0);
    waiters.forEach((resolve: any) => resolve());
  }

  S.scheduleCloudSync = function scheduleCloudSync() {
    // no-op: parent ProjectSaveController owns cloud saves now
  }

  S.uploadLayerRaster = async function uploadLayerRaster(pid: any, index: any, blob: any) {
    const fd = new FormData();
    fd.append('layer_index', String(index));
    fd.append('raster', blob, 'layer-' + index + '.png');
    const res = await fetch('/api/projects/' + pid + '/document/layer', {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('Layer upload failed:', index, res.status, errText);
      return null;
    }
    const data = await res.json();
    return data.raster_path || null;
  }

  S.flushCloudSync = async function flushCloudSync() {
    const pid = typeof window !== 'undefined' ? (window as any).__SKETCHTRUDE_PROJECT_ID : null;
    if (S._cloudSyncInFlight) {
      await S.waitForCloudSync();
      return S.flushCloudSync();
    }
    if (!pid || pid === 'local' || !S._lastDocPayload) return;
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
            console.warn('Cloud save skipped: missing uploaded raster for layer', i);
            return;
          }
          raster_path = uploaded;
          const live = state.layers[i];
          if (live) live._rasterPath = uploaded;
          l.raster_path = uploaded;
        }
        layerMeta.push({
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          trace: l.trace,
          blendMode: l.blendMode,
          raster_path,
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
        scaleCalibration: payload.scaleCalibration,
        pxPerUnit: payload.pxPerUnit,
        scaleUnit: payload.scaleUnit,
        scaleLabel: payload.scaleLabel,
        measurements: payload.measurements,
        walls: payload.walls,
        wallRooms: payload.wallRooms || [],
        wallsVisible: payload.wallsVisible,
        shapes: payload.shapes,
        masses: payload.masses,
        massBaseAnchor: payload.massBaseAnchor,
        layers: layerMeta,
        layer_count: layerMeta.length,
      };
      const res = await fetch('/api/projects/' + pid + '/document', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(manifest),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn('Cloud save failed:', res.status, errText);
      }
    } catch (e) {
      console.warn('Cloud save failed:', e);
    } finally {
      S._cloudSyncInFlight = false;
      S.notifyCloudSyncWaiters();
    }
  }

  S.loadCloudDocument = async function loadCloudDocument() {
    const pid = typeof window !== 'undefined' ? (window as any).__SKETCHTRUDE_PROJECT_ID : null;
    if (!pid || pid === 'local') return null;
    try {
      const res = await fetch('/api/projects/' + pid + '/document', { credentials: 'same-origin' });
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
          pdf: ld.pdf || null,
          pdf_url: ld.pdf_url || null,
          blob: null as any,
        };
        if (ld.raster_url) {
          try {
            const imgRes = await fetch(ld.raster_url);
            if (imgRes.ok) entry.blob = await imgRes.blob();
          } catch (_) { /* skip layer image */ }
        }
        layers.push(entry);
      }
      return Object.assign({}, data, { layers });
    } catch (e) {
      console.warn('Cloud load failed:', e);
      return null;
    }
  }

  S.loadSavedDoc = async function loadSavedDoc() {
    const db = await S.idb();
    if (!db) return null;
    return new Promise((resolve: any) => {
      const tx = db.transaction(S.AUTOSAVE_STORE, 'readonly');
      const req = tx.objectStore(S.AUTOSAVE_STORE).get(S.autosaveKey());
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  S.savedDocHasPixels = function savedDocHasPixels(doc: any) {
    return !!doc?.layers?.some((layer: any) => layer?.blob && layer.blob.size > 0);
  }

  S.savedDocHasVectors = function savedDocHasVectors(doc: any) {
    return ['measurements', 'walls', 'shapes', 'masses'].some((key: any) => Array.isArray(doc?.[key]) && doc[key].length > 0);
  }

  S.isRestorableDoc = function isRestorableDoc(doc: any) {
    return !!doc?.layers?.length && (S.savedDocHasPixels(doc) || S.savedDocHasVectors(doc));
  }

  S.chooseSavedDoc = function chooseSavedDoc(localDoc: any, cloudDoc: any) {
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
  }

  S.clearSavedDoc = async function clearSavedDoc() {
    const db = await S.idb();
    if (!db) return;
    const tx = db.transaction(S.AUTOSAVE_STORE, 'readwrite');
    tx.objectStore(S.AUTOSAVE_STORE).delete(S.autosaveKey());
  }

  S.removeAllLayers = function removeAllLayers() {
    for (const [eid] of [...S.layerSurfaces.keys()]) S.disposeLayerSurface(eid);
    state.layers.forEach((l: any) => {
      try { if (l.canvas && l.canvas.parentNode) l.canvas.parentNode.removeChild(l.canvas); } catch (_) {}
      try { if (l.imageCanvas && l.imageCanvas.parentNode) l.imageCanvas.parentNode.removeChild(l.imageCanvas); } catch (_) {}
    });
    state.layers = [];
    S.layerSurfaces.clear();
    if (S.layerEngine) {
      S.layerEngine.floors = {};
      S.layerEngine.layers = {};
      S.layerEngine.objects = {};
      S.layerEngine.rootFloorIds = [];
      S.layerEngine.activeFloorId = null;
      S.layerEngine.activeLayerId = null;
    }
  }

  S.resolveLayerBlob = async function resolveLayerBlob(ld: any) {
    if (ld && ld.blob && ld.blob.size > 0) return ld.blob;
    const url = ld && (ld.raster_url || ld.rasterUrl);
    if (url) {
      try {
        const imgRes = await fetch(url);
        if (imgRes.ok) return await imgRes.blob();
      } catch (_) { /* skip layer image */ }
    }
    return null;
  }

  /** If imported layers lack pixels, merge blobs from the engine's local IDB autosave. */
  S.mergeLocalLayerBlobs = async function mergeLocalLayerBlobs(saved: any) {
    if (!saved?.layers?.length) return saved;
    const needsPixels = saved.layers.some((l: any) => !(l.blob && l.blob.size > 0) && !(l.raster_url || l.rasterUrl));
    if (!needsPixels) return saved;
    try {
      const local = await S.loadSavedDoc();
      if (!local?.layers?.length) return saved;
      const layers = saved.layers.map((layer: any, i: any) => {
        if (layer.blob && layer.blob.size > 0) return layer;
        if (layer.raster_url || layer.rasterUrl) return layer;
        const sameLayerType = (candidate: any) => Boolean(candidate?.pdf) === Boolean(layer?.pdf);
        const layerId = typeof layer.layer_id === 'string' ? layer.layer_id : null;
        const identifiedLocal = layerId
          ? local.layers.find((candidate: any) => candidate?.layer_id === layerId)
          : null;
        const namedCandidates = local.layers.filter((candidate: any) =>
          sameLayerType(candidate) && candidate?.name === layer?.name);
        const namedLocal = namedCandidates.length === 1 ? namedCandidates[0] : null;
        const indexedLocal = local.layers[i];
        const localHasStableIds = local.layers.some((candidate: any) => candidate?.layer_id);
        const fromLocal = identifiedLocal || (!layerId
          ? namedLocal || (!localHasStableIds && sameLayerType(indexedLocal) ? indexedLocal : null)
          : null);
        if (fromLocal?.blob && fromLocal.blob.size > 0) {
          return { ...layer, blob: fromLocal.blob };
        }
        return layer;
      });
      // Prefer local vector data when the imported doc looks empty (broken prior cloud save)
      const importedEmpty =
        !(saved.walls?.length || saved.shapes?.length || saved.masses?.length || saved.measurements?.length);
      const merged = { ...saved, layers };
      if (importedEmpty && local) {
        if (Array.isArray(local.walls)) merged.walls = local.walls;
        if (Array.isArray(local.shapes)) merged.shapes = local.shapes;
        if (Array.isArray(local.masses)) merged.masses = local.masses;
        if (Array.isArray(local.measurements)) merged.measurements = local.measurements;
        if (local.massBaseAnchor) merged.massBaseAnchor = local.massBaseAnchor;
        if (local.scaleCalibration) {
          merged.scaleCalibration = local.scaleCalibration;
          merged.pxPerUnit = local.pxPerUnit;
          merged.scaleUnit = local.scaleUnit;
          merged.scaleLabel = local.scaleLabel;
        } else if (local.pxPerUnit) {
          merged.pxPerUnit = local.pxPerUnit;
          merged.scaleUnit = local.scaleUnit;
          merged.scaleLabel = local.scaleLabel;
        }
        if (local.doc?.wmm) merged.doc = local.doc;
      }
      return merged;
    } catch (_) {
      return saved;
    }
  }

  S.repairCrossLayerPdfCopies = function repairCrossLayerPdfCopies() {
    const pdfLayers = (state.layers || []).filter((layer: any) =>
      layer?.pdf && layer.pdfCanvas && layer.imageTransform);
    const rasterLayers = (state.layers || []).filter((layer: any) =>
      layer && !layer.pdf && layer.canvas);
    if (!pdfLayers.length || !rasterLayers.length) return false;

    const thumbScale = Math.min(1, 320 / Math.max(S.doc.wPx, S.doc.hPx));
    const thumbWidth = Math.max(1, Math.round(S.doc.wPx * thumbScale));
    const thumbHeight = Math.max(1, Math.round(S.doc.hPx * thumbScale));
    let repaired = false;

    for (const pdfLayer of pdfLayers) {
      const transform = pdfLayer.imageTransform;
      const pdfCanvas = pdfLayer.pdfCanvas;
      if (!transform || !pdfCanvas) continue;
      const referenceThumb = document.createElement('canvas');
      referenceThumb.width = thumbWidth;
      referenceThumb.height = thumbHeight;
      const referenceThumbCtx = referenceThumb.getContext('2d') as CanvasRenderingContext2D;
      referenceThumbCtx.scale(thumbScale, thumbScale);
      referenceThumbCtx.translate(transform.x, transform.y);
      referenceThumbCtx.rotate((transform.rotation || 0) * Math.PI / 180);
      referenceThumbCtx.drawImage(
        pdfCanvas,
        -transform.w / 2,
        -transform.h / 2,
        transform.w,
        transform.h,
      );
      const referenceThumbData = referenceThumbCtx.getImageData(
        0, 0, thumbWidth, thumbHeight);

      for (const layer of rasterLayers) {
        const candidateThumb = document.createElement('canvas');
        candidateThumb.width = thumbWidth;
        candidateThumb.height = thumbHeight;
        const candidateThumbCtx = candidateThumb.getContext('2d') as CanvasRenderingContext2D;
        candidateThumbCtx.drawImage(
          layer.canvas,
          0, 0, S.doc.wPx, S.doc.hPx,
          0, 0, thumbWidth, thumbHeight,
        );
        const candidateThumbData = candidateThumbCtx.getImageData(
          0, 0, thumbWidth, thumbHeight);
        const similarity = pdfRasterContentSimilarity(
          candidateThumbData.data,
          referenceThumbData.data,
        );
        if (similarity < 0.72) continue;

        const reference = document.createElement('canvas');
        reference.width = S.doc.wPx;
        reference.height = S.doc.hPx;
        const referenceCtx = reference.getContext('2d') as CanvasRenderingContext2D;
        referenceCtx.translate(transform.x, transform.y);
        referenceCtx.rotate((transform.rotation || 0) * Math.PI / 180);
        referenceCtx.drawImage(
          pdfCanvas,
          -transform.w / 2,
          -transform.h / 2,
          transform.w,
          transform.h,
        );
        const candidateData = layer.ctx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
        const referenceData = referenceCtx.getImageData(0, 0, S.doc.wPx, S.doc.hPx);
        if (!clearMatchingPdfPixels(candidateData.data, referenceData.data)) continue;
        layer.ctx.putImageData(candidateData, 0, 0);
        layer._dirty = true;
        layer._savedBlob = null;
        layer._rasterPath = null;
        const meta = S.layerEngine?.getLayer(layer.engineId);
        if (meta) meta.rasterPath = null;
        S.saveSnapshot(layer);
        repaired = true;
      }
    }
    return repaired;
  }

  /** Apply a LegacyStudioDocument into live engine state. Caller manages hydration flags. */
  S.applyLegacyDocument = async function applyLegacyDocument(saved: any) {
    if (!saved || typeof saved !== 'object') {
      throw new Error('Document has no layers');
    }
    // Tolerate missing doc block from older/broken saves
    const wmm = saved.doc?.wmm || S.doc.wMM;
    const hmm = saved.doc?.hmm || S.doc.hMM;
    const dpi = saved.doc?.dpi || S.doc.dpi;
    if (!saved.layers || !saved.layers.length) {
      throw new Error('Document has no layers');
    }
    // Apply document dimensions
    S.doc.wMM = wmm; S.doc.hMM = hmm; S.doc.dpi = dpi;
    S.doc.wPx = Math.round(S.doc.wMM / 25.4 * S.doc.dpi);
    S.doc.hPx = Math.round(S.doc.hMM / 25.4 * S.doc.dpi);
    S.strokeCanvas.width = 1; S.strokeCanvas.height = 1;
    const gc = $el('guide-canvas');
    if (gc) {
      gc.width = state.guideType && state.guideType !== 'none' ? S.doc.wPx : 1;
      gc.height = state.guideType && state.guideType !== 'none' ? S.doc.hPx : 1;
    }
    if (S.paper) {
      S.paper.style.width = S.doc.wPx + 'px';
      S.paper.style.height = S.doc.hPx + 'px';
    }

    S.removeAllLayers();
    // Rebuild LayerEngine from flat legacy list so save payload stays index-compatible.
    const engineIds = S.layerEngine
      ? S.layerEngine.rebuildFromLegacyLayers(saved.layers, saved.activeLayer ?? 0)
      : [];
    const resolvedLayerBlobs = await Promise.all(
      saved.layers.map((layer: any) => S.resolveLayerBlob(layer)),
    );
    const duplicatePdfRasterIndexes =
      await findDuplicateLegacyPdfRasterIndexes(saved.layers, resolvedLayerBlobs);
    for (let i = 0; i < saved.layers.length; i++) {
      const ld = saved.layers[i];
      const engineId = engineIds[i];
      const layer = engineId
        ? S.allocateLayerSurface(engineId, ld.name || `Layer ${i + 1}`)
        : S.createLayer(ld.name);
      layer.visible = ld.visible !== false;
      layer.locked = ld.locked === true;
      layer.opacity = typeof ld.opacity === 'number' ? ld.opacity : 1;
      layer.canvasSourceId = ld.canvasSourceId || null;
      layer.trace = ld.trace || 0;
      layer.blendMode = ld.blendMode || 'source-over';
      if (ld.raster_path) layer._rasterPath = ld.raster_path;
      if (ld.rendering?.architecture === 'hybrid-v1' && layer.tileStore) {
        if (ld.rendering.strokes && layer.strokeStore?.constructor?.fromSnapshot) {
          layer.strokeStore = layer.strokeStore.constructor.fromSnapshot(
            ld.rendering.strokes,
          );
          for (const stroke of layer.strokeStore.all()) {
            S.renderRecordedStroke?.(layer, stroke);
          }
        }
        for (const tile of ld.rendering.tiles || []) {
          const source = tile.blob instanceof Blob ? tile.blob : tile.url;
          if (!source) continue;
          try {
            await layer.tileStore.importTile(tile, source);
          } catch (error) {
            console.warn('Layer tile restore failed', tile.key, error);
          }
        }
      }
      if (ld.pdf) {
        layer.pdf = { ...ld.pdf, transform: { ...ld.pdf.transform } };
        layer.pdfBlob = ld.pdfBlob instanceof Blob ? ld.pdfBlob : null;
        layer.pdfUrl = ld.pdf_url || ld.pdfUrl || null;
        layer.imageTransform = { ...ld.pdf.transform };
        layer.imageOpacity = typeof ld.pdf.opacity === 'number' ? ld.pdf.opacity : 1;
        layer.imageBaked = false;
        layer.image = new Image();
        layer.image.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
      }
      if (ld.imageReference) {
        layer.imageReference = {
          ...ld.imageReference,
          transform: { ...ld.imageReference.transform },
        };
        layer.imageBlob = ld.imageBlob instanceof Blob ? ld.imageBlob : null;
        layer.imageUrl = ld.image_url || ld.imageUrl || null;
        layer.imageTransform = { ...ld.imageReference.transform };
        layer.imageOpacity =
          typeof ld.imageReference.opacity === 'number'
            ? ld.imageReference.opacity
            : 1;
        layer.imageBaked = false;
      }
      if (S.layerEngine && engineId) {
        const meta = S.layerEngine.getLayer(engineId);
        if (meta) {
          meta.visible = layer.visible;
          meta.locked = layer.locked;
          meta.opacity = layer.opacity;
          meta.trace = layer.trace;
          meta.blendMode = layer.blendMode;
          meta.rasterPath = ld.raster_path || null;
        }
      }
      const blob = resolvedLayerBlobs[i];
      let pdfRestored = false;
      if (layer.pdf && (layer.pdfBlob || layer.pdfUrl) && typeof S.loadPdfRuntime === 'function') {
        try {
          await S.loadPdfRuntime(layer, layer.pdfBlob || layer.pdfUrl);
          pdfRestored = true;
        } catch (error) {
          console.warn('PDF source restore failed; using raster fallback', error);
        }
      }
      if (
        layer.imageReference &&
        (layer.imageBlob || layer.imageUrl) &&
        typeof S.loadImageReferenceRuntime === 'function'
      ) {
        try {
          await S.loadImageReferenceRuntime(
            layer,
            layer.imageBlob || layer.imageUrl,
          );
        } catch (error) {
          console.warn('Image reference restore failed', error);
        }
      }
      if (blob && !ld.rendering) {
        try {
          if (!duplicatePdfRasterIndexes.has(i) && shouldPaintPersistedLayerRaster(
            Boolean(layer.pdf),
            pdfRestored,
            ld.pdf?.rasterMode,
          )) {
            const bmp = await createImageBitmap(blob);
            if (layer.tileStore) {
              layer.tileStore.forEachContext(
                { x: 0, y: 0, w: S.doc.wPx, h: S.doc.hPx },
                (ctx: CanvasRenderingContext2D) => ctx.drawImage(bmp, 0, 0),
              );
            } else {
              layer.ctx.drawImage(bmp, 0, 0);
            }
            bmp.close && bmp.close();
          }
          layer._savedBlob = duplicatePdfRasterIndexes.has(i) ? null : blob;
        } catch (_) { /* skip a corrupt layer image */ }
      }
      if (duplicatePdfRasterIndexes.has(i)) {
        // Repair documents corrupted by the former index-based raster upload:
        // an exact copy of a legacy PDF fallback must not live on Sketch.
        layer._dirty = true;
        layer._rasterPath = null;
      }
      if (pdfRestored && ld.pdf?.rasterMode !== 'drawing-only') {
        // Legacy PDF rasters contain the PDF page itself. Do not paint that
        // composite beside the live PDF, and migrate the next save to a clean
        // drawing-only raster so moving/hiding the PDF cannot reveal a ghost.
        layer._dirty = true;
        layer._savedBlob = null;
      }
      layer.history = []; layer.redo = [];
      S.saveSnapshot(layer);
    }
    if (S.layerEngine) S.syncStateLayersFromEngine();
    const repairedCrossLayerPdf = S.repairCrossLayerPdfCopies();
    state.activeLayer = Math.min(saved.activeLayer ?? state.layers.length - 1, state.layers.length - 1);
    if (S.layerEngine && state.layers[state.activeLayer]?.engineId) {
      S.layerEngine.setActiveLayer(state.layers[state.activeLayer].engineId);
    }
    if (saved.scaleCalibration) {
      S.setScaleCalibration(
        saved.scaleCalibration,
        saved.pxPerUnit,
        saved.scaleUnit,
      );
    } else if (saved.pxPerUnit) {
      S.setScaleCalibration(null, saved.pxPerUnit, saved.scaleUnit || 'cm');
    } else if (saved.scaleLabel) {
      S.clearScaleCalibration();
      S.applyScaleFromLabel(saved.scaleLabel);
    } else {
      S.clearScaleCalibration();
    }
    S.updateScaleDisplay();
    if (saved.infiniteCanvas != null) state.infiniteCanvas = !!saved.infiniteCanvas;
    state.autoExpandCanvas = false;
    if (saved.paperBg) { state.paperBg = saved.paperBg; if (S.paper) S.paper.style.background = saved.paperBg; }
    if (saved.grid) {
      state.showGrid = !!saved.grid.show;
      state.gridType = saved.grid.type || state.gridType;
      if (saved.grid.spacingMM) state.gridSpacingMM = saved.grid.spacingMM;
      S.drawDocGrid();
    }
    if (Array.isArray(saved.measurements)) state.measurements = saved.measurements;
    if (Array.isArray(saved.walls)) {
      state.walls = saved.walls;
      state.walls.forEach(S.ensureWallId);
      if (typeof S.migrateWallsToSegments === 'function') S.migrateWallsToSegments();
      if (typeof S.reconcileWallRooms === 'function') S.reconcileWallRooms();
    }
    if (Array.isArray(saved.wallRooms)) state.wallRooms = saved.wallRooms;
    state.wallsVisible = saved.wallsVisible != null ? !!saved.wallsVisible : true;
    if (Array.isArray(saved.shapes)) {
      state.shapes = saved.shapes;
      S.ensureAllShapeIds(state.shapes);
    }
    if (Array.isArray(saved.masses)) { S.massing.masses = saved.masses; S.massing.selected = -1; }
    if (saved.massBaseAnchor) S.massing.baseAnchor = saved.massBaseAnchor;
    if (typeof S.syncWallsToMasses === 'function') S.syncWallsToMasses();
    if (S.layerEngine) S.syncSceneObjectsToEngine();
    S.fitToScreen();
    S.updateLayerOrder(); S.renderLayers(); S.updateUI();
    S.refreshMeasurements(); S.renderSchedule();
    if (repairedCrossLayerPdf) {
      setTimeout(() => S.scheduleAutosave(), 0);
    }
  }

  // Host postMessage / import-export bridge (restoreSession, sketchtrudeEngine API).
  initHostBridge();

  S._scaleSyncTimer = null;
  S.syncProjectScale = function syncProjectScale(label: any) {
    const pid = typeof window !== 'undefined' ? (window as any).__SKETCHTRUDE_PROJECT_ID : null;
    if (!pid || pid === 'local') return;
    const cfg = (window as any).__SKETCHTRUDE_PROJECT_CONFIG;
    if (cfg) cfg.scale_label = label;
    clearTimeout(S._scaleSyncTimer);
    S._scaleSyncTimer = setTimeout(async () => {
      try {
        await fetch('/api/projects/' + pid, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scale_label: label }),
          credentials: 'same-origin',
        });
      } catch (_) { /* offline — IDB still has scale */ }
    }, 400);
  }

  S.scaleLabelFromState = function scaleLabelFromState() {
    const ratio = S.scaleDenominator();
    if (!ratio || ratio <= 0) return null;
    return `1:${Math.round(ratio)}`;
  }

  S.updateScaleDisplay = function updateScaleDisplay() {
    const label = S.scaleLabelFromState();
    const el = $el('scale-text');
    if (el) el.textContent = label ? label.replace(/\s+/g, '') : '—';
    return label;
  }

  S.applyScaleFromLabel = function applyScaleFromLabel(label: any) {
    if (!label || S.hasCalibratedScale()) return;
    const m = String(label).match(/1\s*:\s*(\d+(?:\.\d+)?)/);
    if (!m) return;
    const ratio = parseFloat(m[1]);
    if (!ratio || ratio <= 0) return;
    const docUnitsPerPaperMM = S.doc.wPx / S.doc.wMM;
    S.setScaleCalibration({
      version: 1,
      status: 'calibrated',
      mmPerDocumentUnit: ratio / docUnitsPerPaperMM,
      method: 'reference-line',
      displayUnit: 'cm',
      reference: null,
    });
    S.updateScaleDisplay();
  }

  S.applyProjectConfig = function applyProjectConfig() {
    const cfg = typeof window !== 'undefined' ? (window as any).__SKETCHTRUDE_PROJECT_CONFIG : null;
    if (!cfg) return;
    const meta = cfg.metadata || {};
    const isInfinite = !!(meta.infinite_canvas || cfg.infinite_canvas);
    // Never auto-expand; infinite = large fixed world.
    state.autoExpandCanvas = false;
    state.infiniteCanvas = isInfinite;

    if (cfg.doc_dpi > 0) S.doc.dpi = cfg.doc_dpi;

    if (isInfinite) {
      // Large fixed canvas so drawing is not clipped quickly (~1600mm square at project dpi).
      S.doc.wMM = 1600;
      S.doc.hMM = 1600;
    } else if (cfg.doc_width_mm > 0 && cfg.doc_height_mm > 0) {
      S.doc.wMM = cfg.doc_width_mm;
      S.doc.hMM = cfg.doc_height_mm;
    }

    S.doc.wPx = Math.round(S.doc.wMM / 25.4 * S.doc.dpi);
    S.doc.hPx = Math.round(S.doc.hMM / 25.4 * S.doc.dpi);
    if (S.paper) {
      S.paper.style.width = S.doc.wPx + 'px';
      S.paper.style.height = S.doc.hPx + 'px';
      if (state.paperBg) S.paper.style.background = state.paperBg;
    }
    if (typeof S.strokeCanvas !== 'undefined' && S.strokeCanvas) {
      S.strokeCanvas.width = 1;
      S.strokeCanvas.height = 1;
    }
    const gc = $el('guide-canvas');
    if (gc) {
      gc.width = state.guideType && state.guideType !== 'none' ? S.doc.wPx : 1;
      gc.height = state.guideType && state.guideType !== 'none' ? S.doc.hPx : 1;
    }
    if (typeof S.gridCanvas !== 'undefined' && S.gridCanvas) {
      (S.gridCanvas as any).width = state.showGrid ? S.doc.wPx : 1;
      (S.gridCanvas as any).height = state.showGrid ? S.doc.hPx : 1;
    }
    S.updateDocInfo(S.paperFormatName(S.doc.wMM, S.doc.hMM));

    const bg = meta.paper_bg;
    if (bg) {
      state.paperBg = bg;
      if (S.paper) S.paper.style.background = bg;
    }
    if (meta.show_grid) {
      state.showGrid = true;
      state.gridType = meta.grid_type || 'square';
      if (meta.grid_spacing_mm) state.gridSpacingMM = meta.grid_spacing_mm;
    }
    if (meta.guide_type) {
      state.guideType = meta.guide_type;
      if (meta.guide_opacity != null) state.guideOpacity = meta.guide_opacity;
    }
  }

  S.toggleSymmetry = function toggleSymmetry() {
    const order = [null, 'vertical', 'horizontal'];
    const idx = order.indexOf(state.symmetryAxis);
    state.symmetryAxis = order[(idx + 1) % order.length];
    const labels = { vertical: 'Vertical symmetry', horizontal: 'Horizontal symmetry' };
    S.showHint(state.symmetryAxis ? (labels as any)[state.symmetryAxis] + ' ON' : 'Symmetry off');
    const btn = $el('ovf-symmetry');
    if (btn) btn.classList.toggle('active', !!state.symmetryAxis);
  }


}
