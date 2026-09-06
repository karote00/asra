import { afterEach, expect, it, vi } from 'vitest'
import { IDENTITY_POSE } from '../../../domain/math'
import {
  intervalAlgebra,
  poseOperations
} from '../../../domain/kinematic-algebra'
import type { MeshGeometry } from '../../../domain/part-geometry'
import * as indexModule from '../mesh-index'
import { MeshWorkLimit, OriginalMeshQuery } from '../original-mesh-query'

const ops = poseOperations(intervalAlgebra)
const geometry: MeshGeometry = Object.freeze({
  kind: 'mesh',
  version: 1,
  source: { assetId: 'a'.repeat(64), scale: [1, 1, 1] as const },
  positions: Object.freeze([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
  indices: Object.freeze([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3])
})
const mesh = { geometry, pose: ops.fromPose(IDENTITY_POSE) }
const sphere = (x: number) => ({
  geometry: { kind: 'sphere' as const, radius: 0.02 },
  pose: ops.fromPose({ ...IDENTITY_POSE, position: [x, 0.2, 0.2] })
})

afterEach(() => vi.restoreAllMocks())

it('reuses immutable preparation between independent pose queries with exact evidence and logical-work parity', () => {
  const indices = new WeakMap()
  const build = vi.spyOn(indexModule, 'buildMeshIndex')
  const warmResults = [5, 0.2, 3].map((x) => {
    const query = new OriginalMeshQuery(undefined, 500000, true, indices)
    const result = query.distance(mesh, sphere(x), 0.02, 1e-6, 48)

    return { result, work: query.work }
  })

  expect(build).toHaveBeenCalledTimes(1)

  for (const [i, x] of [5, 0.2, 3].entries()) {
    const cold = new OriginalMeshQuery()

    expect(cold.distance(mesh, sphere(x), 0.02, 1e-6, 48)).toEqual(
      warmResults[i].result
    )
    expect(cold.work).toBe(warmResults[i].work)
  }
})

it('misses replaced or mutable geometry and retains no failed preparation', () => {
  const indices = new WeakMap()
  const build = vi.spyOn(indexModule, 'buildMeshIndex')
  const query = () => new OriginalMeshQuery(undefined, 500000, true, indices)

  query().distance(mesh, sphere(5), 0.02, 1e-6, 48)
  query().distance(
    { ...mesh, geometry: Object.freeze({ ...geometry }) },
    sphere(5),
    0.02,
    1e-6,
    48
  )
  const mutable = { ...mesh, geometry: structuredClone(geometry) }

  query().distance(mutable, sphere(5), 0.02, 1e-6, 48)
  mutable.geometry.positions = mutable.geometry.positions.map((value, i) =>
    i === 3 ? 0.5 : value
  )
  query().distance(mutable, sphere(5), 0.02, 1e-6, 48)

  expect(build).toHaveBeenCalledTimes(4)

  const fresh = new WeakMap()
  expect(() =>
    new OriginalMeshQuery(undefined, 1, true, fresh).distance(
      mesh,
      sphere(5),
      0.02,
      1e-6,
      48
    )
  ).toThrow(MeshWorkLimit)
  new OriginalMeshQuery(undefined, 500000, true, fresh).distance(
    mesh,
    sphere(5),
    0.02,
    1e-6,
    48
  )
  expect(build).toHaveBeenCalledTimes(6)
})

it('retains independent invocation budgets and current cancellation on warm hits', () => {
  const indices = new WeakMap()
  const first = new OriginalMeshQuery(undefined, 500000, true, indices)
  first.distance(mesh, sphere(5), 0.02, 1e-6, 48)

  expect(() =>
    new OriginalMeshQuery(undefined, first.work - 1, true, indices).distance(
      mesh,
      sphere(5),
      0.02,
      1e-6,
      48
    )
  ).toThrow(MeshWorkLimit)
  expect(() =>
    new OriginalMeshQuery(
      () => {
        throw new Error('cancelled')
      },
      500000,
      true,
      indices
    ).distance(mesh, sphere(5), 0.02, 1e-6, 48)
  ).toThrow('cancelled')
  expect(
    new OriginalMeshQuery(undefined, first.work, true, indices).distance(
      mesh,
      sphere(5),
      0.02,
      1e-6,
      48
    )
  ).toEqual(first.distance(mesh, sphere(5), 0.02, 1e-6, 48))
})
