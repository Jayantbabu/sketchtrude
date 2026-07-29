import { tilesForRect, type TileRect } from "./tile-store";

export type ImageReferenceTransform = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
};

export type ImagePyramidRendererOptions = {
  root: HTMLElement;
  image: HTMLImageElement;
  getTransform: () => ImageReferenceTransform;
  getVisibleRect: () => TileRect;
  getScreenScale: () => number;
  tileSize?: number;
  maxTiles?: number;
};

type ImageTile = {
  key: string;
  canvas: HTMLCanvasElement;
  lastUsed: number;
};

/**
 * A display-resolution image pyramid. It crops only visible source regions and
 * selects a power-of-two backing resolution for the current zoom.
 */
export class ImagePyramidRenderer {
  private readonly options: ImagePyramidRendererOptions;
  private readonly tiles = new Map<string, ImageTile>();
  private generation = 0;
  private clock = 0;

  constructor(options: ImagePyramidRendererOptions) {
    this.options = options;
  }

  private levelScale(transform: ImageReferenceTransform): number {
    const sourcePerDocumentPixel = Math.min(
      this.options.image.naturalWidth / Math.max(1, transform.w),
      this.options.image.naturalHeight / Math.max(1, transform.h),
    );
    const requested = Math.max(
      0.125,
      this.options.getScreenScale() * Math.min(2, devicePixelRatio || 1),
    );
    const quantized = 2 ** Math.ceil(Math.log2(requested));
    return Math.max(0.125, Math.min(sourcePerDocumentPixel, quantized));
  }

  async refresh(): Promise<void> {
    const transform = this.options.getTransform();
    if (!transform || Math.abs((transform.rotation || 0) % 360) > 0.001) {
      this.setVisible(false);
      return;
    }
    this.setVisible(true);
    const imageBounds = {
      x: transform.x - transform.w / 2,
      y: transform.y - transform.h / 2,
      w: transform.w,
      h: transform.h,
    };
    const viewport = this.options.getVisibleRect();
    const x0 = Math.max(imageBounds.x, viewport.x);
    const y0 = Math.max(imageBounds.y, viewport.y);
    const x1 = Math.min(imageBounds.x + imageBounds.w, viewport.x + viewport.w);
    const y1 = Math.min(imageBounds.y + imageBounds.h, viewport.y + viewport.h);
    if (x1 <= x0 || y1 <= y0) {
      for (const tile of this.tiles.values()) tile.canvas.style.display = "none";
      return;
    }

    const generation = ++this.generation;
    const tileSize = this.options.tileSize ?? 512;
    const scale = this.levelScale(transform);
    const level = Math.round(Math.log2(scale) * 8);
    const visibleKeys = new Set<string>();
    const documentWidth = Math.ceil(
      Math.max(imageBounds.x + imageBounds.w, viewport.x + viewport.w),
    );
    const documentHeight = Math.ceil(
      Math.max(imageBounds.y + imageBounds.h, viewport.y + viewport.h),
    );
    const coordinates = tilesForRect(
      { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
      documentWidth,
      documentHeight,
      tileSize,
    );

    await Promise.all(
      coordinates.map(async (coordinate) => {
        const dx0 = Math.max(coordinate.x, imageBounds.x);
        const dy0 = Math.max(coordinate.y, imageBounds.y);
        const dx1 = Math.min(
          coordinate.x + coordinate.width,
          imageBounds.x + imageBounds.w,
        );
        const dy1 = Math.min(
          coordinate.y + coordinate.height,
          imageBounds.y + imageBounds.h,
        );
        if (dx1 <= dx0 || dy1 <= dy0) return;
        const key = `${level}:${coordinate.key}`;
        visibleKeys.add(key);
        const cached = this.tiles.get(key);
        if (cached) {
          cached.lastUsed = ++this.clock;
          cached.canvas.style.display = "block";
          return;
        }

        const sx = Math.max(
          0,
          Math.floor(
            ((dx0 - imageBounds.x) / imageBounds.w) *
              this.options.image.naturalWidth,
          ),
        );
        const sy = Math.max(
          0,
          Math.floor(
            ((dy0 - imageBounds.y) / imageBounds.h) *
              this.options.image.naturalHeight,
          ),
        );
        const sw = Math.max(
          1,
          Math.ceil(
            ((dx1 - dx0) / imageBounds.w) *
              this.options.image.naturalWidth,
          ),
        );
        const sh = Math.max(
          1,
          Math.ceil(
            ((dy1 - dy0) / imageBounds.h) *
              this.options.image.naturalHeight,
          ),
        );
        const width = Math.max(1, Math.ceil((dx1 - dx0) * scale));
        const height = Math.max(1, Math.ceil((dy1 - dy0) * scale));
        const bitmap = await createImageBitmap(
          this.options.image,
          sx,
          sy,
          Math.min(sw, this.options.image.naturalWidth - sx),
          Math.min(sh, this.options.image.naturalHeight - sy),
          { resizeWidth: width, resizeHeight: height, resizeQuality: "high" },
        );
        if (generation !== this.generation) {
          bitmap.close?.();
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.style.position = "absolute";
        canvas.style.left = `${dx0}px`;
        canvas.style.top = `${dy0}px`;
        canvas.style.width = `${dx1 - dx0}px`;
        canvas.style.height = `${dy1 - dy0}px`;
        canvas.style.pointerEvents = "none";
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        bitmap.close?.();
        this.options.root.appendChild(canvas);
        this.tiles.set(key, { key, canvas, lastUsed: ++this.clock });
      }),
    );

    for (const [key, tile] of this.tiles) {
      tile.canvas.style.display = visibleKeys.has(key) ? "block" : "none";
    }
    const maxTiles = this.options.maxTiles ?? 64;
    const excess = this.tiles.size - maxTiles;
    if (excess > 0) {
      const removable = [...this.tiles.values()]
        .filter((tile) => !visibleKeys.has(tile.key))
        .sort((a, b) => a.lastUsed - b.lastUsed)
        .slice(0, excess);
      for (const tile of removable) {
        tile.canvas.remove();
        this.tiles.delete(tile.key);
      }
    }
  }

  setVisible(visible: boolean): void {
    this.options.root.style.display = visible ? "block" : "none";
  }

  dispose(): void {
    this.generation += 1;
    for (const tile of this.tiles.values()) tile.canvas.remove();
    this.tiles.clear();
  }
}
