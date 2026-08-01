/* Stencils — shared scope S */
import { S } from "./scope";

export function createPlacedStencilShape(options: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg?: number;
  name: string;
  dataUrl: string;
  opacity?: number;
}) {
  const rad = ((options.rotationDeg || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    { x: -options.width / 2, y: -options.height / 2 },
    { x: options.width / 2, y: -options.height / 2 },
    { x: options.width / 2, y: options.height / 2 },
    { x: -options.width / 2, y: options.height / 2 },
  ];
  return {
    kind: 'stencil',
    name: options.name,
    pts: corners.map((corner) => ({
      x: options.x + corner.x * cos - corner.y * sin,
      y: options.y + corner.x * sin + corner.y * cos,
    })),
    closed: true,
    stroke: 'transparent',
    width: 1,
    opacity: typeof options.opacity === 'number' ? options.opacity : 1,
    bgImage: options.dataUrl,
    stencilDataUrl: options.dataUrl,
    visible: true,
  };
}

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
    if (!l || l.locked || l.layerKind === 'reference') {
      S.showHint('Select an unlocked sketch layer to place a stencil');
      return;
    }

    const drawOnLayer = (rect: any, draw: (ctx: CanvasRenderingContext2D) => void) => {
      if (l.tileStore) {
        l.tileStore.beginPatch();
        l.tileStore.forEachContext(rect, (ctx: CanvasRenderingContext2D) => draw(ctx));
        S.saveSnapshot(l);
      } else {
        const rx = Math.max(0, Math.floor(rect.x));
        const ry = Math.max(0, Math.floor(rect.y));
        const rw = Math.max(0, Math.min(S.doc.wPx - rx, Math.ceil(rect.w)));
        const rh = Math.max(0, Math.min(S.doc.hPx - ry, Math.ceil(rect.h)));
        let before = null;
        try { before = l.ctx.getImageData(rx, ry, rw, rh); } catch (_) {}
        draw(l.ctx);
        try {
          const after = l.ctx.getImageData(rx, ry, rw, rh);
          if (before) S.pushRegionSnapshot(l, rx, ry, before, after);
          else S.saveSnapshot(l);
        } catch (_) { S.saveSnapshot(l); }
      }
      S.renderLayers();
    };

    // Hatch patterns are a separate category
    if (state.stencilCat === 'hatch') {
      const hatch = S.hatchList()[state.selectedStencil as any];
      if (!hatch) return;
      const size = Math.max(200, state.size * 40) * (state.stencilScale || 1);
      const half = size * Math.SQRT2 / 2 + 4;
      drawOnLayer(
        { x: p.x - half, y: p.y - half, w: half * 2, h: half * 2 },
        (ctx) => S.placeHatch(hatch, ctx, p.x, p.y, size, rad),
      );
      S.showHint(`${hatch.name} placed · tap again to repeat`);
      return;
    }
    const baseSize = Math.max(100, state.size * 40);
    const size = baseSize * (state.stencilScale || 1);
    const stencil = S.currentStencilList()[state.selectedStencil as any];
    if (!stencil) return;

    const commitStencil = (dataUrl: string, ratio = 1) => {
      const before = S.vectorSnapshot();
      const width = size * 1.5;
      const height = width / Math.max(0.05, ratio || 1);
      const shape = createPlacedStencilShape({
        x: p.x,
        y: p.y,
        width,
        height,
        rotationDeg: state.stencilRotation || 0,
        name: stencil.name || 'Stencil',
        dataUrl,
        opacity: state.alpha,
      });
      state.shapes.push(shape);
      const id = S.ensureShapeId(shape);
      S.registerShapeInLayerPanel(shape);
      S.recordVec(before);
      S.setTool('select');
      S.selectShapeById(id, 'canvas');
      S.refreshMeasurements();
      S.renderLayers();
      S.showHint(`${stencil.name} placed and selected · use Move, Scale, or Rotate`);
    };

    if (stencil.dataUrl) {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        commitStencil(stencil.dataUrl, ratio);
      };
      img.src = stencil.dataUrl;
    } else if (stencil.draw) {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.strokeStyle = state.color;
      ctx.fillStyle = state.color;
      ctx.lineWidth = Math.max(2, state.size * 1.5);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      stencil.draw(ctx, 128, 128, 200);
      commitStencil(canvas.toDataURL('image/png'), 1);
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
        S.showHint(`Tap canvas to place ${s.name} · tap repeatedly to stamp`);
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
