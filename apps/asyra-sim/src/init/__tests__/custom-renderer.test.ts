// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import core from '@asyra/core'
import { installCustomRenderer } from '../custom-renderer'
import { ThreeEngine, type GraphicsDriver } from '../../engine/three-engine'
import type { SpatialFrame } from '../../render-app/spatial-layer'

it('uses normal Core startup, registered projection, demand frames, public picking and teardown', async () => {
  const canvas = document.createElement('canvas')
  const driver: GraphicsDriver = {
    domElement: canvas,
    autoClear: true,
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    clear: vi.fn(),
    clearDepth: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn()
  }
  let callback: FrameRequestCallback | undefined
  const provider = vi.fn(
    () =>
      new ThreeEngine({
        createDriver: () => driver,
        requestFrame: (cb) => {
          callback = cb
          return 1
        },
        cancelFrame: () => {
          callback = undefined
        }
      })
  )
  const { layer, dispose } = installCustomRenderer(core, provider)
  expect(provider).not.toHaveBeenCalled()
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
        id: 'proof-body',
        visible: true,
        descriptor: {
          kind: 'mesh',
          position: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          shape: { kind: 'box', size: [1, 1, 1] },
          color: 0x00cc88,
          opacity: 1,
          wireframe: false,
          selectable: true
        }
      }
    ]
  }
  layer.submit(frame)
  const host = document.createElement('div')
  await core.start(host, { width: 640, height: 480, backgroundColor: 0x101b29 })
  expect(provider).toHaveBeenCalledOnce()
  expect(core.getCanvas()).toBe(canvas)
  expect(host.firstElementChild).toBe(canvas)
  expect(core.getElementIdAtClientPos({ x: 320, y: 240 })).toBe('proof-body')
  const before = core.getUndoHistoryDepth()
  layer.submit({ ...frame, meshes: [] })
  expect(callback).toBeTypeOf('function')
  callback?.(1)
  expect(core.getElementIdAtClientPos({ x: 320, y: 240 })).toBeNull()
  expect(core.getUndoHistoryDepth()).toBe(before)
  expect(() => core.setRenderEngineProvider(provider)).toThrow(
    'permanently closed'
  )
  dispose()
  dispose()
  await core.destroy()
  expect(driver.dispose).toHaveBeenCalledOnce()
  expect(host.childElementCount).toBe(0)
})
