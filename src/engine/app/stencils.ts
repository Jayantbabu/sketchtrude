/* Stencils — shared scope S */
import { S } from "./scope";

export function initStencils() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);

  /* =================== STENCILS =================== */
  S.placeStencil = function placeStencil(p: any) {
    if (state.selectedStencil === null) return;
    const rad = (state.stencilRotation || 0) * Math.PI / 180;
    const l = S.activeLayer();
    const ctx = l.ctx;
    // Hatch patterns are a separate category
    if (state.stencilCat === 'hatch') {
      const hatch = S.hatchList()[state.selectedStencil as any];
      if (!hatch) return;
      const size = Math.max(200, state.size * 40) * (state.stencilScale || 1);
      S.placeHatch(hatch, ctx, p.x, p.y, size, rad);
      S.saveSnapshot(l);
      S.renderLayers();
      return;
    }
    const baseSize = Math.max(100, state.size * 40);
    const size = baseSize * (state.stencilScale || 1);
    const stencil = S.currentStencilList()[state.selectedStencil as any];
    if (!stencil) return;

    const drawWith = (drawFn: any) => {
      const half = size * 0.85;
      const rx = Math.max(0, Math.floor(p.x - half));
      const ry = Math.max(0, Math.floor(p.y - half));
      const rw = Math.min(S.doc.wPx - rx, Math.ceil(half * 2));
      const rh = Math.min(S.doc.hPx - ry, Math.ceil(half * 2));
      let before = null;
      try { before = ctx.getImageData(rx, ry, rw, rh); } catch (_) {}
      ctx.save();
      ctx.translate(p.x, p.y);
      if (rad) ctx.rotate(rad);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = state.color;
      ctx.fillStyle = state.color;
      ctx.lineWidth = Math.max(1, state.size);
      ctx.globalAlpha = state.alpha;
      drawFn();
      ctx.restore();
      try {
        const after = ctx.getImageData(rx, ry, rw, rh);
        if (before) S.pushRegionSnapshot(l, rx, ry, before, after);
        else S.saveSnapshot(l);
      } catch (_) { S.saveSnapshot(l); }
      S.renderLayers();
    };

    if (stencil.dataUrl) {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        const w = size * 1.5, h = w / ratio;
        drawWith(() => ctx.drawImage(img, -w/2, -h/2, w, h));
      };
      img.src = stencil.dataUrl;
    } else if (stencil.draw) {
      drawWith(() => stencil.draw(ctx, 0, 0, size));
    }
  }

  S.currentStencilList = function currentStencilList() {
    return state.stencilCat === 'builtin' ? S.BUILTIN_STENCILS : state.customStencils;
  }

  S.renderStencils = function renderStencils() {
    const grid = $el('stencil-grid');
    grid.innerHTML = '';
    const list = S.currentStencilList();
    list.forEach((s: any, i: any) => {
      const div = document.createElement('div');
      div.className = 'stencil' + (state.selectedStencil === i ? ' active' : '');
      div.title = s.name;
      if (s.dataUrl) {
        const img = document.createElement('img');
        img.src = s.dataUrl;
        div.appendChild(img);
      } else {
        const tmp = document.createElement('canvas');
        tmp.width = 80; tmp.height = 80;
        const tctx = tmp.getContext('2d') as any;
        tctx.strokeStyle = '#0a0a0a';
        tctx.lineWidth = 1.8;
        tctx.lineCap = 'round';
        tctx.lineJoin = 'round';
        s.draw(tctx, 40, 40, 60);
        const img = document.createElement('img');
        img.src = tmp.toDataURL();
        div.appendChild(img);
      }
      div.addEventListener('click', () => {
        state.selectedStencil = i;
        S.renderStencils();
        S.showHint(`Tap canvas to place: ${s.name}`);
      });
      if (state.stencilCat === 'custom') {
        const del = document.createElement('button');
        del.className = 'del';
        del.textContent = '×';
        del.addEventListener('click', (e: any) => {
          e.stopPropagation();
          state.customStencils.splice(i, 1);
          if (state.selectedStencil === i) state.selectedStencil = null;
          S.renderStencils();
          S.persistStencils();
        });
        div.appendChild(del);
      }
      grid.appendChild(div);
    });
    // add button (only in custom)
    if (state.stencilCat === 'custom') {
      const add = document.createElement('div');
      add.className = 'stencil add';
      add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      add.title = 'Upload stencil';
      add.addEventListener('click', () => S.fileInputStencil.click());
      grid.appendChild(add);
    }
  }

  S.persistStencils = function persistStencils() {
    try {
      const slim = state.customStencils.map((s: any) => ({ name: s.name, dataUrl: s.dataUrl }));
      // localStorage may fail in artifact context; try and ignore
      localStorage.setItem('nm-stencils', JSON.stringify(slim));
    } catch (e) {}
  }

  S.loadStencils = function loadStencils() {
    try {
      const raw = localStorage.getItem('nm-stencils');
      if (raw) state.customStencils = JSON.parse(raw);
    } catch (e) {}
  }

  S.fileInputStencil.addEventListener('change', (e: any) => {
    const files = Array.from(e.target.files);
    files.forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = (ev: any) => {
        state.customStencils.push({
          name: file.name.replace(/\.[^.]+$/, ''),
          dataUrl: ev.target.result,
        });
        S.renderStencils();
        S.persistStencils();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });

  $all('.stencil-tab').forEach((t: any) => {
    t.addEventListener('click', () => {
      $all('.stencil-tab').forEach((x: any) => x.classList.remove('active'));
      t.classList.add('active');
      state.stencilCat = t.dataset.cat;
      state.selectedStencil = null;
      S.renderStencils();
    });
  });
}
