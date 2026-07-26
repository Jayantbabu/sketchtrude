/* Features — orthogonal snap, hatch, rooms, dimensions, guides, wall graph */
import { initSnap } from "./snap";
import { initHatch } from "./hatch";
import { initRooms } from "./rooms";
import { initDimensions } from "./dimensions";
import { initGuides } from "./guides";
import { initWallGraph } from "./wall-graph";

export function initFeatures() {
  initSnap();
  initHatch();
  initRooms();
  initWallGraph();
  initDimensions();
  initGuides();
}
