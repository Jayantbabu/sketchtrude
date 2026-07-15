/* Colour wheel — shared scope S */
import { S } from "./scope";

export function initColor() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);

  /* =================== COLOR =================== */
  /* =================== COLOUR WHEEL (HSV) =================== */
  // Internal colour state in HSV (0-360, 0-100, 0-100)
  S.hsv = { h: 0, s: 0, v: 0 };

  S.hsvToHex = function hsvToHex(h: any, s: any, v: any) {
    s /= 100; v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r=0,g=0,b=0;
    if (h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}
    else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}
    const toHex = (n: any) => Math.round((n+m)*255).toString(16).padStart(2,'0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  S.hexToHsv = function hexToHsv(hex: any) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max-min;
    let h=0,s=max===0?0:d/max,v=max;
    if(d>0){
      if(max===r) h=((g-b)/d+6)%6;
      else if(max===g) h=(b-r)/d+2;
      else h=(r-g)/d+4;
      h*=60;
    }
    return { h: Math.round(h), s: Math.round(s*100), v: Math.round(v*100) };
  }

  S.hexToRgba = function hexToRgba(hex: any, alpha: any =255) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r, g, b, alpha];
  }

  S.hsvToHarmony = function hsvToHarmony(h: any, s: any, v: any) {
    return [
      S.hsvToHex(h, s, v),
      S.hsvToHex((h+180)%360, s, v),
      S.hsvToHex((h+120)%360, s, v),
      S.hsvToHex((h+240)%360, s, v),
      S.hsvToHex((h+30)%360, s, v),
    ];
  }

  // Draw the hue ring
  S.drawHueWheel = function drawHueWheel() {
    const canvas = $el('hue-wheel');
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as any;
    const cx = canvas.width/2, cy = canvas.height/2;
    const outerR = cx - 4, innerR = outerR - 22;
    for (let a = 0; a < 360; a++) {
      const start = (a - 1) * Math.PI / 180;
      const end = (a + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx + innerR * Math.cos(start), cy + innerR * Math.sin(start));
      ctx.arc(cx, cy, outerR, start, end);
      ctx.arc(cx, cy, innerR, end, start, true);
      ctx.closePath();
      ctx.fillStyle = `hsl(${a},100%,50%)`;
      ctx.fill();
    }
    // Ring overlay markers
    S.drawHueMarker();
  }

  S.drawHueMarker = function drawHueMarker() {
    const canvas = $el('hue-wheel');
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as any;
    const cx = canvas.width/2, cy = canvas.height/2;
    const outerR = cx - 4, innerR = outerR - 22, midR = (outerR + innerR) / 2;
    const a = (S.hsv.h - 90) * Math.PI / 180;
    const mx = cx + midR * Math.cos(a);
    const my = cy + midR * Math.sin(a);
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI*2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Draw the SV square
  S.drawSVSquare = function drawSVSquare() {
    const canvas = $el('sv-square');
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as any;
    const w = canvas.width, h = canvas.height;
    // Saturation gradient left-right
    const gS = ctx.createLinearGradient(0, 0, w, 0);
    gS.addColorStop(0, '#fff');
    gS.addColorStop(1, `hsl(${S.hsv.h},100%,50%)`);
    ctx.fillStyle = gS;
    ctx.fillRect(0, 0, w, h);
    // Value gradient top-bottom (white to black)
    const gV = ctx.createLinearGradient(0, 0, 0, h);
    gV.addColorStop(0, 'rgba(0,0,0,0)');
    gV.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gV;
    ctx.fillRect(0, 0, w, h);
    // Marker
    const mx = (S.hsv.s / 100) * w;
    const my = (1 - S.hsv.v / 100) * h;
    ctx.beginPath();
    ctx.arc(mx, my, 8, 0, Math.PI*2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  S.syncWheelFromColor = function syncWheelFromColor(hex: any) {
    const h = S.hexToHsv(hex);
    S.hsv.h = h.h; S.hsv.s = h.s; S.hsv.v = h.v;
    S.drawSVSquare();
    S.drawHueWheel();
    S.updateWheelSliders();
    S.updateHarmony();
    $el('color-swatch-display').style.background = hex;
    $el('wheel-hex').value = hex.toUpperCase();
  }

  S.updateWheelSliders = function updateWheelSliders() {
    $el('sl-h').value = S.hsv.h;
    $el('sl-h-v').textContent = Math.round(S.hsv.h);
    $el('sl-s').value = S.hsv.s;
    $el('sl-s-v').textContent = Math.round(S.hsv.s);
    $el('sl-v').value = S.hsv.v;
    $el('sl-v-v').textContent = Math.round(S.hsv.v);
  }

  S.updateHarmony = function updateHarmony() {
    const row = $el('harmony-row');
    if (!row) return;
    row.innerHTML = '';
    S.hsvToHarmony(S.hsv.h, S.hsv.s, S.hsv.v).forEach((c: any) => {
      const sw = document.createElement('div');
      sw.className = 'harmony-swatch';
      sw.style.background = c;
      sw.title = c;
      sw.addEventListener('click', () => { S.setColor(c); });
      row.appendChild(sw);
    });
  }

  S.initWheelEvents = function initWheelEvents() {
    const hueCanvas = $el('hue-wheel');
    const svCanvas = $el('sv-square');
    if (!hueCanvas || !svCanvas) return;

    function onHueDrag(e: any) {
      e.preventDefault();
      const rect = hueCanvas.getBoundingClientRect();
      const cx = rect.width/2, cy = rect.height/2;
      const ex = (e.clientX || e.touches?.[0]?.clientX) - rect.left - cx;
      const ey = (e.clientY || e.touches?.[0]?.clientY) - rect.top - cy;
      S.hsv.h = Math.round((Math.atan2(ey, ex) * 180 / Math.PI + 90 + 360) % 360);
      S.drawHueWheel();
      S.drawSVSquare();
      const hex = S.hsvToHex(S.hsv.h, S.hsv.s, S.hsv.v);
      S.setColor(hex);
      S.updateWheelSliders();
      S.updateHarmony();
    }
    function onSVDrag(e: any) {
      e.preventDefault();
      const rect = svCanvas.getBoundingClientRect();
      const ex = Math.max(0, Math.min(rect.width, (e.clientX || e.touches?.[0]?.clientX) - rect.left));
      const ey = Math.max(0, Math.min(rect.height, (e.clientY || e.touches?.[0]?.clientY) - rect.top));
      S.hsv.s = Math.round((ex / rect.width) * 100);
      S.hsv.v = Math.round((1 - ey / rect.height) * 100);
      S.drawSVSquare();
      const hex = S.hsvToHex(S.hsv.h, S.hsv.s, S.hsv.v);
      S.setColor(hex);
      S.updateWheelSliders();
      S.updateHarmony();
    }
    // Hue ring
    hueCanvas.addEventListener('pointerdown', (e: any) => {
      hueCanvas.setPointerCapture(e.pointerId);
      onHueDrag(e);
      const move = (ev: any) => onHueDrag(ev);
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
    // SV square
    svCanvas.addEventListener('pointerdown', (e: any) => {
      svCanvas.setPointerCapture(e.pointerId);
      onSVDrag(e);
      const move = (ev: any) => onSVDrag(ev);
      const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
    // Sliders
    ['h','s','v'].forEach((ch: any) => {
      $el(`sl-${ch}`).addEventListener('input', (e: any) => {
        S.hsv[ch] = parseInt(e.target.value);
        $el(`sl-${ch}-v`).textContent = S.hsv[ch];
        S.drawSVSquare();
        if (ch === 'h') S.drawHueWheel();
        const hex = S.hsvToHex(S.hsv.h, S.hsv.s, S.hsv.v);
        S.setColor(hex);
        S.updateHarmony();
        $el('wheel-hex').value = hex.toUpperCase();
      });
    });
    // Hex input
    $el('wheel-hex').addEventListener('change', (e: any) => {
      let v = e.target.value.trim();
      if (!v.startsWith('#')) v = '#' + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) { S.setColor(v); }
    });
  }

  S.renderSwatches = function renderSwatches() {
    const cont = $el('swatches');
    if (!cont) return;
    cont.innerHTML = '';
    S.SWATCHES.forEach((c: any) => {
      const sw = document.createElement('div');
      sw.className = 'swatch' + (c.toLowerCase() === state.color.toLowerCase() ? ' active' : '');
      sw.style.background = c;
      sw.addEventListener('click', () => { S.setColor(c); S.renderSwatches(); });
      cont.appendChild(sw);
    });
  }

  S.setColor = function setColor(c: any) {
    state.color = c;
    $el('puck-color').style.background = c;
    $el('color-swatch-display').style.background = c;
    $el('wheel-hex').value = c.toUpperCase();
    S.syncWheelFromColor(c);
    S.updatePreview();
    S.renderSwatches();
  };

  $el('puck-color').addEventListener('click', (e: any) => {
    e.stopPropagation();
    const puckRect = $el('puck').getBoundingClientRect();
    const areaRect = S.area.getBoundingClientRect();
    S.colorPopover.style.left = Math.max(8, puckRect.left - areaRect.left - 100) + 'px';
    S.colorPopover.style.top = '';
    S.colorPopover.style.bottom = '';
    const spaceBelow = areaRect.bottom - puckRect.bottom;
    const spaceAbove = puckRect.top - areaRect.top;
    if (spaceBelow >= 300 || spaceBelow >= spaceAbove) {
      S.colorPopover.style.bottom = (areaRect.height - (puckRect.top - areaRect.top) + 10) + 'px';
    } else {
      S.colorPopover.style.top = (puckRect.bottom - areaRect.top + 10) + 'px';
    }
    S.colorPopover.classList.toggle('show');
    if (S.colorPopover.classList.contains('show')) {
      S.drawHueWheel();
      S.drawSVSquare();
      S.updateHarmony();
      S.renderSwatches();
      // Show fill tolerance row only when fill tool active
      $el('fill-tolerance-row').style.display = (state.tool === 'fill' || state.tool === 'wand' || state.tool === 'lasso') ? 'block' : 'none';
    }
  });

  // Eyedropper
  $el('eyedropper-btn').addEventListener('click', () => {
    S.colorPopover.classList.remove('show');
    state.eyedropperActive = true;
    document.body.style.cursor = 'crosshair';
    S.showHint('Tap anywhere on the canvas to pick a colour');
  });
}
