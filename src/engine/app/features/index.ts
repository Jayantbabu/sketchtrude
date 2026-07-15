/* Features — orthogonal snap, hatch, rooms, dimensions, guides */
import { initSnap } from "./snap";
import { initHatch } from "./hatch";
import { initRooms } from "./rooms";
import { initDimensions } from "./dimensions";
import { initGuides } from "./guides";

export function initFeatures() {
  initSnap();
  initHatch();
  initRooms();
  initDimensions();
  initGuides();
}
