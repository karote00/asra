import { describe, it, expect, beforeEach, vi } from 'vitest'
import { componentRegistry } from '../component-registry'

// Mock constructor for testing
class MockComponent {
    constructor(data?: any) { }
}

describe('ComponentRegistry', () => {
    beforeEach(() => {
        // Clear registry
        componentRegistry.getAll().forEach((_, type) => {
            componentRegistry.unregister(type)
        })
    })

    it('should register and retrieve components', () => {
        componentRegistry.register({
            type: 'test-component',
            idPrefix: 'test',
            namePrefix: 'Test',
            constructor: MockComponent as any,
            properties: [],
            defaults: {}
        })

        expect(componentRegistry.has('test-component')).toBe(true)
        const registration = componentRegistry.get('test-component')
        expect(registration?.type).toBe('test-component')
        expect(registration?.idPrefix).toBe('test')
        expect(registration?.namePrefix).toBe('Test')
    })

    it('should warn on duplicate registration', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

        componentRegistry.register({
            type: 'duplicate',
            idPrefix: 'dup',
            namePrefix: 'Duplicate',
            constructor: MockComponent as any,
            properties: [],
            defaults: {}
        })

        componentRegistry.register({
            type: 'duplicate',
            idPrefix: 'dup2',
            namePrefix: 'Duplicate2',
            constructor: MockComponent as any,
            properties: [],
            defaults: {}
        })

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('already registered')
        )
        consoleSpy.mockRestore()
    })

    it('should unregister components', () => {
        componentRegistry.register({
            type: 'removable',
            idPrefix: 'rem',
            namePrefix: 'Removable',
            constructor: MockComponent as any,
            properties: [],
            defaults: {}
        })

        expect(componentRegistry.has('removable')).toBe(true)

        const result = componentRegistry.unregister('removable')
        expect(result).toBe(true)
        expect(componentRegistry.has('removable')).toBe(false)
    })

    it('should store component properties and defaults', () => {
        const properties = [{ name: 'count', type: 'custom', defaultValue: 5 }]
        const defaults = { width: 100, height: 100 }

        componentRegistry.register({
            type: 'star',
            idPrefix: 'star',
            namePrefix: 'Star',
            constructor: MockComponent as any,
            properties,
            defaults
        })

        const registration = componentRegistry.get('star')
        expect(registration?.properties).toEqual(properties)
        expect(registration?.defaults).toEqual(defaults)
    })

    it('should return all registered components', () => {
        componentRegistry.register({
            type: 'comp1',
            idPrefix: 'c1',
            namePrefix: 'Comp1',
            constructor: MockComponent as any,
            properties: [],
            defaults: {}
        })

        componentRegistry.register({
            type: 'comp2',
            idPrefix: 'c2',
            namePrefix: 'Comp2',
            constructor: MockComponent as any,
            properties: [],
            defaults: {}
        })

        const all = componentRegistry.getAll()
        expect(all.size).toBe(2)
        expect(all.has('comp1')).toBe(true)
        expect(all.has('comp2')).toBe(true)
    })
})
