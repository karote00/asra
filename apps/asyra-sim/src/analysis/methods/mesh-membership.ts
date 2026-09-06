import {
  iadd,
  idiv,
  ineg,
  interval,
  isub,
  type Interval
} from '../../domain/interval'
import {
  intervalAlgebra,
  poseOperations,
  type Vector
} from '../../domain/kinematic-algebra'
import type { Vec3 } from '../../domain/math'
import type { ConvexShape } from './convex-query'
import {
  localPoint,
  type Bounds,
  type MeshIndex,
  type MeshNode
} from './mesh-index'

const ops = poseOperations(intervalAlgebra)
export type Membership = 'inside' | 'outside' | 'unknown'
const directions: readonly Vec3[] = [
  [1, 0.371, 0.529],
  [0.293, 1, 0.617],
  [0.431, 0.173, 1]
]

function rayMayHit(
  origin: Vector<Interval>,
  direction: Vec3,
  bounds: Bounds
): boolean {
  let near = 0,
    far = Infinity
  for (let axis = 0; axis < 3; axis++) {
    const range = idiv(
      isub(bounds[axis], origin[axis]),
      interval(direction[axis])
    )
    near = Math.max(near, range[0])
    far = Math.min(far, range[1])
  }
  return near <= far
}

/** Signed ray crossings per closed component; uncertain edge hits retry, never round. */
export function meshMembership(
  point: Vector<Interval>,
  index: MeshIndex,
  checkpoint: () => void
): Membership {
  if (
    point.some(
      (axis, i) =>
        axis[1] < index.root.bounds[i][0] || axis[0] > index.root.bounds[i][1]
    )
  )
    return 'outside'
  for (const direction of directions) {
    const crossings = new Int32Array(index.componentCount),
      d = ops.vector(direction)
    const pending: MeshNode[] = [index.root]
    let uncertain = false
    while (pending.length && !uncertain) {
      checkpoint()
      const node = pending.pop()
      if (!node) throw new Error('Missing pending mesh node')
      if (!rayMayHit(point, direction, node.bounds)) continue
      if (node.children) {
        pending.push(...node.children)
        continue
      }
      for (const triangle of node.triangles) {
        checkpoint()
        if (!rayMayHit(point, direction, triangle.bounds)) continue
        const [a, b, c] = triangle.vertices.map(ops.vector),
          e1 = ops.sub(b, a),
          e2 = ops.sub(c, a)
        const p = ops.cross(d, e2),
          determinant = ops.dot(e1, p)
        if (determinant[0] <= 0 && determinant[1] >= 0) {
          uncertain = true
          break
        }
        const tvec = ops.sub(point, a),
          u = idiv(ops.dot(tvec, p), determinant)
        if (u[1] < 0 || u[0] > 1) continue
        const q = ops.cross(tvec, e1),
          v = idiv(ops.dot(d, q), determinant),
          sum = iadd(u, v)
        if (v[1] < 0 || sum[0] > 1) continue
        const time = idiv(ops.dot(e2, q), determinant)
        if (time[1] < 0) continue
        if (u[0] <= 0 || v[0] <= 0 || sum[1] >= 1 || time[0] <= 0) {
          uncertain = true
          break
        }
        crossings[triangle.component] += determinant[0] > 0 ? 1 : -1
      }
    }
    if (!uncertain)
      return crossings.some((count) => count !== 0) ? 'inside' : 'outside'
  }
  return 'unknown'
}

export function shapeMembership(
  point: Vector<Interval>,
  shape: ConvexShape,
  index: MeshIndex | undefined,
  checkpoint: () => void
): Membership {
  const local = localPoint(shape.pose, point),
    g = shape.geometry
  if (g.kind === 'mesh') {
    if (!index) throw new Error('Missing mesh membership index')
    return meshMembership(local, index, checkpoint)
  }
  if (g.kind === 'triangle') return 'unknown'
  if (g.kind === 'box') {
    if (
      local.every(
        (value, axis) =>
          value[0] > -g.size[axis] / 2 && value[1] < g.size[axis] / 2
      )
    )
      return 'inside'
    if (
      local.some(
        (value, axis) =>
          value[1] < -g.size[axis] / 2 || value[0] > g.size[axis] / 2
      )
    )
      return 'outside'
    return 'unknown'
  }
  let vector = local
  if (g.kind === 'capsule') {
    const y = local[1],
      half = interval(g.length / 2)
    const above = isub(y, half),
      below = isub(ineg(y), half)
    vector = [
      local[0],
      interval(
        Math.max(0, above[0], below[0]),
        Math.max(0, above[1], below[1])
      ),
      local[2]
    ]
  }
  const distance = ops.norm(vector)
  if (distance[1] < g.radius) return 'inside'
  return distance[0] > g.radius ? 'outside' : 'unknown'
}
