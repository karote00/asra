import {
  iabs,
  iadd,
  idiv,
  imid,
  ineg,
  interval,
  imul,
  type Interval
} from '../../domain/interval'
import {
  intervalAlgebra,
  poseOperations,
  type AlgebraPose,
  type Vector
} from '../../domain/kinematic-algebra'
import {
  add,
  dot,
  magnitude,
  scale,
  subtract,
  type Vec3
} from '../../domain/math'
import type { Geometry } from '../../domain/workcell'

export interface ConvexShape {
  geometry: Geometry
  pose: AlgebraPose<Interval>
}
export interface DistanceEvidence {
  lower: number
  upper: number
  penetration: boolean
  converged: boolean
  iterations: number
  axis: Vec3
  /** Search witnesses are not contact locations when a simplex proves penetration. */
  witnessA: Vector<Interval>
  witnessB: Vector<Interval>
}
const ops = poseOperations(intervalAlgebra)
const midpoint = (v: Vector<Interval>): Vec3 => [
  imid(v[0]),
  imid(v[1]),
  imid(v[2])
]
const inverseDirection = (
  shape: ConvexShape,
  d: Vector<Interval>
): Vector<Interval> => {
  const q = shape.pose.rotation
  return ops.rotate([ineg(q[0]), ineg(q[1]), ineg(q[2]), q[3]], d)
}

/** Encloses the exact support value, even if a witness direction is ambiguous. */
export function supportValue(shape: ConvexShape, direction: Vec3): Interval {
  const world = ops.vector(direction),
    local = inverseDirection(shape, world),
    g = shape.geometry
  let extent: Interval
  if (g.kind === 'box')
    extent = local.reduce(
      (sum, value, index) =>
        iadd(sum, imul(iabs(value), interval(g.size[index] / 2))),
      interval(0)
    )
  else {
    extent = imul(interval(g.radius), ops.norm(local))
    if (g.kind === 'capsule')
      extent = iadd(extent, imul(interval(g.length / 2), iabs(local[1])))
  }
  return iadd(ops.dot(world, shape.pose.position), extent)
}

/** A point in the shape, not a claim that a floating-point branch found its exact extremum. */
function supportPoint(shape: ConvexShape, direction: Vec3): Vector<Interval> {
  const local = inverseDirection(shape, ops.vector(direction)),
    g = shape.geometry
  let point: Vector<Interval>
  if (g.kind === 'box')
    point = [0, 1, 2].map((index) =>
      interval(((imid(local[index]) < 0 ? -1 : 1) * g.size[index]) / 2)
    ) as unknown as Vector<Interval>
  else {
    const norm = ops.norm(local)
    point =
      norm[0] > 0
        ? ops.scale(local, idiv(interval(g.radius), norm))
        : ops.vector([0, 0, 0])
    if (g.kind === 'capsule')
      point = ops.add(
        point,
        ops.vector([0, ((imid(local[1]) < 0 ? -1 : 1) * g.length) / 2, 0])
      )
  }
  return ops.add(shape.pose.position, ops.rotate(shape.pose.rotation, point))
}

interface Vertex {
  a: Vector<Interval>
  b: Vector<Interval>
  difference: Vector<Interval>
  point: Vec3
}
function vertex(a: ConvexShape, b: ConvexShape, axis: Vec3): Vertex {
  const pa = supportPoint(a, axis),
    pb = supportPoint(b, scale(axis, -1)),
    difference = ops.sub(pa, pb)
  return { a: pa, b: pb, difference, point: midpoint(difference) }
}

/** Candidate search only. Certificates below do not trust this approximate solve. */
function solve(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length,
    rows = matrix.map((row, index) => [...row, rhs[index]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++)
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row
    if (Math.abs(rows[pivot][col]) < 1e-30) return null
    ;[rows[col], rows[pivot]] = [rows[pivot], rows[col]]
    const denominator = rows[col][col]
    for (let k = col; k <= n; k++) rows[col][k] /= denominator
    for (let row = 0; row < n; row++)
      if (row !== col) {
        const multiplier = rows[row][col]
        for (let k = col; k <= n; k++) rows[row][k] -= multiplier * rows[col][k]
      }
  }
  const values = rows.map((row) => row[n])
  return values.every(Number.isFinite) ? values : null
}

interface Simplex {
  vertices: Vertex[]
  weights: number[]
  point: Vec3
}
function closest(vertices: Vertex[]): Simplex {
  let best: Simplex = {
      vertices: [vertices[0]],
      weights: [1],
      point: vertices[0].point
    },
    bestSquared = dot(best.point, best.point)
  for (let mask = 1; mask < 1 << vertices.length; mask++) {
    const subset = vertices.filter((_, index) => mask & (1 << index))
    if (subset.length > 4) continue
    const anchor = subset[0].point,
      edges = subset.slice(1).map((v) => subtract(v.point, anchor))
    const weights = edges.length
      ? solve(
          edges.map((a) => edges.map((b) => dot(a, b))),
          edges.map((edge) => -dot(edge, anchor))
        )
      : []
    if (!weights) continue
    const barycentric = [
      1 - weights.reduce((sum, value) => sum + value, 0),
      ...weights
    ]
    if (barycentric.some((value) => value < 0 || value > 1)) continue
    const point = subset.reduce<Vec3>(
      (sum, v, index) => add(sum, scale(v.point, barycentric[index])),
      [0, 0, 0]
    )
    const squared = dot(point, point)
    if (squared < bestSquared) {
      best = { vertices: subset, weights: barycentric, point }
      bestSquared = squared
    }
  }
  return best
}

function interior(vertices: readonly Vertex[]): boolean {
  if (vertices.length !== 4) return false
  for (let opposite = 0; opposite < 4; opposite++) {
    const face = vertices
      .filter((_, index) => index !== opposite)
      .map((v) => v.difference)
    const normal = ops.cross(
      ops.sub(face[1], face[0]),
      ops.sub(face[2], face[0])
    )
    const originSide = ops.dot(normal, ops.scale(face[0], interval(-1)))
    const insideSide = ops.dot(
      normal,
      ops.sub(vertices[opposite].difference, face[0])
    )
    if (!(
      (originSide[0] > 0 && insideSide[0] > 0) ||
      (originSide[1] < 0 && insideSide[1] < 0)
    ))
      return false
  }
  return true
}

/** Sequential interpolation preserves exact convex membership despite rounded search weights. */
function witness(simplex: Simplex, side: 'a' | 'b'): Vector<Interval> {
  let point = simplex.vertices[0][side],
    sum = simplex.weights[0]
  for (let index = 1; index < simplex.vertices.length; index++) {
    const weight = simplex.weights[index],
      total = sum + weight
    if (total > 0) {
      const t = Math.max(0, Math.min(1, weight / total))
      point = ops.add(
        point,
        ops.scale(ops.sub(simplex.vertices[index][side], point), interval(t))
      )
    }
    sum = total
  }
  return point
}

export function separationLowerBound(
  a: ConvexShape,
  b: ConvexShape,
  axis: Vec3
): number {
  const norm = ops.norm(ops.vector(axis))
  if (norm[0] <= 0) return 0
  const support = iadd(supportValue(a, axis), supportValue(b, scale(axis, -1)))
  return Math.max(0, idiv(ineg(support), norm)[0])
}

export function convexDistance(
  a: ConvexShape,
  b: ConvexShape,
  tolerance = 1e-6,
  maxIterations = 64
): DistanceEvidence {
  if (
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    !Number.isInteger(maxIterations) ||
    maxIterations < 1 ||
    maxIterations > 256
  )
    throw new Error('Invalid convex query budget')
  let axis = subtract(midpoint(b.pose.position), midpoint(a.pose.position))
  if (magnitude(axis) < 1e-12) axis = [1, 0, 0]
  let simplex: Simplex = {
    vertices: [vertex(a, b, axis)],
    weights: [1],
    point: [0, 0, 0]
  }
  simplex.point = simplex.vertices[0].point
  let lower = 0,
    upper = Infinity,
    witnessA = a.pose.position,
    witnessB = b.pose.position
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const wa = witness(simplex, 'a'),
      wb = witness(simplex, 'b'),
      candidate = ops.norm(ops.sub(wa, wb))[1]
    if (candidate < upper) {
      upper = candidate
      witnessA = wa
      witnessB = wb
    }
    if (interior(simplex.vertices))
      return {
        lower: 0,
        upper: 0,
        penetration: true,
        converged: true,
        iterations: iteration,
        axis,
        witnessA: wa,
        witnessB: wb
      }
    axis = scale(simplex.point, -1)
    if (magnitude(axis) < 1e-12) {
      // A zero search point is not a contact proof. Try independent spanning
      // directions; strict interval tetrahedron predicates remain authoritative.
      const directions: Vec3[] = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
        [1, 1, 1],
        [-1, -1, 1],
        [-1, 1, -1],
        [1, -1, -1]
      ]
      const points = directions.map((d) => vertex(a, b, d))
      let enclosed = false
      // A lower-dimensional simplex can cross the origin without furnishing a
      // strict interior proof. Expand symmetrically, then certify a full simplex.
      for (let i = 0; i < points.length - 3 && !enclosed; i++)
        for (let j = i + 1; j < points.length - 2 && !enclosed; j++)
          for (let k = j + 1; k < points.length - 1 && !enclosed; k++)
            for (let l = k + 1; l < points.length && !enclosed; l++)
              enclosed = interior([points[i], points[j], points[k], points[l]])
      if (enclosed)
        return {
          lower: 0,
          upper: 0,
          penetration: true,
          converged: true,
          iterations: iteration,
          axis: [1, 0, 0],
          witnessA,
          witnessB
        }
      return {
        lower,
        upper,
        penetration: false,
        converged: upper - lower <= tolerance,
        iterations: iteration,
        axis: [1, 0, 0],
        witnessA,
        witnessB
      }
    }
    const bound = separationLowerBound(a, b, axis)
    lower = Math.max(lower, bound)
    if (lower > upper)
      throw new Error('Inconsistent convex distance certificates')
    if (upper - lower <= tolerance)
      return {
        lower,
        upper,
        penetration: false,
        converged: true,
        iterations: iteration,
        axis,
        witnessA,
        witnessB
      }
    const next = vertex(a, b, axis)
    simplex = closest([...simplex.vertices, next])
  }
  return {
    lower,
    upper,
    penetration: false,
    converged: false,
    iterations: maxIterations,
    axis,
    witnessA,
    witnessB
  }
}
