import { interval, type Interval } from '../../domain/interval'
import {
  evaluateKinematics,
  interpolateSegment,
  intervalAlgebra,
  poseOperations
} from '../../domain/kinematic-algebra'
import type { Trajectory, Workcell } from '../../domain/workcell'
import {
  convexDistance,
  separationLowerBound,
  type ConvexShape,
  type DistanceEvidence
} from './convex-query'

export interface ColliderReference {
  bodyId: string
  colliderId: string
}
export interface PairQuery {
  workcell: Workcell
  trajectory: Trajectory
  a: ColliderReference
  b: ColliderReference
  interval: readonly [number, number]
}
export interface QuerySettings {
  threshold: number
  distanceTolerance: number
  timeTolerance: number
  maxIntervals: number
  maxIterations: number
}
export interface IntervalEvidence {
  start: number
  end: number
  lower: number
  upper: number | null
  witnessTime: number | null
  penetration: boolean
  state: 'clear' | 'finding' | 'unresolved'
  reason: string
}
export interface PairEvidence {
  leaves: readonly IntervalEvidence[]
  lower: number
  upper: number | null
  coverage: 'complete' | 'partial'
  evaluations: number
}
const ops = poseOperations(intervalAlgebra)

function shapesAt(
  query: PairQuery,
  segment: number,
  time: Interval
): readonly [ConvexShape, ConvexShape] {
  const values = interpolateSegment(
    query.trajectory,
    segment,
    time,
    intervalAlgebra
  )
  const poses = evaluateKinematics(query.workcell, values, intervalAlgebra)
  const shape = (reference: ColliderReference): ConvexShape => {
    const body = query.workcell.bodies.find(
      (body) => body.id === reference.bodyId
    )
    const collider = body?.colliders.find(
        (collider) => collider.id === reference.colliderId
      ),
      pose = poses.get(reference.bodyId)
    if (!collider || !pose)
      throw new Error('Missing canonical collider in pair snapshot')
    return {
      geometry: collider.geometry,
      pose: ops.compose(pose, ops.fromPose(collider.pose))
    }
  }
  return [shape(query.a), shape(query.b)]
}

function checkSettings(settings: QuerySettings): void {
  if (
    !Number.isFinite(settings.threshold) ||
    settings.threshold < 0 ||
    settings.threshold > 20 ||
    !Number.isFinite(settings.distanceTolerance) ||
    settings.distanceTolerance < 1e-9 ||
    settings.distanceTolerance > 1 ||
    !Number.isFinite(settings.timeTolerance) ||
    settings.timeTolerance < 1e-9 ||
    settings.timeTolerance > 1 ||
    !Number.isInteger(settings.maxIntervals) ||
    settings.maxIntervals < 1 ||
    settings.maxIntervals > 20000 ||
    !Number.isInteger(settings.maxIterations) ||
    settings.maxIterations < 1 ||
    settings.maxIterations > 256
  )
    throw new Error('Unsupported method settings')
}

export function queryContinuousPair(
  query: PairQuery,
  settings: QuerySettings,
  checkpoint: () => void = () => undefined
): PairEvidence {
  checkSettings(settings)
  const [start, end] = query.interval,
    frames = query.trajectory.keyframes
  const first = frames[0],
    last = frames.at(-1)
  if (
    !first ||
    !last ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    start < first.time ||
    end > last.time
  )
    throw new Error('Analysis interval is not covered by the trajectory')
  if (query.a.bodyId === query.b.bodyId)
    throw new Error('Same-body shapes are not analysis pairs')
  interface Node {
    start: number
    end: number
    segment: number
  }
  const pending: Node[] = [],
    leaves: IntervalEvidence[] = []
  if (start === end) {
    const found = frames.findIndex((frame) => frame.time > start)
    pending.push({
      start,
      end,
      segment: found < 0 ? frames.length - 1 : Math.max(0, found - 1)
    })
  } else
    for (let segment = 0; segment < frames.length - 1; segment++) {
      const a = Math.max(start, frames[segment].time),
        b = Math.min(end, frames[segment + 1].time)
      if (a < b) pending.push({ start: a, end: b, segment })
    }
  let evaluations = 0
  while (pending.length && evaluations < settings.maxIntervals) {
    checkpoint()
    const node = pending.pop()
    if (!node) break
    const middle = node.start + (node.end - node.start) / 2
    let witness: DistanceEvidence | null = null,
      witnessTime = middle
    // Endpoints matter for both minima and keyframe contacts. They are evidence,
    // never a substitute for the interval-wide separating certificate below.
    for (const time of new Set([node.start, middle, node.end])) {
      checkpoint()
      const [a, b] = shapesAt(query, node.segment, interval(time))
      const result = convexDistance(
        a,
        b,
        settings.distanceTolerance,
        settings.maxIterations
      )
      if (!witness || result.upper < witness.upper || result.penetration) {
        witness = result
        witnessTime = time
      }
      if (result.penetration) break
    }
    if (!witness) throw new Error('No witness evaluation')
    evaluations++
    const [a, b] = shapesAt(query, node.segment, interval(node.start, node.end))
    const lower =
      node.start === node.end
        ? witness.lower
        : separationLowerBound(a, b, witness.axis)
    if (lower > witness.upper)
      throw new Error('Inconsistent continuous distance certificates')
    const base = {
      start: node.start,
      end: node.end,
      lower,
      upper: witness.upper,
      witnessTime,
      penetration: witness.penetration
    }
    if (witness.penetration || witness.upper < settings.threshold)
      leaves.push({
        ...base,
        state: 'finding',
        reason:
          'An observed witness establishes an issue; this is not an enumeration of every contact.'
      })
    else if (lower > settings.threshold)
      leaves.push({
        ...base,
        state: 'clear',
        reason: 'A conservative support gap covers this complete interval.'
      })
    else if (
      node.end - node.start <= settings.timeTolerance ||
      middle === node.start ||
      middle === node.end
    )
      leaves.push({
        ...base,
        state: 'unresolved',
        reason: 'Threshold uncertainty remains at the declared time resolution.'
      })
    else
      pending.push(
        { start: node.start, end: middle, segment: node.segment },
        { start: middle, end: node.end, segment: node.segment }
      )
  }
  for (const node of pending)
    leaves.push({
      start: node.start,
      end: node.end,
      lower: 0,
      upper: null,
      witnessTime: null,
      penetration: false,
      state: 'unresolved',
      reason: 'Interval budget exhausted before this leaf was resolved.'
    })
  leaves.sort((a, b) => a.start - b.start)
  if (!leaves.length) throw new Error('No valid analysis interval')
  const upper = leaves.reduce<number | null>(
    (best, leaf) =>
      leaf.upper === null ? best : Math.min(best ?? Infinity, leaf.upper),
    null
  )
  return {
    leaves,
    lower: Math.min(...leaves.map((leaf) => leaf.lower)),
    upper,
    coverage: leaves.some((leaf) => leaf.state === 'unresolved')
      ? 'partial'
      : 'complete',
    evaluations
  }
}
