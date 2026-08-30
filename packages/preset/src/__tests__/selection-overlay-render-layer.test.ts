import { describe, expect, it, vi } from 'vitest'
import { EntityTypes, setElementGeometryLocalBounds } from '@asyra/utils'
import type { RenderLayerRegistration } from '@asyra/core'
import { registerSelectionOverlayRenderLayer } from '../render-layers/selection-overlay-render-layer.js'
import { PresetSystemPropertyKeys } from '../system-property-keys.js'

interface OverlayGraphicsProbe {
  moveTo: (x: number, y: number) => unknown
  lineTo: (x: number, y: number) => unknown
}

interface OverlayProbeInput {
  renderElement: object
  sceneElement: object
  selectedIds?: string[]
  hoveredElementId?: string | null
}

const createOverlayProbe = ({
  renderElement,
  sceneElement,
  selectedIds = [],
  hoveredElementId = null
}: OverlayProbeInput) => {
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
        getManagedProperty: vi.fn((key: string) =>
          key === PresetSystemPropertyKeys.HOVERED_ELEMENT_ID
            ? hoveredElementId
            : null
        )
      },
      getSelection: vi.fn(() => ({
        getSelectedIds: () => selectedIds
      }))
    } as unknown as Parameters<typeof registerSelectionOverlayRenderLayer>[1]
  )

  if (!registration) {
    throw new Error('Selection overlay registration was not created')
  }
  const layer = registration.layer as
    { children?: OverlayGraphicsProbe[] } | undefined
  const graphics = layer?.children?.[0]
  if (!graphics) {
    throw new Error('Selection overlay graphics was not created')
  }

  return { registration, graphics }
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
      { children?: OverlayGraphicsProbe[] } | undefined
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

  it('projects one selected official Group from current presentation bounds without a duplicate hover outline', () => {
    const renderElement = {
      getBounds: vi.fn(() => ({ x: 125, y: 85, width: 250, height: 170 })),
      worldTransform: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: 120,
        ty: 80
      }
    }
    const sceneElement = {
      get: vi.fn((key: string) =>
        key === 'type' ? EntityTypes.GROUP : undefined
      ),
      getAllComputedData: vi.fn(() => ({
        x: 120,
        y: 80,
        width: 20,
        height: 20
      }))
    }
    const { registration, graphics } = createOverlayProbe({
      renderElement,
      sceneElement,
      selectedIds: ['group-1'],
      hoveredElementId: 'group-1'
    })
    const moveToSpy = vi.spyOn(graphics, 'moveTo')
    const lineToSpy = vi.spyOn(graphics, 'lineTo')

    try {
      expect(registration.update?.()).toBe(true)
      expect(moveToSpy.mock.calls).toEqual([
        [125, 85],
        [375, 85],
        [375, 255],
        [125, 255]
      ])
      expect(lineToSpy.mock.calls).toEqual([
        [375, 85],
        [375, 255],
        [125, 255],
        [125, 85]
      ])
      expect(renderElement.getBounds).toHaveBeenCalled()
      expect(sceneElement.getAllComputedData).not.toHaveBeenCalled()
    } finally {
      moveToSpy.mockRestore()
      lineToSpy.mockRestore()
    }
  })

  it('projects a hovered nested Group from current world presentation bounds', () => {
    const renderElement = {
      getBounds: vi.fn(() => ({ x: 150, y: 100, width: 50, height: 100 })),
      worldTransform: {
        a: 0,
        b: 1,
        c: -1,
        d: 0,
        tx: 200,
        ty: 100
      }
    }
    const sceneElement = {
      get: vi.fn((key: string) =>
        key === 'type' ? EntityTypes.GROUP : undefined
      ),
      getAllComputedData: vi.fn(() => ({
        x: 30,
        y: 20,
        width: 100,
        height: 50
      }))
    }
    const { registration, graphics } = createOverlayProbe({
      renderElement,
      sceneElement,
      hoveredElementId: 'nested-group'
    })
    const moveToSpy = vi.spyOn(graphics, 'moveTo')
    const lineToSpy = vi.spyOn(graphics, 'lineTo')

    try {
      expect(registration.update?.()).toBe(true)
      expect(moveToSpy.mock.calls).toEqual([
        [150, 100],
        [200, 100],
        [200, 200],
        [150, 200]
      ])
      expect(lineToSpy.mock.calls).toEqual([
        [200, 100],
        [200, 200],
        [150, 200],
        [150, 100]
      ])
      expect(renderElement.getBounds).toHaveBeenCalled()
      expect(sceneElement.getAllComputedData).not.toHaveBeenCalled()
    } finally {
      moveToSpy.mockRestore()
      lineToSpy.mockRestore()
    }
  })

  it('fails closed when current Group presentation bounds are invalid', () => {
    const renderElement = {
      getBounds: vi.fn(() => ({
        x: 10,
        y: 20,
        width: Number.NaN,
        height: 160
      })),
      worldTransform: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: 10,
        ty: 20
      }
    }
    const sceneElement = {
      get: vi.fn((key: string) =>
        key === 'type' ? EntityTypes.GROUP : undefined
      ),
      getAllComputedData: vi.fn(() => ({
        x: 10,
        y: 20,
        width: 240,
        height: 160
      }))
    }
    const { registration, graphics } = createOverlayProbe({
      renderElement,
      sceneElement,
      selectedIds: ['group-1']
    })
    const lineToSpy = vi.spyOn(graphics, 'lineTo')

    try {
      expect(registration.update?.()).toBe(true)
      expect(lineToSpy).not.toHaveBeenCalled()
      expect(sceneElement.getAllComputedData).not.toHaveBeenCalled()
    } finally {
      lineToSpy.mockRestore()
    }
  })
})
