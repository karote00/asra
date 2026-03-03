import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, unregisterComponent } from '../define-component'
import sceneTree, { componentRegistry } from '@asyra/scene-tree'
import { elementPropertyRegistry } from '@asyra/props-manager'
import { renderStrategyRegistry } from '@asyra/render'
import { PropertyTypes, idCounter, nameCounter } from '@asyra/utils'
import type { RenderStrategy } from '@asyra/render'
import type { ElementInstanceTypes } from '@asyra/utils'

// Use actual package imports without mocks to source files

const COMPONENT_TYPES = [
  'star',
  'polygon',
  'container',
  'shared-a',
  'shared-b'
]

const cleanupType = (type: string) => {
  unregisterComponent(type, { force: true })
  componentRegistry.unregister(type)
  elementPropertyRegistry.unregisterComponent(type)
  renderStrategyRegistry.unregister(type)
  idCounter.unregisterType(type)
  nameCounter.unregisterType(type)
}

describe('defineComponent', () => {
  beforeEach(() => {
    sceneTree.dispose()
    COMPONENT_TYPES.forEach((type) => cleanupType(type))
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
    const properties = elementPropertyRegistry.getPropertiesForComponent('star')
    expect(properties).toHaveLength(3)
    expect(properties.map((p) => p.name)).toEqual(['count', 'x', 'y'])

    // Check render registry
    expect(renderStrategyRegistry.has('star')).toBe(true)
    expect(renderStrategyRegistry.get('star')).toBe(mockRenderStrategy)
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
    expect(
      elementPropertyRegistry.getPropertiesForComponent('polygon')
    ).toHaveLength(1)
    expect(renderStrategyRegistry.has('polygon')).toBe(false)
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

    const properties = elementPropertyRegistry.getPropertiesForComponent('star')
    expect(properties).toHaveLength(4)
    expect(properties.map((p) => p.name)).toEqual([
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

    const properties = elementPropertyRegistry.getPropertiesForComponent('star')
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
    if (registration) {
      const ComponentClass = registration.constructor
      const instance = new ComponentClass() as unknown as {
        data: { children: string[] }
      }
      // Check if it has children array (Group characteristic)
      expect(instance.data.children).toBeDefined()
      expect(Array.isArray(instance.data.children)).toBe(true)
    }
  })
})

describe('unregisterComponent', () => {
  beforeEach(() => {
    sceneTree.dispose()
    COMPONENT_TYPES.forEach((type) => cleanupType(type))
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
    expect(
      elementPropertyRegistry.getPropertiesForComponent('star')
    ).toHaveLength(1)
    expect(renderStrategyRegistry.has('star')).toBe(true)
    expect(idCounter.hasType('star')).toBe(true)
    expect(nameCounter.hasType('star')).toBe(true)

    const result = unregisterComponent('star')

    expect(result).toBe(true)
    expect(componentRegistry.has('star')).toBe(false)
    expect(
      elementPropertyRegistry.getPropertiesForComponent('star')
    ).toHaveLength(0)
    expect(renderStrategyRegistry.has('star')).toBe(false)
    expect(idCounter.hasType('star')).toBe(false)
    expect(nameCounter.hasType('star')).toBe(false)
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
    renderStrategyRegistry.unregister('star')

    const result = unregisterComponent('star')
    expect(result).toBe(true) // Should still return true if any registry had it
  })

  it('should return detailed cascade result when requested', () => {
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

    const result = unregisterComponent('star', { detailed: true })

    expect(result.ok).toBe(true)
    expect(result.removed).toContain('component:star')
    expect(result.removed).toContain('render:star')
    expect(result.removed).toContain('id-counter:star')
    expect(result.removed).toContain('name-counter:star')
    expect(result.removed).toContain('property-owner:star.count')
    expect(result.removed).toContain('property-definition:count')
  })

  it('should block unregister when active instances exist and force is false', () => {
    defineComponent({
      type: 'star',
      idPrefix: 'star',
      namePrefix: 'Star',
      properties: []
    })

    const activeElement = {
      get: vi.fn((key: string) => {
        if (key === 'id') {
          return 'star-active'
        }
        if (key === 'type') {
          return 'star'
        }
        return undefined
      })
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(activeElement)

    const result = unregisterComponent('star', { detailed: true })

    expect(result.ok).toBe(false)
    expect(componentRegistry.has('star')).toBe(true)
    expect(
      result.skipped.some(
        (entry) =>
          entry.item === 'component:star' &&
          entry.reason.includes('active scene instance')
      )
    ).toBe(true)
  })

  it('should allow force unregister when active instances exist', () => {
    defineComponent({
      type: 'star',
      idPrefix: 'star',
      namePrefix: 'Star',
      properties: []
    })

    const activeElement = {
      get: vi.fn((key: string) => {
        if (key === 'id') {
          return 'star-active'
        }
        if (key === 'type') {
          return 'star'
        }
        return undefined
      })
    } as unknown as ElementInstanceTypes
    sceneTree.addToMap(activeElement)

    const result = unregisterComponent('star', { detailed: true, force: true })

    expect(result.ok).toBe(true)
    expect(componentRegistry.has('star')).toBe(false)
  })
})
