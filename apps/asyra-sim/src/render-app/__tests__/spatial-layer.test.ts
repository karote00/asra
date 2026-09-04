import { describe, expect, it, vi } from 'vitest'
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
