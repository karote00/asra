import { expect, it } from 'vitest'
import { IDENTITY_POSE, axisAngle, transformPoint } from '../../domain/math'
import type { Body, Workcell } from '../../domain/workcell'
import type { VisualAsset } from '../../engine/glb/decode'
import {
  createWorkcellFrame,
  DEFAULT_CAMERA,
  prepareWorkcellProjection
} from '../workcell-frame'
import { resolvePartWorkcell } from '../../domain/part-geometry'

const assetId = 'a'.repeat(64)
const asset: VisualAsset = {
  format: 'restricted-glb-v0',
  source: { sha256: assetId, byteLength: 100, lengthUnit: 'm' },
  meshes: [
    {
      name: 'Reference',
      sourceNode: 0,
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
      color: 0xabcdef,
      opacity: 0.8
    }
  ],
  bounds: { min: [0, 0, 0], max: [1, 1, 0] }
}
const body = (id: string, parentId: string | null): Body => ({
  id,
  parentId,
  name: id,
  role: 'link',
  pose: IDENTITY_POSE,
  visible: true,
  color: 0x123456,
  joint: { kind: 'fixed', axis: [0, 0, 1], value: 0, min: 0, max: 0 },
  colliders: []
})
const model = (): Workcell => ({
  version: 1,
  robotRootId: 'base',
  bodies: [
    {
      ...body('base', null),
      pose: { ...IDENTITY_POSE, position: [1, 2, 0] },
      joint: { kind: 'revolute', axis: [0, 0, 1], value: 0, min: -4, max: 4 }
    },
    {
      ...body('tool', 'base'),
      pose: { ...IDENTITY_POSE, position: [2, 0, 0] },
      colliders: [
        {
          id: 'proxy',
          pose: IDENTITY_POSE,
          geometry: { kind: 'sphere', radius: 1 }
        }
      ],
      visuals: [
        {
          version: 1,
          id: 'reference',
          assetId,
          pose: {
            position: [1, 0, 0],
            rotation: axisAngle([0, 0, 1], Math.PI / 2)
          },
          scale: [2, 3, 4]
        }
      ]
    }
  ]
})
const view = { camera: DEFAULT_CAMERA, grid: false, selectedId: null }
const resources = new Map([[assetId, asset]])

it('retains complete placed triangles across pose/appearance frames and replaces them for new source inputs', () => {
  const workcell = model(),
    project = prepareWorkcellProjection(workcell, resources)
  const initial = project(view).meshes[0].descriptor.shape
  for (const angle of [0, 0.3, 1.2]) {
    const options = {
      ...view,
      joints: { base: angle },
      selectedId: 'tool',
      wireframe: true
    }
    const frame = project(options)
    expect(frame).toEqual(createWorkcellFrame(workcell, options, resources))
    expect(frame.meshes[0].descriptor.shape).toBe(initial)
  }
  const binding = workcell.bodies[1].visuals?.[0]
  if (!binding) throw new Error('Missing original binding')
  binding.scale = [4, 3, 2]
  const replacement = prepareWorkcellProjection(workcell, resources)(view)
  expect(replacement.meshes[0].descriptor.shape).not.toEqual(initial)
  expect(project(view).meshes[0].descriptor.shape).toBe(initial)
})

it.each([0, Math.PI / 2, -Math.PI / 4])(
  'projects the exact resolved original part at %s without surrogate geometry',
  (angle) => {
    const workcell = model(),
      before = structuredClone(workcell),
      source = structuredClone(asset)
    const frame = createWorkcellFrame(
      workcell,
      { ...view, joints: { base: angle } },
      resources
    )
    const visual = frame.meshes.find(
      (mesh) => mesh.descriptor.shape.kind === 'triangles'
    )
    expect(visual).toBeDefined()
    if (!visual || visual.descriptor.shape.kind !== 'triangles')
      throw new Error('Missing visual projection')
    expect(visual.elementId).toBe('tool')
    expect(visual.descriptor.shape.positions).toEqual([
      0, 0, 0, 2, 0, 0, 0, 3, 0
    ])
    expect(visual.descriptor.color).toBe(0xabcdef)
    expect(visual.descriptor.opacity).toBe(0.8)
    for (const [point, x, y] of [
      [[0, 0, 0] as const, 3, 0],
      [[2, 0, 0] as const, 3, 2],
      [[0, 3, 0] as const, 0, 0]
    ] as const) {
      const world = transformPoint(visual.descriptor, point)
      expect(world[0]).toBeCloseTo(
        1 + x * Math.cos(angle) - y * Math.sin(angle),
        12
      )
      expect(world[1]).toBeCloseTo(
        2 + x * Math.sin(angle) + y * Math.cos(angle),
        12
      )
    }
    const proxy = frame.meshes.find(
      (mesh) => mesh.descriptor.shape.kind === 'sphere'
    )
    expect(proxy).toBeUndefined()
    const resolved = resolvePartWorkcell(workcell, resources).bodies[1]
      .colliders[0].geometry
    expect(resolved.kind).toBe('mesh')
    if (resolved.kind !== 'mesh')
      throw new Error('Missing resolved original part')
    expect(visual.descriptor.shape.positions).toEqual(resolved.positions)
    expect(visual.descriptor.shape.indices).toEqual(resolved.indices)
    expect(workcell).toEqual(before)
    expect(asset).toEqual(source)
  }
)

it('keeps visual/proxy display controls transient and inherits hidden ancestry', () => {
  const workcell = model(),
    before = structuredClone(workcell)
  expect(
    createWorkcellFrame(workcell, { ...view, visuals: false }, resources).meshes
  ).toHaveLength(0)
  expect(
    createWorkcellFrame(workcell, { ...view, proxies: false }, resources)
      .meshes[0].descriptor.shape.kind
  ).toBe('triangles')
  expect(
    createWorkcellFrame(
      workcell,
      { ...view, proxies: false, visuals: false },
      resources
    ).meshes
  ).toHaveLength(0)
  expect(workcell).toEqual(before)
  workcell.bodies[0].visible = false
  expect(
    createWorkcellFrame(workcell, view, resources).meshes.every(
      (mesh) => !mesh.visible
    )
  ).toBe(true)
  expect(() =>
    createWorkcellFrame(workcell, { ...view, visuals: false })
  ).toThrow('Missing visual source')
})

it('does not synthesize colliders for a visual-only body and preserves independent instance identities', () => {
  const workcell = model(),
    tool = workcell.bodies[1]
  tool.colliders = []
  const binding = tool.visuals?.[0]
  if (!binding) throw new Error('Missing test binding')
  tool.visuals = [binding, { ...binding, id: 'second', scale: [1, 1, 1] }]
  const frame = createWorkcellFrame(workcell, view, resources)
  expect(frame.meshes).toHaveLength(2)
  expect(new Set(frame.meshes.map((mesh) => mesh.id)).size).toBe(2)
  expect(
    frame.meshes.every(
      (mesh) =>
        mesh.elementId === 'tool' && mesh.descriptor.shape.kind === 'triangles'
    )
  ).toBe(true)
  expect(tool.colliders).toEqual([])
})
