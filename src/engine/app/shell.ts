/* Auto-converted from public/engine/app/10-shell.js — shared scope S */
import { S } from "./scope";

export function initShell() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);


  /* =================================================================
     KEYBOARD: add area tool + Escape to cancel polygon
     ================================================================= */

  /* =================== KEYBOARD =================== */
  window.addEventListener('keydown', (e: any) => {
    if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
    if (e.key === 'Escape' && typeof S.hideShapeChip === 'function') S.hideShapeChip();
    if (e.key === 'Escape' && state.vecXform) {
      S.cancelVecXform();
      S.showHint('Transform cancelled');
      return;
    }
    if (e.key === 'Escape' && state.polyActive) {
      state.polyPoints = [];
      state.polyActive = false;
      $el('poly-hint').style.display = 'none';
      S.refreshMeasurements();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? S.redo() : S.undo(); }
    else if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); S.redo(); }
    else if (e.key === 'p') S.setTool('pen');
    else if (e.key === 'm') S.setTool('marker');
    else if (e.key === 'b') S.setTool('brush');
    else if (e.key === 'w') S.setTool('watercolour');
    else if (e.key === 'l') S.setTool('pencil');
    else if (e.key === 'e') S.setTool('eraser');
    else if (e.key === 'r') S.setTool('ruler');
    else if (e.key === 'a') S.setTool('area');
    else if (e.key === 's') S.setTool('stencil');
    else if (e.key === 'h') S.setTool('hand');
    else if (e.key === 'i') S.setTool('brushes');
    else if (e.key === 'k') S.setTool('wall');
    else if (e.key === 'j') S.setTool('opening');
    else if (e.key === 'x') S.setTool('wand');
    else if (e.key === 'o') S.setTool('lasso');
    else if (e.key === 'f') S.setTool('fill');
    else if (e.key === 'g') $el('btn-grid').click();
    else if (e.key === '+' || e.key === '=') S.handleZoomIn();
    else if (e.key === '-') S.handleZoomOut();
    else if (e.key === '0') S.handleZoomFit();
  });

  /* =================================================================
     BRUSH CURSOR RING — live circle at stylus tip showing brush size
     ================================================================= */
  S.brushCursor = $el('brush-cursor');

  S.updateBrushCursor = function updateBrushCursor(e: any, brush: any) {
    if (!S.brushCursor) return;
    // Position in CSS pixels relative to canvas-area
    const areaRect = S.area.getBoundingClientRect();
    const cx = e.clientX - areaRect.left;
    const cy = e.clientY - areaRect.top;
    S.brushCursor.style.left = cx + 'px';
    S.brushCursor.style.top = cy + 'px';

    // Size in screen pixels = brush size in doc px × display scale
    const docToScreen = S.paper.getBoundingClientRect().width / S.doc.wPx;
    const pr = S.pressureFor(e);
    const b = brush || S.activeBrush();
    const effSize = Math.max(1, state.size * (1 - b.pressureSize + b.pressureSize * pr));
    const screenSize = Math.max(4, effSize * docToScreen * 2); // diameter
    S.brushCursor.style.width = screenSize + 'px';
    S.brushCursor.style.height = screenSize + 'px';
    S.brushCursor.style.borderColor = b.kind === 'erase'
      ? 'rgba(160,40,53,0.7)'
      : 'rgba(0,0,0,0.65)';
  }

  // Update cursor position on all pen moves, even when not drawing
  S.area.addEventListener('pointermove', (e: any) => {
    if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;
    const b = S.activeBrush();
    if (S.isDrawTool(state.tool)) {
      S.brushCursor.style.display = 'block';
      S.updateBrushCursor(e, b);
    } else {
      S.brushCursor.style.display = 'none';
    }
  }, { passive: true });

  S.area.addEventListener('pointerleave', () => {
    S.brushCursor.style.display = 'none';
  });

  /* =================================================================
     CANVAS ROTATION — two-finger twist gesture
     ================================================================= */
  state.canvasRotation = 0; // degrees
  S._rotateStart = null;

  S.applyCanvasRotation = function applyCanvasRotation() {
    const r = state.canvasRotation;
    S.paper.style.transform = `translate(-50%, -50%) scale(${state.zoom * state.baseZoom}) rotate(${r}deg)`;
    const badge = $el('rotation-badge');
    if (r === 0) {
      badge.classList.remove('show');
    } else {
      badge.textContent = `${Math.round(r)}°`;
      badge.classList.add('show');
    }
  }

  // Override applyStageTransform to include rotation
  S._origApplyStageTransform = S.applyStageTransform;
  S.applyStageTransform = function applyStageTransform() {
    S.stage.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
    S.paper.style.transform = `translate(-50%, -50%) scale(${state.zoom * state.baseZoom}) rotate(${state.canvasRotation}deg)`;
    $el('zoom-level').textContent = Math.round(state.zoom * 100) + '%';
    S.refreshMeasurements();
  }

  // Detect rotation gesture: track angle between two touches
  S.area.addEventListener('touchstart', (e: any) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0], t2 = e.touches[1];
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
      S._rotateStart = { angle, rotation: state.canvasRotation };
    }
  }, { passive: true });

  S.area.addEventListener('touchmove', (e: any) => {
    if (e.touches.length === 2 && S._rotateStart !== null) {
      const t1 = e.touches[0], t2 = e.touches[1];
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
      const delta = angle - S._rotateStart.angle;
      state.canvasRotation = S._rotateStart.rotation + delta;
      S.applyCanvasRotation();
    }
  }, { passive: true });

  S.area.addEventListener('touchend', () => {
    // Snap to 0° if within 8° — prevents accidental rotation
    if (Math.abs(state.canvasRotation) < 8) {
      state.canvasRotation = 0;
      S.applyCanvasRotation();
    }
    S._rotateStart = null;
  });

  // Double-tap the rotation badge to reset to 0°
  $el('rotation-badge').addEventListener('click', () => {
    state.canvasRotation = 0;
    S.applyCanvasRotation();
    S.showHint('Canvas rotation reset to 0°');
  });

  /* =================================================================
     DRAGGABLE PUCK
     ================================================================= */
  (function initDraggablePuck() {
    const puck = $el('puck');
    const handle = $el('puck-drag-handle');
    if (!handle || !puck) return;

    let dragging = false, ox = 0, oy = 0;

    handle.addEventListener('pointerdown', (e: any) => {
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      dragging = true;
      const pr = puck.getBoundingClientRect();
      const ar = S.area.getBoundingClientRect();
      ox = e.clientX - pr.left;
      oy = e.clientY - pr.top;
      puck.style.transition = 'none';
      puck.style.bottom = 'unset';
      puck.style.left = (pr.left - ar.left) + 'px';
      puck.style.top  = (pr.top  - ar.top)  + 'px';
      puck.style.transform = 'none';
    });

    handle.addEventListener('pointermove', (e: any) => {
      if (!dragging) return;
      const ar = S.area.getBoundingClientRect();
      const newLeft = Math.max(0, Math.min(ar.width  - puck.offsetWidth,  e.clientX - ar.left - ox));
      const newTop  = Math.max(0, Math.min(ar.height - puck.offsetHeight, e.clientY - ar.top  - oy));
      puck.style.left = newLeft + 'px';
      puck.style.top  = newTop  + 'px';
    });

    handle.addEventListener('pointerup', () => { dragging = false; });
  })();

  /* =================================================================
     FULL-SCREEN MODE
     ================================================================= */
  $el('btn-fullscreen').addEventListener('click', () => {
    const isFS = document.body.classList.toggle('nm-fullscreen');
    $el('btn-fullscreen').classList.toggle('active', isFS);
    $el('fs-exit').style.display = isFS ? 'block' : 'none';
    const refit = () => {
      S.fitToScreen();
      if (typeof S.massing !== 'undefined' && S.massing.active && typeof S.renderMassing === 'function') {
        S.renderMassing();
      }
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(refit);
    });
    setTimeout(refit, 50);
    setTimeout(refit, 100);
    setTimeout(refit, 200);
    S.showHint(isFS ? 'Full-screen mode · Esc or click ⤡ to exit' : 'Exited full-screen');
  });

  // Keep canvas fitted when the viewport / canvas-area size changes
  (function bindCanvasAreaResize() {
    let resizeTimer: any = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        S.fitToScreen();
        if (typeof S.massing !== 'undefined' && S.massing.active && typeof S.renderMassing === 'function') {
          S.renderMassing();
        }
      }, 50);
    };
    if (typeof ResizeObserver !== 'undefined' && S.area) {
      const ro = new ResizeObserver(onResize);
      ro.observe(S.area);
    }
    window.addEventListener('resize', onResize);
  })();

  $el('fs-exit').addEventListener('click', () => {
    $el('btn-fullscreen').click();
  });

  window.addEventListener('keydown', (e: any) => {
    if ((e.key === 'F11' || (e.key === 'Escape' && document.body.classList.contains('nm-fullscreen'))) &&
        e.target.tagName !== 'INPUT') {
      e.preventDefault();
      $el('btn-fullscreen').click();
    }
  }, true);

  /* =================================================================
     OVERFLOW PANEL — secondary tools
     ================================================================= */
  S.overflowPanel = $el('overflow-panel');

  $el('btn-overflow').addEventListener('click', (e: any) => {
    e.stopPropagation();
    S.overflowPanel.classList.toggle('show');
  });

  // Wire overflow buttons to hidden originals
  $el('ovf-guide').addEventListener('click', (e: any) => {
    e.stopPropagation();
    if (S.guidePopover.classList.contains('show')) S.guidePopover.classList.remove('show');
    else S.guidePopover.classList.add('show');
    S.overflowPanel.classList.remove('show');
  });
  $el('ovf-canvas-size').addEventListener('click', () => {
    S.openCanvasSize();
    S.overflowPanel.classList.remove('show');
  });
  $el('ovf-fullscreen').addEventListener('click', () => {
    $el('btn-fullscreen').click();
    S.overflowPanel.classList.remove('show');
  });
  $el('ovf-scale').addEventListener('click', () => {
    $el('btn-scale').click();
    S.overflowPanel.classList.remove('show');
  });
  $el('ovf-measures').addEventListener('click', () => {
    $el('btn-measures').click();
    S.syncOverflowStates();
  });
  $el('ovf-chain').addEventListener('click', () => {
    S.toggleDimChain();
    S.syncOverflowStates();
  });
  $el('ovf-clear-dim').addEventListener('click', () => {
    $el('btn-clear-measures').click();
    S.overflowPanel.classList.remove('show');
  });
  $el('ovf-import').addEventListener('click', () => {
    $el('btn-import-image').click();
    S.overflowPanel.classList.remove('show');
  });

  S.syncOverflowStates = function syncOverflowStates() {
    const chainBtn = $el('ovf-chain');
    chainBtn.classList.toggle('active-state', state.dimChainMode);
    const measBtn = $el('ovf-measures');
    measBtn.classList.toggle('active-state', state.showMeasurements);
    const gridBtn = $el('ovf-grid');
    gridBtn.classList.toggle('active-state', state.showGrid);
  }

  // Close overflow on outside click
  document.addEventListener('click', () => S.overflowPanel.classList.remove('show'));
  S.overflowPanel.addEventListener('click', (e: any) => e.stopPropagation());

  /* =================================================================
     LAYERS SLIDE-OUT PANEL
     ================================================================= */
  S.layersPanel = $el('layers-panel');
  S.layersTab = $el('layers-tab');

  S.layersTab.addEventListener('click', () => {
    const isOpen = S.layersPanel.classList.toggle('open');
    S.layersTab.style.transition = 'right 0.24s cubic-bezier(0.4,0,0.2,1)';
    S.layersTab.style.right = isOpen ? '280px' : '0';
  });

  // Close layers panel on canvas click
  $el('canvas-area').addEventListener('pointerdown', () => {
    if (S.layersPanel.classList.contains('open') && window.innerWidth < 900) {
      S.layersPanel.classList.remove('open');
    }
  }, { passive: true });


}
