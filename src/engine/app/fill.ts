/* Flood fill — shared scope S */
import { S } from "./scope";

export function initFill() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);

  /* =================== FLOOD FILL =================== */
  // Flatten all visible layers (image + strokes, honouring opacity) into one ctx.
  S.flattenVisibleToCtx = function flattenVisibleToCtx(ctx: any) {
    ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    for (const l of state.layers) {
      if (l.visible === false) continue;
      ctx.save();
      ctx.globalAlpha = (l.opacity != null ? l.opacity : 1);
      if (l.imageCanvas && !l.imageBaked) ctx.drawImage(l.imageCanvas, 0, 0);
      ctx.drawImage(l.canvas, 0, 0);
      ctx.restore();
    }
  }

  S._thumbCanvas = null;
  S.generateThumbnailBlob = async function generateThumbnailBlob(maxW: any) {
    maxW = maxW != null ? maxW : 420;
    if (!state.layers.length || S.doc.wPx <= 0 || S.doc.hPx <= 0) return null;
    const tw = Math.min(maxW, S.doc.wPx);
    const th = Math.max(1, Math.round(tw * (S.doc.hPx / S.doc.wPx)));
    if (!S._thumbCanvas) S._thumbCanvas = document.createElement('canvas');
    S._thumbCanvas.width = tw;
    S._thumbCanvas.height = th;
    const tctx = S._thumbCanvas.getContext('2d') as any;
    tctx.fillStyle = state.paperBg || '#ffffff';
    tctx.fillRect(0, 0, tw, th);
    const full = document.createElement('canvas');
    full.width = S.doc.wPx;
    full.height = S.doc.hPx;
    S.flattenVisibleToCtx(full.getContext('2d') as any);
    tctx.drawImage(full, 0, 0, tw, th);
    return new Promise((resolve: any) => S._thumbCanvas.toBlob(resolve, 'image/jpeg', 0.84));
  }

  S.saveThumbnailLocal = async function saveThumbnailLocal(blob: any) {
    if (!blob) return;
    const db = await S.idb();
    if (!db) return;
    await new Promise((resolve: any, reject: any) => {
      const tx = db.transaction(S.AUTOSAVE_STORE, 'readwrite');
      tx.objectStore(S.AUTOSAVE_STORE).put({ blob, savedAt: Date.now() }, 'thumb-' + S.autosaveKey());
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  S._thumbSyncTimer = null;
  S.syncProjectThumbnail = function syncProjectThumbnail(blob: any) {
    const pid = typeof window !== 'undefined' ? (window as any).__SKETCHTRUDE_PROJECT_ID : null;
    if (!pid || pid === 'local' || !blob) return;
    clearTimeout(S._thumbSyncTimer);
    S._thumbSyncTimer = setTimeout(async () => {
      try {
        const fd = new FormData();
        fd.append('file', blob, 'preview.jpg');
        await fetch('/api/projects/' + pid + '/thumbnail', { method: 'POST', body: fd, credentials: 'same-origin' });
      } catch (_) { /* offline — local thumb still works */ }
    }, 1200);
  }

  S._projThumbTimer = null;
  S.scheduleThumbnail = function scheduleThumbnail() {
    clearTimeout(S._projThumbTimer);
    S._projThumbTimer = setTimeout(async () => {
      if (state.drawing) { S.scheduleThumbnail(); return; }
      try {
        const blob = await S.generateThumbnailBlob();
        if (!blob) return;
        await S.saveThumbnailLocal(blob);
        S.syncProjectThumbnail(blob);
      } catch (_) {}
    }, 2500);
  }

  // Reusable scratch canvas for sampling composites.
  S._sampleCanvas = null, S._sampleCtx = null;
  S.sampleData = function sampleData(sampleAll: any) {
    if (!S._sampleCanvas) {
      S._sampleCanvas = document.createElement('canvas');
      S._sampleCtx = S._sampleCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (S._sampleCanvas.width !== S.doc.wPx || S._sampleCanvas.height !== S.doc.hPx) {
      S._sampleCanvas.width = S.doc.wPx; S._sampleCanvas.height = S.doc.hPx;
    }
    if (sampleAll) {
      S.flattenVisibleToCtx(S._sampleCtx);
    } else {
      const l = S.activeLayer();
      S._sampleCtx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
      if (l.imageCanvas && !l.imageBaked) S._sampleCtx.drawImage(l.imageCanvas, 0, 0);
      S._sampleCtx.drawImage(l.canvas, 0, 0);
    }
    return S._sampleCtx.getImageData(0, 0, S.doc.wPx, S.doc.hPx).data;
  }

  // Compute the contiguous region matching the seed pixel in `sample`, returns a mask.
  S.computeFillMask = function computeFillMask(sample: any, startX: any, startY: any, tolerance: any) {
    const w = S.doc.wPx, h = S.doc.hPx;
    startX = Math.max(0, Math.min(w - 1, Math.round(startX)));
    startY = Math.max(0, Math.min(h - 1, Math.round(startY)));
    const seed = (startY * w + startX) * 4;
    const sr = sample[seed], sg = sample[seed+1], sb = sample[seed+2], sa = sample[seed+3];
    const mask = new Uint8Array(w * h);
    const match = (idx: any) =>
      Math.abs(sample[idx]-sr) + Math.abs(sample[idx+1]-sg) +
      Math.abs(sample[idx+2]-sb) + Math.abs(sample[idx+3]-sa) <= tolerance;
    const stack = [startX + startY * w];
    mask[startX + startY * w] = 1;
    while (stack.length) {
      const pos = stack.pop();
      let x = pos % w;
      const y = (pos / w) | 0;
      while (x > 0 && match(((y*w)+x-1)*4) && !mask[y*w+x-1]) x--;
      let spanA = false, spanB = false;
      while (x < w && match((y*w+x)*4)) {
        mask[y*w + x] = 1;
        if (y > 0) {
          const a = (y-1)*w + x;
          if (!mask[a] && match(a*4)) { if (!spanA) { stack.push(a); mask[a]=1; spanA=true; } }
          else spanA = false;
        }
        if (y < h-1) {
          const b = (y+1)*w + x;
          if (!mask[b] && match(b*4)) { if (!spanB) { stack.push(b); mask[b]=1; spanB=true; } }
          else spanB = false;
        }
        x++;
      }
    }
    return mask;
  }

  // Grow a mask by `r` pixels (so the fill tucks under anti-aliased boundary lines).
  S.expandMask = function expandMask(mask: any, r: any) {
    if (!r) return mask;
    const w = S.doc.wPx, h = S.doc.hPx;
    let cur = mask;
    for (let pass = 0; pass < r; pass++) {
      const next = new Uint8Array(cur);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y*w + x;
          if (cur[i]) continue;
          if ((x>0 && cur[i-1]) || (x<w-1 && cur[i+1]) || (y>0 && cur[i-w]) || (y<h-1 && cur[i+w])) next[i] = 1;
        }
      }
      cur = next;
    }
    return cur;
  }

  // Shrink a mask inward so fills stay inside line boundaries (prevents colour spill).
  S.shrinkMask = function shrinkMask(mask: any, r: any) {
    if (!r) return mask;
    const w = S.doc.wPx, h = S.doc.hPx;
    let cur = mask;
    for (let pass = 0; pass < r; pass++) {
      const next = new Uint8Array(cur);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y*w + x;
          if (!cur[i]) continue;
          if ((x>0 && !cur[i-1]) || (x<w-1 && !cur[i+1]) || (y>0 && !cur[i-w]) || (y<h-1 && !cur[i+w])) next[i] = 0;
        }
      }
      cur = next;
    }
    return cur;
  }

  // Paint a mask region with a flat colour onto ctx.
  S.paintMaskColor = function paintMaskColor(ctx: any, mask: any, fillHex: any, fa: any) {
    const w = S.doc.wPx, h = S.doc.hPx;
    const [fr, fg, fb] = S.hexToRgba(fillHex);
    const target = ctx.getImageData(0, 0, w, h);
    const d = target.data;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) { const o = i * 4; d[o] = fr; d[o+1] = fg; d[o+2] = fb; d[o+3] = fa; }
    }
    ctx.putImageData(target, 0, 0);
  }

  // Paint a mask region with an image texture (tiled or stretched), clipped to the mask.
  S.paintMaskWithImage = function paintMaskWithImage(layer: any, mask: any, bbox: any, img: any, mode: any, scale: any) {
    const c = document.createElement('canvas');
    c.width = bbox.w; c.height = bbox.h;
    const cx: any = c.getContext('2d', { willReadFrequently: true });
    if (mode === 'stretch') {
      cx.drawImage(img, 0, 0, bbox.w, bbox.h);
    } else {
      // tile: build a scaled tile, repeat across the bbox
      const s = scale || 1;
      const tw = Math.max(1, Math.round((img.naturalWidth || img.width) * s));
      const th = Math.max(1, Math.round((img.naturalHeight || img.height) * s));
      let tile = img;
      if (tw !== (img.naturalWidth || img.width) || th !== (img.naturalHeight || img.height)) {
        const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
        (tc.getContext('2d') as any).drawImage(img, 0, 0, tw, th);
        tile = tc;
      }
      const pat = cx.createPattern(tile, 'repeat');
      cx.fillStyle = pat;
      cx.fillRect(0, 0, bbox.w, bbox.h);
    }
    // clip to the mask (zero alpha outside the selected pixels)
    const id = cx.getImageData(0, 0, bbox.w, bbox.h);
    const d = id.data, W = S.doc.wPx;
    for (let y = 0; y < bbox.h; y++) {
      for (let x = 0; x < bbox.w; x++) {
        if (!mask[(bbox.y + y) * W + (bbox.x + x)]) d[(y * bbox.w + x) * 4 + 3] = 0;
      }
    }
    cx.putImageData(id, 0, 0);
    layer.ctx.save();
    layer.ctx.globalAlpha = state.alpha;
    layer.ctx.drawImage(c, bbox.x, bbox.y);
    layer.ctx.restore();
  }

  S.currentFillTexture = function currentFillTexture() {
    if ((state.fillTexIndex as any) == null) return null;
    const t: any = state.fillTextures[state.fillTexIndex as any];
    return (t && t.img && t.img.complete) ? t.img : null;
  }

  // Apply the current fill source (colour or image) to a mask on a layer.
  S.applyFill = function applyFill(layer: any, mask: any) {
    if (state.fillStyle === 'image' && S.currentFillTexture()) {
      const bbox = S.computeMaskBBox(mask);
      if (bbox) S.paintMaskWithImage(layer, mask, bbox, S.currentFillTexture(), state.fillTexMode, state.fillTexScale);
    } else {
      S.paintMaskColor(layer.ctx, mask, state.color, Math.round(state.alpha * 255));
    }
  }

  // Bucket fill: detect region on the sample source, paint with the current source.
  S.floodFill = function floodFill(ctx: any, startX: any, startY: any, fillHex: any, tolerance: any, sampleAll: any, expand: any) {
    const sample = S.sampleData(sampleAll);
    let mask = S.computeFillMask(sample, startX, startY, tolerance);
    if (expand) mask = S.expandMask(mask, expand);
    S.paintMaskColor(ctx, mask, fillHex, Math.round(state.alpha * 255));
  };

  $el('fill-tolerance').addEventListener('input', (e: any) => {
    $el('fill-tol-v').textContent = e.target.value;
  });
  $el('fill-expand').addEventListener('input', (e: any) => {
    $el('fill-expand-v').textContent = e.target.value;
  });

  /* ---- Fill texture picker (image/texture fill source) ---- */
  S.fileInputFillTex = document.createElement('input');
  S.fileInputFillTex.type = 'file';
  S.fileInputFillTex.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
  S.fileInputFillTex.multiple = true;
  S.fileInputFillTex.style.display = 'none';
  document.body.appendChild(S.fileInputFillTex);
  S.fileInputFillTex.addEventListener('change', (e: any) => { Array.from(e.target.files).forEach(S.addFillTexture); e.target.value = ''; });

  S.addFillTexture = function addFillTexture(file: any) {
    const reader = new FileReader();
    reader.onload = (ev: any) => {
      const img = new Image();
      img.onload = () => {
        const name = file.name.replace(/\.[^.]+$/, '') || 'Texture';
        state.fillTextures.push({ name, dataUrl: ev.target.result, img });
        (state.fillTexIndex as any) = state.fillTextures.length - 1;
        state.fillStyle = 'image';
        S.syncFillStyleUI();
        S.renderTexStrip();
        S.persistFillTextures();
        S.showHint('Texture added: ' + name);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  S.renderTexStrip = function renderTexStrip() {
    const strip = $el('fill-tex-strip');
    if (!strip) return;
    strip.innerHTML = '';
    state.fillTextures.forEach((t: any, i: any) => {
      const d = document.createElement('div');
      d.className = 'tex-thumb' + (i === (state.fillTexIndex as any) ? ' active' : '');
      d.style.backgroundImage = `url(${t.dataUrl})`;
      d.title = t.name;
      d.addEventListener('click', () => { (state.fillTexIndex as any) = i; S.renderTexStrip(); });
      const del = document.createElement('button');
      del.className = 'del'; del.textContent = '×';
      del.addEventListener('click', (ev: any) => {
        ev.stopPropagation();
        state.fillTextures.splice(i, 1);
        if ((state.fillTexIndex as any) === i) (state.fillTexIndex as any) = null;
        else if ((state.fillTexIndex as any) > i) (state.fillTexIndex as any)--;
        S.renderTexStrip(); S.persistFillTextures();
      });
      d.appendChild(del);
      strip.appendChild(d);
    });
  }

  S.syncFillStyleUI = function syncFillStyleUI() {
    $all('[data-fillstyle]').forEach((b: any) => b.classList.toggle('active', b.dataset.fillstyle === state.fillStyle));
    const opts = $el('fill-image-opts');
    if (opts) opts.style.display = state.fillStyle === 'image' ? 'block' : 'none';
  };

  $all('[data-fillstyle]').forEach((b: any) => b.addEventListener('click', () => { state.fillStyle = b.dataset.fillstyle; S.syncFillStyleUI(); }));
  $all('[data-texmode]').forEach((b: any) => b.addEventListener('click', () => {
    state.fillTexMode = b.dataset.texmode;
    $all('[data-texmode]').forEach((x: any) => x.classList.toggle('active', x === b));
    $el('fill-tex-scale-row').style.display = state.fillTexMode === 'tile' ? 'flex' : 'none';
  }));
  $el('fill-tex-scale').addEventListener('input', (e: any) => {
    state.fillTexScale = parseFloat(e.target.value);
    $el('fill-tex-scale-v').textContent = state.fillTexScale.toFixed(1) + '×';
  });
  $el('fill-tex-import').addEventListener('click', () => S.fileInputFillTex.click());

  S.persistFillTextures = function persistFillTextures() {
    try { localStorage.setItem('nm-fill-textures', JSON.stringify(state.fillTextures.map((t: any) => ({ name: t.name, dataUrl: t.dataUrl })))); } catch (e) {}
  }
  S.loadFillTextures = function loadFillTextures() {
    try {
      const raw = localStorage.getItem('nm-fill-textures'); if (!raw) return;
      JSON.parse(raw).forEach((rec: any) => { const img = new Image(); img.onload = () => { state.fillTextures.push({ name: rec.name, dataUrl: rec.dataUrl, img }); S.renderTexStrip(); }; img.src = rec.dataUrl; });
    } catch (e) {}
  }

}
