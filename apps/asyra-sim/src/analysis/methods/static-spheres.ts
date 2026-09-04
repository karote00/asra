import { MethodIds, MethodVersions } from '../../constants'
import { iadd, interval, isub } from '../../domain/interval'
import {
  evaluateKinematics,
  interpolateSegment,
  intervalAlgebra,
  poseOperations
} from '../../domain/kinematic-algebra'
import {
  EXPERIMENT_RESOURCE_PROFILE,
  type AnalysisColliderReference,
  type ExperimentSnapshot
} from '../contracts'
import type {
  InstalledMethodDescriptor,
  MethodEvidence,
  MethodPairEvidence
} from '../../extensions/contracts'
import { validParameterValues } from '../../extensions/descriptor'
import type { IntervalEvidence, PairEvidence } from './continuous-query'

export const STATIC_SPHERE_METHOD: InstalledMethodDescriptor = Object.freeze({
  id: MethodIds.STATIC_SPHERES,
  version: MethodVersions.STATIC_SPHERES,
  geometryKinds: Object.freeze(['sphere'] as const),
  supportsStatic: true,
  supportsMotion: false,
  maxPairs: EXPERIMENT_RESOURCE_PROFILE.maxPairs,
  warningWorkUnits: EXPERIMENT_RESOURCE_PROFILE.warningWorkUnits,
  manifest: Object.freeze({
    contractVersion: 1,
    name: 'Analytical static spheres',
    origin: 'example',
    author: 'Asyra Sim contributors',
    source: 'src/analysis/methods/static-spheres.ts',
    license: 'MIT',
    purpose: 'Independent local SDK example for static sphere-pair clearance.',
    units: 'm-rad-s',
    coordinates: 'right-handed-z-up',
    applicability:
      'One static keyframe; sphere radii 0.0001-20 m; shared machine-scale domain limits. No motion, meshes, dynamics or physical-safety certification.',
    numericalSemantics:
      'Outward center norm minus outward radius sum; unsigned lower/upper distance bounds and strict penetration. Touching and threshold overlap remain unresolved.',
    controls:
      'Noniterative static query: common distanceTolerance, timeTolerance and maxIterations do not change it. additionalError widens bounds in meters, never narrows them.',
    reproducibility:
      'Deterministic binary64 interval operations; no random seed. Browser arithmetic conformance remains required.',
    resources:
      'One evaluation per pair. Global pair, evidence, wall-time and cancellation/termination limits apply; no commercial runtime.',
    services: Object.freeze({
      network: false,
      additionalFiles: false,
      commercialRuntime: false
    }),
    validation: Object.freeze({
      status: 'unverified',
      evidence:
        'Independent analytical static-sphere cases in static-spheres.test.ts. Example status is not an official endorsement or independent numerical audit.'
    })
  }),
  parameterSchema: Object.freeze({
    additionalError: Object.freeze({
      kind: 'number',
      label: 'Additional absolute uncertainty',
      unit: 'm',
      min: 0,
      max: 0.001,
      default: 0
    })
  })
})

/** Pure analytical implementation, independent of the official convex search. */
export function runStaticSphereMethod(
  snapshot: ExperimentSnapshot,
  checkpoint: () => void = () => undefined,
  onPair: (pair: MethodPairEvidence) => void = () => undefined
): MethodEvidence {
  if (
    snapshot.method.id !== STATIC_SPHERE_METHOD.id ||
    snapshot.method.version !== STATIC_SPHERE_METHOD.version ||
    snapshot.trajectory.keyframes.length !== 1 ||
    snapshot.interval[0] !== snapshot.interval[1] ||
    !snapshot.pairs.length
  )
    throw new Error(
      'Static-sphere method requires its exact version and a static sphere scope'
    )
  if (
    !validParameterValues(
      STATIC_SPHERE_METHOD.parameterSchema,
      snapshot.method.settings.parameters ?? {}
    )
  )
    throw new Error('Invalid static-sphere method parameters')
  checkpoint()
  const extra = snapshot.method.settings.parameters?.additionalError as number,
    ops = poseOperations(intervalAlgebra),
    values = interpolateSegment(
      snapshot.trajectory,
      0,
      interval(snapshot.interval[0]),
      intervalAlgebra
    ),
    poses = evaluateKinematics(snapshot.workcell, values, intervalAlgebra)
  const resolve = (reference: AnalysisColliderReference) => {
    const body = snapshot.workcell.bodies.find(
        (item) => item.id === reference.bodyId
      ),
      collider = body?.colliders.find(
        (item) => item.id === reference.colliderId
      ),
      pose = poses.get(reference.bodyId)
    if (!pose || collider?.geometry.kind !== 'sphere')
      throw new Error('Static-sphere method received unsupported geometry')
    return {
      center: ops.compose(pose, ops.fromPose(collider.pose)).position,
      radius: interval(collider.geometry.radius)
    }
  }
  const pairs: MethodPairEvidence[] = []
  let evaluations = 0
  for (const pair of snapshot.pairs) {
    checkpoint()
    let evidence: PairEvidence
    if (evaluations >= snapshot.budget.maxIntervals) {
      evidence = {
        lower: 0,
        upper: null,
        coverage: 'partial',
        evaluations: 0,
        leaves: [
          {
            start: snapshot.interval[0],
            end: snapshot.interval[1],
            lower: 0,
            upper: null,
            witnessTime: null,
            penetration: false,
            state: 'unresolved',
            reason: 'Global evaluation budget exhausted before this pair.'
          }
        ]
      }
    } else {
      const a = resolve(pair.a),
        b = resolve(pair.b),
        gap = iadd(
          isub(ops.norm(ops.sub(a.center, b.center)), iadd(a.radius, b.radius)),
          interval(-extra, extra)
        ),
        penetration = gap[1] < 0,
        lower = Math.max(0, gap[0]),
        upper = Math.max(0, gap[1])
      let state: IntervalEvidence['state'] = 'unresolved',
        reason =
          'Analytical distance interval overlaps contact or the decision threshold.'
      if (penetration) {
        state = 'finding'
        reason = 'Strict analytical sphere penetration bound.'
      } else if (upper < snapshot.rule.minimumClearance) {
        state = 'finding'
        reason = 'Analytical distance upper bound is below the threshold.'
      } else if (lower > snapshot.rule.minimumClearance) {
        state = 'clear'
        reason = 'Analytical distance lower bound exceeds the threshold.'
      }
      evaluations++
      evidence = {
        lower,
        upper,
        coverage: state === 'unresolved' ? 'partial' : 'complete',
        evaluations: 1,
        leaves: [
          {
            start: snapshot.interval[0],
            end: snapshot.interval[1],
            lower,
            upper,
            witnessTime: snapshot.interval[0],
            penetration,
            state,
            reason
          }
        ]
      }
    }
    evidence.leaves.forEach(Object.freeze)
    Object.freeze(evidence.leaves)
    const completed = Object.freeze({
      pairId: pair.id,
      evidence: Object.freeze(evidence)
    })
    pairs.push(completed)
    onPair(completed)
  }
  return Object.freeze({
    version: 1,
    snapshotId: snapshot.snapshotId,
    method: Object.freeze({
      id: STATIC_SPHERE_METHOD.id,
      version: STATIC_SPHERE_METHOD.version
    }),
    coverage: pairs.some((pair) => pair.evidence.coverage === 'partial')
      ? 'partial'
      : 'complete',
    evaluations,
    pairs: Object.freeze(pairs)
  })
}
