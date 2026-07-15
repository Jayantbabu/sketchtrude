/* Thin re-export — selection + chrome */
import { initSelection } from "./selection";
import { initChrome } from "./chrome";

export function initSelectionChrome() {
  initSelection();
  initChrome();
}
