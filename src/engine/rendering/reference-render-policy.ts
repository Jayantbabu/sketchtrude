export type ReferenceRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function rectContains(
  outer: ReferenceRect | null | undefined,
  inner: ReferenceRect | null | undefined,
  epsilon = 0.01,
): boolean {
  if (!outer || !inner) return false;
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    inner.x + inner.w <= outer.x + outer.w + epsilon &&
    inner.y + inner.h <= outer.y + outer.h + epsilon
  );
}

export function shouldReuseReferenceRender(options: {
  renderedBox?: ReferenceRect | null;
  visibleBox?: ReferenceRect | null;
  renderedPixelsPerUnit?: number;
  targetPixelsPerUnit?: number;
  minimumScaleRatio?: number;
  maximumScaleRatio?: number;
}): boolean {
  const {
    renderedBox,
    visibleBox,
    renderedPixelsPerUnit = 0,
    targetPixelsPerUnit = 0,
    minimumScaleRatio = 0.9,
    maximumScaleRatio = 1.5,
  } = options;
  if (!rectContains(renderedBox, visibleBox)) return false;
  if (renderedPixelsPerUnit <= 0 || targetPixelsPerUnit <= 0) return false;
  const ratio = renderedPixelsPerUnit / targetPixelsPerUnit;
  return ratio >= minimumScaleRatio && ratio <= maximumScaleRatio;
}
