import { hasExactOwnKeys } from './records'
import type { Vec3 } from './math'
import type { Body, Collider, VisualBinding, Workcell } from './workcell'

/** Complete, source-ordered triangles in canonical meters; never a hull or LOD. */
export interface MeshGeometry {
  kind: 'mesh'
  version: 1
  source: { assetId: string; scale: Vec3 }
  positions: readonly number[]
  indices: readonly number[]
}

/** Decoder handoff; appearance is intentionally not an analysis input. */
export interface PartSource {
  source: { sha256: string }
  meshes: readonly {
    positions: readonly number[]
    indices: readonly number[]
  }[]
}

export const PART_GEOMETRY_LIMITS = Object.freeze({
  vertices: 200000,
  indices: 600000,
  workcellVertices: 500000,
  workcellIndices: 1500000,
  coordinate: 1000,
  minScale: 0.000001,
  maxScale: 1000
})

export function validMeshGeometry(value: unknown): value is MeshGeometry {
  if (
    !hasExactOwnKeys(value, [
      'kind',
      'version',
      'source',
      'positions',
      'indices'
    ]) ||
    value.kind !== 'mesh' ||
    value.version !== 1 ||
    !hasExactOwnKeys(value.source, ['assetId', 'scale']) ||
    typeof value.source.assetId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.source.assetId) ||
    !Array.isArray(value.source.scale) ||
    value.source.scale.length !== 3 ||
    !value.source.scale.every(
      (n) =>
        Number.isFinite(n) &&
        n >= PART_GEOMETRY_LIMITS.minScale &&
        n <= PART_GEOMETRY_LIMITS.maxScale
    ) ||
    !Array.isArray(value.positions) ||
    value.positions.length < 9 ||
    value.positions.length % 3 !== 0 ||
    value.positions.length > PART_GEOMETRY_LIMITS.vertices * 3 ||
    !value.positions.every(
      (n) =>
        Number.isFinite(n) && Math.abs(n) <= PART_GEOMETRY_LIMITS.coordinate
    ) ||
    !Array.isArray(value.indices) ||
    value.indices.length < 3 ||
    value.indices.length % 3 !== 0 ||
    value.indices.length > PART_GEOMETRY_LIMITS.indices
  )
    return false
  const count = value.positions.length / 3
  return value.indices.every((n) => Number.isInteger(n) && n >= 0 && n < count)
}

/** Shared placement: source values are scaled once into canonical local vertices. */
export function placedPartPositions(
  positions: readonly number[],
  scale: Vec3
): number[] {
  return positions.map((value, index) => value * scale[index % 3])
}

export function resolvePart(
  binding: VisualBinding,
  source: PartSource
): Collider {
  if (source.source.sha256 !== binding.assetId)
    throw new Error('Original part source identity mismatch')
  const positions: number[] = [],
    indices: number[] = []
  for (const mesh of source.meshes) {
    const offset = positions.length / 3
    for (const value of placedPartPositions(mesh.positions, binding.scale))
      positions.push(value)
    for (const index of mesh.indices) indices.push(index + offset)
  }
  const geometry: MeshGeometry = {
    kind: 'mesh',
    version: 1,
    source: { assetId: binding.assetId, scale: [...binding.scale] },
    positions,
    indices
  }
  if (!validMeshGeometry(geometry))
    throw new Error(
      'Original part geometry exceeds the supported source profile'
    )
  return { id: binding.id, pose: structuredClone(binding.pose), geometry }
}

/** Derived input only: no canonical writes, source repair, or surrogate fallback. */
export function resolvePartWorkcell(
  workcell: Workcell,
  sources: ReadonlyMap<string, PartSource>
): Workcell {
  let vertices = 0,
    indices = 0
  for (const body of workcell.bodies)
    for (const binding of body.visuals ?? []) {
      const source = sources.get(binding.assetId)
      if (!source)
        throw new Error(`Missing original part source ${binding.assetId}`)
      for (const mesh of source.meshes) {
        vertices += mesh.positions.length / 3
        indices += mesh.indices.length
      }
      if (
        vertices > PART_GEOMETRY_LIMITS.workcellVertices ||
        indices > PART_GEOMETRY_LIMITS.workcellIndices
      )
        throw new Error(
          'Workcell exceeds the aggregate original part geometry limit'
        )
    }
  return {
    ...workcell,
    bodies: workcell.bodies.map((body) => ({
      ...body,
      colliders: body.visuals?.length
        ? body.visuals.map((binding) => {
            const source = sources.get(binding.assetId)
            if (!source)
              throw new Error(`Missing original part source ${binding.assetId}`)
            return resolvePart(binding, source)
          })
        : body.colliders
    }))
  }
}

/** Resolved snapshot bindings must exactly cover all parts and retain placement. */
export function hasResolvedParts(
  body: Pick<Body, 'colliders' | 'visuals'>
): boolean {
  if (!body.visuals?.length) return true
  return (
    body.colliders.length === body.visuals.length &&
    body.visuals.every((binding, index) => {
      const collider = body.colliders[index],
        geometry = collider?.geometry
      return (
        collider?.id === binding.id &&
        geometry?.kind === 'mesh' &&
        geometry.source.assetId === binding.assetId &&
        geometry.source.scale.every(
          (value, axis) => value === binding.scale[axis]
        ) &&
        collider.pose.position.every(
          (value, axis) => value === binding.pose.position[axis]
        ) &&
        collider.pose.rotation.every(
          (value, axis) => value === binding.pose.rotation[axis]
        )
      )
    })
  )
}
