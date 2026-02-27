import { beforeAll, describe, it, expect, vi } from 'vitest'
import {
  componentRegistry,
  elementPropertyRegistry,
  renderRegistry
} from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { applyPreset } from '../preset'

beforeAll(() => {
  applyPreset(
    {
      registerRenderLayer: () => {
        // no-op for this unit test; vector component registration is asserted via registries.
      },
      registerPropertySchema: () => {},
      registerSelection: () => {},
      getSelection: () => undefined,
      registerUIProperty: () => {
        // no-op for this unit test.
      },
      registerSystemProperty: () => {
        // return stub observable-like value for source$ wiring in preset.
        return {}
      }
    },
    {
      sceneTree: {
        getElementById: () => undefined
      },
      systemContext: {
        getManagedProperty: () => undefined,
        getSystemContextSnapshot: () => ({
          primaryTool: 'select',
          mouse: { position: { x: 0, y: 0 } }
        })
      },
      render: {
        getViewportPosition: () => ({ x: 0, y: 0 }),
        getViewportScale: () => 1,
        getMousePosInWorkspace: () => ({ x: 0, y: 0 })
      }
    }
  )
})

const runRenderStrategy = (
  strategy: unknown,
  graphic: unknown,
  data: unknown
) => {
  ;(strategy as (graphic: unknown, data: unknown) => void)(graphic, data)
}

describe('Vector Component', () => {
  it('should register vector component in all registries', () => {
    expect(componentRegistry.has('vector')).toBe(true)
    expect(
      elementPropertyRegistry.getPropertiesForComponent('vector').length
    ).toBeGreaterThan(0)
    expect(renderRegistry.has('vector')).toBe(true)
  })

  it('should register anchorPoints property', () => {
    const properties =
      elementPropertyRegistry.getPropertiesForComponent('vector')
    const anchorPointsProp = properties.find((p) => p.name === 'anchorPoints')

    expect(anchorPointsProp).toBeDefined()
    expect(anchorPointsProp?.type).toBe(PropertyTypes.ANCHOR_POINTS)
    expect(anchorPointsProp?.defaultValue).toEqual([])
  })

  it('should register closed property', () => {
    const properties =
      elementPropertyRegistry.getPropertiesForComponent('vector')
    const closedProp = properties.find((p) => p.name === 'closed')

    expect(closedProp).toBeDefined()
    expect(closedProp?.type).toBe('custom')
    expect(closedProp?.defaultValue).toBe(false)
  })

  it('should register fill properties', () => {
    const properties =
      elementPropertyRegistry.getPropertiesForComponent('vector')
    const fillProp = properties.find((p) => p.name === 'fill')
    const strokeStyleProp = properties.find((p) => p.name === 'strokeStyle')

    expect(fillProp).toBeDefined()
    expect(fillProp?.defaultValue).toBe('none')

    expect(strokeStyleProp).toBeDefined()
    expect(strokeStyleProp?.alias).toEqual(['stroke', 'strokeWidth'])
    expect(strokeStyleProp?.defaultValue).toEqual({
      stroke: '#cccccc',
      strokeWidth: 1
    })
  })

  it('should have renderStrategy registered', () => {
    expect(renderRegistry.has('vector')).toBe(true)
    const renderStrategy = renderRegistry.get('vector')
    expect(typeof renderStrategy).toBe('function')
  })

  it('should render straight lines for sharp anchor points', () => {
    const renderStrategy = renderRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      anchorPoints: [
        { id: '1', x: 0, y: 0, type: 'sharp', inHandle: null, outHandle: null },
        {
          id: '2',
          x: 100,
          y: 0,
          type: 'sharp',
          inHandle: null,
          outHandle: null
        },
        {
          id: '3',
          x: 100,
          y: 100,
          type: 'sharp',
          inHandle: null,
          outHandle: null
        }
      ],
      closed: false,
      fill: 'none',
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.clear).toHaveBeenCalled()
    expect(mockGraphic.stroke).toHaveBeenCalledWith({
      width: 2,
      color: 0x000000,
      cap: 'round',
      join: 'round'
    })
    expect(mockGraphic.moveTo).toHaveBeenCalledWith(0, 0)
    expect(mockGraphic.lineTo).toHaveBeenCalledWith(100, 0)
    expect(mockGraphic.lineTo).toHaveBeenCalledWith(100, 100)
    expect(mockGraphic.bezierCurveTo).not.toHaveBeenCalled()
  })

  it('should render bezier curves for smooth anchor points', () => {
    const renderStrategy = renderRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      anchorPoints: [
        {
          id: '1',
          x: 0,
          y: 0,
          type: 'smooth',
          inHandle: null,
          outHandle: { x: 25, y: 0 }
        },
        {
          id: '2',
          x: 100,
          y: 100,
          type: 'smooth',
          inHandle: { x: 75, y: 100 },
          outHandle: null
        }
      ],
      closed: false,
      fill: 'none',
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.bezierCurveTo).toHaveBeenCalledWith(
      25,
      0,
      75,
      100,
      100,
      100
    )
  })

  it('should close path and fill when closed is true', () => {
    const renderStrategy = renderRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      anchorPoints: [
        { id: '1', x: 0, y: 0, type: 'sharp', inHandle: null, outHandle: null },
        {
          id: '2',
          x: 100,
          y: 0,
          type: 'sharp',
          inHandle: null,
          outHandle: null
        },
        {
          id: '3',
          x: 100,
          y: 100,
          type: 'sharp',
          inHandle: null,
          outHandle: null
        },
        {
          id: '4',
          x: 0,
          y: 100,
          type: 'sharp',
          inHandle: null,
          outHandle: null
        }
      ],
      closed: true,
      fill: '#ff0000',
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.closePath).toHaveBeenCalled()
    expect(mockGraphic.fill).toHaveBeenCalledWith(0xff0000)
  })

  it('should not render if anchor points less than 2', () => {
    const renderStrategy = renderRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn()
    }

    const mockData = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      anchorPoints: [
        { id: '1', x: 0, y: 0, type: 'sharp', inHandle: null, outHandle: null }
      ],
      closed: false,
      fill: 'none',
      stroke: '#000000',
      strokeWidth: 2
    }

    runRenderStrategy(renderStrategy, mockGraphic, mockData)

    expect(mockGraphic.clear).toHaveBeenCalled()
    expect(mockGraphic.moveTo).toHaveBeenCalledWith(0, 0)
    expect(mockGraphic.lineTo).not.toHaveBeenCalled()
    expect(mockGraphic.stroke).toHaveBeenCalled()
  })
})
