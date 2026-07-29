import { DEFAULT_TILE_SIZE, tileKey, tilesForRect } from "./tile-store";

export type StrokeSegment = {
  cx: number;
  cy: number;
  mx: number;
  my: number;
  width: number;
  pressure?: number;
};

export type VectorStroke = {
  id: string;
  brushId: string;
  color: string;
  opacity: number;
  blendMode: string;
  start: { x: number; y: number };
  segments: StrokeSegment[];
  stamps?: Array<{
    x: number;
    y: number;
    radius: number;
    strength: number;
    hardness: number;
  }>;
  bounds: { x: number; y: number; w: number; h: number };
  createdAt: number;
};

export type VectorStrokeStoreSnapshot = {
  version: 1;
  tileSize: number;
  strokes: VectorStroke[];
};

function createStrokeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Serializable vector strokes plus a spatial tile index for fast rerendering. */
export class VectorStrokeStore {
  readonly tileSize: number;
  private readonly strokes = new Map<string, VectorStroke>();
  private readonly tileIndex = new Map<string, Set<string>>();

  constructor(tileSize = DEFAULT_TILE_SIZE) {
    this.tileSize = tileSize;
  }

  get size(): number {
    return this.strokes.size;
  }

  add(
    input: Omit<VectorStroke, "id" | "createdAt"> &
      Partial<Pick<VectorStroke, "id" | "createdAt">>,
  ): VectorStroke {
    const stroke: VectorStroke = {
      ...input,
      id: input.id ?? createStrokeId(),
      createdAt: input.createdAt ?? Date.now(),
    };
    this.strokes.set(stroke.id, stroke);
    for (const tile of tilesForRect(
      stroke.bounds,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      this.tileSize,
    )) {
      let ids = this.tileIndex.get(tile.key);
      if (!ids) {
        ids = new Set();
        this.tileIndex.set(tile.key, ids);
      }
      ids.add(stroke.id);
    }
    return stroke;
  }

  remove(id: string): VectorStroke | null {
    const stroke = this.strokes.get(id);
    if (!stroke) return null;
    this.strokes.delete(id);
    for (const ids of this.tileIndex.values()) ids.delete(id);
    return stroke;
  }

  get(id: string): VectorStroke | null {
    return this.strokes.get(id) ?? null;
  }

  inTile(column: number, row: number): VectorStroke[] {
    const ids = this.tileIndex.get(tileKey(column, row));
    if (!ids) return [];
    return [...ids]
      .map((id) => this.strokes.get(id))
      .filter((stroke): stroke is VectorStroke => Boolean(stroke))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  all(): VectorStroke[] {
    return [...this.strokes.values()].sort((a, b) => a.createdAt - b.createdAt);
  }

  clear(): void {
    this.strokes.clear();
    this.tileIndex.clear();
  }

  serialize(): VectorStrokeStoreSnapshot {
    return {
      version: 1,
      tileSize: this.tileSize,
      strokes: this.all(),
    };
  }

  static fromSnapshot(snapshot: VectorStrokeStoreSnapshot): VectorStrokeStore {
    const store = new VectorStrokeStore(snapshot.tileSize);
    for (const stroke of snapshot.strokes ?? []) store.add(stroke);
    return store;
  }
}
