import { afterEach, describe, expect, it, vi } from 'vitest'
import { RenderContainer, RenderMesh } from '@asyra/render'
import { SPATIAL_PROPERTY } from '../../engine/spatial-contract'
import { SpatialLayer, type SpatialFrame } from '../spatial-layer'

const frame: SpatialFrame = {
  camera: {
    kind: 'camera',
    position: [0, 0, 5],
    target: [0, 0, 0],
    fov: 60,
    near: 0.01,
    far: 100
  },
  meshes: [
    {
      id: 'body-a',
      visible: true,
      descriptor: {
        kind: 'mesh',
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        shape: { kind: 'box', size: [1, 1, 1] },
        color: 0x0088aa,
        opacity: 1,
        wireframe: false,
        selectable: true
      }
    }
  ]
}
describe('Spatial projection owner', () => {
  afterEach(() => vi.restoreAllMocks())
  it('coalesces camera bursts without resubmitting meshes and preserves a pending model update', () => {
    const invalidate = vi.fn(),
      layer = new SpatialLayer(invalidate)
    layer.submit(frame)
    layer.registration.update?.()
    const update = vi.spyOn(RenderMesh.prototype, 'update')
    invalidate.mockClear()
    for (let i = 1; i <= 60; i++)
      layer.submitCamera({ ...frame.camera, position: [i, 0, 5] })
    expect(invalidate).toHaveBeenCalledTimes(1)
    layer.registration.update?.()
    expect(update).not.toHaveBeenCalled()
    const container = layer.registration.layer
    if (!(container instanceof RenderContainer))
      throw new Error('Missing spatial container')
    expect(
      container.children[0].getEngineProperties()[SPATIAL_PROPERTY]
    ).toMatchObject({ position: [60, 0, 5] })
    expect(layer.registration.shouldUpdate?.()).toBe(false)
    layer.submit({
      ...frame,
      meshes: [
        {
          ...frame.meshes[0],
          descriptor: { ...frame.meshes[0].descriptor, color: 123 }
        }
      ]
    })
    layer.submitCamera({ ...frame.camera, position: [2, 0, 5] })
    layer.registration.update?.()
    expect(update).toHaveBeenCalledTimes(1)
    expect(
      container.children[0].getEngineProperties()[SPATIAL_PROPERTY]
    ).toMatchObject({ position: [2, 0, 5] })
    layer.submitCamera({ ...frame.camera, position: [3, 0, 5] })
    expect(() =>
      layer.submit({ ...frame, meshes: [frame.meshes[0], frame.meshes[0]] })
    ).toThrow('unique')
    layer.registration.update?.()
    expect(
      container.children[0].getEngineProperties()[SPATIAL_PROPERTY]
    ).toMatchObject({ position: [3, 0, 5] })
    layer.submitCamera({ ...frame.camera, position: [4, 0, 5] })
    layer.submit({ ...frame, meshes: [] })
    layer.registration.update?.()
    expect(container.children).toHaveLength(1)
    expect(
      container.children[0].getEngineProperties()[SPATIAL_PROPERTY]
    ).toMatchObject(frame.camera)
    layer.dispose()
    expect(() => layer.submitCamera(frame.camera)).toThrow('disposed')
  })
  it('retains a pending complete frame and invalidates only accepted submissions', () => {
    const invalidate = vi.fn(),
      layer = new SpatialLayer(invalidate)
    layer.submit(frame)
    expect(layer.registration.shouldUpdate?.()).toBe(true)
    expect(layer.registration.update?.()).toBe(true)
    expect(layer.registration.shouldUpdate?.()).toBe(false)
    expect(invalidate).toHaveBeenCalledOnce()
    expect(() =>
      layer.submit({ ...frame, meshes: [...frame.meshes, ...frame.meshes] })
    ).toThrow('unique')
    expect(invalidate).toHaveBeenCalledOnce()
    layer.dispose()
    layer.dispose()
    expect(() => layer.submit(frame)).toThrow('disposed')
  })
})
