import { expect, it } from 'vitest'
import { RenderContainer } from '@asyra/render'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import {
  createWorkcellFrame,
  DEFAULT_CAMERA,
  prepareWorkcellProjection
} from '../workcell-frame'
import { SpatialLayer } from '../spatial-layer'
import { compose } from '../../domain/math'
import { forwardKinematics } from '../../domain/workcell'

it('highlights both complete parts without replacing their shapes and restores selection afterward', () => {
  const { workcell } = createSyntheticExample()
  const ids = workcell.bodies.slice(0, 2).map((body) => body.id)
  const project = prepareWorkcellProjection(workcell, new Map())
  const view = { camera: DEFAULT_CAMERA, selectedId: ids[0], grid: false }
  const original = project(view)
  const highlighted = project({
    ...view,
    highlight: { bodyIds: ids, color: 0xff625e }
  })

  for (const mesh of highlighted.meshes) {
    const source = original.meshes.find((item) => item.id === mesh.id)

    if (!source) throw new Error('Missing original mesh')

    expect(mesh.descriptor.shape).toBe(source.descriptor.shape)
    expect(mesh.descriptor.position).toEqual(source.descriptor.position)
    expect(mesh.descriptor.color).toBe(
      mesh.elementId && ids.includes(mesh.elementId)
        ? 0xff625e
        : source.descriptor.color
    )
  }

  expect(project(view)).toEqual(original)
})

it('inherits parent visibility for display without changing analysis geometry', () => {
  const { workcell } = createSyntheticExample()
  const hidden = {
    ...workcell,
    bodies: workcell.bodies.map((body) => ({
      ...body,
      visible: body.id !== workcell.robotRootId
    }))
  }
  const frame = createWorkcellFrame(hidden, {
    camera: DEFAULT_CAMERA,
    selectedId: null,
    grid: false
  })
  const tool = hidden.bodies.find((body) => body.role === 'tool')
  expect(tool?.visible).toBe(true)
  expect(
    frame.meshes.find((mesh) => mesh.elementId === tool?.id)?.visible
  ).toBe(false)
  expect(
    hidden.bodies.every(
      (body, index) =>
        body.colliders.length === workcell.bodies[index].colliders.length
    )
  ).toBe(true)
})

it('projects shared domain poses and body identity without mutating canonical input', () => {
  const { workcell } = createSyntheticExample(),
    before = structuredClone(workcell)
  const body = workcell.bodies[3],
    pose = forwardKinematics(workcell).get(body.id)
  if (!pose) throw new Error('Missing example pose')
  const frame = createWorkcellFrame(workcell, {
    camera: DEFAULT_CAMERA,
    selectedId: body.id,
    grid: true
  })
  const projected = frame.meshes.find((mesh) => mesh.elementId === body.id)
  expect(projected?.descriptor.position).toEqual(
    compose(pose, body.colliders[0].pose).position
  )
  expect(projected?.descriptor.color).toBe(0x62e6c1)
  expect(
    frame.meshes
      .filter((mesh) => mesh.id.startsWith('workspace:'))
      .every((mesh) => !mesh.descriptor.selectable)
  ).toBe(true)
  expect(workcell).toEqual(before)
  const layer = new SpatialLayer(() => undefined)
  layer.submit(frame)
  layer.registration.update?.()
  const container = layer.registration.layer
  if (!(container instanceof RenderContainer))
    throw new Error('Missing registered container')
  const selectedMesh = container.children.find(
    (child) => child.label === body.id
  )
  expect(selectedMesh).toBeDefined()
  layer.dispose()
})
