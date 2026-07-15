/* Measure + scale — shared scope S */
import { S } from "./scope";

export function initMeasure() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);

  /* =================== MEASUREMENTS =================== */
  S.refreshMeasurements = function refreshMeasurements() {
    S.rulerOverlay.innerHTML = '';
    S.rulerOverlay.setAttribute('viewBox', `0 0 ${S.doc.wPx} ${S.doc.hPx}`);
    S.renderWalls2D();
    S.renderShapes2D();
    if (state.tool === 'offset' && state.offset) { const ov = S.computeOffsetPreview(); if (ov) S.drawOffsetPreview(ov); }
    if (state.showMeasurements) {
      state.measurements.forEach((m: any, i: any) => S.addMeasureSVG(m, false, i));
    }
    if (state.measurePreview) S.addMeasureSVG(state.measurePreview, true);

    // Draw chain anchor — visible pulsing dot at the chain end point
    if (state.dimChainMode && state.dimChainEnd && state.tool === 'ruler') {
      const svgns = 'http://www.w3.org/2000/svg';
      const { x, y } = state.dimChainEnd;
      const ring = document.createElementNS(svgns, 'circle');
      ring.setAttribute('cx', String(x)); ring.setAttribute('cy', String(y)); ring.setAttribute('r', '22');
      ring.setAttribute('fill', 'rgba(160,40,53,0.12)');
      ring.setAttribute('stroke', '#a02835'); ring.setAttribute('stroke-width', '3');
      ring.setAttribute('stroke-dasharray', '6 4');
      ring.setAttribute('pointer-events', 'none');
      S.rulerOverlay.appendChild(ring);
      const dot = document.createElementNS(svgns, 'circle');
      dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y)); dot.setAttribute('r', '8');
      dot.setAttribute('fill', '#a02835');
      dot.setAttribute('pointer-events', 'none');
      S.rulerOverlay.appendChild(dot);
    }
  }

  // addMeasureSVG is defined later as a thin wrapper over addDimSVG (architectural dim renderer)

  S.measureDeleteAt = function measureDeleteAt(clientX: any, clientY: any) {
    if (!state.showMeasurements || !state.measurements.length) return false;
    const hit: any = document.elementFromPoint(clientX, clientY);
    if (!hit || !S.rulerOverlay.contains(hit)) return false;
    const raw = hit.dataset ? hit.dataset.measureIdx : null;
    if (raw == null || raw === '') return false;
    const idx = parseInt(raw, 10);
    if (Number.isNaN(idx)) return false;
    S.deleteMeasurement(idx);
    return true;
  }

  S.deleteMeasurement = function deleteMeasurement(idx: any) {
    if (typeof idx !== 'number' || idx < 0 || idx >= state.measurements.length) return;
    const __b = S.vectorSnapshot();
    state.measurements.splice(idx, 1);
    // If chain mode, reset chain end if we deleted the last measurement
    if (state.dimChainMode && state.measurements.length === 0) state.dimChainEnd = null;
    S.refreshMeasurements();
    S.renderSchedule();
    S.recordVec(__b);
    S.showHint('Measurement deleted');
  }

  S.commitMeasurement = function commitMeasurement(m: any) {
    if (!m) return;
    const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
    if (Math.sqrt(dx*dx + dy*dy) < 10) return;
    if (state.pendingScale) {
      state.pendingScaleStart = { x: m.x1, y: m.y1 };
      state.pendingScaleEnd = { x: m.x2, y: m.y2 };
      state.pendingScale = false;
      state.measurePreview = m;
      S.refreshMeasurements();
      S.openScaleApply();
      return;
    }
    const __b = S.vectorSnapshot();
    state.measurements.push({...m});
    // Chain mode: next measurement starts from this endpoint
    if (state.dimChainMode) {
      state.dimChainEnd = { x: m.x2, y: m.y2 };
    }
    S.refreshMeasurements();
    S.recordVec(__b);
  }

  window.addEventListener('resize', () => {
    S.fitToScreen();
  });

  /* =================== SCALE =================== */
  S.startScale = function startScale() {
    S.setTool('ruler');
    state.pendingScale = true;
    S.showHint('Draw a line on the canvas, then enter its real-world length');
  }

  S.openScaleApply = function openScaleApply() {
    S.scalePrompt.style.display = 'block';   // override inline display:none
    S.scalePrompt.classList.add('show');
    const rect = S.paper.getBoundingClientRect();
    const midX = ((state.pendingScaleStart as any).x + (state.pendingScaleEnd as any).x) / 2;
    const midY = ((state.pendingScaleStart as any).y + (state.pendingScaleEnd as any).y) / 2;
    const sx = midX / S.doc.wPx * rect.width + rect.left;
    const sy = midY / S.doc.hPx * rect.height + rect.top;
    const areaRect = S.area.getBoundingClientRect();
    S.scalePrompt.style.left = Math.min(areaRect.width - 260, Math.max(20, sx - areaRect.left + 20)) + 'px';
    S.scalePrompt.style.top = Math.max(20, sy - areaRect.top - 120) + 'px';
    const inp = $el('scale-length');
    inp.value = '';
    setTimeout(() => inp.focus(), 30);
  };

    $el('scale-apply').addEventListener('click', () => {
    const v = parseFloat($el('scale-length').value);
    const u = $el('scale-unit').value;
    if (!v || v <= 0) return;
    const dx = (state.pendingScaleEnd as any).x - (state.pendingScaleStart as any).x;
    const dy = (state.pendingScaleEnd as any).y - (state.pendingScaleStart as any).y;
    const distPx = Math.sqrt(dx*dx + dy*dy);
    state.pxPerUnit = distPx / v;
    state.scaleUnit = u;
    const label = S.updateScaleDisplay();
    S.syncProjectScale(label);
    S.scalePrompt.classList.remove('show');
    S.scalePrompt.style.display = 'none';
    state.measurePreview = null;
    state.pendingScaleStart = null;
    state.pendingScaleEnd = null;
    S.refreshMeasurements();
    S.renderSchedule();
    S.scheduleAutosave();
    S.showHint(`Scale set · ${v} ${u} reference · measurements now in real units`);
  });

  $el('scale-cancel').addEventListener('click', () => {
    S.scalePrompt.classList.remove('show');
    S.scalePrompt.style.display = 'none';
    state.pendingScale = false;
    state.pendingScaleStart = null;
    state.pendingScaleEnd = null;
    state.measurePreview = null;
    S.refreshMeasurements();
  });


}
