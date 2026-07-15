export function createLayerEngineId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createFloorId(): string {
  return createLayerEngineId("floor");
}

export function createLayerId(): string {
  return createLayerEngineId("layer");
}

export function createObjectId(prefix = "obj"): string {
  return createLayerEngineId(prefix);
}
