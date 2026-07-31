import { describe, expect, it } from "vitest";
import {
  fitWallMassCameraScale,
  resolveWallMassAnchor,
  wallMassKey,
} from "@/engine/app/features/wall-massing-model";
import { mergeDetectedWallCycles } from "@/engine/app/features/wall-graph";

const roomWalls = [
  { id: "north", pts: [{ x: 100, y: 100 }, { x: 500, y: 100 }] },
  { id: "east", pts: [{ x: 500, y: 100 }, { x: 500, y: 400 }] },
  { id: "south", pts: [{ x: 500, y: 400 }, { x: 100, y: 400 }] },
  { id: "west", pts: [{ x: 100, y: 400 }, { x: 100, y: 100 }] },
];

describe("2D wall to 3D mass synchronization", () => {
  it("uses stable wall ids instead of array positions for generated masses", () => {
    expect(wallMassKey(roomWalls[0]!, 0, 0)).toBe("north:0");
    expect(wallMassKey(roomWalls[0]!, 3, 0)).toBe("north:0");
  });

  it("centers a wall-only model and follows the calibrated scale", () => {
    const resolved = resolveWallMassAnchor({
      walls: roomWalls,
      currentPpm: 20,
      existingAnchor: { px: 0, py: 0, ppm: 5 },
      preserveExisting: false,
    });

    expect(resolved.anchor).toEqual({ px: 300, py: 250, ppm: 20 });
    expect(resolved.reanchored).toBe(true);
  });

  it("preserves the shared anchor when independent 3D masses exist", () => {
    const existing = { px: 40, py: 50, ppm: 12 };
    const resolved = resolveWallMassAnchor({
      walls: roomWalls,
      currentPpm: 20,
      existingAnchor: existing,
      preserveExisting: true,
    });

    expect(resolved.anchor).toEqual(existing);
    expect(resolved.reanchored).toBe(false);
  });

  it("fits large architectural rooms into the 3D viewport", () => {
    const resolved = resolveWallMassAnchor({
      walls: roomWalls,
      currentPpm: 10,
      preserveExisting: false,
    });
    const scale = fitWallMassCameraScale({
      bounds: resolved.bounds,
      ppm: resolved.anchor!.ppm,
      viewportWidth: 1200,
      viewportHeight: 700,
    });

    expect(scale).not.toBeNull();
    expect(scale!).toBeGreaterThanOrEqual(4);
    expect(scale!).toBeLessThanOrEqual(60);
  });
});

describe("persisted room graph reconciliation", () => {
  it("keeps a valid saved room when detection temporarily misses it", () => {
    const savedRoom = { wallIds: ["north", "east", "south", "west"] };
    expect(mergeDetectedWallCycles([], [savedRoom], () => true)).toEqual([
      savedRoom.wallIds,
    ]);
  });

  it("does not resurrect an invalid saved room", () => {
    expect(
      mergeDetectedWallCycles(
        [],
        [{ wallIds: ["north", "east", "missing"] }],
        () => false,
      ),
    ).toEqual([]);
  });
});
