import { describe, it, expect, vi } from 'vitest'
import { componentRegistry } from '@asyra/scene-tree'
import { propertyRegistry } from '@asyra/props-manager'
import { renderRegistry } from '@asyra/render'

import '../components/vector'

describe('Vector Component', () => {
  it('should register vector component in all registries', () => {
    expect(componentRegistry.has('vector')).toBe(true)
    expect(
      propertyRegistry.getPropertiesForComponent('vector').length
    ).toBeGreaterThan(0)
    expect(renderRegistry.has('vector')).toBe(true)
  })

  it('should register anchorPoints property', () => {
    const properties = propertyRegistry.getPropertiesForComponent('vector')
    const anchorPointsProp = properties.find((p) => p.name === 'anchorPoints')

    expect(anchorPointsProp).toBeDefined()
    expect(anchorPointsProp?.type).toBe('custom')
    expect(anchorPointsProp?.defaultValue).toEqual([])
  })

  it('should register closed property', () => {
    const properties = propertyRegistry.getPropertiesForComponent('vector')
    const closedProp = properties.find((p) => p.name === 'closed')

    expect(closedProp).toBeDefined()
    expect(closedProp?.type).toBe('custom')
    expect(closedProp?.defaultValue).toBe(false)
  })

  it('should register fill properties', () => {
    const properties = propertyRegistry.getPropertiesForComponent('vector')
    const fillProp = properties.find((p) => p.name === 'fill')
    const strokeProp = properties.find((p) => p.name === 'stroke')
    const strokeWidthProp = properties.find((p) => p.name === 'strokeWidth')

    expect(fillProp).toBeDefined()
    expect(fillProp?.defaultValue).toBe('none')

    expect(strokeProp).toBeDefined()
    expect(strokeProp?.defaultValue).toBe('#000000')

    expect(strokeWidthProp).toBeDefined()
    expect(strokeWidthProp?.defaultValue).toBe(2)
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
      setStrokeStyle: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn()
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

    renderStrategy(mockGraphic as any, mockData as any)

    expect(mockGraphic.clear).toHaveBeenCalled()
    expect(mockGraphic.setStrokeStyle).toHaveBeenCalled()
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
      setStrokeStyle: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn()
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

    renderStrategy(mockGraphic as any, mockData as any)

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
      setStrokeStyle: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn()
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

    renderStrategy(mockGraphic as any, mockData as any)

    expect(mockGraphic.closePath).toHaveBeenCalled()
    expect(mockGraphic.fill).toHaveBeenCalledWith(0xff0000)
  })

  it('should not render if anchor points less than 2', () => {
    const renderStrategy = renderRegistry.get('vector')
    expect(renderStrategy).toBeDefined()

    if (!renderStrategy) return

    const mockGraphic = {
      clear: vi.fn(),
      setStrokeStyle: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn()
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

    renderStrategy(mockGraphic as any, mockData as any)

    expect(mockGraphic.clear).toHaveBeenCalled()
    expect(mockGraphic.setStrokeStyle).not.toHaveBeenCalled()
    expect(mockGraphic.moveTo).not.toHaveBeenCalled()
  })
})
