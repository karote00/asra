import type { Body, Collider, Geometry } from '../../domain/workcell'

export function newGeometry(kind: string): Geometry {
  if (kind === 'box') return { kind: 'box', size: [0.2, 0.2, 0.2] }

  if (kind === 'sphere') return { kind: 'sphere', radius: 0.1 }

  return { kind: 'capsule', radius: 0.1, length: 0.3 }
}

export function shapeUpdate(
  body: Body,
  update: (patch: Partial<Body>) => void,
  id: string,
  change: Partial<Collider>
) {
  update({
    colliders: body.colliders.map((item) =>
      item.id === id ? { ...item, ...change } : item
    )
  })
}
