import {
  intervalAlgebra,
  poseOperations,
  type Vector
} from '../../domain/kinematic-algebra'
import type { Interval } from '../../domain/interval'
import type { MeshGeometry } from '../../domain/part-geometry'
import { EXPERIMENT_RESOURCE_PROFILE } from '../contracts'
import {
  convexDistance,
  type ConvexShape,
  type DistanceEvidence
} from './convex-query'
import {
  boundsGap,
  buildMeshIndex,
  shapeBounds,
  worldBounds,
  worldPoint,
  type MeshIndex,
  type MeshNode
} from './mesh-index'
import { shapeMembership } from './mesh-membership'

const ops = poseOperations(intervalAlgebra)
export class MeshWorkLimit extends Error {}

/** One execution-owned query context. No renderer, document mutation or global state. */
export class OriginalMeshQuery {
  work = 0
  private readonly indices = new WeakMap<MeshGeometry, MeshIndex>()
  constructor(
    private readonly checkpoint: () => void = () => undefined,
    private readonly maxWork: number = EXPERIMENT_RESOURCE_PROFILE.maxWorkUnits,
    private readonly hierarchy = true
  ) {}

  private tick = () => {
    this.checkpoint()
    if (++this.work > this.maxWork)
      throw new MeshWorkLimit('The original-triangle work budget was exhausted')
  }
  private index(shape: ConvexShape): MeshIndex | undefined {
    const geometry = shape.geometry
    if (geometry.kind !== 'mesh') return undefined
    const immutable =
      Object.isFrozen(geometry) &&
      Object.isFrozen(geometry.positions) &&
      Object.isFrozen(geometry.indices)
    if (immutable) {
      const retained = this.indices.get(geometry)
      if (retained) return retained
    }
    const index = buildMeshIndex(geometry, this.tick, this.hierarchy)
    if (immutable) this.indices.set(geometry, index)
    return index
  }
  private witness(shape: ConvexShape, index?: MeshIndex): Vector<Interval> {
    return index
      ? worldPoint(shape.pose, index.representatives[0])
      : shape.pose.position
  }
  distance(
    a: ConvexShape,
    b: ConvexShape,
    threshold: number,
    tolerance: number,
    iterations: number
  ): DistanceEvidence {
    if (a.geometry.kind !== 'mesh' && b.geometry.kind !== 'mesh')
      return convexDistance(a, b, tolerance, iterations)
    this.tick()
    const ai = this.index(a),
      bi = this.index(b)
    const wa = this.witness(a, ai),
      wb = this.witness(b, bi)
    let result: DistanceEvidence = {
      lower: 0,
      upper: ops.norm(ops.sub(wa, wb))[1],
      penetration: false,
      converged: false,
      iterations: 0,
      axis: [1, 0, 0],
      witnessA: wa,
      witnessB: wb
    }
    const gap = boundsGap(shapeBounds(a, ai), shapeBounds(b, bi))
    if (gap > threshold) return { ...result, lower: gap }
    let unknown = false
    for (const [from, fi, to, ti] of [
      [a, ai, b, bi],
      [b, bi, a, ai]
    ] as const) {
      const points = fi
        ? fi.representatives.map((point) => worldPoint(from.pose, point))
        : [from.pose.position]
      for (const point of points) {
        this.tick()
        const membership = shapeMembership(point, to, ti, this.tick)
        if (membership === 'inside')
          return {
            ...result,
            upper: 0,
            penetration: true,
            converged: true,
            witnessA: point,
            witnessB: point
          }
        unknown ||= membership === 'unknown'
      }
    }
    const pending: [MeshNode | undefined, MeshNode | undefined][] = [
      [ai?.root, bi?.root]
    ]
    let lower = Infinity
    while (pending.length) {
      this.tick()
      const pair = pending.pop()
      if (!pair) throw new Error('Missing pending mesh pair')
      const [an, bn] = pair
      const bound = boundsGap(
        an ? worldBounds(an.bounds, a.pose) : shapeBounds(a),
        bn ? worldBounds(bn.bounds, b.pose) : shapeBounds(b)
      )
      if (bound > threshold) {
        lower = Math.min(lower, bound)
        continue
      }
      if (an?.children) {
        for (const child of an.children) pending.push([child, bn])
        continue
      }
      if (bn?.children) {
        for (const child of bn.children) pending.push([an, child])
        continue
      }
      for (const at of an?.triangles ?? [undefined])
        for (const bt of bn?.triangles ?? [undefined]) {
          this.tick()
          const ab = at ? worldBounds(at.bounds, a.pose) : shapeBounds(a),
            bb = bt ? worldBounds(bt.bounds, b.pose) : shapeBounds(b)
          const triangleGap = boundsGap(ab, bb)
          if (triangleGap > threshold) {
            lower = Math.min(lower, triangleGap)
            continue
          }
          const sa: ConvexShape = at
            ? {
                geometry: { kind: 'triangle', vertices: at.vertices },
                pose: a.pose
              }
            : a
          const sb: ConvexShape = bt
            ? {
                geometry: { kind: 'triangle', vertices: bt.vertices },
                pose: b.pose
              }
            : b
          const evidence = convexDistance(sa, sb, tolerance, iterations)
          lower = Math.min(lower, evidence.lower)
          if (evidence.penetration || evidence.upper < result.upper)
            result = evidence
          if (result.penetration || result.upper < threshold)
            return { ...result, lower: 0 }
        }
    }
    if (lower > result.upper)
      throw new Error('Inconsistent original mesh distance certificates')
    return {
      ...result,
      lower: unknown ? 0 : lower,
      converged: !unknown && result.upper - lower <= tolerance
    }
  }

  /** A positive surface gap plus an outside static witness excludes containment
   * throughout a connected time interval: entering requires a surface crossing. */
  lowerOver(
    a: ConvexShape,
    b: ConvexShape,
    threshold: number,
    witness: DistanceEvidence,
    tolerance = 1e-6,
    iterations = 48
  ): number {
    this.tick()
    const ai = this.index(a),
      bi = this.index(b)
    if (!ai && !bi)
      throw new Error('Native interval queries use their analytical kernel')
    const overall = boundsGap(shapeBounds(a, ai), shapeBounds(b, bi))
    if (overall > threshold) return overall
    if (witness.lower <= 0) return 0
    const pending: [MeshNode | undefined, MeshNode | undefined][] = [
      [ai?.root, bi?.root]
    ]
    let lower = Infinity
    while (pending.length) {
      this.tick()
      const pair = pending.pop()
      if (!pair) throw new Error('Missing pending mesh pair')
      const [an, bn] = pair
      const gap = boundsGap(
        an ? worldBounds(an.bounds, a.pose) : shapeBounds(a),
        bn ? worldBounds(bn.bounds, b.pose) : shapeBounds(b)
      )
      if (gap > threshold) {
        lower = Math.min(lower, gap)
        continue
      }
      if (an?.children) {
        for (const child of an.children) pending.push([child, bn])
        continue
      }
      if (bn?.children) {
        for (const child of bn.children) pending.push([an, child])
        continue
      }
      for (const at of an?.triangles ?? [undefined])
        for (const bt of bn?.triangles ?? [undefined]) {
          this.tick()
          let gap = boundsGap(
            at ? worldBounds(at.bounds, a.pose) : shapeBounds(a),
            bt ? worldBounds(bt.bounds, b.pose) : shapeBounds(b)
          )
          if (gap <= threshold) {
            // A box overlap is not a surface overlap. Search an axis, then use
            // the original triangle's outward support over the complete interval.
            const sa: ConvexShape = at
              ? {
                  geometry: { kind: 'triangle', vertices: at.vertices },
                  pose: a.pose
                }
              : a
            const sb: ConvexShape = bt
              ? {
                  geometry: { kind: 'triangle', vertices: bt.vertices },
                  pose: b.pose
                }
              : b
            gap = convexDistance(sa, sb, tolerance, iterations).lower
            if (gap <= threshold) return 0
          }
          lower = Math.min(lower, gap)
        }
    }
    return lower
  }
}
