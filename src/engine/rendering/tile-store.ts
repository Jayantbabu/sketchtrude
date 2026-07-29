export const DEFAULT_TILE_SIZE = 512;

export type TileRect = { x: number; y: number; w: number; h: number };

export type TileCoordinate = {
  key: string;
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RasterTilePatch = TileCoordinate & {
  before: ImageData;
  after: ImageData;
};

export type PersistedRasterTile = {
  key: string;
  column: number;
  row: number;
  width: number;
  height: number;
  storagePath?: string | null;
  url?: string | null;
  blob?: Blob | null;
};

type RuntimeTile = TileCoordinate & {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  dirty: boolean;
  lastUsed: number;
  persistedBlob: Blob | null;
};

export type RasterTileStoreOptions = {
  width: number;
  height: number;
  tileSize?: number;
  root?: HTMLElement | null;
  maxResidentTiles?: number;
  createCanvas?: (width: number, height: number) => HTMLCanvasElement;
};

function defaultCreateCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function tileKey(column: number, row: number): string {
  return `${column}:${row}`;
}

export function tilesForRect(
  rect: TileRect,
  documentWidth: number,
  documentHeight: number,
  tileSize = DEFAULT_TILE_SIZE,
): TileCoordinate[] {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(documentWidth, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(documentHeight, Math.ceil(rect.y + rect.h));
  if (x1 <= x0 || y1 <= y0) return [];

  const firstColumn = Math.floor(x0 / tileSize);
  const lastColumn = Math.floor((x1 - 1) / tileSize);
  const firstRow = Math.floor(y0 / tileSize);
  const lastRow = Math.floor((y1 - 1) / tileSize);
  const result: TileCoordinate[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const x = column * tileSize;
      const y = row * tileSize;
      result.push({
        key: tileKey(column, row),
        column,
        row,
        x,
        y,
        width: Math.min(tileSize, documentWidth - x),
        height: Math.min(tileSize, documentHeight - y),
      });
    }
  }
  return result;
}

/**
 * Sparse document raster. A blank layer owns no bitmap memory; canvases are
 * allocated only when a stroke touches their 512px document tile.
 */
export class RasterTileStore {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly maxResidentTiles: number;
  readonly root: HTMLElement | null;

  private readonly createCanvas: (
    width: number,
    height: number,
  ) => HTMLCanvasElement;
  private readonly tiles = new Map<string, RuntimeTile>();
  private readonly evicted = new Map<
    string,
    { descriptor: PersistedRasterTile; blob: Blob }
  >();
  private transactionBefore: Map<string, ImageData> | null = null;
  private clock = 0;

  constructor(options: RasterTileStoreOptions) {
    this.width = Math.max(1, Math.floor(options.width));
    this.height = Math.max(1, Math.floor(options.height));
    this.tileSize = Math.max(64, Math.floor(options.tileSize ?? DEFAULT_TILE_SIZE));
    this.maxResidentTiles = Math.max(8, options.maxResidentTiles ?? 96);
    this.root = options.root ?? null;
    this.createCanvas = options.createCanvas ?? defaultCreateCanvas;
  }

  get size(): number {
    return this.tiles.size;
  }

  keys(): string[] {
    return [...new Set([...this.tiles.keys(), ...this.evicted.keys()])];
  }

  has(key: string): boolean {
    return this.tiles.has(key);
  }

  dropOutside(visible: TileRect, force = false): number {
    const keep = new Set(
      tilesForRect(visible, this.width, this.height, this.tileSize).map(
        (tile) => tile.key,
      ),
    );
    const candidates = [...this.tiles.values()]
      .filter(
        (tile) =>
          !keep.has(tile.key) &&
          (force || (!tile.dirty && Boolean(tile.persistedBlob))),
      )
      .sort((a, b) => a.lastUsed - b.lastUsed);
    let removed = 0;
    for (const tile of candidates) {
      if (!force && tile.persistedBlob) {
        this.evicted.set(tile.key, {
          descriptor: {
            key: tile.key,
            column: tile.column,
            row: tile.row,
            width: tile.width,
            height: tile.height,
          },
          blob: tile.persistedBlob,
        });
      }
      tile.canvas.remove();
      tile.canvas.width = 1;
      tile.canvas.height = 1;
      this.tiles.delete(tile.key);
      removed += 1;
    }
    return removed;
  }

  async ensureVisible(visible: TileRect): Promise<void> {
    for (const coordinate of tilesForRect(
      visible,
      this.width,
      this.height,
      this.tileSize,
    )) {
      if (this.tiles.has(coordinate.key)) continue;
      const backing = this.evicted.get(coordinate.key);
      if (!backing) continue;
      await this.importTile(backing.descriptor, backing.blob);
      this.evicted.delete(coordinate.key);
    }
  }

  private createTile(coordinate: TileCoordinate): RuntimeTile {
    const canvas = this.createCanvas(coordinate.width, coordinate.height);
    canvas.dataset.tileKey = coordinate.key;
    canvas.style.position = "absolute";
    canvas.style.left = `${coordinate.x}px`;
    canvas.style.top = `${coordinate.y}px`;
    canvas.style.width = `${coordinate.width}px`;
    canvas.style.height = `${coordinate.height}px`;
    canvas.style.pointerEvents = "none";
    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    }) as CanvasRenderingContext2D;
    context.lineCap = "round";
    context.lineJoin = "round";
    this.root?.appendChild(canvas);
    const tile: RuntimeTile = {
      ...coordinate,
      canvas,
      context,
      dirty: false,
      lastUsed: ++this.clock,
      persistedBlob: null,
    };
    this.tiles.set(coordinate.key, tile);
    return tile;
  }

  private getTile(
    coordinate: TileCoordinate,
    create = true,
  ): RuntimeTile | null {
    const existing = this.tiles.get(coordinate.key);
    if (existing) {
      existing.lastUsed = ++this.clock;
      return existing;
    }
    return create ? this.createTile(coordinate) : null;
  }

  beginPatch(): void {
    this.transactionBefore = new Map();
  }

  forEachContext(
    rect: TileRect,
    draw: (
      context: CanvasRenderingContext2D,
      tile: TileCoordinate,
    ) => void,
  ): void {
    for (const coordinate of tilesForRect(
      rect,
      this.width,
      this.height,
      this.tileSize,
    )) {
      const tile = this.getTile(coordinate, true)!;
      if (
        this.transactionBefore &&
        !this.transactionBefore.has(coordinate.key)
      ) {
        this.transactionBefore.set(
          coordinate.key,
          tile.context.getImageData(0, 0, tile.width, tile.height),
        );
      }
      tile.context.save();
      tile.context.translate(-tile.x, -tile.y);
      draw(tile.context, coordinate);
      tile.context.restore();
      tile.dirty = true;
      tile.persistedBlob = null;
    }
  }

  endPatch(): RasterTilePatch[] {
    const before = this.transactionBefore;
    this.transactionBefore = null;
    if (!before) return [];
    const patches: RasterTilePatch[] = [];
    for (const [key, beforeImage] of before) {
      const tile = this.tiles.get(key);
      if (!tile) continue;
      patches.push({
        key,
        column: tile.column,
        row: tile.row,
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
        before: beforeImage,
        after: tile.context.getImageData(0, 0, tile.width, tile.height),
      });
    }
    return patches;
  }

  cancelPatch(): void {
    const before = this.transactionBefore;
    this.transactionBefore = null;
    if (!before) return;
    for (const [key, image] of before) {
      const tile = this.tiles.get(key);
      if (tile) tile.context.putImageData(image, 0, 0);
    }
  }

  applyPatches(patches: RasterTilePatch[], side: "before" | "after"): void {
    for (const patch of patches) {
      const tile = this.getTile(patch, true)!;
      tile.context.putImageData(patch[side], 0, 0);
      tile.dirty = true;
      tile.persistedBlob = null;
    }
  }

  clear(): RasterTilePatch[] {
    this.beginPatch();
    for (const tile of this.tiles.values()) {
      if (!this.transactionBefore!.has(tile.key)) {
        this.transactionBefore!.set(
          tile.key,
          tile.context.getImageData(0, 0, tile.width, tile.height),
        );
      }
      tile.context.clearRect(0, 0, tile.width, tile.height);
      tile.dirty = true;
      tile.persistedBlob = null;
    }
    return this.endPatch();
  }

  drawTo(
    context: CanvasRenderingContext2D,
    scale = 1,
    rect: TileRect = { x: 0, y: 0, w: this.width, h: this.height },
  ): void {
    const allowed = new Set(
      tilesForRect(rect, this.width, this.height, this.tileSize).map(
        (tile) => tile.key,
      ),
    );
    for (const tile of this.tiles.values()) {
      if (!allowed.has(tile.key)) continue;
      context.drawImage(
        tile.canvas,
        tile.x * scale,
        tile.y * scale,
        tile.width * scale,
        tile.height * scale,
      );
    }
  }

  async drawAllTo(
    context: CanvasRenderingContext2D,
    scale = 1,
  ): Promise<void> {
    this.drawTo(context, scale);
    for (const backing of this.evicted.values()) {
      const bitmap = await createImageBitmap(backing.blob);
      const x = backing.descriptor.column * this.tileSize;
      const y = backing.descriptor.row * this.tileSize;
      context.drawImage(
        bitmap,
        x * scale,
        y * scale,
        backing.descriptor.width * scale,
        backing.descriptor.height * scale,
      );
      bitmap.close?.();
    }
  }

  async persistedTiles(dirtyOnly = false): Promise<PersistedRasterTile[]> {
    const result: PersistedRasterTile[] = [];
    for (const tile of this.tiles.values()) {
      if (dirtyOnly && !tile.dirty) continue;
      const blob =
        tile.persistedBlob ??
        (await new Promise<Blob | null>((resolve) =>
          tile.canvas.toBlob(resolve, "image/png"),
        ));
      tile.persistedBlob = blob;
      tile.dirty = false;
      result.push({
        key: tile.key,
        column: tile.column,
        row: tile.row,
        width: tile.width,
        height: tile.height,
        blob,
      });
    }
    if (!dirtyOnly) {
      for (const backing of this.evicted.values()) {
        result.push({ ...backing.descriptor, blob: backing.blob });
      }
    }
    return result;
  }

  /** Full manifest, but PNG bytes only for tiles changed since the prior save. */
  async takeSaveManifest(): Promise<PersistedRasterTile[]> {
    const result: PersistedRasterTile[] = [];
    for (const tile of this.tiles.values()) {
      let blob: Blob | null = null;
      if (tile.dirty || !tile.persistedBlob) {
        blob = await new Promise<Blob | null>((resolve) =>
          tile.canvas.toBlob(resolve, "image/png"),
        );
        tile.persistedBlob = blob;
      }
      result.push({
        key: tile.key,
        column: tile.column,
        row: tile.row,
        width: tile.width,
        height: tile.height,
        blob,
      });
      tile.dirty = false;
    }
    return result;
  }

  async importTile(
    descriptor: PersistedRasterTile,
    source: Blob | string,
  ): Promise<void> {
    const coordinate: TileCoordinate = {
      key: descriptor.key || tileKey(descriptor.column, descriptor.row),
      column: descriptor.column,
      row: descriptor.row,
      x: descriptor.column * this.tileSize,
      y: descriptor.row * this.tileSize,
      width: descriptor.width,
      height: descriptor.height,
    };
    const tile = this.getTile(coordinate, true)!;
    const blob =
      typeof source === "string"
        ? await fetch(source, { credentials: "same-origin" }).then(
            (response) => {
              if (!response.ok) {
                throw new Error("Tile source could not be loaded");
              }
              return response.blob();
            },
          )
        : source;
    const bitmap = await createImageBitmap(blob);
    tile.context.clearRect(0, 0, tile.width, tile.height);
    tile.context.drawImage(bitmap, 0, 0, tile.width, tile.height);
    bitmap.close?.();
    tile.persistedBlob = blob;
    tile.dirty = false;
  }

  evictOutside(visible: TileRect): number {
    const keep = new Set(
      tilesForRect(visible, this.width, this.height, this.tileSize).map(
        (tile) => tile.key,
      ),
    );
    const candidates = [...this.tiles.values()]
      .filter((tile) => !keep.has(tile.key) && !tile.dirty && tile.persistedBlob)
      .sort((a, b) => a.lastUsed - b.lastUsed);
    const excess = Math.max(0, this.tiles.size - this.maxResidentTiles);
    let evicted = 0;
    for (const tile of candidates.slice(0, excess)) {
      this.evicted.set(tile.key, {
        descriptor: {
          key: tile.key,
          column: tile.column,
          row: tile.row,
          width: tile.width,
          height: tile.height,
        },
        blob: tile.persistedBlob!,
      });
      tile.canvas.remove();
      tile.canvas.width = 1;
      tile.canvas.height = 1;
      this.tiles.delete(tile.key);
      evicted += 1;
    }
    return evicted;
  }

  dispose(): void {
    for (const tile of this.tiles.values()) tile.canvas.remove();
    this.tiles.clear();
    this.evicted.clear();
    this.transactionBefore = null;
  }
}
