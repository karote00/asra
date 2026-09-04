import { describe, expect, it } from 'vitest'
import {
  intervalAlgebra,
  poseOperations
} from '../../../domain/kinematic-algebra'
import {
  IDENTITY_POSE,
  axisAngle,
  compose,
  type Pose
} from '../../../domain/math'
import type { Geometry } from '../../../domain/workcell'
import { convexDistance, type ConvexShape } from '../convex-query'

const ops = poseOperations(intervalAlgebra)
const shape = (
  geometry: Geometry,
  pose: Pose = IDENTITY_POSE
): ConvexShape => ({ geometry, pose: ops.fromPose(pose) })
const geometries: Geometry[] = [
  { kind: 'sphere', radius: 1 },
  { kind: 'box', size: [2, 2, 2] },
  { kind: 'capsule', radius: 1, length: 2 }
]
describe('convex distance certificates', () => {
  it('establishes shallow overlap on either side of a collinear closest simplex', () => {
    const sphere = { kind: 'sphere' as const, radius: 0.1 }
    for (const sign of [-1, 1]) {
      const result = convexDistance(
        shape(sphere, { ...IDENTITY_POSE, position: [3 + sign * 0.15, 0, 0] }),
        shape(sphere, { ...IDENTITY_POSE, position: [3, 0, 0] })
      )
      expect(result.penetration).toBe(true)
    }
  })
  it('keeps finite, conservative bounds at the supported shape-ratio and coordinate limits', () => {
    const small = shape(
      { kind: 'sphere', radius: 0.0001 },
      { ...IDENTITY_POSE, position: [1000, 0, 0] }
    )
    const large = shape(
      { kind: 'sphere', radius: 20 },
      { ...IDENTITY_POSE, position: [970, 0, 0] }
    )
    const result = convexDistance(small, large)
    expect(result.lower).toBeLessThanOrEqual(9.9999)
    expect(result.upper).toBeGreaterThanOrEqual(9.9999)
    expect(result.upper - result.lower).toBeLessThan(1e-6)
  })
  for (let a = 0; a < 3; a++)
    for (let b = a; b < 3; b++) {
      const ga = geometries[a],
        gb = geometries[b]
      it(`${ga.kind}/${gb.kind}: encloses analytic separation with symmetry and transformed axes`, () => {
        for (const angle of [0, 0.3, 1.2]) {
          const rotation: Pose = {
            position: [13, -20, 3],
            rotation: axisAngle([1, 2, 3], angle)
          }
          const sa = shape(ga, rotation),
            sb = shape(
              gb,
              compose(rotation, { ...IDENTITY_POSE, position: [5, 0, 0] })
            )
          const result = convexDistance(sa, sb),
            reverse = convexDistance(sb, sa)
          for (const evidence of [result, reverse]) {
            expect(evidence.lower).toBeLessThanOrEqual(3)
            expect(evidence.upper).toBeGreaterThanOrEqual(3)
            expect(evidence.upper - evidence.lower).toBeLessThan(1e-6)
            expect(evidence.penetration).toBe(false)
          }
        }
      })
      it(`${ga.kind}/${gb.kind}: establishes strict overlap but does not certify touching`, () => {
        const overlap = convexDistance(
          shape(ga),
          shape(gb, { ...IDENTITY_POSE, position: [0.3, 0.1, 0.2] })
        )
        expect(overlap.penetration).toBe(true)
        expect(overlap.lower).toBe(0)
        expect(overlap.upper).toBe(0)
        const touching = convexDistance(
          shape(ga),
          shape(gb, { ...IDENTITY_POSE, position: [2, 0, 0] })
        )
        expect(touching.penetration).toBe(false)
        expect(touching.lower).toBe(0)
        expect(touching.upper).toBeLessThan(1e-5)
      })
    }
  it('bounds an independent sphere diagonal and capsule endpoint distance', () => {
    const sphere = { kind: 'sphere', radius: 0.5 } as const
    const diagonal = convexDistance(
      shape(sphere),
      shape(sphere, { ...IDENTITY_POSE, position: [3, 4, 0] })
    )
    expect(diagonal.lower).toBeLessThanOrEqual(4)
    expect(diagonal.upper).toBeGreaterThanOrEqual(4)
    expect(diagonal.upper - diagonal.lower).toBeLessThan(1e-6)
    const capsule = { kind: 'capsule', radius: 1, length: 2 } as const
    const endpoint = convexDistance(
      shape(capsule),
      shape(capsule, { ...IDENTITY_POSE, position: [0, 7, 0] })
    )
    expect(endpoint.lower).toBeLessThanOrEqual(3)
    expect(endpoint.upper).toBeGreaterThanOrEqual(3)
  })
  it('preserves a bounded nonconverged result when an iteration budget is exhausted', () => {
    const result = convexDistance(
      shape({ kind: 'box', size: [2, 3, 4] }),
      shape(
        { kind: 'capsule', radius: 0.2, length: 2 },
        { position: [4, 4, 4], rotation: axisAngle([1, 3, 2], 0.7) }
      ),
      1e-12,
      1
    )
    expect(result.converged).toBe(false)
    expect(result.iterations).toBe(1)
    expect(result.lower).toBeGreaterThanOrEqual(0)
    expect(result.upper).toBeGreaterThanOrEqual(result.lower)
  })
})
