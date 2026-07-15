/* Feature: hatch — shared scope S */
import { S } from "../scope";

export function initHatch() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);
  /* =================================================================
     FEATURE 2 — MATERIAL HATCHING STENCILS
     ================================================================= */
  // Each hatch draws a tiled patch using canvas pattern at the stamp location.
  S.HATCH_PATTERNS = [
    {
      name: 'Brick', category: 'hatch',
      tile: (ctx: any, tileW: any, tileH: any) => {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
        // row 1
        ctx.strokeRect(1, 1, tileW/2-2, tileH/2-1);
        ctx.strokeRect(tileW/2, 1, tileW/2-1, tileH/2-1);
        // row 2 (offset)
        ctx.strokeRect(1-tileW/4, tileH/2, tileW/2-2, tileH/2-1);
        ctx.strokeRect(tileW/4+1, tileH/2, tileW/2-2, tileH/2-1);
        ctx.strokeRect(tileW-tileW/4+1, tileH/2, tileW/2-2, tileH/2-1);
      }, tileW: 60, tileH: 30,
    },
    {
      name: 'Concrete', category: 'hatch',
      tile: (ctx: any, tileW: any, tileH: any) => {
        ctx.fillStyle = '#333';
        const pts = [[8,8],[20,15],[35,5],[45,20],[55,10],[12,22],[30,25],[48,28]];
        pts.forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x%tileW, y%tileH, 1.2, 0, Math.PI*2); ctx.fill(); });
        ctx.strokeStyle = '#555'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0,tileH*0.6); ctx.lineTo(tileW,tileH*0.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,tileH*0.2); ctx.lineTo(tileW,tileH*0.35); ctx.stroke();
      }, tileW: 60, tileH: 30,
    },
    {
      name: 'Wood', category: 'hatch',
      tile: (ctx: any, tileW: any, tileH: any) => {
        ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const y = (i / 4) * tileH + 3;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(tileW*0.25, y-2, tileW*0.5, y+2, tileW*0.75, y-1);
          ctx.bezierCurveTo(tileW*0.85, y, tileW, y+1, tileW, y);
          ctx.stroke();
        }
      }, tileW: 80, tileH: 20,
    },
    {
      name: 'Insulation', category: 'hatch',
      tile: (ctx: any, tileW: any, tileH: any) => {
        ctx.strokeStyle = '#e0a020'; ctx.lineWidth = 1.5;
        const mid = tileH / 2;
        ctx.beginPath();
        for (let x = 0; x <= tileW; x += 10) {
          ctx.lineTo(x, x % 20 === 0 ? mid - 6 : mid + 6);
        }
        ctx.stroke();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(tileW,0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,tileH); ctx.lineTo(tileW,tileH); ctx.stroke();
      }, tileW: 60, tileH: 24,
    },
    {
      name: 'Earth', category: 'hatch',
      tile: (ctx: any, tileW: any, tileH: any) => {
        ctx.strokeStyle = '#6b4c2a'; ctx.lineWidth = 1;
        // diagonal hatching
        for (let i = -tileH; i < tileW + tileH; i += 10) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + tileH, tileH); ctx.stroke();
        }
        // dots
        ctx.fillStyle = '#6b4c2a';
        [[15,10],[35,6],[55,15],[10,20],[45,22]].forEach(([x,y]) => {
          ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI*2); ctx.fill();
        });
      }, tileW: 60, tileH: 30,
    },
    {
      name: 'Water', category: 'hatch',
      tile: (ctx: any, tileW: any, tileH: any) => {
        ctx.strokeStyle = '#1e6fa8'; ctx.lineWidth = 1.2;
        [0.3, 0.65, 1.0].forEach((f: any) => {
          const y = f * tileH;
          ctx.beginPath();
          for (let x = 0; x <= tileW; x += 12) {
            ctx.quadraticCurveTo(x + 3, y - 4, x + 6, y);
            ctx.quadraticCurveTo(x + 9, y + 4, x + 12, y);
          }
          ctx.stroke();
        });
      }, tileW: 48, tileH: 18,
    },
  ];

  // Pre-build OffscreenCanvas tiles for fast pattern access
  S._hatchTiles = {};
  S.getHatchTile = function getHatchTile(hatch: any) {
    const key = hatch._key || hatch.name;
    if (S._hatchTiles[key]) return S._hatchTiles[key];
    const oc = document.createElement('canvas');
    oc.width = hatch.tileW; oc.height = hatch.tileH;
    const octx = oc.getContext('2d') as any;
    octx.clearRect(0, 0, hatch.tileW, hatch.tileH);
    hatch.tile(octx, hatch.tileW, hatch.tileH);
    S._hatchTiles[key] = oc;
    return oc;
  }

  // Built-in + user-imported hatches, in one list.
  S.hatchList = function hatchList() { return S.HATCH_PATTERNS.concat(state.customHatches); }

  // Build a custom hatch object from a loaded image. The image becomes the
  // repeating tile (capped to 256px on the long side for tiling performance).
  S.buildCustomHatch = function buildCustomHatch(name: any, img: any, dataUrl: any) {
    const cap = 256;
    const scale = Math.min(1, cap / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const tileW = Math.max(2, Math.round((img.naturalWidth || img.width) * scale));
    const tileH = Math.max(2, Math.round((img.naturalHeight || img.height) * scale));
    return {
      name, category: 'hatch', custom: true,
      _key: 'custom:' + name + ':' + Date.now() + ':' + Math.random().toString(36).slice(2, 6),
      img, dataUrl, tileW, tileH,
      tile: (ctx: any, w: any, h: any) => ctx.drawImage(img, 0, 0, w, h),
    };
  }

  S.addCustomHatchFromFile = function addCustomHatchFromFile(file: any) {
    const reader = new FileReader();
    reader.onload = (ev: any) => {
      const img = new Image();
      img.onload = () => {
        const name = file.name.replace(/\.[^.]+$/, '') || 'Hatch';
        state.customHatches.push(S.buildCustomHatch(name, img, ev.target.result));
        if (state.stencilCat === 'hatch') S.renderStencilsWithHatch();
        S.persistHatches();
        S.showHint(`Added hatch: ${name}`);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  S.persistHatches = function persistHatches() {
    try {
      const slim = state.customHatches.map((h: any) => ({ name: h.name, dataUrl: h.dataUrl }));
      localStorage.setItem('nm-hatches', JSON.stringify(slim));
    } catch (e) {}
  }

  S.loadHatches = function loadHatches() {
    try {
      const raw = localStorage.getItem('nm-hatches');
      if (!raw) return;
      JSON.parse(raw).forEach((rec: any) => {
        const img = new Image();
        img.onload = () => {
          state.customHatches.push(S.buildCustomHatch(rec.name, img, rec.dataUrl));
          if (state.stencilCat === 'hatch') S.renderStencilsWithHatch();
        };
        img.src = rec.dataUrl;
      });
    } catch (e) {}
  }

  S.placeHatch = function placeHatch(hatchPattern: any, ctx: any, cx: any, cy: any, size: any, rad: any) {
    const tile = S.getHatchTile(hatchPattern);
    const pattern = ctx.createPattern(tile, 'repeat');
    const s = size;
    ctx.save();
    ctx.globalAlpha = state.alpha;
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(cx, cy);
    if (rad) ctx.rotate(rad);
    // offset pattern so it tiles from the patch origin
    const mat = new DOMMatrix().translate(-s/2, -s/2);
    pattern.setTransform(mat);
    ctx.fillStyle = pattern;
    ctx.fillRect(-s/2, -s/2, s, s);
    ctx.restore();
  }
  /* =================================================================
     PATCH: Hatch stencils into stencil system + area-aware measurement render
     ================================================================= */

  // Override addMeasureSVG with the new architectural dim version
  // (we rename the old one and route through addDimSVG)
  S.addMeasureSVG = function addMeasureSVG(m: any, isPreview: any, mIndex: any) {
    S.addDimSVG(m, isPreview, mIndex);
  }

  // Override renderStencils to include hatch category
  S._stencilTabHandler = () => {
    $all('.stencil-tab').forEach((t: any) => {
      t.dataset.cat && (t.addEventListener('click', () => {
        $all('.stencil-tab').forEach((x: any) => x.classList.remove('active'));
        t.classList.add('active');
        state.stencilCat = t.dataset.cat;
        state.selectedStencil = null;
        S.renderStencilsWithHatch();
      }));
    });
  };

  // Add hatch tab to stencil panel HTML dynamically at boot
  S.injectHatchTab = function injectHatchTab() {
    const tabs = $qs('.stencil-tabs');
    if (!tabs) return;
    const tab = document.createElement('button');
    tab.className = 'stencil-tab';
    tab.dataset.cat = 'hatch';
    tab.textContent = 'Hatch';
    tab.addEventListener('click', () => {
      $all('.stencil-tab').forEach((x: any) => x.classList.remove('active'));
      tab.classList.add('active');
      state.stencilCat = 'hatch';
      state.selectedStencil = null;
      S.renderStencilsWithHatch();
    });
    tabs.appendChild(tab);
  }

  S.renderStencilsWithHatch = function renderStencilsWithHatch() {
    const grid = $el('stencil-grid');
    grid.innerHTML = '';
    const list = state.stencilCat === 'hatch' ? S.hatchList()
      : state.stencilCat === 'builtin' ? S.BUILTIN_STENCILS
      : state.customStencils;

    list.forEach((s: any, i: any) => {
      const div = document.createElement('div');
      div.className = 'stencil' + (state.selectedStencil === i ? ' active' : '');
      div.title = s.name;
      if (s.category === 'hatch') {
        // Preview hatch tile
        const cv = document.createElement('canvas');
        cv.width = 60; cv.height = 60;
        const ctx = cv.getContext('2d') as any;
        const tile = S.getHatchTile(s);
        const pat = ctx.createPattern(tile, 'repeat');
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, 60, 60);
        div.appendChild(cv);
      } else if (s.dataUrl) {
        const img = document.createElement('img');
        img.src = s.dataUrl;
        div.appendChild(img);
      } else {
        const tmp = document.createElement('canvas');
        tmp.width = 80; tmp.height = 80;
        const tctx = tmp.getContext('2d') as any;
        tctx.strokeStyle = '#0a0a0a'; tctx.lineWidth = 1.8;
        tctx.lineCap = 'round'; tctx.lineJoin = 'round';
        s.draw(tctx, 40, 40, 60);
        const img = document.createElement('img');
        img.src = tmp.toDataURL();
        div.appendChild(img);
      }
      div.addEventListener('click', () => {
        state.selectedStencil = i;
        S.renderStencilsWithHatch();
        S.showHint(`Tap canvas to place: ${s.name}`);
      });
      if (state.stencilCat === 'custom') {
        const del = document.createElement('button');
        del.className = 'del';
        del.textContent = '×';
        del.addEventListener('click', (ex: any) => {
          ex.stopPropagation();
          state.customStencils.splice(i, 1);
          if (state.selectedStencil === i) state.selectedStencil = null;
          S.renderStencilsWithHatch();
          S.persistStencils();
        });
        div.appendChild(del);
      }
      if (state.stencilCat === 'hatch' && s.custom) {
        const del = document.createElement('button');
        del.className = 'del';
        del.textContent = '×';
        del.addEventListener('click', (ex: any) => {
          ex.stopPropagation();
          const ci = state.customHatches.indexOf(s);
          if (ci >= 0) state.customHatches.splice(ci, 1);
          if (state.selectedStencil === i) state.selectedStencil = null;
          S.renderStencilsWithHatch();
          S.persistHatches();
        });
        div.appendChild(del);
      }
      grid.appendChild(div);
    });
    if (state.stencilCat === 'custom') {
      const add = document.createElement('div');
      add.className = 'stencil add';
      add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      add.addEventListener('click', () => S.fileInputStencil.click());
      grid.appendChild(add);
    }
    if (state.stencilCat === 'hatch') {
      const add = document.createElement('div');
      add.className = 'stencil add';
      add.title = 'Import hatch (PNG / JPG / SVG)';
      add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      add.addEventListener('click', () => (S.fileInputHatch as any).click());
      grid.appendChild(add);
    }
  }
}
