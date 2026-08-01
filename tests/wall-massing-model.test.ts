import { describe, expect, it } from "vitest";
import {
  fitWallMassCameraScale,
  resolveWallMassAnchor,
  wallMassKey,
} from "@/engine/app/features/wall-massing-model";
import {
  dedupeOverlappingWallCycles,
  matchingPreviousRoomIndex,
  mergeDetectedWallCycles,
  recoverSavedWallRooms,
} from "@/engine/app/features/wall-graph";
import { BUILTIN_FILL_TEXTURES } from "@/engine/app/fill";

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
  it("recovers room membership from saved walls when an older server omitted wallRooms", () => {
    expect(
      recoverSavedWallRooms(undefined, [
        { id: "north", roomId: "room-1" },
        { id: "east", roomId: "room-1" },
        { id: "south", roomId: "room-1" },
        { id: "west", roomId: "room-1" },
      ]),
    ).toEqual([
      {
        id: "room-1",
        name: "Room 1",
        wallIds: ["north", "east", "south", "west"],
        areaPx2: 0,
      },
    ]);
  });

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

  it("does not append a stale saved room when detection already found one", () => {
    const detected = [["north", "east-v2", "south", "west"]];
    expect(
      mergeDetectedWallCycles(
        detected,
        [{ wallIds: ["north", "east", "south", "west"] }],
        () => true,
      ),
    ).toEqual(detected);
  });

  it("restores a valid saved boundary wall omitted by transient detection", () => {
    expect(
      mergeDetectedWallCycles(
        [["north", "south", "west"]],
        [{ wallIds: ["north", "east", "south", "west"] }],
        (wallIds) => wallIds.includes("east"),
      ),
    ).toEqual([["north", "east", "south", "west"]]);
  });

  it("does not revive an omitted saved wall when that boundary is invalid", () => {
    const detected = [["north", "south", "west"]];
    expect(
      mergeDetectedWallCycles(
        detected,
        [{ wallIds: ["north", "missing-east", "south", "west"] }],
        () => false,
      ),
    ).toEqual(detected);
  });

  it("keeps room identity when one normalized wall id changes", () => {
    expect(
      matchingPreviousRoomIndex(
        ["north", "east-v2", "south", "west"],
        [
          { wallIds: ["other-a", "other-b", "other-c"] },
          { wallIds: ["north", "east", "south", "west"] },
        ],
      ),
    ).toBe(1);
  });

  it("collapses stale room records that differ by one wall id", () => {
    expect(
      dedupeOverlappingWallCycles([
        ["north", "east", "south", "west"],
        ["north", "east-v2", "south", "west"],
        ["north", "east-v3", "south", "west"],
      ]),
    ).toEqual([["north", "east", "south", "west"]]);
  });

  it("keeps adjacent rooms that only share their dividing wall", () => {
    const rooms = [
      ["north-a", "outer-east", "south-a", "divider"],
      ["north-b", "divider", "south-b", "outer-west"],
    ];
    expect(dedupeOverlappingWallCycles(rooms)).toEqual(rooms);
  });

  it("restores only one room when saved fallbacks overlap", () => {
    expect(
      mergeDetectedWallCycles(
        [],
        [
          { wallIds: ["north", "east", "south", "west"] },
          { wallIds: ["north", "east-v2", "south", "west"] },
          { wallIds: ["north", "east-v3", "south", "west"] },
        ],
        () => true,
      ),
    ).toEqual([["north", "east", "south", "west"]]);
  });

  it("prefers the fuller valid room when a shorter fallback was saved first", () => {
    expect(
      mergeDetectedWallCycles(
        [],
        [
          { wallIds: ["north", "south", "west"] },
          { wallIds: ["north", "east", "south", "west"] },
        ],
        () => true,
      ),
    ).toEqual([["north", "east", "south", "west"]]);
  });
});

describe("fill texture presets", () => {
  it("ships useful architectural textures without requiring an import", () => {
    expect(BUILTIN_FILL_TEXTURES.map((texture) => texture.name)).toEqual([
      "Diagonal hatch",
      "Cross hatch",
      "Brick",
      "Concrete",
      "Timber",
    ]);
    expect(BUILTIN_FILL_TEXTURES.every((texture) => texture.dataUrl.startsWith("data:image/svg+xml"))).toBe(true);
  });
});
