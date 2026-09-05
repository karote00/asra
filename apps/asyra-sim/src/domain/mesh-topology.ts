import type { MeshGeometry } from './part-geometry'
import { intervalAlgebra, poseOperations } from './kinematic-algebra'
import type { Vec3 } from './math'

export interface MeshTopology {
  /** Original triangle offsets, grouped by connected shell. */
  components: readonly (readonly number[])[]
  issue: string | null
}

/** Exact coordinate adjacency only. No epsilon welding, triangle removal or hole repair. */
export function inspectMeshTopology(
  mesh: MeshGeometry,
  checkpoint: () => void = () => undefined
): MeshTopology {
  const ops = poseOperations(intervalAlgebra)
  const vertices = new Map<string, number>(),
    canonical: number[] = []
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const key = mesh.positions.slice(i, i + 3).join(',')
    let id = vertices.get(key)
    if (id === undefined) {
      id = vertices.size
      vertices.set(key, id)
    }
    canonical.push(id)
  }
  const edges = new Map<
    string,
    { triangle: number; from: number; to: number }
  >()
  const adjacency: number[][] = Array.from(
    { length: mesh.indices.length / 3 },
    () => []
  )
  const closed = new Set<string>()
  const invalid = (issue: string): MeshTopology => ({ components: [], issue })
  for (let t = 0; t < mesh.indices.length; t += 3) {
    if (t % 768 === 0) checkpoint()
    const ids = mesh.indices.slice(t, t + 3)
    const points = ids.map((id) =>
      ops.vector(mesh.positions.slice(id * 3, id * 3 + 3) as unknown as Vec3)
    )
    const normal = ops.cross(
      ops.sub(points[1], points[0]),
      ops.sub(points[2], points[0])
    )
    if (!normal.some((axis) => axis[0] > 0 || axis[1] < 0))
      return invalid('Degenerate or numerically ambiguous original triangle')
    for (let e = 0; e < 3; e++) {
      const from = canonical[ids[e]],
        to = canonical[ids[(e + 1) % 3]]
      if (from === to) return invalid('Degenerate original triangle edge')
      const key = from < to ? `${from}:${to}` : `${to}:${from}`
      if (closed.has(key)) return invalid('Non-manifold original part edge')
      const previous = edges.get(key)
      if (previous) {
        if (previous.from !== to || previous.to !== from)
          return invalid('Inconsistent original part triangle orientation')
        adjacency[t / 3].push(previous.triangle)
        adjacency[previous.triangle].push(t / 3)
        edges.delete(key)
        closed.add(key)
      } else edges.set(key, { triangle: t / 3, from, to })
    }
  }
  if (edges.size)
    return invalid('Open original part surface: closed solids are required')
  const seen = new Set<number>(),
    components: number[][] = []
  for (let t = 0; t < adjacency.length; t++) {
    if (seen.has(t)) continue
    const component: number[] = [],
      pending = [t]
    seen.add(t)
    while (pending.length) {
      const triangle = pending.pop()
      if (triangle === undefined) throw new Error('Missing topology face')
      component.push(triangle * 3)
      for (const next of adjacency[triangle])
        if (!seen.has(next)) {
          seen.add(next)
          pending.push(next)
        }
    }
    components.push(component)
  }
  // Separate closed components may touch at a vertex. Each component's fan
  // must still be connected; a pinched shell is not a manifold component.
  for (const component of components) {
    const incident = new Map<number, Set<number>>()
    for (const t of component)
      for (let v = 0; v < 3; v++) {
        const id = canonical[mesh.indices[t + v]]
        let faces = incident.get(id)
        if (!faces) {
          faces = new Set()
          incident.set(id, faces)
        }
        faces.add(t / 3)
      }
    for (const faces of incident.values()) {
      const first = faces.values().next().value
      if (first === undefined) throw new Error('Empty topology vertex fan')
      const pending = [first],
        reached = new Set(pending)
      while (pending.length) {
        const face = pending.pop()
        if (face === undefined) throw new Error('Missing vertex fan face')
        for (const next of adjacency[face]) {
          if (faces.has(next) && !reached.has(next)) {
            reached.add(next)
            pending.push(next)
          }
        }
      }
      if (reached.size !== faces.size)
        return invalid('Non-manifold original part vertex fan')
    }
  }
  return { components, issue: null }
}
