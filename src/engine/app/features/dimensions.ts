/* Feature: dimensions — shared scope S */
import { S } from "../scope";

export function initDimensions() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);
  /* =================================================================
     FEATURE 4 — ARCHITECTURAL DIMENSION CHAIN
     ================================================================= */
  state.dimChainMode = false;
  state.dimChainEnd = null;

  S.toggleDimChain = function toggleDimChain() {
    state.dimChainMode = !state.dimChainMode;
    const btn = $el('btn-dim-chain');
    btn.classList.toggle('chain-active', state.dimChainMode);
    if (!state.dimChainMode) state.dimChainEnd = null;
    S.showHint(state.dimChainMode
      ? 'Dimension Chain ON — each measurement starts from the last endpoint'
      : 'Dimension Chain OFF');
  }

  // Architectural-style dimension rendering — replaces addMeasureSVG for ruler lines
  S.addDimSVG = function addDimSVG(m: any, isPreview: any, mIndex: any) {
    const svgns = 'http://www.w3.org/2000/svg';
    S.rulerOverlay.setAttribute('viewBox', `0 0 ${S.doc.wPx} ${S.doc.hPx}`);

    if (m.type === 'area') { S.addAreaSVG(m, mIndex); return; }

    const color = isPreview ? '#a02835' : '#1d4ed8';
    const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 2) return;
    let nx = -dy / len, ny = dx / len;
    // Scale-set preview: always place the dimension above the stroke and far
    // enough away that a stylus hand does not cover the value.
    const settingScale = !!(isPreview && (state.pendingScale || state.pendingScaleStart));
    if (settingScale && ny > 0) { nx = -nx; ny = -ny; }
    const viewScale = Math.max(0.01, (state.zoom || 1) * (state.baseZoom || 1));
    const extLen = settingScale ? 160 / viewScale : 28;
    const labelOff = settingScale ? 40 / viewScale : 20;
    const tickLen = 12;
    if (settingScale) {
      const mx = (m.x1 + m.x2) / 2, my = (m.y1 + m.y2) / 2;
      const offset = extLen + labelOff;
      const area = document.getElementById('canvas-area')?.getBoundingClientRect();
      const matrix = S.rulerOverlay.getScreenCTM?.();
      if (area && matrix) {
        const overflow = (side: number) => {
          const p = new DOMPoint(mx + nx * offset * side, my + ny * offset * side).matrixTransform(matrix);
          const margin = 28;
          return Math.max(0, area.left + margin - p.x) +
            Math.max(0, p.x - area.right + margin) +
            Math.max(0, area.top + margin - p.y) +
            Math.max(0, p.y - area.bottom + margin);
        };
        if (overflow(-1) < overflow(1)) { nx = -nx; ny = -ny; }
      } else {
        const lx = mx + nx * offset, ly = my + ny * offset;
        const margin = 24 / viewScale;
        if (lx < margin || lx > S.doc.wPx - margin || ly < margin || ly > S.doc.hPx - margin) {
          nx = -nx; ny = -ny;
        }
      }
    }

    // Extension lines — non-interactive
    [[m.x1,m.y1],[m.x2,m.y2]].forEach(([x,y]) => {
      const el = document.createElementNS(svgns, 'line');
      el.setAttribute('x1', String(x + nx * extLen)); el.setAttribute('y1', String(y + ny * extLen));
      el.setAttribute('x2', String(x - nx * 6));      el.setAttribute('y2', String(y - ny * 6));
      el.setAttribute('stroke', color); el.setAttribute('stroke-width', '1.5');
      el.setAttribute('pointer-events', 'none');
      S.rulerOverlay.appendChild(el);
    });

    // Main dimension line — non-interactive
    const dline = document.createElementNS(svgns, 'line');
    dline.setAttribute('x1', String(m.x1 + nx * extLen)); dline.setAttribute('y1', String(m.y1 + ny * extLen));
    dline.setAttribute('x2', String(m.x2 + nx * extLen)); dline.setAttribute('y2', String(m.y2 + ny * extLen));
    dline.setAttribute('stroke', color); dline.setAttribute('stroke-width', '2');
    dline.setAttribute('pointer-events', 'none');
    S.rulerOverlay.appendChild(dline);

    // Tick marks — non-interactive
    [[m.x1,m.y1],[m.x2,m.y2]].forEach(([x,y]) => {
      const tx = x + nx * extLen, ty = y + ny * extLen;
      const ux = dx / len, uy = dy / len;
      const tick = document.createElementNS(svgns, 'line');
      tick.setAttribute('x1', String(tx - ux * tickLen - nx * tickLen/2));
      tick.setAttribute('y1', String(ty - uy * tickLen - ny * tickLen/2));
      tick.setAttribute('x2', String(tx + ux * tickLen + nx * tickLen/2));
      tick.setAttribute('y2', String(ty + uy * tickLen + ny * tickLen/2));
      tick.setAttribute('stroke', color); tick.setAttribute('stroke-width', '2.5');
      tick.setAttribute('pointer-events', 'none');
      S.rulerOverlay.appendChild(tick);
    });

    // Endpoint dots — non-interactive
    [[m.x1,m.y1],[m.x2,m.y2]].forEach(([x,y]) => {
      const c = document.createElementNS(svgns, 'circle');
      c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y)); c.setAttribute('r', '7');
      c.setAttribute('fill', color);
      c.setAttribute('pointer-events', 'none');
      S.rulerOverlay.appendChild(c);
    });

    // Label group — clickable for delete
    const distPx = len;
    let text = S.formatLen(distPx);
    const lx = (m.x1 + m.x2) / 2 + nx * (extLen + labelOff);
    const ly = (m.y1 + m.y2) / 2 + ny * (extLen + labelOff);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const readableAngle = (angle > 90 || angle < -90) ? angle + 180 : angle;
    const pW = text.length * 15 + (isPreview ? 20 : 60);

    const g = document.createElementNS(svgns, 'g');
    g.setAttribute('transform', `rotate(${readableAngle} ${lx} ${ly})`);

    const bg = document.createElementNS(svgns, 'rect');
    bg.setAttribute('x', String(lx - pW/2)); bg.setAttribute('y', String(ly - 18));
    bg.setAttribute('width', String(pW)); bg.setAttribute('height', String(34));
    bg.setAttribute('rx', String(5));
    bg.setAttribute('fill', isPreview ? '#a02835' : '#1d4ed8');
    bg.setAttribute('pointer-events', isPreview ? 'none' : 'auto');
    if (!isPreview && typeof mIndex === 'number') bg.dataset.measureIdx = String(mIndex);
    if (!isPreview) {
      bg.style.cursor = 'pointer';
      bg.addEventListener('pointerdown', (e: any) => { e.stopPropagation(); e.preventDefault(); S.deleteMeasurement(mIndex); });
    }
    g.appendChild(bg);

    const lbl = document.createElementNS(svgns, 'text');
    lbl.setAttribute('x', String(lx - (isPreview ? 0 : 14))); lbl.setAttribute('y', String(ly + 6));
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('fill', 'white');
    lbl.setAttribute('font-family', 'JetBrains Mono,monospace');
    lbl.setAttribute('font-weight', '600');
    lbl.setAttribute('font-size', '19');
    lbl.setAttribute('pointer-events', 'none');
    lbl.textContent = text;
    g.appendChild(lbl);

    if (!isPreview && typeof mIndex === 'number') {
      const xHit = document.createElementNS(svgns, 'circle');
      xHit.setAttribute('cx', String(lx + pW/2 - 18));
      xHit.setAttribute('cy', String(ly));
      xHit.setAttribute('r', '16');
      xHit.setAttribute('fill', 'transparent');
      xHit.setAttribute('pointer-events', 'auto');
      xHit.dataset.measureIdx = String(mIndex);
      xHit.style.cursor = 'pointer';
      xHit.addEventListener('pointerdown', (e: any) => { e.stopPropagation(); e.preventDefault(); S.deleteMeasurement(mIndex); });
      g.appendChild(xHit);
      const xBtn = document.createElementNS(svgns, 'text');
      xBtn.setAttribute('x', String(lx + pW/2 - 18)); xBtn.setAttribute('y', String(ly + 8));
      xBtn.setAttribute('text-anchor', 'middle');
      xBtn.setAttribute('fill', 'rgba(255,255,255,0.8)');
      xBtn.setAttribute('font-size', '26');
      xBtn.setAttribute('font-family', 'sans-serif');
      xBtn.setAttribute('pointer-events', 'none');
      xBtn.textContent = '×';
      g.appendChild(xBtn);
    }
    S.rulerOverlay.appendChild(g);
  }

  S.addAreaSVG = function addAreaSVG(m: any, mIndex: any) {
    const svgns = 'http://www.w3.org/2000/svg';
    if (!m.points || m.points.length < 3) return;
    const fill = document.createElementNS(svgns, 'polygon');
    fill.setAttribute('points', m.points.map((p: any) => `${p.x},${p.y}`).join(' '));
    fill.setAttribute('class', 'area-fill');
    fill.setAttribute('pointer-events', 'none');
    S.rulerOverlay.appendChild(fill);
    for (let i = 0; i < m.points.length; i++) {
      const j = (i+1) % m.points.length;
      const l = document.createElementNS(svgns, 'line');
      l.setAttribute('x1', String(m.points[i].x)); l.setAttribute('y1', String(m.points[i].y));
      l.setAttribute('x2', String(m.points[j].x)); l.setAttribute('y2', String(m.points[j].y));
      l.setAttribute('class', 'area-edge');
      l.setAttribute('pointer-events', 'none');
      S.rulerOverlay.appendChild(l);
    }
    const cx = m.points.reduce((s: any, p: any) => s + p.x, 0) / m.points.length;
    const cy = m.points.reduce((s: any, p: any) => s + p.y, 0) / m.points.length;
    const liveLabel = S.formatArea(S.shoelaceArea(m.points));
    const display = (m.name ? m.name + ' · ' : '') + liveLabel + (m.void ? '  (void)' : '');
    const pW = display.length * 11 + 50;
    const bg = document.createElementNS(svgns, 'rect');
    bg.setAttribute('x', String(cx - pW/2)); bg.setAttribute('y', String(cy - 20));
    bg.setAttribute('width', String(pW)); bg.setAttribute('height', String(34));
    bg.setAttribute('rx', String(6)); bg.setAttribute('fill', m.void ? '#6b7280' : '#15803d');
    bg.setAttribute('pointer-events', 'auto');
    bg.dataset.measureIdx = String(mIndex);
    bg.style.cursor = 'pointer';
    bg.addEventListener('pointerdown', (e: any) => { e.stopPropagation(); e.preventDefault(); S.deleteMeasurement(mIndex); });
    S.rulerOverlay.appendChild(bg);
    const txt = document.createElementNS(svgns, 'text');
    txt.setAttribute('x', String(cx - 14)); txt.setAttribute('y', String(cy + 3));
    txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('fill', 'white');
    txt.setAttribute('font-family', 'JetBrains Mono,monospace');
    txt.setAttribute('font-weight', '600'); txt.setAttribute('font-size', '17');
    txt.setAttribute('pointer-events', 'none');
    txt.textContent = display;
    S.rulerOverlay.appendChild(txt);
    const xHit = document.createElementNS(svgns, 'circle');
    xHit.setAttribute('cx', String(cx + pW/2 - 18));
    xHit.setAttribute('cy', String(cy));
    xHit.setAttribute('r', '16');
    xHit.setAttribute('fill', 'transparent');
    xHit.setAttribute('pointer-events', 'auto');
    xHit.dataset.measureIdx = String(mIndex);
    xHit.style.cursor = 'pointer';
    xHit.addEventListener('pointerdown', (e: any) => { e.stopPropagation(); e.preventDefault(); S.deleteMeasurement(mIndex); });
    S.rulerOverlay.appendChild(xHit);
    const xBtn = document.createElementNS(svgns, 'text');
    xBtn.setAttribute('x', String(cx + pW/2 - 18)); xBtn.setAttribute('y', String(cy + 6));
    xBtn.setAttribute('fill', 'rgba(255,255,255,0.8)');
    xBtn.setAttribute('font-size', '26'); xBtn.setAttribute('font-family', 'sans-serif');
    xBtn.setAttribute('pointer-events', 'none');
    xBtn.textContent = '×';
    S.rulerOverlay.appendChild(xBtn);
  };

  $el('btn-dim-chain').addEventListener('click', S.toggleDimChain);

}
