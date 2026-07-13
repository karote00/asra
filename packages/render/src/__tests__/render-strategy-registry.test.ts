import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderStrategyRegistry } from '../registries/render-strategy'
import type { RenderStrategy } from '../types/render-strategy'
import type { Graphics } from 'pixi.js'
import type { RenderElementData } from '../types'

describe('RenderStrategyRegistry', () => {
  beforeEach(() => {
    // Clear registry before each test
    const types = ['test-type', 'another-type', 'star']
    types.forEach((type) => {
      renderStrategyRegistry.unregister(type)
    })
  })

  it('should register a render strategy', () => {
    const mockStrategy: RenderStrategy = vi.fn()

    renderStrategyRegistry.register('test-type', mockStrategy)

    expect(renderStrategyRegistry.has('test-type')).toBe(true)
    expect(renderStrategyRegistry.get('test-type')).toBe(mockStrategy)
  })

  it('should unregister a render strategy', () => {
    const mockStrategy: RenderStrategy = vi.fn()

    renderStrategyRegistry.register('test-type', mockStrategy)
    expect(renderStrategyRegistry.has('test-type')).toBe(true)

    const result = renderStrategyRegistry.unregister('test-type')

    expect(result).toBe(true)
    expect(renderStrategyRegistry.has('test-type')).toBe(false)
    expect(renderStrategyRegistry.get('test-type')).toBeUndefined()
  })

  it('should return false when unregistering non-existent strategy', () => {
    const result = renderStrategyRegistry.unregister('non-existent')
    expect(result).toBe(false)
  })

  it('should throw on duplicate strategy registration', () => {
    const strategy1: RenderStrategy = vi.fn()
    const strategy2: RenderStrategy = vi.fn()

    renderStrategyRegistry.register('test-type', strategy1)
    expect(() =>
      renderStrategyRegistry.register('test-type', strategy2)
    ).toThrow('Render strategy for "test-type" is already registered')
    expect(renderStrategyRegistry.get('test-type')).toBe(strategy1)
  })

  it('should execute registered strategy when retrieved', () => {
    const mockGraphic = {} as Graphics
    const mockData: RenderElementData = {
      id: 'test-1',
      type: 'star',
      name: 'Star 1',
      visible: true,
      lock: false,
      rotation: 0,
      x: 10,
      y: 20,
      width: 100,
      height: 100
    }

    const mockStrategy: RenderStrategy = vi.fn((graphic, data) => {
      // Strategy implementation
    })

    renderStrategyRegistry.register('star', mockStrategy)

    const strategy = renderStrategyRegistry.get('star')
    expect(strategy).toBeDefined()

    if (strategy) {
      strategy(mockGraphic, mockData)
    }

    expect(mockStrategy).toHaveBeenCalledWith(mockGraphic, mockData)
  })

  it('should handle multiple different strategies', () => {
    const strategy1: RenderStrategy = vi.fn()
    const strategy2: RenderStrategy = vi.fn()

    renderStrategyRegistry.register('type-1', strategy1)
    renderStrategyRegistry.register('type-2', strategy2)

    expect(renderStrategyRegistry.has('type-1')).toBe(true)
    expect(renderStrategyRegistry.has('type-2')).toBe(true)
    expect(renderStrategyRegistry.get('type-1')).toBe(strategy1)
    expect(renderStrategyRegistry.get('type-2')).toBe(strategy2)
  })
})
