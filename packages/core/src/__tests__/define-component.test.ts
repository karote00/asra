import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, unregisterComponent } from '../define-component'
import { componentRegistry } from '@asyra/scene-tree'
import { propertyRegistry } from '@asyra/props-manager'
import { renderRegistry } from '@asyra/render'
import { PropertyTypes } from '@asyra/utils'
import type { RenderStrategy } from '@asyra/render'

// Use actual package imports without mocks to source files


describe('defineComponent', () => {
    beforeEach(() => {
        // Clean up registries before each test
        componentRegistry.unregister('star')
        componentRegistry.unregister('polygon')
        propertyRegistry.unregisterComponent('star')
        propertyRegistry.unregisterComponent('polygon')
        renderRegistry.unregister('star')
        renderRegistry.unregister('polygon')
    })

    it('should register a component with all registries', () => {
        const mockRenderStrategy: RenderStrategy = vi.fn()

        defineComponent({
            type: 'star',
            idPrefix: 'star',
            namePrefix: 'Star',
            properties: [
                { name: 'count', type: PropertyTypes.CUSTOM, defaultValue: 5 },
                { name: 'x', type: PropertyTypes.CUSTOM, defaultValue: 0 },
                { name: 'y', type: PropertyTypes.CUSTOM, defaultValue: 0 }
            ],
            renderStrategy: mockRenderStrategy
        })

        // Check component registry
        expect(componentRegistry.has('star')).toBe(true)

        // Check property registry
        const properties = propertyRegistry.getPropertiesForComponent('star')
        expect(properties).toHaveLength(3)
        expect(properties.map(p => p.name)).toEqual(['count', 'x', 'y'])

        // Check render registry
        expect(renderRegistry.has('star')).toBe(true)
        expect(renderRegistry.get('star')).toBe(mockRenderStrategy)
    })

    it('should register component without render strategy', () => {
        defineComponent({
            type: 'polygon',
            idPrefix: 'polygon',
            namePrefix: 'Polygon',
            properties: [
                { name: 'sides', type: PropertyTypes.CUSTOM, defaultValue: 6 }
            ]
        })

        expect(componentRegistry.has('polygon')).toBe(true)
        expect(propertyRegistry.getPropertiesForComponent('polygon')).toHaveLength(1)
        expect(renderRegistry.has('polygon')).toBe(false)
    })

    it('should create component with correct ID and name prefixes', () => {
        defineComponent({
            type: 'star',
            idPrefix: 'star',
            namePrefix: 'Star',
            properties: [
                { name: 'count', type: PropertyTypes.CUSTOM, defaultValue: 5 }
            ]
        })

        const ComponentClass = componentRegistry.get('star')
        expect(ComponentClass).toBeDefined()

        // The component class should be created with the correct prefixes
        // This is tested more thoroughly in component-registry tests
    })

    it('should register multiple properties for a component', () => {
        defineComponent({
            type: 'star',
            idPrefix: 'star',
            namePrefix: 'Star',
            properties: [
                { name: 'count', type: PropertyTypes.CUSTOM, defaultValue: 5 },
                { name: 'position', type: PropertyTypes.POSITION },
                { name: 'dimension', type: PropertyTypes.DIMENSION },
                { name: 'rotation', type: PropertyTypes.CUSTOM, defaultValue: 0 }
            ]
        })

        const properties = propertyRegistry.getPropertiesForComponent('star')
        expect(properties).toHaveLength(4)
        expect(properties.map(p => p.name)).toEqual([
            'count',
            'position',
            'dimension',
            'rotation'
        ])
    })

    it('should allow custom property types', () => {
        defineComponent({
            type: 'star',
            idPrefix: 'star',
            namePrefix: 'Star',
            properties: [
                { name: 'count', type: PropertyTypes.CUSTOM, defaultValue: 5 },
                { name: 'innerRadius', type: PropertyTypes.CUSTOM, defaultValue: 0.5 }
            ]
        })

        const properties = propertyRegistry.getPropertiesForComponent('star')
        expect(properties[0].type).toBe(PropertyTypes.CUSTOM)
        expect(properties[1].type).toBe(PropertyTypes.CUSTOM)
    })

    it('should register container components', () => {
        defineComponent({
            type: 'container',
            idPrefix: 'container',
            namePrefix: 'Container',
            properties: [],
            isContainer: true
        })

        const registration = componentRegistry.get('container')
        expect(registration).toBeDefined()
        const ComponentClass = registration!.constructor
        const instance = new ComponentClass()
        // Check if it has children array (Group characteristic)
        expect((instance as any).data.children).toBeDefined()
        expect(Array.isArray((instance as any).data.children)).toBe(true)
    })
})

describe('unregisterComponent', () => {
    beforeEach(() => {
        // Clean up registries before each test
        componentRegistry.unregister('star')
        propertyRegistry.unregisterComponent('star')
        renderRegistry.unregister('star')
    })

    it('should unregister component from all registries', () => {
        const mockRenderStrategy: RenderStrategy = vi.fn()

        defineComponent({
            type: 'star',
            idPrefix: 'star',
            namePrefix: 'Star',
            properties: [
                { name: 'count', type: PropertyTypes.CUSTOM, defaultValue: 5 }
            ],
            renderStrategy: mockRenderStrategy
        })

        expect(componentRegistry.has('star')).toBe(true)
        expect(propertyRegistry.getPropertiesForComponent('star')).toHaveLength(1)
        expect(renderRegistry.has('star')).toBe(true)

        const result = unregisterComponent('star')

        expect(result).toBe(true)
        expect(componentRegistry.has('star')).toBe(false)
        expect(propertyRegistry.getPropertiesForComponent('star')).toHaveLength(0)
        expect(renderRegistry.has('star')).toBe(false)
    })

    it('should return true when unregistering existing component', () => {
        defineComponent({
            type: 'star',
            idPrefix: 'star',
            namePrefix: 'Star',
            properties: []
        })

        const result = unregisterComponent('star')
        expect(result).toBe(true)
    })

    it('should return false when unregistering non-existent component', () => {
        const result = unregisterComponent('non-existent')
        expect(result).toBe(false)
    })

    it('should handle partial unregistration gracefully', () => {
        // Register only in component registry, not in others
        defineComponent({
            type: 'star',
            idPrefix: 'star',
            namePrefix: 'Star',
            properties: []
        })

        // Manually unregister from render registry (simulating partial state)
        renderRegistry.unregister('star')

        const result = unregisterComponent('star')
        expect(result).toBe(true) // Should still return true if any registry had it
    })
})
