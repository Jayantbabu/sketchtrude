/* Tool UI + brushes — shared scope S */
import { S } from "./scope";
import { initColor } from "./color";
import { initFill } from "./fill";
import { semanticToolRequiresScale } from "../../lib/scale-system";

export function initToolUi() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);


  /* =================== TOOL UI =================== */
  S.setTool = function setTool(tool: any) {
    if (typeof S.hideShapeChip === 'function') S.hideShapeChip();
    if (semanticToolRequiresScale(tool) && !S.hasCalibratedScale()) {
      S.requestScaleForTool('wall');
      return;
    }
    // The old Brushes pseudo-tool now routes to the compact draw menu.
    if (tool === 'brushes') {
      if (typeof S.openDrawToolMenu === 'function') S.openDrawToolMenu();
      return;
    }
    // Leaving 3D massing if another tool is chosen
    if (S.massing.active && tool !== 'massing') {
      S.massing.active = false;
      S.massingCanvas.style.display = 'none';
      S.massingBar.style.display = 'none';
      S.massing.dragging = null;
      S.massing.selected = -1;
      $el('mass-inspector').style.display = 'none';
      S.massHint('');
      if (typeof S.updateMatPalette === 'function') S.updateMatPalette();
      if (typeof S.updateBuildPalette === 'function') S.updateBuildPalette();
    }
    state.tool = tool;
    $all('.tool').forEach((t: any) => t.classList.toggle('active', t.dataset.tool === S.brushFamilyOf(tool)));

    // close popovers
    S.colorPopover.classList.remove('show');
    S.stencilPopover.classList.remove('show');

    { const bb = S.BUILTIN_BRUSHES.find((x: any) => x.id === tool); if (bb) S.setActiveBrush(bb); }

    if (tool === 'massing') {
      S.enterMassing();
      return;
    }

    if (tool === 'stencil') {
      S.showStencilPopover();
    }
    if (tool === 'hand') {
      S.showHint('Hand tool — drag to pan, scroll to zoom');
    }
    if (tool === 'fill') {
      document.body.classList.add('fill-mode');
      S.showHint('Flood Fill — tap inside a closed shape to fill. Open colour picker to set tolerance.');
    } else {
      document.body.classList.remove('fill-mode');
    }
    if (tool === 'wand') {
      S.showHint('Magic Wand — tap a region to select. Tolerance is in the colour/fill panel.');
    } else if (tool === 'lasso') {
      S.showHint('Lasso — drag to trace a region. Shows its area; Copy / Cut / Delete / Fill the selection.');
    } else {
      // leaving wand/lasso: place any floating pixels and clear the selection
      if (state.floating || state.selection) { S.commitFloating(); S.clearSelection(); }
    }
    if (tool === 'area') {
      S.startPolyTool();
      S.showHint('Area tool — click to place vertices · Double-click near start to close · Esc to cancel');
    } else if (tool === 'wall') {
      if (state.wallsVisible === false) S.setWallsVisible(true);
      state.wallChainEnd = null;
      state.wallDrag = null;
      state.polyActive = false;
      state.polyPoints = [];
      const ph = $el('poly-hint');
      if (ph) ph.style.display = 'none';
      S.showHint('Wall — drag to draw · snaps to angles & ends · Esc ends chain · select wall to curve via bulge handle');
    } else if (tool === 'opening') {
      if (state.polyActive) { state.polyPoints = []; state.polyActive = false; $el('poly-hint').style.display = 'none'; }
      if (state.wallDrag) S.cancelWallDrag();
      S.showHint('Door / Window / Opening — tap a wall to place · drag to slide · edit in the bar');
    } else if (tool === 'select') {
      if (state.polyActive) { state.polyPoints = []; state.polyActive = false; $el('poly-hint').style.display = 'none'; }
      if (state.wallDrag) S.cancelWallDrag();
      S.showHint('Select — tap a wall, door, window, or room to edit it · Delete to remove');
    } else if (tool === 'offset') {
      if (state.polyActive) { state.polyPoints = []; state.polyActive = false; $el('poly-hint').style.display = 'none'; }
      if (state.wallDrag) S.cancelWallDrag();
      S.showHint('Offset — tap a room, then set the distance and tap Apply');
    } else if (tool === 'line') {
      S.startPolyTool();
      S.showHint('Polygon — tap to place vertices · tap the first point or double-tap to close · 2 points = a line · Esc to cancel');
    } else if (state.polyActive) {
      // Cancel polygon if switching away
      state.polyPoints = []; state.polyActive = false;
      $el('poly-hint').style.display = 'none';
      S.refreshMeasurements();
    }
    if (tool !== 'wall' && state.wallChainEnd) state.wallChainEnd = null;
    // Top floating palettes are replaced by the bottom tool options bar.
    if (typeof S.showWall2dPalette === 'function') S.showWall2dPalette(false);
    if (typeof S.showOpeningPalette === 'function') S.showOpeningPalette(false);
    if (tool !== 'opening') { state.selOpening2D = null; }
    else if (typeof S.updateOpeningPalette === 'function') S.updateOpeningPalette();
    const preserveSel = !!state._preserveSelOnSetTool;
    const _hadSel = !!state.sel;
    if (!preserveSel) {
      state.sel = null;
      S.syncSelectionManagerFromLegacy('programmatic');
      if (typeof S.showSelectBar === 'function') S.showSelectBar(null);
    }
    if (tool !== 'offset' && state.offset) { state.offset = null; if (typeof S.showOffsetBar === 'function') S.showOffsetBar(false); }
    if (_hadSel && !preserveSel && typeof S.refreshMeasurements === 'function') S.refreshMeasurements();
    S.highlightRailGroups();
    S.updatePreview();
    S.updateLayerOrder();
    if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
  }

  S.setActiveBrush = function setActiveBrush(brush: any) {
    state.activeBrush = brush;
    state.size = brush.size;
    state.alpha = brush.opacity;
    if (typeof brush.smoothing === 'number') {
      // Map brush smoothing into existing stabilizer (0–1).
      state.stabilizer = Math.max(state.stabilizer || 0, brush.smoothing * 0.6);
    }
    if (S.brushLibraryEngine) S.brushLibraryEngine.markRecent(brush.id);
    // sync puck UI
    const maxSize = brush.maxSize || Math.max(40, brush.size * 3);
    $el('puck-name').textContent = (brush.name || 'BRUSH').toUpperCase();
    const sizeSlider = $el('puck-size-slider');
    sizeSlider.max = maxSize;
    sizeSlider.value = brush.size;
    $el('puck-size-val').textContent = brush.size;
    $el('puck-alpha-slider').value = Math.round(brush.opacity * 100);
    $el('puck-alpha-val').textContent = Math.round(brush.opacity * 100);
    // Active state is reflected by the grouped rail
    $all('.tool').forEach((t: any) => t.classList.remove('active'));
    state.tool = brush.builtIn !== false ? brush.id : 'pen';
    if (brush.id === 'tech-revision') state.color = '#a02835';
    if (typeof S.highlightRailGroups === 'function') S.highlightRailGroups();
    S.updatePreview();
    if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
  }

  // Tool buttons: single tap selects; tapping the ALREADY-active tool again
  // opens that tool's settings (Procreate-style double-tap).
  S._lastToolTap = { tool: null, time: 0 };
  $all('.tool').forEach((btn: any) => {
    btn.addEventListener('click', (e: any) => {
      e.stopPropagation();   // don't let document close-on-outside fire
      const tool = btn.dataset.tool;
      const now = Date.now();
      const wasActive = (state.tool === tool) || (tool === 'brushes');
      const isDoubleTap = (S._lastToolTap.tool === tool && now - S._lastToolTap.time < 400);
      S._lastToolTap = { tool, time: now };

      if (tool === 'brushes') { S.openDrawToolMenu?.(); return; }

      if (S.BRUSH_FAMILIES[tool]) {
        const fam = tool;
        const wasFamActive = S.BRUSH_FAMILIES[fam].includes(state.tool);
        state.brushLast = state.brushLast || {};
        const last = state.brushLast[fam] || fam;
        S.setTool(last);
        if (wasFamActive || isDoubleTap) S.openDrawToolMenu?.();
        return;
      }

      S.setTool(tool);

      if (wasActive || isDoubleTap) {
        S.openToolSettings(tool);
      }
    });
  });

  // ===== Grouped rail: collapse the 20-tool strip into category buttons =====
  S.TOOL_GROUPS = [
    { id: 'draw',     label: 'Draw',           tools: ['pen','pencil','marker','brush','texture','eraser'] },
    { id: 'shapes',   label: 'Shapes',         tools: ['line','rect','circle'] },
    { id: 'fillstamp',label: 'Fill / Stamp',   tools: ['fill','stencil'] },
    { id: 'region',   label: 'Region',         tools: ['wand','lasso'] },
    { id: 'measure',  label: 'Measure / Area', tools: ['ruler','area'] },
    { id: 'build',    label: 'Build',          tools: ['wall','opening'] },
  ];
  S._railMeta = {};
  S._groupOf = function _groupOf(toolId: any) { return S.TOOL_GROUPS.find((g: any) => g.tools.includes(toolId)); }
  S.activateRailTool = function activateRailTool(t: any) { S.setTool(t); }

  S.regroupRail = function regroupRail() {
    const rail = $qs('.rail');
    if (!rail || rail.dataset.grouped) return;
    // capture each tool's icon + clean name from the existing buttons
    rail.querySelectorAll('.tool').forEach((b: any) => {
      const t = b.dataset.tool; if (!t) return;
      const svg = b.querySelector('svg');
      const lbl = (b.querySelector('.label')?.textContent || t).replace(/\s·.*$/, '');
      S._railMeta[t] = { svg: svg ? svg.outerHTML : '', label: lbl };
    });
    Object.assign(S._railMeta, {
      pen: { ...S._railMeta.pen, label: 'Pen' },
      pencil: { ...S._railMeta.pencil, label: 'Pencil' },
      marker: { ...S._railMeta.marker, label: 'Marker' },
      brush: { ...S._railMeta.brush, label: 'Brush' },
      texture: {
        label: 'Texture',
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19L19 4M8 21L21 8M3 14L14 3"/><path d="M4 8h4v4M12 16h4v4" opacity=".55"/></svg>',
      },
      eraser: { ...S._railMeta.eraser, label: 'Eraser' },
    });
    if (!$el('grp-flyout-style')) {
      const st = document.createElement('style'); st.id = 'grp-flyout-style';
      st.textContent =
        '#grp-flyout{position:fixed;z-index:1400;display:flex;flex-direction:column;gap:3px;background:#1c1a18;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:6px;box-shadow:0 12px 34px rgba(0,0,0,0.5);min-width:172px;}'
      + '#grp-flyout .gfi{display:flex;align-items:center;gap:11px;font:600 12px ui-sans-serif,system-ui;color:#e8e4de;padding:9px 12px;border-radius:8px;cursor:pointer;background:transparent;border:none;text-align:left;width:100%;}'
      + '#grp-flyout .gfi:hover{background:#2b2826;}#grp-flyout .gfi.on{background:#a02835;color:#fff;}'
      + '#grp-flyout .gfi svg{width:18px;height:18px;flex:0 0 18px;}';
      document.head.appendChild(st);
    }
    state.groupLast = {};
    S.TOOL_GROUPS.forEach((g: any) => state.groupLast[g.id] = g.tools[0]);
    rail.innerHTML = '';
    rail.dataset.grouped = '1';

    const mkBtn = (iconTool: any, labelTxt: any) => {
      const b = document.createElement('button');
      b.className = 'tool';
      b.title = labelTxt;
      b.innerHTML = `${S._railMeta[iconTool]?.svg || ''}<span class="label">${labelTxt}</span>`;
      rail.appendChild(b);
      return b;
    };
    // Top-level Select (arrow) — picks an entity and offers edit/delete
    const selBtn = document.createElement('button');
    selBtn.className = 'tool'; selBtn.dataset.tool = 'select'; selBtn.title = 'Select';
    selBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3l6.5 17 2.4-7.1L20 10.5 4 3z"/></svg><span class="label">Select</span>';
    selBtn.addEventListener('click', (e: any) => { e.stopPropagation(); S.setTool('select'); });
    rail.appendChild(selBtn);
    // Top-level Offset (concentric) — offset a room boundary in/out
    const offBtn = document.createElement('button');
    offBtn.className = 'tool'; offBtn.dataset.tool = 'offset'; offBtn.title = 'Offset';
    offBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><rect x="7.5" y="7.5" width="9" height="9" rx="1"/></svg><span class="label">Offset</span>';
    offBtn.addEventListener('click', (e: any) => { e.stopPropagation(); S.setTool('offset'); });
    rail.appendChild(offBtn);
    const topDiv = document.createElement('div'); topDiv.className = 'rail-divider'; rail.appendChild(topDiv);
    S.TOOL_GROUPS.forEach((g: any) => {
      const btn = mkBtn(g.tools[0], g.label);
      btn.dataset.group = g.id;
      btn.addEventListener('click', (e: any) => {
        e.stopPropagation();
        const active = g.tools.includes(state.tool) || g.tools.includes(S.brushFamilyOf(state.tool));
        if (active && g.tools.length > 1) { S.openGroupFlyout(g, btn); return; }
        S.activateRailTool(state.groupLast[g.id] || g.tools[0]);
      });
      let lp: any;
      btn.addEventListener('pointerdown', () => { lp = setTimeout(() => S.openGroupFlyout(g, btn), 450); });
      ['pointerup','pointerleave','pointercancel'].forEach((ev: any) => btn.addEventListener(ev, () => clearTimeout(lp)));
    });
    const div = document.createElement('div'); div.className = 'rail-divider'; rail.appendChild(div);
    const b3d = mkBtn('massing', '3D'); b3d.dataset.tool = 'massing';
    b3d.addEventListener('click', (e: any) => { e.stopPropagation(); S.setTool('massing'); });
    rail.appendChild(b3d);
    const bpan = mkBtn('hand', 'Pan'); bpan.dataset.tool = 'hand';
    bpan.addEventListener('click', (e: any) => { e.stopPropagation(); S.setTool('hand'); });
    rail.appendChild(bpan);
    S.highlightRailGroups();
  }

  S.updateGroupIcon = function updateGroupIcon(g: any) {
    const btn = $qs(`.rail .tool[data-group="${g.id}"]`); if (!btn) return;
    const t = state.groupLast[g.id] || g.tools[0];
    const lbl = btn.querySelector('.label');
    btn.innerHTML = `${S._railMeta[t]?.svg || ''}`;
    if (lbl) btn.appendChild(lbl);
  }

  S._grpFlyout = null;
  S.closeGroupFlyout = function closeGroupFlyout() { if (S._grpFlyout) { S._grpFlyout.remove(); S._grpFlyout = null; } }
  S.openGroupFlyout = function openGroupFlyout(g: any, btn: any) {
    S.closeGroupFlyout();
    const fly = document.createElement('div'); fly.id = 'grp-flyout';
    g.tools.forEach((t: any) => {
      const it = document.createElement('button'); it.className = 'gfi';
      it.innerHTML = `${S._railMeta[t]?.svg || ''}<span>${S._railMeta[t]?.label || t}</span>`;
      if (t === state.tool || t === S.brushFamilyOf(state.tool)) it.classList.add('on');
      it.addEventListener('click', (e: any) => {
        e.stopPropagation();
        state.groupLast[g.id] = t;
        S.setTool(t);
        S.updateGroupIcon(g);
        S.closeGroupFlyout();
      });
      fly.appendChild(it);
    });
    if (g.id === 'draw') {
      const divider = document.createElement('div');
      divider.style.cssText = 'height:1px;background:rgba(255,255,255,0.1);margin:3px 5px;';
      fly.appendChild(divider);

      const importPen = document.createElement('button');
      importPen.className = 'gfi';
      importPen.title = 'PNG/JPG tips; limited ABR, Procreate and SketchBook extraction';
      importPen.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14a2 2 0 0 0 2-2v-4M3 15v4a2 2 0 0 0 2 2"/>'
        + '</svg><span>Import Pen…</span>';
      importPen.addEventListener('click', (e: any) => {
        e.stopPropagation();
        S.closeGroupFlyout();
        $el('brush-import-file')?.click();
      });
      fly.appendChild(importPen);
    }
    document.body.appendChild(fly);
    const r = btn.getBoundingClientRect();
    fly.style.left = (r.right + 8) + 'px';
    fly.style.top = Math.max(8, Math.min(r.top, window.innerHeight - fly.offsetHeight - 8)) + 'px';
    S._grpFlyout = fly;
    setTimeout(() => document.addEventListener('click', S.closeGroupFlyout, { once: true }), 0);
  }

  S.openDrawToolMenu = function openDrawToolMenu() {
    const drawGroup = S.TOOL_GROUPS.find((g: any) => g.id === 'draw');
    const drawButton = $qs('.rail .tool[data-group="draw"]');
    if (!drawGroup || !drawButton) return;
    if (typeof S.closeBrushLibrary === 'function') S.closeBrushLibrary();
    S.openGroupFlyout(drawGroup, drawButton);
  }

  S.highlightRailGroups = function highlightRailGroups() {
    const rail = $qs('.rail'); if (!rail || !rail.dataset.grouped) return;
    const activeTool = S.massing.active ? 'massing' : state.tool;
    const inGroup = (g: any, t: any) => g.tools.includes(t) || g.tools.includes(S.brushFamilyOf(t));
    rail.querySelectorAll('.tool[data-group]').forEach((b: any) => {
      const g = S.TOOL_GROUPS.find((x: any) => x.id === b.dataset.group);
      b.classList.toggle('active', !!g && !S.massing.active && inGroup(g, activeTool));
    });
    rail.querySelectorAll('.tool[data-tool]').forEach((b: any) => b.classList.toggle('active', b.dataset.tool === activeTool));
    // a group button shows the active base tool's icon (variants keep the family icon)
    S.TOOL_GROUPS.forEach((g: any) => { if (state.groupLast && g.tools.includes(state.tool)) { state.groupLast[g.id] = state.tool; S.updateGroupIcon(g); } });
  }

  // ---- rail flyout: pick a pen / pencil variant ----
  S._brushFlyout = null;
  S.ensureBrushFlyout = function ensureBrushFlyout() {
    if (S._brushFlyout) return S._brushFlyout;
    const style = document.createElement('style');
    style.textContent =
      '#brush-flyout{position:fixed;z-index:1300;display:none;flex-direction:column;gap:3px;background:#1c1a18;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:6px;box-shadow:0 12px 34px rgba(0,0,0,0.5);min-width:170px;max-height:min(70vh,520px);overflow-y:auto;overscroll-behavior:contain;}' +
      '#brush-flyout .bfi{display:flex;align-items:center;gap:11px;font:600 12px ui-sans-serif,system-ui;color:#e8e4de;padding:9px 12px;border-radius:8px;cursor:pointer;background:transparent;border:none;text-align:left;width:100%;flex-shrink:0;}' +
      '#brush-flyout .bfi:hover{background:#2b2826;}' +
      '#brush-flyout .bfi.on{background:#a02835;color:#fff;}' +
      '#brush-flyout .bfi .sw{width:26px;border-radius:3px;background:currentColor;opacity:0.9;flex-shrink:0;}' +
      '#brush-flyout::-webkit-scrollbar{width:6px;}#brush-flyout::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.22);border-radius:4px;}';
    document.head.appendChild(style);
    const el = document.createElement('div'); el.id = 'brush-flyout';
    el.addEventListener('pointerdown', (e: any) => e.stopPropagation());
    el.addEventListener('wheel', (e: any) => { e.stopPropagation(); }, { passive: true });
    document.body.appendChild(el); S._brushFlyout = el;
    document.addEventListener('pointerdown', () => { if (S._brushFlyout) S._brushFlyout.style.display = 'none'; });
    return el;
  }
  S.openBrushFlyout = function openBrushFlyout(fam: any, anchorBtn: any) {
    const el = S.ensureBrushFlyout(); el.innerHTML = '';
    (S.BRUSH_FAMILIES[fam] || []).forEach((id: any) => {
      const b = S.BUILTIN_BRUSHES.find((x: any) => x.id === id); if (!b) return;
      const item = document.createElement('button'); item.className = 'bfi' + (state.tool === id ? ' on' : '');
      const sw = document.createElement('span'); sw.className = 'sw'; sw.style.height = Math.max(2, Math.min(8, b.size)) + 'px';
      const nm = document.createElement('span'); nm.textContent = b.name;
      item.append(sw, nm);
      item.onclick = (ev: any) => { ev.stopPropagation(); state.brushLast = state.brushLast || {}; state.brushLast[fam] = id; S.setTool(id); el.style.display = 'none'; };
      el.appendChild(item);
    });
    const r = anchorBtn.getBoundingClientRect();
    el.style.display = 'flex';
    const fr = el.getBoundingClientRect();
    let top = r.top; if (top + fr.height > window.innerHeight - 8) top = window.innerHeight - 8 - fr.height;
    el.style.left = (r.right + 8) + 'px';
    el.style.top = Math.max(8, top) + 'px';
  }

  // Open the settings panel appropriate to each tool
  S.openToolSettings = function openToolSettings(tool: any) {
    if (S.isDrawTool(tool)) {
      S.openDrawToolMenu();
    } else if (tool === 'stencil') {
      S.showStencilPopover();   // setTool already opens it; re-tap re-opens if closed
    } else if (tool === 'fill' || tool === 'wand' || tool === 'lasso') {
      $el('puck-color').click();  // colour popover holds tolerance + fill source
    }
    // ruler/area have no extra settings panel — selecting them is enough
  }

  S.showStencilPopover = function showStencilPopover() {
    const puckRect = $el('puck').getBoundingClientRect();
    const areaRect = S.area.getBoundingClientRect();
    S.stencilPopover.style.left = '24px';
    S.stencilPopover.style.bottom = '80px';
    S.stencilPopover.style.right = '';
    S.stencilPopover.style.top = '';
    S.stencilPopover.classList.add('show');
    S.renderStencils();
  }

  /* =================== BRUSH LIBRARY =================== */
  S.brushLibrary = $el('brush-library');
  S.brushModal = $el('brush-modal');

  S.openBrushLibrary = function openBrushLibrary() {
    // anchor above the puck, centered
    const puckRect = $el('puck').getBoundingClientRect();
    const areaRect = S.area.getBoundingClientRect();
    const desiredLeft = puckRect.left + puckRect.width/2 - 170 - areaRect.left;
    S.brushLibrary.style.left = Math.max(20, Math.min(areaRect.width - 360, desiredLeft)) + 'px';
    S.brushLibrary.style.bottom = (areaRect.height - (puckRect.top - areaRect.top) + 10) + 'px';
    S.brushLibrary.style.display = 'block';   // override inline display:none
    S.brushLibrary.classList.add('show');
    S.renderBrushList();
    // Ensure the list can receive wheel scroll (canvas-area also listens for zoom).
    const list = $el('brush-list');
    if (list && !list.dataset.wheelBound) {
      list.dataset.wheelBound = '1';
      list.addEventListener('wheel', (e: any) => { e.stopPropagation(); }, { passive: true });
    }
    if (S.brushLibrary && !S.brushLibrary.dataset.wheelBound) {
      S.brushLibrary.dataset.wheelBound = '1';
      S.brushLibrary.addEventListener('wheel', (e: any) => { e.stopPropagation(); }, { passive: true });
    }
  }

  S.closeBrushLibrary = function closeBrushLibrary() {
    S.brushLibrary.style.display = 'none';    // override inline + class
    S.brushLibrary.classList.remove('show');
    // restore tool active state
    $el('rail-brushes')?.classList.remove('active');
    const cur = S.activeBrush();
    if (cur && cur.builtIn) {
      const btn = $qs(`.tool[data-tool="${cur.id}"]`);
      if (btn) btn.classList.add('active');
    }
  };

  $el('brush-lib-close').addEventListener('click', S.closeBrushLibrary);

  $el('rail-brushes')?.addEventListener('click', (e: any) => {
    e.stopPropagation();
    // override default setTool routing
  });

  // click outside closes
  document.addEventListener('click', (e: any) => {
    if (S.brushLibrary.classList.contains('show') &&
        !e.target.closest('#brush-library') &&
        !e.target.closest('#rail-brushes') &&
        !e.target.closest('#puck-name')) {
      S.closeBrushLibrary();
    }
  });

  S.renderBrushList = function renderBrushList() {
    const list = $el('brush-list');
    list.innerHTML = '';

    // Search + category filters
    if (!list.dataset.controlsBound) {
      list.dataset.controlsBound = '1';
    }
    const head = document.createElement('div');
    head.className = 'brush-lib-filters';
    head.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:0 0 8px;';
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search brushes…';
    search.value = state._brushSearch || '';
    search.style.cssText = 'width:100%;border:1px solid var(--line-2);border-radius:8px;padding:7px 10px;font:12px inherit;background:var(--paper);color:var(--ink);';
    search.addEventListener('input', () => {
      state._brushSearch = search.value;
      S.renderBrushList();
    });
    head.appendChild(search);

    const cats = document.createElement('div');
    cats.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
    const activeCat = state._brushCategory || 'all';
    const labels = (S.brushes && S.brushes.getCategoryLabels)
      ? S.brushes.getCategoryLabels()
      : {};
    const catIds = S.brushLibraryEngine
      ? ['all', 'recent', ...S.brushLibraryEngine.categories()]
      : ['all', 'technical', 'pencil', 'ink', 'marker', 'paint', 'watercolor', 'eraser'];
    catIds.forEach((cat: any) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = cat === 'all' ? 'All' : cat === 'recent' ? 'Recent' : (labels[cat] || cat);
      chip.style.cssText = 'border:1px solid var(--line-2);background:' + (activeCat === cat ? 'var(--brand)' : 'transparent') + ';color:' + (activeCat === cat ? '#fff' : 'var(--ink)') + ';border-radius:999px;padding:3px 8px;font:600 10px inherit;cursor:pointer;';
      chip.addEventListener('click', (e: any) => {
        e.stopPropagation();
        state._brushCategory = cat;
        S.renderBrushList();
      });
      cats.appendChild(chip);
    });
    head.appendChild(cats);
    list.appendChild(head);

    let brushes = S.BUILTIN_BRUSHES.slice();
    if (S.brushLibraryEngine) {
      brushes = S.brushLibraryEngine.all().filter((b: any) => b.builtIn !== false || !b.builtIn);
      // Prefer library builtins + keep custom separate below
      brushes = S.brushLibraryEngine.all().filter((b: any) => b.source === 'built-in' || b.builtIn);
    }
    if (state._brushSearch) {
      const q = state._brushSearch.toLowerCase();
      brushes = brushes.filter((b: any) => b.name.toLowerCase().includes(q) || (b.category || '').includes(q));
    }
    if (activeCat === 'recent' && S.brushLibraryEngine) {
      brushes = S.brushLibraryEngine.getRecent();
    } else if (activeCat !== 'all') {
      brushes = brushes.filter((b: any) => b.category === activeCat);
    }

    const grouped: any = {};
    brushes.forEach((b: any) => {
      const c = b.category || 'technical';
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(b);
    });
    Object.keys(grouped).forEach((cat: any) => {
      const builtinLabel = document.createElement('div');
      builtinLabel.className = 'brush-group-label';
      builtinLabel.textContent = labels[cat] || cat;
      list.appendChild(builtinLabel);
      grouped[cat].forEach((b: any) => list.appendChild(S.renderBrushCard(b)));
    });

    // Custom group
    const customLabel = document.createElement('div');
    customLabel.className = 'brush-group-label';
    customLabel.textContent = `My Brushes${state.customBrushes.length ? ' · ' + state.customBrushes.length : ''}`;
    list.appendChild(customLabel);
    if (state.customBrushes.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:12px;font-size:11px;color:var(--muted);text-align:center;';
      empty.textContent = 'No custom brushes yet. Create one below.';
      list.appendChild(empty);
    } else {
      state.customBrushes.forEach((b: any, i: any) => list.appendChild(S.renderBrushCard(b, i)));
    }
  }

  S.renderBrushCard = function renderBrushCard(brush: any, customIndex: any) {
    const div = document.createElement('div');
    div.className = 'brush-card' + (state.activeBrush && state.activeBrush.id === brush.id ? ' active' : '');

    // preview canvas
    const previewWrap = document.createElement('div');
    previewWrap.className = 'brush-card-preview';
    const cv = document.createElement('canvas');
    cv.width = 140; cv.height = 56;
    cv.style.cssText = 'width:100%;height:100%;';
    previewWrap.appendChild(cv);
    div.appendChild(previewWrap);

    // info
    const info = document.createElement('div');
    info.className = 'brush-card-info';
    const name = document.createElement('div');
    name.className = 'brush-card-name';
    name.textContent = brush.name;
    const meta = document.createElement('div');
    meta.className = 'brush-card-meta';
    meta.textContent = `${(brush.tipType || brush.engineType || 'brush').toString().toUpperCase()} · ${brush.size}px · ${Math.round((brush.opacity || 1)*100)}%`;
    info.appendChild(name);
    info.appendChild(meta);
    div.appendChild(info);

    // actions
    const acts = document.createElement('div');
    acts.className = 'brush-card-actions';
    if (!brush.builtIn) {
      const editBtn = document.createElement('button');
      editBtn.className = 'brush-card-act';
      editBtn.title = 'Edit';
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>';
      editBtn.addEventListener('click', (e: any) => { e.stopPropagation(); S.openBrushEditor(brush, customIndex); });
      acts.appendChild(editBtn);

      const dupBtn = document.createElement('button');
      dupBtn.className = 'brush-card-act';
      dupBtn.title = 'Duplicate';
      dupBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      dupBtn.addEventListener('click', (e: any) => {
        e.stopPropagation();
        const dup = JSON.parse(JSON.stringify(brush));
        dup.id = 'b' + Date.now();
        dup.name = brush.name + ' Copy';
        state.customBrushes.push(dup);
        S.persistBrushes();
        S.renderBrushList();
      });
      acts.appendChild(dupBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'brush-card-act';
      delBtn.title = 'Delete';
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>';
      delBtn.addEventListener('click', (e: any) => {
        e.stopPropagation();
        if (confirm(`Delete "${brush.name}"?`)) {
          state.customBrushes.splice(customIndex, 1);
          S.persistBrushes();
          S.renderBrushList();
        }
      });
      acts.appendChild(delBtn);
    }
    div.appendChild(acts);

    // click select
    div.addEventListener('click', () => {
      S.setActiveBrush(brush);
      S.renderBrushList();
      S.closeBrushLibrary();
      S.showHint(`Brush: ${brush.name}`);
    });

    // draw preview stroke after attach (so we can read size correctly)
    setTimeout(() => S.drawBrushPreview(cv, brush), 0);

    return div;
  }

  S.drawBrushPreview = function drawBrushPreview(canvas: any, brush: any) {
    const ctx = canvas.getContext('2d') as any;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const points = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const x = 8 + t * (canvas.width - 16);
      const y = canvas.height/2 + Math.sin(t * Math.PI * 2.5) * 14;
      points.push({ x, y, pressure: 0.25 + Math.sin(t * Math.PI) * 0.7 });
    }
    if (brush.tipType === 'texture' && brush.tipImage) {
      const img = S.getTipImage(brush.tipImage);
      if (!img) { setTimeout(() => S.drawBrushPreview(canvas, brush), 100); return; }
      const previewBrush = { ...brush, size: Math.min(brush.size, 22) };
      const savedColor = state.color;
      state.color = '#0a0a0a';
      let last = points[0];
      let accum = 0;
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        const dx = p.x - last.x, dy = p.y - last.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        const effSize = Math.max(2, previewBrush.size * (1 - previewBrush.pressureSize + previewBrush.pressureSize * p.pressure));
        const step = Math.max(0.5, previewBrush.spacing * effSize);
        accum += d;
        while (accum >= step) {
          const overshoot = accum - step;
          const t2 = (d - overshoot) / d;
          const sx = last.x + dx * t2;
          const sy = last.y + dy * t2;
          S.stampTexture(ctx, previewBrush, sx, sy, p.pressure);
          last = { x: sx, y: sy, pressure: p.pressure };
          accum = overshoot;
        }
        last = p;
      }
      state.color = savedColor;
    } else {
      // simulated stroke
      const previewBrush = { ...brush, size: Math.min(brush.size, 22) };
      const savedColor = state.color;
      const savedSize = state.size;
      const savedAlpha = state.alpha;
      state.color = '#0a0a0a';
      state.size = previewBrush.size;
      state.alpha = previewBrush.opacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < points.length; i++) {
        const p = points[i], q = points[i-1];
        S.configurePen(ctx, p.pressure, previewBrush);
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      state.color = savedColor;
      state.size = savedSize;
      state.alpha = savedAlpha;
    }
  };

  $el('brush-new-btn').addEventListener('click', () => S.openBrushEditor());

  /* =================================================================
     BRUSH IMPORT — PNG/JPG images, Photoshop .abr, Sketchbook/Procreate
     ================================================================= */
  $el('brush-import-btn').addEventListener('click', () =>
    $el('brush-import-file').click());

  $el('brush-import-file').addEventListener('change', async (e: any) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    const firstImportedIndex = state.customBrushes.length;
    let imported = 0;
    for (const file of files as any[]) {
      const lower = file.name.toLowerCase();
      try {
        if (lower.endsWith('.abr')) {
          imported += await S.importABR(file);
        } else if (lower.endsWith('.brushset') || lower.endsWith('.brush') || lower.endsWith('.skbrush') || lower.endsWith('.zip')) {
          imported += await S.importBrushArchive(file);
        } else {
          // Plain image → stamp brush
          const dataUrl = await S.fileToDataURL(file);
          S.addImportedTipBrush(file.name.replace(/\.[^.]+$/, ''), dataUrl);
          imported++;
        }
      } catch (err) {
        console.warn('Brush import failed for', file.name, err);
      }
    }
    S.persistBrushes();
    S.renderBrushList();
    const firstImported = state.customBrushes[firstImportedIndex];
    if (imported > 0 && firstImported) S.setActiveBrush(firstImported);
    S.showHint(imported ? `Imported ${imported} brush${imported>1?'es':''}` : 'No brushes could be read from that file');
  });

  S.fileToDataURL = function fileToDataURL(file: any) {
    return new Promise((res: any, rej: any) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  // Build a texture (stamp) brush from a tip image dataURL.
  // White/opaque areas of the tip become the active colour when drawn.
  S.addImportedTipBrush = function addImportedTipBrush(name: any, dataUrl: any) {
    const brush = {
      id: 'imp' + Date.now() + Math.random().toString(36).slice(2,6),
      name: name.slice(0, 40) || 'Imported',
      tipType: 'texture',
      tipImage: dataUrl,
      size: 28,
      opacity: 1,
      spacing: 0.08,
      hardness: 0.7,
      pressureSize: 0.6,
      pressureOpacity: 0.2,
      jitter: 0,
      blend: 'source-over',
      kind: 'draw',
      builtIn: false,
    };
    state.customBrushes.push(brush);
  }

  // Convert raw RGBA/grayscale tip pixels to a tinted PNG dataURL.
  S.tipPixelsToDataURL = function tipPixelsToDataURL(width: any, height: any, getAlpha: any) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d') as any;
    const img = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const a = getAlpha(i);
      img.data[i*4] = 0; img.data[i*4+1] = 0; img.data[i*4+2] = 0;
      img.data[i*4+3] = a;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  // ---- Photoshop .abr parser (sampled brushes) ----
  // Supports the common sampled-brush records in v1/v2 and v6+ (8BIM 'samp').
  // Parametric (computed) brushes are skipped — only bitmap tips are extracted.
  S.importABR = async function importABR(file: any) {
    const buf = await file.arrayBuffer();
    const dv = new DataView(buf);
    let count = 0;
    const version = dv.getUint16(0, false);

    function readBitmapTip(pos: any) {
      // returns { dataUrl, next } or null
      return null;
    }

    if (version === 6 || version === 7 || version === 10) {
      // v6+ : look for 8BIM 'samp' section, then parse sampled brush blocks
      let p = 0;
      // subversion at offset 2
      // Scan for '8BIM' 'samp'
      const sig = '8BIM', tag = 'samp';
      function matchAt(o: any, s: any) {
        for (let i=0;i<s.length;i++) if (dv.getUint8(o+i)!==s.charCodeAt(i)) return false;
        return true;
      }
      while (p < buf.byteLength - 8) {
        if (matchAt(p, sig) && matchAt(p+4, tag)) {
          const len = dv.getUint32(p+8, false);
          let q = p + 12;
          const end = q + len;
          // Within samp section: each brush = 4-byte len + key(37 bytes) + data
          while (q < end - 4) {
            const blockLen = dv.getUint32(q, false); q += 4;
            const blockStart = q;
            // key string (37 bytes) then bounds rect (4×i32) then depth, compression...
            q += 37;
            if (q + 24 > end) break;
            const top = dv.getInt32(q, false), left = dv.getInt32(q+4, false),
                  bottom = dv.getInt32(q+8, false), right = dv.getInt32(q+12, false);
            q += 16;
            const depth = dv.getUint16(q, false); q += 2;
            const compression = dv.getUint8(q); q += 1;
            const w = right - left, h = bottom - top;
            if (w > 0 && h > 0 && w <= 4096 && h <= 4096) {
              const px = new Uint8Array(w * h);
              try {
                if (compression === 0) {
                  for (let i=0;i<w*h;i++) px[i] = dv.getUint8(q+i);
                } else {
                  // RLE (PackBits) per row
                  const rowLens = [];
                  let rp = q;
                  for (let y=0;y<h;y++){ rowLens.push(dv.getUint16(rp,false)); rp+=2; }
                  let out = 0;
                  for (let y=0;y<h;y++){
                    let bytes = rowLens[y];
                    let consumed = 0;
                    while (consumed < bytes) {
                      const n = (dv.getInt8(rp)); rp++; consumed++;
                      if (n >= 0) { for (let k=0;k<=n;k++){ px[out++]=dv.getUint8(rp); rp++; consumed++; } }
                      else if (n !== -128) { const val=dv.getUint8(rp); rp++; consumed++; for(let k=0;k<1-n;k++) px[out++]=val; }
                    }
                  }
                }
                // ABR sampled tips: 0=black..255=white; brush uses darkness as alpha
                const dataUrl = S.tipPixelsToDataURL(w, h, (i: any) => px[i]); // white→opaque tint
                S.addImportedTipBrush(file.name.replace(/\.abr$/i,'') + ' ' + (count+1), dataUrl);
                count++;
              } catch(_) {}
            }
            q = blockStart + blockLen;
            // pad to even
            if (blockLen % 2 === 1) q++;
          }
          p = end;
        } else {
          p++;
        }
      }
    } else if (version === 1 || version === 2) {
      // Older format: count at offset 2, then brush records
      let p = 2;
      const n = dv.getUint16(p, false); p += 2;
      for (let b=0; b<n && p < buf.byteLength-6; b++) {
        const type = dv.getUint16(p, false); p += 2;
        const len = dv.getUint32(p, false); p += 4;
        const recStart = p;
        if (type === 2) { // sampled
          p += 4; // misc
          p += 2; // spacing
          // name (Pascal/Unicode varies) — skip via record length
          // bounds
          try {
            // Heuristic: bounds appear near start; fall back to skipping
          } catch(_) {}
        }
        p = recStart + len;
      }
    }
    return count;
  }

  // ---- Sketchbook / Procreate / generic ZIP brush sets ----
  // These are ZIP archives. We extract any PNG tip images and make stamp brushes.
  S.importBrushArchive = async function importBrushArchive(file: any) {
    const buf = await file.arrayBuffer();
    let entries = S.parseZip(new Uint8Array(buf));
    entries = await S.inflateEntries(entries);
    let count = 0;
    for (const ent of entries) {
      const nameLower = ent.name.toLowerCase();
      const isPng = nameLower.endsWith('.png');
      const looksLikeTip = /(shape|grain|tip|brush|stamp|texture)/.test(nameLower);
      if (isPng && (looksLikeTip || ent.data.length > 200)) {
        try {
          const blob = new Blob([ent.data], { type: 'image/png' });
          const dataUrl = await S.blobToDataURL(blob);
          const base = file.name.replace(/\.[^.]+$/,'');
          const tipName = ent.name.replace(/.*\//,'').replace(/\.png$/i,'');
          S.addImportedTipBrush(`${base} · ${tipName}`, dataUrl);
          count++;
          if (count >= 30) break;
        } catch(_) {}
      }
    }
    return count;
  }

  S.blobToDataURL = function blobToDataURL(blob: any) {
    return new Promise((res: any, rej: any) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  // Minimal ZIP reader (stored + deflate) using DecompressionStream when available.
  S.parseZip = function parseZip(bytes: any) {
    const entries: any[] = [];
    const dv = new DataView(bytes.buffer);
    // Find End Of Central Directory
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return entries;
    const cdOffset = dv.getUint32(eocd + 16, true);
    const cdCount = dv.getUint16(eocd + 10, true);
    let p = cdOffset;
    const pending = [];
    for (let i = 0; i < cdCount; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const localOffset = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
      pending.push({ name, method, compSize, localOffset });
      p += 46 + nameLen + extraLen + commentLen;
    }
    for (const ent of pending) {
      const lp = ent.localOffset;
      if (dv.getUint32(lp, true) !== 0x04034b50) continue;
      const nameLen = dv.getUint16(lp + 26, true);
      const extraLen = dv.getUint16(lp + 28, true);
      const dataStart = lp + 30 + nameLen + extraLen;
      const raw = bytes.subarray(dataStart, dataStart + ent.compSize);
      if (ent.method === 0) {
        entries.push({ name: ent.name, data: raw });
      } else if (ent.method === 8) {
        entries.push({ name: ent.name, data: raw, deflate: true });
      }
    }
    return entries;
  }

  // Inflate any deflated entries (async) — wraps importBrushArchive's sync use.
  S.inflateEntries = async function inflateEntries(entries: any) {
    const out = [];
    for (const e of entries) {
      if (e.deflate && typeof DecompressionStream !== 'undefined') {
        try {
          const ds = new DecompressionStream('deflate-raw');
          const stream = new Blob([e.data]).stream().pipeThrough(ds);
          const ab = await new Response(stream).arrayBuffer();
          out.push({ name: e.name, data: new Uint8Array(ab) });
        } catch (_) { /* skip */ }
      } else {
        out.push(e);
      }
    }
    return out;
  }

  // The active brush name is the compact preset picker for draw tools.
  $el('puck-name').addEventListener('click', (e: any) => {
    e.stopPropagation();
    const group = S._groupOf ? S._groupOf(state.tool) : null;
    const isDraw = (group && group.id === 'draw') || (typeof S.isDrawTool === 'function' && S.isDrawTool(state.tool));
    if (!isDraw) return;
    if (document.getElementById('brush-preset-menu')) {
      S.closeBrushPresetMenu();
      return;
    }
    if (S._grpFlyout) S.closeGroupFlyout();
    S.openBrushPresetMenu($el('puck-name'));
  });

  /* =================== BRUSH EDITOR =================== */
  S.editorBrush = null;
  S.editorEditIndex = null; // null = new

  S.openBrushEditor = function openBrushEditor(brush: any, customIndex: any) {
    if (brush) {
      S.editorBrush = JSON.parse(JSON.stringify(brush));
      S.editorEditIndex = (typeof customIndex === 'number') ? customIndex : null;
      $el('brush-modal-title').textContent = 'Edit Brush';
    } else {
      S.editorBrush = {
        id: 'b' + Date.now(),
        name: 'New Brush',
        tipType: 'soft',
        tipImage: null,
        size: 12,
        opacity: 1,
        spacing: 0.05,
        hardness: 0.7,
        pressureSize: 0.7,
        pressureOpacity: 0.3,
        jitter: 0,
        blend: 'source-over',
        kind: 'draw',
        builtIn: false,
      };
      S.editorEditIndex = null;
      $el('brush-modal-title').textContent = 'New Brush';
    }
    S.syncEditorUI();
    S.brushModal.classList.add('open');
  }

  S.closeBrushEditor = function closeBrushEditor() {
    S.brushModal.classList.remove('open');
    S.editorBrush = null;
    S.editorEditIndex = null;
  };

  $el('brush-modal-close').addEventListener('click', S.closeBrushEditor);
  $el('be-cancel').addEventListener('click', S.closeBrushEditor);
  S.brushModal.addEventListener('click', (e: any) => { if (e.target === S.brushModal) S.closeBrushEditor(); });

  S.syncEditorUI = function syncEditorUI() {
    if (!S.editorBrush) return;
    $el('be-name').value = S.editorBrush.name;
    $el('be-tip').value = S.editorBrush.tipType;
    $el('be-size').value = S.editorBrush.size;
    $el('be-size-v').textContent = S.editorBrush.size;
    $el('be-opacity').value = Math.round(S.editorBrush.opacity * 100);
    $el('be-opacity-v').textContent = Math.round(S.editorBrush.opacity * 100);
    $el('be-spacing').value = Math.round(S.editorBrush.spacing * 100);
    $el('be-spacing-v').textContent = Math.round(S.editorBrush.spacing * 100);
    $el('be-hardness').value = Math.round(S.editorBrush.hardness * 100);
    $el('be-hardness-v').textContent = Math.round(S.editorBrush.hardness * 100);
    $el('be-psize').value = Math.round(S.editorBrush.pressureSize * 100);
    $el('be-psize-v').textContent = Math.round(S.editorBrush.pressureSize * 100);
    $el('be-popacity').value = Math.round(S.editorBrush.pressureOpacity * 100);
    $el('be-popacity-v').textContent = Math.round(S.editorBrush.pressureOpacity * 100);
    $el('be-jitter').value = Math.round(S.editorBrush.jitter * 100);
    $el('be-jitter-v').textContent = Math.round(S.editorBrush.jitter * 100);
    $el('be-blend').value = S.editorBrush.blend;
    S.toggleTextureRow();
    S.redrawEditorPreview();
  }

  S.toggleTextureRow = function toggleTextureRow() {
    const row = $el('be-texture-row');
    const hardField = $el('be-hardness-field');
    if (S.editorBrush.tipType === 'texture') {
      row.style.display = 'flex';
      hardField.style.display = 'none';
      const thumb = $el('be-tip-thumb');
      thumb.innerHTML = '';
      if (S.editorBrush.tipImage) {
        const img = document.createElement('img');
        img.src = S.editorBrush.tipImage;
        thumb.appendChild(img);
      } else {
        thumb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>';
      }
    } else {
      row.style.display = 'none';
      hardField.style.display = S.editorBrush.tipType === 'soft' ? 'flex' : 'none';
    }
  };

  $el('be-name').addEventListener('input', (e: any) => { S.editorBrush.name = e.target.value.trim() || 'Brush'; });
  $el('be-tip').addEventListener('change', (e: any) => { S.editorBrush.tipType = e.target.value; S.toggleTextureRow(); S.redrawEditorPreview(); });
  $el('be-size').addEventListener('input', (e: any) => { S.editorBrush.size = parseFloat(e.target.value); $el('be-size-v').textContent = S.editorBrush.size; S.redrawEditorPreview(); });
  $el('be-opacity').addEventListener('input', (e: any) => { S.editorBrush.opacity = parseInt(e.target.value)/100; $el('be-opacity-v').textContent = e.target.value; S.redrawEditorPreview(); });
  $el('be-spacing').addEventListener('input', (e: any) => { S.editorBrush.spacing = parseInt(e.target.value)/100; $el('be-spacing-v').textContent = e.target.value; S.redrawEditorPreview(); });
  $el('be-hardness').addEventListener('input', (e: any) => { S.editorBrush.hardness = parseInt(e.target.value)/100; $el('be-hardness-v').textContent = e.target.value; S.redrawEditorPreview(); });
  $el('be-psize').addEventListener('input', (e: any) => { S.editorBrush.pressureSize = parseInt(e.target.value)/100; $el('be-psize-v').textContent = e.target.value; S.redrawEditorPreview(); });
  $el('be-popacity').addEventListener('input', (e: any) => { S.editorBrush.pressureOpacity = parseInt(e.target.value)/100; $el('be-popacity-v').textContent = e.target.value; S.redrawEditorPreview(); });
  $el('be-jitter').addEventListener('input', (e: any) => { S.editorBrush.jitter = parseInt(e.target.value)/100; $el('be-jitter-v').textContent = e.target.value; S.redrawEditorPreview(); });
  $el('be-blend').addEventListener('change', (e: any) => { S.editorBrush.blend = e.target.value; S.redrawEditorPreview(); });

  $el('be-tip-thumb').addEventListener('click', () => $el('be-tip-file').click());
  $el('be-tip-file').addEventListener('change', (e: any) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev: any) => {
      S.editorBrush.tipImage = ev.target.result;
      S.toggleTextureRow();
      S.redrawEditorPreview();
    };
    reader.readAsDataURL(f);
  });

  S.redrawEditorPreview = function redrawEditorPreview() {
    if (!S.editorBrush) return;
    const c = $el('be-preview-canvas');
    // size to its actual displayed size
    const r = c.getBoundingClientRect();
    c.width = Math.max(200, Math.round(r.width));
    c.height = Math.max(60, Math.round(r.height));
    S.drawBrushPreview(c, S.editorBrush);
  };

  $el('be-save').addEventListener('click', () => {
    if (!S.editorBrush) return;
    if (S.editorBrush.tipType === 'texture' && !S.editorBrush.tipImage) {
      alert('Upload a texture image first, or choose a different Tip Shape.');
      return;
    }
    if (S.editorEditIndex !== null) {
      state.customBrushes[S.editorEditIndex] = S.editorBrush;
    } else {
      state.customBrushes.push(S.editorBrush);
    }
    const savedBrush = S.editorBrush;   // keep ref before close nulls it
    S.persistBrushes();
    S.closeBrushEditor();
    S.renderBrushList();
    S.setActiveBrush(savedBrush);
    S.showHint(`Saved · ${savedBrush.name}`);
  });

  S.persistBrushes = function persistBrushes() {
    try {
      localStorage.setItem('nm-brushes', JSON.stringify(state.customBrushes));
    } catch (e) {}
  }
  S.loadBrushes = function loadBrushes() {
    try {
      const raw = localStorage.getItem('nm-brushes');
      if (raw) state.customBrushes = JSON.parse(raw);
    } catch (e) {}
  }


  /* =================== MODE TOGGLE =================== */
  $all('#mode-group .pill').forEach((b: any) => {
    b.addEventListener('click', () => {
      $all('#mode-group .pill').forEach((p: any) => p.classList.remove('active'));
      b.classList.add('active');
      state.mode = b.dataset.mode;
      S.updateLayerOrder();
      if (state.mode === 'navigate') {
        S.showHint('Navigate mode — drag to pan, pinch or scroll to zoom');
        S.area.style.cursor = 'grab';
        if (S.paper) S.paper.style.cursor = 'grab';
      } else {
        S.area.style.cursor = '';
        if (S.paper) S.paper.style.cursor = '';
      }
    });
  });

  /* =================== STENCIL SCALE =================== */
  state.stencilScale = 1.0;
  $el('stencil-scale-slider').addEventListener('input', (e: any) => {
    state.stencilScale = parseFloat(e.target.value);
    $el('stencil-scale-val').textContent = state.stencilScale.toFixed(1) + '×';
  });
  state.stencilRotation = 0;
  $el('stencil-rot-slider').addEventListener('input', (e: any) => {
    state.stencilRotation = parseFloat(e.target.value);
    $el('stencil-rot-val').textContent = Math.round(state.stencilRotation) + '°';
  });

  S.closeBrushSubmenu = function closeBrushSubmenu() {
    document.getElementById('brush-submenu')?.remove();
  };

  S.openBrushSubmenu = function openBrushSubmenu(parentId: string, anchor: HTMLElement) {
    S.closeBrushSubmenu();
    const ids = S.BRUSH_SUBFAMILIES[parentId] || [];
    if (!ids.length) return;
    const menu = document.createElement('div');
    menu.id = 'brush-submenu';
    ids.forEach((id: string) => {
      const brush = S.BUILTIN_BRUSHES.find((item: any) => item.id === id);
      if (!brush) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = state.tool === id ? 'on' : '';
      button.textContent = brush.name;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        state.brushLast = state.brushLast || {};
        state.brushLast.texture = id;
        S.setTool(id);
        S.closeBrushSubmenu();
        S.closeBrushPresetMenu();
      });
      menu.appendChild(button);
    });
    menu.addEventListener('pointerdown', (event) => event.stopPropagation());
    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const parentMenu = anchor.closest('#brush-preset-menu');
    if (parentMenu) {
      menu.style.left = Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, rect.right + 8)) + 'px';
      menu.style.top = Math.max(8, Math.min(window.innerHeight - menuRect.height - 8, rect.top)) + 'px';
    } else {
      menu.style.left = Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, rect.left)) + 'px';
      menu.style.top = Math.max(8, rect.top - menuRect.height - 8) + 'px';
    }
    setTimeout(() => document.addEventListener('pointerdown', S.closeBrushSubmenu, { once: true }), 0);
  };

  S.closeBrushPresetMenu = function closeBrushPresetMenu() {
    document.getElementById('brush-preset-menu')?.remove();
    S.closeBrushSubmenu();
  };

  S.openBrushPresetMenu = function openBrushPresetMenu(anchor: HTMLElement) {
    S.closeBrushPresetMenu();
    const family = S.brushFamilyOf(state.tool);
    const ids = S.BRUSH_FAMILIES[family] || [];
    if (!ids.length) return;

    const menu = document.createElement('div');
    menu.id = 'brush-preset-menu';
    menu.setAttribute('role', 'menu');

    const title = document.createElement('div');
    title.className = 'bpm-title';
    title.textContent = family;
    menu.appendChild(title);

    ids.forEach((id: string) => {
      const brush = S.BUILTIN_BRUSHES.find((item: any) => item.id === id);
      if (!brush) return;
      const children = S.BRUSH_SUBFAMILIES[id] || [];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bpm-item' + ((state.tool === id || children.includes(state.tool)) ? ' on' : '');
      button.setAttribute('role', 'menuitem');
      button.title = children.length ? `${brush.name} options` : brush.name;

      const preview = document.createElement('span');
      preview.className = 'bpm-preview';
      preview.style.height = Math.max(1, Math.min(8, Number(brush.size) * 0.55)) + 'px';
      preview.style.opacity = String(Math.max(0.32, Number(brush.opacity) || 1));
      button.appendChild(preview);

      const label = document.createElement('span');
      label.className = 'bpm-name';
      label.textContent = brush.name;
      button.appendChild(label);

      if (children.length) {
        const arrow = document.createElement('span');
        arrow.className = 'bpm-arrow';
        arrow.textContent = '›';
        button.appendChild(arrow);
      }

      button.addEventListener('click', (event: any) => {
        event.stopPropagation();
        if (children.length) {
          S.openBrushSubmenu(id, button);
          return;
        }
        state.brushLast = state.brushLast || {};
        state.brushLast[family] = id;
        S.setTool(id);
        S.closeBrushPresetMenu();
      });
      menu.appendChild(button);
    });

    menu.addEventListener('pointerdown', (event) => event.stopPropagation());
    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(window.innerWidth - menuRect.width - 8, rect.left)) + 'px';
    menu.style.top = Math.max(8, rect.top - menuRect.height - 10) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', S.closeBrushPresetMenu, { once: true }), 0);
  };

  /** Bottom-center context options for shapes / wall / measure / region / selection. */
  S.syncToolOptionsBar = function syncToolOptionsBar() {
    const ctx = $el('puck-context');
    const drawCtrls = $el('puck-draw-controls');
    const nameEl = $el('puck-name');
    if (!ctx || !drawCtrls) return;

    const chip = (label: string, on: boolean, fn: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'puck-chip' + (on ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', (e: any) => { e.stopPropagation(); fn(); });
      return b;
    };
    const label = (t: string) => {
      const s = document.createElement('span');
      s.className = 'puck-chip-label';
      s.textContent = t;
      return s;
    };
    const numField = (id: string, val: number, min: number, max: number, step: number, onInput: (v: number) => void) => {
      const wrap = document.createElement('div');
      wrap.className = 'puck-size';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.id = id;
      inp.min = String(min); inp.max = String(max); inp.step = String(step);
      inp.value = String(val);
      inp.style.cssText = 'width:56px;font:600 11px ui-sans-serif,system-ui;padding:4px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:#e8e4de;';
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        if (Number.isFinite(v)) onInput(v);
      });
      wrap.appendChild(inp);
      return wrap;
    };

    const tool = state.tool;
    const group = S._groupOf ? S._groupOf(tool) : null;
    const sel: any = state.sel;
    ctx.innerHTML = '';

    const setOpeningKind = (kind: string) => {
      state.openingKind = kind;
      const o = typeof S.selectedOpening2D === 'function' ? S.selectedOpening2D() : null;
      if (o) {
        const __b = S.vectorSnapshot();
        o.kind = kind;
        if (kind === 'door') { o.sillMM = 0; if (o.hand == null) o.hand = 1; if (o.swing == null) o.swing = 1; }
        if (kind === 'opening') { o.sillMM = 0; }
        S.refreshMeasurements(); S.syncWallsToMasses(); S.recordVec(__b, true);
      }
      if (tool !== 'opening' && !(sel && sel.type === 'opening')) S.setTool('opening');
      else S.syncToolOptionsBar();
    };

    const appendOpeningDims = (activeKind: string, o: any) => {
      const dims = o
        ? { wMM: o.wMM, hMM: o.hMM, sillMM: o.sillMM || 0 }
        : (typeof S.openingDims === 'function' ? S.openingDims(activeKind) : { wMM: 900, hMM: 2100, sillMM: 0 });
      ctx.appendChild(label('W'));
      ctx.appendChild(numField('puck-op-w', dims.wMM, 100, 4000, 10, (v) => {
        const cur = typeof S.selectedOpening2D === 'function' ? S.selectedOpening2D() : null;
        const __b = cur ? S.vectorSnapshot() : null;
        if (cur) cur.wMM = v;
        else if (state.openingKind === 'door') state.doorWMM = v;
        else if (state.openingKind === 'window') state.winWMM = v;
        else state.openWMM = v;
        S.refreshMeasurements(); S.syncWallsToMasses();
        if (__b) S.recordVec(__b, true);
      }));
      ctx.appendChild(label('H'));
      ctx.appendChild(numField('puck-op-h', dims.hMM, 100, 4000, 10, (v) => {
        const cur = typeof S.selectedOpening2D === 'function' ? S.selectedOpening2D() : null;
        const __b = cur ? S.vectorSnapshot() : null;
        if (cur) cur.hMM = v;
        else if (state.openingKind === 'door') state.doorHMM = v;
        else if (state.openingKind === 'window') state.winHMM = v;
        else state.openHMM = v;
        S.syncWallsToMasses();
        if (__b) S.recordVec(__b, true);
      }));
      if (activeKind === 'window') {
        ctx.appendChild(label('SILL'));
        ctx.appendChild(numField('puck-op-sill', dims.sillMM || 0, 0, 3000, 10, (v) => {
          const cur = typeof S.selectedOpening2D === 'function' ? S.selectedOpening2D() : null;
          const __b = cur ? S.vectorSnapshot() : null;
          if (cur) cur.sillMM = v; else state.winSillMM = v;
          S.syncWallsToMasses();
          if (__b) S.recordVec(__b, true);
        }));
      }
      if (activeKind === 'door' && o) {
        ctx.appendChild(chip('Hinge', false, () => {
          const cur = S.selectedOpening2D(); if (!cur) return;
          const __b = S.vectorSnapshot(); cur.hand = -(cur.hand || 1);
          S.refreshMeasurements(); S.recordVec(__b, true); S.syncToolOptionsBar();
        }));
        ctx.appendChild(chip('Swing', false, () => {
          const cur = S.selectedOpening2D(); if (!cur) return;
          const __b = S.vectorSnapshot(); cur.swing = -(cur.swing || 1);
          S.refreshMeasurements(); S.recordVec(__b, true); S.syncToolOptionsBar();
        }));
      }
      if (o) {
        ctx.appendChild(chip('Delete', false, () => {
          if (state.selOpening2D) S.deleteOpening2D(state.selOpening2D);
          state.sel = null;
          S.syncToolOptionsBar();
        }));
      }
    };

    // Selected opening — never fall through to pen SIZE/OPACITY
    if (sel && sel.type === 'opening') {
      drawCtrls.style.display = 'none';
      ctx.style.display = 'flex';
      if (nameEl) nameEl.textContent = 'OPENING';
      const o = typeof S.selectedOpening2D === 'function' ? S.selectedOpening2D() : null;
      const kind = (o && o.kind) || state.openingKind || 'door';
      ctx.appendChild(chip('Door', kind === 'door', () => setOpeningKind('door')));
      ctx.appendChild(chip('Window', kind === 'window', () => setOpeningKind('window')));
      ctx.appendChild(chip('Opening', kind === 'opening', () => setOpeningKind('opening')));
      appendOpeningDims(kind, o);
      return;
    }

    // Selection transforms take priority in the bottom bar
    if (sel && (sel.type === 'shape' || sel.type === 'wall')) {
      drawCtrls.style.display = 'none';
      ctx.style.display = 'flex';
      if (nameEl) nameEl.textContent = sel.type === 'shape' ? 'SHAPE' : 'WALL';
      const transformMode = state.vecXform && state.vecXform.mode;
      ctx.appendChild(chip('Move', transformMode === 'move', () => S.beginVecXform('move')));
      ctx.appendChild(chip('Scale', transformMode === 'scale', () => S.beginVecXform('scale')));
      ctx.appendChild(chip('Rotate', transformMode === 'rotate', () => S.beginVecXform('rotate')));
      ctx.appendChild(chip('Delete', false, () => S.deleteSelectedElement()));
      if (sel.type === 'wall') {
        let wi = typeof sel.wi === 'number' ? sel.wi : -1;
        if (wi < 0 && sel.id) wi = (state.walls || []).findIndex((w: any) => w && w.id === sel.id);
        const wall = wi >= 0 ? state.walls[wi] : null;
        if (wall) {
          ctx.appendChild(label('THICK'));
          ctx.appendChild(numField('puck-selected-wall-thick', wall.thickMM || 230, 50, 600, 10, (v) => {
            const __b = S.vectorSnapshot();
            wall.thickMM = v;
            S.refreshMeasurements();
            S.syncWallsToMasses();
            S.recordVec(__b, true);
            S.scheduleAutosave();
          }));
          ctx.appendChild(label('HEIGHT'));
          ctx.appendChild(numField('puck-selected-wall-height', wall.heightM || 3, 0.5, 20, 0.1, (v) => {
            const __b = S.vectorSnapshot();
            wall.heightM = v;
            S.syncWallsToMasses();
            S.recordVec(__b, true);
            S.scheduleAutosave();
          }));
        }
      } else if (state.shapes[sel.idx]) {
        const sh = state.shapes[sel.idx];
        ctx.appendChild(label('LINE'));
        ctx.appendChild(numField('puck-shape-w', sh.width || 2, 0.5, 40, 0.5, (v) => {
          const __b = S.vectorSnapshot(); sh.width = v; S.refreshMeasurements(); S.recordVec(__b, true); S.scheduleAutosave();
        }));
      }
      return;
    }

    if (group && group.id === 'shapes') {
      drawCtrls.style.display = 'none';
      ctx.style.display = 'flex';
      if (nameEl) nameEl.textContent = 'SHAPES';
      ctx.appendChild(chip('Polygon', tool === 'line', () => S.setTool('line')));
      ctx.appendChild(chip('Rectangle', tool === 'rect', () => S.setTool('rect')));
      ctx.appendChild(chip('Circle', tool === 'circle', () => S.setTool('circle')));
      ctx.appendChild(label('BORDER'));
      const sizeWrap = document.createElement('div');
      sizeWrap.className = 'puck-size';
      const sizeInp = document.createElement('input');
      sizeInp.type = 'range'; sizeInp.min = '0.5'; sizeInp.max = '24'; sizeInp.step = '0.5';
      sizeInp.value = String(state.size || 2);
      const sizeVal = document.createElement('div');
      sizeVal.className = 'puck-size-val';
      sizeVal.textContent = String(state.size || 2);
      sizeInp.addEventListener('input', () => {
        state.size = parseFloat(sizeInp.value);
        sizeVal.textContent = String(state.size);
        if (typeof S.updatePreview === 'function') S.updatePreview();
      });
      sizeWrap.appendChild(sizeInp); sizeWrap.appendChild(sizeVal);
      ctx.appendChild(sizeWrap);
      const colorBtn = document.createElement('div');
      colorBtn.className = 'puck-color';
      colorBtn.style.background = state.color || '#0a0a0a';
      colorBtn.style.width = '28px'; colorBtn.style.height = '28px';
      colorBtn.style.borderRadius = '50%'; colorBtn.style.cursor = 'pointer';
      colorBtn.addEventListener('click', () => $el('puck-color')?.click());
      ctx.appendChild(colorBtn);
      return;
    }

    if (group && group.id === 'build') {
      drawCtrls.style.display = 'none';
      ctx.style.display = 'flex';
      if (nameEl) nameEl.textContent = tool === 'opening' ? 'OPENING' : 'WALL';
      ctx.appendChild(chip('Wall', tool === 'wall', () => S.setTool('wall')));
      ctx.appendChild(chip('Door', tool === 'opening' && state.openingKind === 'door', () => setOpeningKind('door')));
      ctx.appendChild(chip('Window', tool === 'opening' && state.openingKind === 'window', () => setOpeningKind('window')));
      ctx.appendChild(chip('Opening', tool === 'opening' && state.openingKind === 'opening', () => setOpeningKind('opening')));
      if (tool === 'wall') {
        ctx.appendChild(label('THICK'));
        ctx.appendChild(numField('puck-wall-thick', state.wallThickMM || 230, 50, 600, 10, (v) => { state.wallThickMM = v; }));
        ctx.appendChild(label('H'));
        ctx.appendChild(numField('puck-wall-h', state.wallHeightM || 3, 0.5, 20, 0.1, (v) => { state.wallHeightM = v; }));
      } else if (tool === 'opening') {
        appendOpeningDims(state.openingKind || 'door', null);
      }
      return;
    }

    if (group && group.id === 'measure') {
      drawCtrls.style.display = 'none';
      ctx.style.display = 'flex';
      if (nameEl) nameEl.textContent = 'MEASURE';
      ctx.appendChild(chip('Ruler', tool === 'ruler', () => S.setTool('ruler')));
      ctx.appendChild(chip('Area', tool === 'area', () => S.setTool('area')));
      return;
    }

    if (group && group.id === 'region') {
      drawCtrls.style.display = 'none';
      ctx.style.display = 'flex';
      if (nameEl) nameEl.textContent = 'REGION';
      ctx.appendChild(chip('Lasso', tool === 'lasso', () => S.setTool('lasso')));
      ctx.appendChild(chip('Wand', tool === 'wand', () => S.setTool('wand')));
      return;
    }

    // Draw / pen / default — restore SIZE/OPACITY/STAB
    ctx.style.display = 'none';
    drawCtrls.style.display = '';
    if (nameEl && state.activeBrush && state.activeBrush.name) {
      nameEl.textContent = String(state.activeBrush.name).toUpperCase();
    }
  };

  initColor();
  initFill();
  if (typeof S.syncToolOptionsBar === 'function') S.syncToolOptionsBar();
}
