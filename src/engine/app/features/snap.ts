/* Feature: snap — shared scope S */
import { S } from "../scope";

export function initSnap() {
  const state = S.state;

  const $el = (id: string): any => document.getElementById(id);
  const $all = (sel: string): any => document.querySelectorAll(sel);
  const $qs = (sel: string): any => document.querySelector(sel);
  /* =================================================================
     FEATURE 1 — ORTHOGONAL SNAP (Shift key)
     ================================================================= */
  S.snapToOrtho = function snapToOrtho(x: any, y: any, anchorX: any, anchorY: any) {
    const dx = x - anchorX, dy = y - anchorY;
    const angle = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const dist = Math.sqrt(dx * dx + dy * dy);
    return {
      x: anchorX + dist * Math.cos(snapped),
      y: anchorY + dist * Math.sin(snapped),
    };
  }

  S.applyOrthoSnap = function applyOrthoSnap(p: any, e: any) {
    if (!e.shiftKey) {
      if (state.snapActive) {
        state.snapActive = false;
        $el('snap-badge').classList.remove('show');
      }
      return p;
    }
    if (!state.snapActive) {
      state.snapActive = true;
      state.snapAnchor = { x: state.lastX, y: state.lastY };
      $el('snap-badge').classList.add('show');
    }
    return S.snapToOrtho(p.x, p.y, state.snapAnchor.x, state.snapAnchor.y);
  }

  // Add snapAnchor + snapActive to state (done inline here, no object literal edit needed)
  state.snapActive = false;
  state.snapAnchor = null;

}
