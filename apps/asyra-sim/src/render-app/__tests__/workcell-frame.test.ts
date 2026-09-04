import { expect, it } from 'vitest'
import { RenderContainer } from '@asyra/render'
import { createSyntheticExample } from '../../../samples/synthetic-workcell'
import { createWorkcellFrame, DEFAULT_CAMERA } from '../workcell-frame'
import { SpatialLayer } from '../spatial-layer'
import { compose } from '../../domain/math'
import { forwardKinematics } from '../../domain/workcell'

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
