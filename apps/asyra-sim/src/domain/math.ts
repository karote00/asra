export type Vec3 = readonly [number, number, number]
export type Quaternion = readonly [number, number, number, number]
export interface Pose {
  position: Vec3
  rotation: Quaternion
}
export const IDENTITY_POSE: Pose = Object.freeze({
  position: Object.freeze([0, 0, 0]) as Vec3,
  rotation: Object.freeze([0, 0, 0, 1]) as Quaternion
})
export const add = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2]
]
export const subtract = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2]
]
export const scale = (a: Vec3, s: number): Vec3 => [
  a[0] * s,
  a[1] * s,
  a[2] * s
]
export const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
]
export const magnitude = (a: Vec3): number => Math.hypot(...a)
export const distance = (a: Vec3, b: Vec3): number => magnitude(subtract(a, b))
export function normalize(a: Vec3): Vec3 {
  const largest = Math.max(...a.map(Math.abs))
  if (!a.every(Number.isFinite) || largest === 0)
    throw new Error('Axis must be finite and nonzero')
  const reduced: Vec3 = [a[0] / largest, a[1] / largest, a[2] / largest]
  const length = magnitude(reduced)
  if (largest < 1e-12 && largest * length < 1e-12)
    throw new Error('Axis must be finite and nonzero')
  return scale(reduced, 1 / length)
}
export function normalizeQuaternion(q: Quaternion): Quaternion {
  const length = Math.hypot(...q)
  if (!Number.isFinite(length) || length < 1e-12)
    throw new Error('Quaternion must be finite and nonzero')
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length]
}
export const conjugate = (q: Quaternion): Quaternion => [
  -q[0],
  -q[1],
  -q[2],
  q[3]
]
export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return normalizeQuaternion([
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ])
}
export function rotate(q: Quaternion, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]]
  const t = scale(cross(u, v), 2)
  return add(v, add(scale(t, q[3]), cross(u, t)))
}
export function axisAngle(axis: Vec3, angle: number): Quaternion {
  if (!Number.isFinite(angle)) throw new Error('Angle must be finite')
  const unit = normalize(axis),
    s = Math.sin(angle / 2)
  return [unit[0] * s, unit[1] * s, unit[2] * s, Math.cos(angle / 2)]
}
export const compose = (parent: Pose, local: Pose): Pose => ({
  position: add(parent.position, rotate(parent.rotation, local.position)),
  rotation: multiply(parent.rotation, local.rotation)
})
export const transformPoint = (pose: Pose, point: Vec3): Vec3 =>
  add(pose.position, rotate(pose.rotation, point))
export const inversePoint = (pose: Pose, point: Vec3): Vec3 =>
  rotate(conjugate(pose.rotation), subtract(point, pose.position))

export function lengthInMeters(value: number, unit: 'mm' | 'm'): number {
  if (!Number.isFinite(value)) throw new Error('Length must be finite')
  if (unit === 'mm') return value / 1000
  if (unit === 'm') return value
  throw new Error('Explicit length units are required')
}
export function angleInRadians(value: number, unit: 'deg' | 'rad'): number {
  if (!Number.isFinite(value)) throw new Error('Angle must be finite')
  if (unit === 'deg') return (value * Math.PI) / 180
  if (unit === 'rad') return value
  throw new Error('Explicit angle units are required')
}
