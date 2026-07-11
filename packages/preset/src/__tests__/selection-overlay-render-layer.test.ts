import { describe, expect, it, vi } from 'vitest'
import { setElementGeometryLocalBounds } from '@asyra/utils'
import type { RenderLayerRegistration } from '@asyra/core'
import { registerSelectionOverlayRenderLayer } from '../render-layers/selection-overlay-render-layer'

interface OverlayGraphicsProbe {
  moveTo: (x: number, y: number) => unknown
  lineTo: (x: number, y: number) => unknown
}

describe('selection overlay render layer', () => {
  it('projects selected bounds with the current transform during frame-aligned geometry updates', () => {
    const renderElement = {
      getBounds: vi.fn(() => ({ x: 40, y: 20, width: 240, height: 160 })),
      toGlobal: vi.fn((point: { x: number; y: number }) => ({
        x: point.x + 120,
        y: point.y + 80
      })),
      worldTransform: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: 40,
        ty: 20
      }
    }
    setElementGeometryLocalBounds(renderElement, {
      x: 0,
      y: 0,
      width: 240,
      height: 160
    })

    const sceneElement = {
      get: vi.fn((key: string) => (key === 'type' ? 'rect' : undefined)),
      getAllComputedData: vi.fn(() => ({
        x: 120,
        y: 80,
        width: 240,
        height: 160
      }))
    }
    let registration: RenderLayerRegistration | undefined

    registerSelectionOverlayRenderLayer(
      (nextRegistration) => {
        registration = nextRegistration
      },
      {
        render: {
          getElementById: vi.fn(() => renderElement),
          getViewportPosition: vi.fn(() => ({ x: 0, y: 0 })),
          getViewportScale: vi.fn(() => 1)
        },
        sceneTree: {
          getElementById: vi.fn(() => sceneElement)
        },
        systemContext: {
          getManagedProperty: vi.fn(() => null)
        },
        getSelection: vi.fn(() => ({
          getSelectedIds: () => ['rect-1']
        }))
      } as unknown as Parameters<typeof registerSelectionOverlayRenderLayer>[1]
    )

    const layer = registration?.layer as
      | { children?: OverlayGraphicsProbe[] }
      | undefined
    const graphics = layer?.children?.[0]
    expect(graphics).toBeDefined()
    if (!graphics) {
      return
    }
    const moveToSpy = vi.spyOn(graphics, 'moveTo')
    const lineToSpy = vi.spyOn(graphics, 'lineTo')

    try {
      expect(registration?.update?.()).toBe(true)
      expect(moveToSpy.mock.calls.slice(-4)).toEqual([
        [120, 80],
        [360, 80],
        [360, 240],
        [120, 240]
      ])
      expect(lineToSpy.mock.calls.slice(-4)).toEqual([
        [360, 80],
        [360, 240],
        [120, 240],
        [120, 80]
      ])
      expect(renderElement.toGlobal).toHaveBeenCalled()
      expect(renderElement.getBounds).not.toHaveBeenCalled()
    } finally {
      moveToSpy.mockRestore()
      lineToSpy.mockRestore()
    }
  })
})
