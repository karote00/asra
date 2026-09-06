export const SPATIAL_PROPERTY = 'spatialV0'
export const SPATIAL_CAPABILITY = 'sim.spatial.v0'

export type SpatialVector = readonly [number, number, number]
export type SpatialQuaternion = readonly [number, number, number, number]
export type SpatialShape =
  | { kind: 'box'; size: SpatialVector }
  | { kind: 'sphere'; radius: number }
  | { kind: 'capsule'; radius: number; length: number }
  | {
      kind: 'triangles'
      positions: readonly number[]
      indices: readonly number[]
    }

export type SpatialDescriptor =
  | {
      kind: 'camera'
      position: SpatialVector
      target: SpatialVector
      fov: number
      near: number
      far: number
    }
  | {
      kind: 'mesh'
      position: SpatialVector
      rotation: SpatialQuaternion
      shape: SpatialShape
      color: number
      opacity: number
      wireframe: boolean
      selectable: boolean
    }

// Weak admission receipts, not caller-identity caches. Only detached, deeply
// frozen products created below enter these sets; caller freezing proves nothing.
const admittedShapes = new WeakSet<object>()
const admittedDescriptors = new WeakSet<object>()

/** Compare accepted geometry values, not caller-owned object identity. */
export function sameSpatialShape(a: SpatialShape, b: SpatialShape): boolean {
  if (a === b && admittedShapes.has(a)) return true
  const equal = (x: readonly number[], y: readonly number[]) =>
    x.length === y.length && x.every((value, index) => value === y[index])
  switch (a.kind) {
    case 'box':
      return b.kind === 'box' && equal(a.size, b.size)
    case 'sphere':
      return b.kind === 'sphere' && a.radius === b.radius
    case 'capsule':
      return (
        b.kind === 'capsule' && a.radius === b.radius && a.length === b.length
      )
    case 'triangles':
      return (
        b.kind === 'triangles' &&
        equal(a.positions, b.positions) &&
        equal(a.indices, b.indices)
      )
  }
}

const finiteTuple = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) &&
  value.length === length &&
  value.every(Number.isFinite)
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function isSpatialShape(value: unknown): value is SpatialShape {
  if (!record(value)) return false
  if (value.kind === 'box')
    return finiteTuple(value.size, 3) && value.size.every(positive)
  if (value.kind === 'sphere') return positive(value.radius)
  if (value.kind === 'capsule') {
    return (
      positive(value.radius) &&
      typeof value.length === 'number' &&
      Number.isFinite(value.length) &&
      value.length >= 0
    )
  }
  if (value.kind !== 'triangles') return false
  const { positions, indices } = value
  return (
    Array.isArray(positions) &&
    positions.length >= 9 &&
    positions.length <= 3000000 &&
    positions.length % 3 === 0 &&
    positions.every(Number.isFinite) &&
    Array.isArray(indices) &&
    indices.length >= 3 &&
    indices.length <= 3000000 &&
    indices.length % 3 === 0 &&
    indices.every(
      (i) => Number.isSafeInteger(i) && i >= 0 && i < positions.length / 3
    )
  )
}

export function readSpatialShape(value: unknown): SpatialShape {
  if (record(value) && admittedShapes.has(value)) return value as SpatialShape
  const snapshot: unknown = structuredClone(value)
  if (!isSpatialShape(snapshot)) throw new Error('Invalid spatial shape')
  let shape: SpatialShape
  if (snapshot.kind === 'triangles')
    shape = {
      kind: 'triangles',
      positions: Object.freeze(snapshot.positions),
      indices: Object.freeze(snapshot.indices)
    }
  else if (snapshot.kind === 'box')
    shape = { kind: 'box', size: Object.freeze(snapshot.size) }
  else if (snapshot.kind === 'sphere')
    shape = { kind: 'sphere', radius: snapshot.radius }
  else
    shape = {
      kind: 'capsule',
      radius: snapshot.radius,
      length: snapshot.length
    }
  Object.freeze(shape)
  admittedShapes.add(shape)
  return shape
}

export function readSpatialDescriptor(value: unknown): SpatialDescriptor {
  if (record(value) && admittedDescriptors.has(value))
    return value as SpatialDescriptor
  if (record(value)) {
    const snapshot = { ...value }
    for (const key of ['position', 'target', 'rotation']) {
      if (Array.isArray(snapshot[key])) snapshot[key] = [...snapshot[key]]
    }
    value = snapshot
  }
  if (!record(value) || !finiteTuple(value.position, 3)) {
    throw new Error('Invalid spatial descriptor or position')
  }
  if (value.kind === 'camera') {
    if (
      !finiteTuple(value.target, 3) ||
      !positive(value.fov) ||
      value.fov >= 170 ||
      !positive(value.near) ||
      !positive(value.far) ||
      value.far <= value.near
    ) {
      throw new Error('Invalid perspective camera')
    }
    const direction = value.target.map(
      (v, i) => v - (value.position as number[])[i]
    )
    if (Math.hypot(direction[0], direction[2]) < 1e-10) {
      throw new Error('Camera direction cannot be parallel to the Y-up axis')
    }
  } else if (value.kind === 'mesh') {
    if (
      !finiteTuple(value.rotation, 4) ||
      Math.abs(Math.hypot(...value.rotation) - 1) > 1e-8 ||
      !Number.isInteger(value.color) ||
      (value.color as number) < 0 ||
      (value.color as number) > 0xffffff ||
      typeof value.opacity !== 'number' ||
      !Number.isFinite(value.opacity) ||
      value.opacity < 0 ||
      value.opacity > 1 ||
      typeof value.selectable !== 'boolean' ||
      typeof value.wireframe !== 'boolean'
    ) {
      throw new Error('Invalid spatial mesh')
    }
  } else {
    throw new Error('Unsupported spatial descriptor kind')
  }
  const position = Object.freeze([...(value.position as number[])])
  const descriptor =
    value.kind === 'camera'
      ? {
          kind: 'camera',
          position,
          target: Object.freeze([...(value.target as number[])]),
          fov: value.fov,
          near: value.near,
          far: value.far
        }
      : {
          kind: 'mesh',
          position,
          rotation: Object.freeze([...(value.rotation as number[])]),
          shape: readSpatialShape(value.shape),
          color: value.color,
          opacity: value.opacity,
          wireframe: value.wireframe,
          selectable: value.selectable
        }
  Object.freeze(descriptor)
  admittedDescriptors.add(descriptor)
  return descriptor as SpatialDescriptor
}
