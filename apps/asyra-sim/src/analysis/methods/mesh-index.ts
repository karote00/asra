import type { MeshGeometry } from '../../domain/part-geometry'
import { inspectMeshTopology } from '../../domain/mesh-topology'
import type { Vec3 } from '../../domain/math'
import { interval, type Interval } from '../../domain/interval'
import {
  intervalAlgebra,
  poseOperations,
  type AlgebraPose,
  type Vector
} from '../../domain/kinematic-algebra'
import { supportValue, type ConvexShape } from './convex-query'

const ops = poseOperations(intervalAlgebra)
export type Bounds = Vector<Interval>
export interface MeshTriangle {
  offset: number
  component: number
  vertices: readonly [Vec3, Vec3, Vec3]
  bounds: Bounds
}
export interface MeshNode {
  bounds: Bounds
  triangles: readonly MeshTriangle[]
  children?: readonly [MeshNode, MeshNode]
}
export interface MeshIndex {
  root: MeshNode
  representatives: readonly Vec3[]
  componentCount: number
}

export function meshPoint(mesh: MeshGeometry, index: number): Vec3 {
  return [
    mesh.positions[index * 3],
    mesh.positions[index * 3 + 1],
    mesh.positions[index * 3 + 2]
  ]
}
export function boundsOf(points: readonly Vec3[]): Bounds {
  return [0, 1, 2].map((axis) => {
    let min = Infinity,
      max = -Infinity
    for (const point of points) {
      min = Math.min(min, point[axis])
      max = Math.max(max, point[axis])
    }
    return interval(min, max)
  }) as unknown as Bounds
}
export function buildMeshIndex(
  mesh: MeshGeometry,
  checkpoint: () => void,
  hierarchy = true
): MeshIndex {
  const topology = inspectMeshTopology(mesh, checkpoint)
  if (topology.issue) throw new Error(topology.issue)
  const triangles: MeshTriangle[] = [],
    representatives: Vec3[] = []
  topology.components.forEach((component, c) => {
    representatives.push(meshPoint(mesh, mesh.indices[component[0]]))
    for (const offset of component) {
      if (triangles.length % 256 === 0) checkpoint()
      const vertices = [0, 1, 2].map((i) =>
        meshPoint(mesh, mesh.indices[offset + i])
      ) as unknown as MeshTriangle['vertices']
      triangles.push({
        offset,
        component: c,
        vertices,
        bounds: boundsOf(vertices)
      })
    }
  })
  function build(items: MeshTriangle[]): MeshNode {
    checkpoint()
    const bounds: Bounds = [0, 1, 2].map((axis) => {
      let lo = Infinity,
        hi = -Infinity
      for (const triangle of items) {
        lo = Math.min(lo, triangle.bounds[axis][0])
        hi = Math.max(hi, triangle.bounds[axis][1])
      }
      return interval(lo, hi)
    }) as unknown as Bounds
    if (!hierarchy || items.length <= 4) return { bounds, triangles: items }
    const widths = bounds.map((axis) => axis[1] - axis[0]),
      axis = widths.indexOf(Math.max(...widths))
    items.sort(
      (a, b) =>
        a.bounds[axis][0] +
          a.bounds[axis][1] -
          (b.bounds[axis][0] + b.bounds[axis][1]) || a.offset - b.offset
    )
    const middle = Math.floor(items.length / 2)
    return {
      bounds,
      triangles: [],
      children: [build(items.slice(0, middle)), build(items.slice(middle))]
    }
  }
  return {
    root: build(triangles),
    representatives,
    componentCount: topology.components.length
  }
}
export function worldPoint(
  pose: AlgebraPose<Interval>,
  point: Vec3
): Vector<Interval> {
  return ops.add(pose.position, ops.rotate(pose.rotation, ops.vector(point)))
}
export function localPoint(
  pose: AlgebraPose<Interval>,
  point: Vector<Interval>
): Vector<Interval> {
  const q = pose.rotation
  return ops.rotate(
    [[-q[0][1], -q[0][0]], [-q[1][1], -q[1][0]], [-q[2][1], -q[2][0]], q[3]],
    ops.sub(point, pose.position)
  )
}
export function worldBounds(
  bounds: Bounds,
  pose: AlgebraPose<Interval>
): Bounds {
  return ops.add(pose.position, ops.rotate(pose.rotation, bounds))
}
export function shapeBounds(shape: ConvexShape, index?: MeshIndex): Bounds {
  if (shape.geometry.kind === 'mesh') {
    if (!index) throw new Error('Missing complete mesh index')
    return worldBounds(index.root.bounds, shape.pose)
  }
  return [0, 1, 2].map((axis) => {
    const direction: [number, number, number] = [0, 0, 0]
    direction[axis] = 1
    const hi = supportValue(shape, direction)[1]
    direction[axis] = -1
    return interval(-supportValue(shape, direction)[1], hi)
  }) as unknown as Bounds
}
/** L-infinity separation is a conservative Euclidean lower bound. */
export function boundsGap(a: Bounds, b: Bounds): number {
  let gap = 0
  for (let i = 0; i < 3; i++)
    gap = Math.max(
      gap,
      intervalAlgebra.sub(interval(a[i][0]), interval(b[i][1]))[0],
      intervalAlgebra.sub(interval(b[i][0]), interval(a[i][1]))[0]
    )
  return gap
}
