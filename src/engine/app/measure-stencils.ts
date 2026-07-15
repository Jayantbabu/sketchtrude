/* Thin re-export — measure + stencils */
import { initMeasure } from "./measure";
import { initStencils } from "./stencils";

export function initMeasureStencils() {
  initMeasure();
  initStencils();
}
