import type { CoordinateSpace, ObjectTransform, Vector3 } from "./types";

export type Mat3 = [number, number, number, number, number, number];

/** 2D affine matrix [a, b, c, d, e, f] for ax+cy+e / bx+dy+f. */
export function identityMat3(): Mat3 {
  return [1, 0, 0, 1, 0, 0];
}

export function multiplyMat3(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function transformFromMat3(m: Mat3): ObjectTransform {
  const scaleX = Math.hypot(m[0], m[1]);
  const scaleY = Math.hypot(m[2], m[3]);
  const rotationZ = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
  return {
    position: { x: m[4], y: m[5], z: 0 },
    rotation: { x: 0, y: 0, z: rotationZ },
    scale: { x: scaleX || 1, y: scaleY || 1, z: 1 },
  };
}

export function mat3FromTransform(t: ObjectTransform): Mat3 {
  const rad = (t.rotation.z * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = t.scale.x;
  const sy = t.scale.y;
  return [
    cos * sx,
    sin * sx,
    -sin * sy,
    cos * sy,
    t.position.x,
    t.position.y,
  ];
}

export function applyMat3ToPoint(m: Mat3, p: Vector3): Vector3 {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
    z: p.z,
  };
}

export function invertMat3(m: Mat3): Mat3 | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  return [
    m[3] * invDet,
    -m[1] * invDet,
    -m[2] * invDet,
    m[0] * invDet,
    (m[2] * m[5] - m[3] * m[4]) * invDet,
    (m[1] * m[4] - m[0] * m[5]) * invDet,
  ];
}

/**
 * Default transform space by object role.
 * Doors/windows → wall-local; furniture → floor-local; free objects → world.
 */
export function defaultTransformSpace(
  objectType: string,
  hasHost: boolean,
): CoordinateSpace {
  if (objectType === "door" || objectType === "window") {
    return hasHost ? "wall-local" : "world";
  }
  if (
    objectType === "furniture" ||
    objectType === "fixture" ||
    objectType === "light" ||
    objectType === "room"
  ) {
    return "floor-local";
  }
  if (objectType === "mass-face") return "object-local";
  return "world";
}

export function translateTransform(
  t: ObjectTransform,
  delta: Vector3,
): ObjectTransform {
  return {
    ...t,
    position: {
      x: t.position.x + delta.x,
      y: t.position.y + delta.y,
      z: t.position.z + delta.z,
    },
  };
}

export function rotateTransformZ(
  t: ObjectTransform,
  degrees: number,
): ObjectTransform {
  return {
    ...t,
    rotation: {
      ...t.rotation,
      z: t.rotation.z + degrees,
    },
  };
}

export function scaleTransform(
  t: ObjectTransform,
  factor: Vector3,
  uniform = false,
): ObjectTransform {
  const sx = factor.x;
  const sy = uniform ? factor.x : factor.y;
  const sz = uniform ? factor.x : factor.z;
  return {
    ...t,
    scale: {
      x: t.scale.x * sx,
      y: t.scale.y * sy,
      z: t.scale.z * sz,
    },
  };
}
