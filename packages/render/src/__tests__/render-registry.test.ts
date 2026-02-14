import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderRegistry } from '../render-registry'
import type { RenderStrategy } from '../types/render-strategy'
import type { Graphics } from 'pixi.js'
import type { RenderElementData } from '../types'

describe('RenderRegistry', () => {
    beforeEach(() => {
        // Clear registry before each test
        const types = ['test-type', 'another-type', 'star']
        types.forEach(type => {
            renderRegistry.unregister(type)
        })
    })

    it('should register a render strategy', () => {
        const mockStrategy: RenderStrategy = vi.fn()

        renderRegistry.register('test-type', mockStrategy)

        expect(renderRegistry.has('test-type')).toBe(true)
        expect(renderRegistry.get('test-type')).toBe(mockStrategy)
    })

    it('should unregister a render strategy', () => {
        const mockStrategy: RenderStrategy = vi.fn()

        renderRegistry.register('test-type', mockStrategy)
        expect(renderRegistry.has('test-type')).toBe(true)

        const result = renderRegistry.unregister('test-type')

        expect(result).toBe(true)
        expect(renderRegistry.has('test-type')).toBe(false)
        expect(renderRegistry.get('test-type')).toBeUndefined()
    })

    it('should return false when unregistering non-existent strategy', () => {
        const result = renderRegistry.unregister('non-existent')
        expect(result).toBe(false)
    })

    it('should overwrite existing strategy with warning', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
        const strategy1: RenderStrategy = vi.fn()
        const strategy2: RenderStrategy = vi.fn()

        renderRegistry.register('test-type', strategy1)
        renderRegistry.register('test-type', strategy2)

        expect(renderRegistry.get('test-type')).toBe(strategy2)
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Render strategy for "test-type" already registered. Overwriting.'
        )

        consoleWarnSpy.mockRestore()
    })

    it('should execute registered strategy when retrieved', () => {
        const mockGraphic = {} as Graphics
        const mockData: RenderElementData = {
            id: 'test-1',
            type: 'star',
            x: 10,
            y: 20,
            width: 100,
            height: 100
        }

        const mockStrategy: RenderStrategy = vi.fn((graphic, data) => {
            // Strategy implementation
        })

        renderRegistry.register('star', mockStrategy)

        const strategy = renderRegistry.get('star')
        expect(strategy).toBeDefined()

        strategy!(mockGraphic, mockData)

        expect(mockStrategy).toHaveBeenCalledWith(mockGraphic, mockData)
    })

    it('should handle multiple different strategies', () => {
        const strategy1: RenderStrategy = vi.fn()
        const strategy2: RenderStrategy = vi.fn()

        renderRegistry.register('type-1', strategy1)
        renderRegistry.register('type-2', strategy2)

        expect(renderRegistry.has('type-1')).toBe(true)
        expect(renderRegistry.has('type-2')).toBe(true)
        expect(renderRegistry.get('type-1')).toBe(strategy1)
        expect(renderRegistry.get('type-2')).toBe(strategy2)
    })
})
