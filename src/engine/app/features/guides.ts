/* Feature: guides — shared scope S */
import { S } from "../scope";

export function initGuides() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);
  /* =================================================================
     FEATURE 5 — PERSPECTIVE / ISOMETRIC GUIDE GRID
     ================================================================= */
  state.guideType = 'none';
  state.guideOpacity = 0.35;
  state.vanishingPoints = [
    { x: S.doc.wPx * 0.5, y: S.doc.hPx * 0.35 },   // 1pt VP (center)
    { x: -S.doc.wPx * 0.12, y: S.doc.hPx * 0.38 },    // 2pt VP left (off-sheet, draggable)
    { x: S.doc.wPx * 1.12, y: S.doc.hPx * 0.38 },    // 2pt VP right
  ];
  state.draggingVP = null;

  S.drawGuideGrid = function drawGuideGrid() {
    const gc = $el('guide-canvas');
    if (!gc) return;
    gc.width = S.doc.wPx; gc.height = S.doc.hPx;
    const ctx = gc.getContext('2d') as any;
    ctx.clearRect(0, 0, S.doc.wPx, S.doc.hPx);
    gc.style.opacity = state.guideOpacity;
    if (state.guideType === 'none') return;

    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 1.5;

    if (state.guideType === 'iso') {
      // Isometric: 30° and 150° diagonals + verticals
      const step = 120;
      const w = S.doc.wPx, h = S.doc.hPx;
      const tan30 = Math.tan(Math.PI / 6);
      // Vertical lines
      ctx.strokeStyle = 'rgba(29,78,216,0.5)'; ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      // 30° right-going lines
      ctx.strokeStyle = 'rgba(29,78,216,0.8)'; ctx.lineWidth = 1.2;
      const diagonalStep = step;
      for (let offset = -h * 2; offset < w + h * 2; offset += diagonalStep) {
        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset + h / tan30, h);
        ctx.stroke();
      }
      // 150° left-going lines
      for (let offset = -h * 2; offset < w + h * 2; offset += diagonalStep) {
        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset - h / tan30, h);
        ctx.stroke();
      }

    } else if (state.guideType === '1pt') {
      const vp = state.vanishingPoints[0];
      const w = S.doc.wPx, h = S.doc.hPx;
      // Horizon line
      ctx.strokeStyle = 'rgba(29,78,216,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, vp.y); ctx.lineTo(w, vp.y); ctx.stroke();
      // Converging lines from VP
      ctx.strokeStyle = 'rgba(29,78,216,0.5)'; ctx.lineWidth = 1;
      const numLines = 16;
      const corners = [[0,0],[w,0],[0,h],[w,h]];
      const extras = [];
      for (let i = 1; i < numLines; i++) {
        extras.push([i / numLines * w, 0]);
        extras.push([i / numLines * w, h]);
      }
      [...corners, ...extras].forEach(([cx, cy]) => {
        ctx.beginPath();
        const dx = cx - vp.x, dy = cy - vp.y;
        const ext = 3;
        ctx.moveTo(vp.x - dx * ext, vp.y - dy * ext);
        ctx.lineTo(vp.x + dx * ext, vp.y + dy * ext);
        ctx.stroke();
      });
      // VP marker
      ctx.fillStyle = '#a02835';
      ctx.beginPath(); ctx.arc(vp.x, vp.y, 18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('VP', vp.x, vp.y + 6);

      // Horizontal/vertical grid on picture plane
      ctx.strokeStyle = 'rgba(29,78,216,0.25)'; ctx.lineWidth = 1;
      const spacing = 160;
      for (let x = 0; x <= w; x += spacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += spacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

    } else if (state.guideType === '2pt') {
      const vp1 = state.vanishingPoints[1]; // left
      const vp2 = state.vanishingPoints[2]; // right
      const w = S.doc.wPx, h = S.doc.hPx;
      const horizY = (vp1.y + vp2.y) / 2;
      // Horizon
      ctx.strokeStyle = 'rgba(29,78,216,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, horizY); ctx.lineTo(w, horizY); ctx.stroke();
      // Lines from VP1
      ctx.strokeStyle = 'rgba(160,40,53,0.45)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        const ty = (i / 12) * h;
        [ty, h - ty].forEach((cy: any) => {
          ctx.beginPath();
          const dx = cy - vp1.y === 0 ? 1 : w + vp1.x;
          const dy = cy - vp1.y;
          const t = 4;
          ctx.moveTo(vp1.x - (w * t), vp1.y - dy * t);
          ctx.lineTo(vp1.x + (w * t), vp1.y + dy * t);
          ctx.stroke();
        });
      }
      // Lines from VP2
      ctx.strokeStyle = 'rgba(29,78,216,0.45)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        const ty = (i / 12) * h;
        [ty, h - ty].forEach((cy: any) => {
          ctx.beginPath();
          const dy = cy - vp2.y;
          const t = 4;
          ctx.moveTo(vp2.x - (w * t), vp2.y - dy * t);
          ctx.lineTo(vp2.x + (w * t), vp2.y + dy * t);
          ctx.stroke();
        });
      }
      // Vertical lines
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 180) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      // VP markers
      [vp1, vp2].forEach((vp: any, i: any) => {
        ctx.fillStyle = i === 0 ? '#a02835' : '#1d4ed8';
        ctx.beginPath(); ctx.arc(vp.x, vp.y, 18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`VP${i+1}`, vp.x, vp.y + 6);
      });
    }
  }

  // Wire guide popover — scope selectors to #guide-popover so we don't steal
  // clicks from Canvas Size presets / Document Grid buttons (same .guide-type-btn class).
  S.guidePopover = $el('guide-popover');
  S.positionGuidePopover = function positionGuidePopover() {
    if (!S.guidePopover) return;
    if (S.guidePopover.parentElement !== document.body) {
      document.body.appendChild(S.guidePopover);
    }
    S.guidePopover.style.position = 'fixed';
    S.guidePopover.style.left = 'auto';
    S.guidePopover.style.right = '12px';
    S.guidePopover.style.top = '52px';
    S.guidePopover.style.bottom = 'auto';
    S.guidePopover.style.zIndex = '2200';
  };
  $el('btn-guide').addEventListener('click', (e: any) => {
    e.stopPropagation();
    if (S.guidePopover.classList.contains('show')) {
      S.guidePopover.classList.remove('show');
      return;
    }
    S.positionGuidePopover();
    S.guidePopover.classList.add('show');
  });

  $all('#guide-popover [data-guide]').forEach((btn: any) => {
    btn.addEventListener('click', () => {
      $all('#guide-popover [data-guide]').forEach((b: any) => b.classList.remove('active'));
      btn.classList.add('active');
      state.guideType = btn.dataset.guide;
      S.drawGuideGrid();
      const hasVP = state.guideType === '1pt' || state.guideType === '2pt';
      $el('guide-vp-hint').style.display = hasVP ? 'block' : 'none';
      S.showHint(state.guideType === 'none' ? 'Guide grid off' : `Guide: ${btn.textContent.trim()} — non-printing`);
    });
  });

  $el('guide-opacity').addEventListener('input', (e: any) => {
    state.guideOpacity = parseInt(e.target.value) / 100;
    $el('guide-opacity-v').textContent = e.target.value + '%';
    $el('guide-canvas').style.opacity = state.guideOpacity;
    if (state.guideType !== 'none') S.drawGuideGrid();
  });

  // Draggable vanishing points via guide canvas
  $el('guide-canvas').addEventListener('pointerdown', (e: any) => {
    if (state.guideType !== '1pt' && state.guideType !== '2pt') return;
    const p = S.clientToCanvas(e.clientX, e.clientY);
    const vps = state.guideType === '1pt'
      ? [state.vanishingPoints[0]]
      : [state.vanishingPoints[1], state.vanishingPoints[2]];
    for (const vp of vps) {
      const dx = p.x - vp.x, dy = p.y - vp.y;
      if (Math.sqrt(dx*dx+dy*dy) < 40) {
        state.draggingVP = vp;
        $el('guide-canvas').setPointerCapture(e.pointerId);
        e.stopPropagation();
        return;
      }
    }
  });

  $el('guide-canvas').addEventListener('pointermove', (e: any) => {
    if (!state.draggingVP) return;
    const p = S.clientToCanvas(e.clientX, e.clientY);
    state.draggingVP.x = p.x;
    state.draggingVP.y = p.y;
    S.drawGuideGrid();
  });

  $el('guide-canvas').addEventListener('pointerup', () => {
    state.draggingVP = null;
  });

  // close guide popover on outside click
  document.addEventListener('click', (e: any) => {
    if (!e.target.closest('#guide-popover') && !e.target.closest('#btn-guide') && !e.target.closest('#ovf-guide')) {
      S.guidePopover.classList.remove('show');
    }
    if (!e.target.closest('#grid-popover') && !e.target.closest('#ovf-grid')) {
      S.gridPopover.classList.remove('show');
    }
  });

}
