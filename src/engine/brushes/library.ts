import {
  BRUSH_CATEGORY_LABELS,
  BRUSH_FAMILIES,
  BRUSH_SUBFAMILIES,
  BUILTIN_BRUSH_PRESETS,
  getBuiltinBrush,
} from "./presets";
import type { BrushCategory, BrushPreset } from "./types";

export type BrushLibraryOptions = {
  custom?: BrushPreset[];
};

/**
 * In-memory brush library: built-ins + user/imported presets.
 * Favorites / recent are session-persisted by the host UI.
 */
export class BrushLibrary {
  private readonly builtins: BrushPreset[];
  private custom: BrushPreset[];
  private favorites = new Set<string>();
  private recent: string[] = [];

  constructor(options: BrushLibraryOptions = {}) {
    this.builtins = BUILTIN_BRUSH_PRESETS.map((b) => ({ ...b }));
    this.custom = (options.custom ?? []).map((b) => ({ ...b }));
  }

  all(): BrushPreset[] {
    return [...this.builtins, ...this.custom];
  }

  get(id: string): BrushPreset | undefined {
    return (
      this.builtins.find((b) => b.id === id) ||
      this.custom.find((b) => b.id === id)
    );
  }

  byCategory(category: BrushCategory): BrushPreset[] {
    return this.all().filter((b) => b.category === category);
  }

  categories(): BrushCategory[] {
    const seen = new Set<BrushCategory>();
    const order: BrushCategory[] = [];
    for (const b of this.all()) {
      if (!seen.has(b.category)) {
        seen.add(b.category);
        order.push(b.category);
      }
    }
    return order;
  }

  categoryLabel(category: BrushCategory): string {
    return BRUSH_CATEGORY_LABELS[category] ?? category;
  }

  search(query: string): BrushPreset[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.all();
    return this.all().filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.category.includes(q) ||
        b.id.includes(q),
    );
  }

  addCustom(brush: BrushPreset): void {
    const next = {
      ...brush,
      builtIn: false,
      source: brush.source === "imported" ? "imported" : "user-created",
      updatedAt: new Date().toISOString(),
    } as BrushPreset;
    const idx = this.custom.findIndex((b) => b.id === next.id);
    if (idx >= 0) this.custom[idx] = next;
    else this.custom.push(next);
  }

  removeCustom(id: string): boolean {
    const before = this.custom.length;
    this.custom = this.custom.filter((b) => b.id !== id);
    this.favorites.delete(id);
    this.recent = this.recent.filter((r) => r !== id);
    return this.custom.length < before;
  }

  setCustom(brushes: BrushPreset[]): void {
    this.custom = brushes.map((b) => ({ ...b, builtIn: false }));
  }

  getCustom(): BrushPreset[] {
    return this.custom.slice();
  }

  toggleFavorite(id: string): boolean {
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
      return false;
    }
    this.favorites.add(id);
    return true;
  }

  isFavorite(id: string): boolean {
    return this.favorites.has(id);
  }

  markRecent(id: string): void {
    this.recent = [id, ...this.recent.filter((r) => r !== id)].slice(0, 12);
  }

  getRecent(): BrushPreset[] {
    return this.recent
      .map((id) => this.get(id))
      .filter((b): b is BrushPreset => Boolean(b));
  }

  getFavorites(): BrushPreset[] {
    return this.all().filter((b) => this.favorites.has(b.id));
  }

  familyOf(id: string): string | null {
    const brush = this.get(id);
    if (brush?.family) return brush.family;
    for (const [fam, ids] of Object.entries(BRUSH_FAMILIES)) {
      if (ids.includes(id)) return fam;
      for (const parentId of ids) {
        if (BRUSH_SUBFAMILIES[parentId]?.includes(id)) return fam;
      }
    }
    return null;
  }

  familyMembers(family: string): BrushPreset[] {
    return this.all().filter((brush) => brush.family === family);
  }
}

export function createBrushLibrary(options?: BrushLibraryOptions): BrushLibrary {
  return new BrushLibrary(options);
}

export { getBuiltinBrush, BRUSH_FAMILIES, BRUSH_CATEGORY_LABELS };
