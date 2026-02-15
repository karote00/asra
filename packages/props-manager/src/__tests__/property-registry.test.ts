import { describe, it, expect, beforeEach } from 'vitest'
import { propertyRegistry } from '../property-registry'
import type { PropertyDefinition } from '../property-registry'

describe('PropertyRegistry', () => {
  beforeEach(() => {
    // Clear registry by unregistering all component types
    const registry = (
      propertyRegistry as unknown as {
        registry: Map<string, { componentTypes: Set<string> }>
      }
    ).registry
    const allProps = Array.from(registry.entries())
    allProps.forEach(([, registered]) => {
      Array.from(registered.componentTypes).forEach((type) => {
        propertyRegistry.unregisterComponent(type)
      })
    })
  })

  it('should register properties for components', () => {
    const propDef: PropertyDefinition = {
      name: 'count',
      type: 'custom',
      defaultValue: 5
    }

    propertyRegistry.register(propDef, 'star')

    expect(propertyRegistry.has('count')).toBe(true)
    const properties = propertyRegistry.getPropertiesForComponent('star')
    expect(properties).toHaveLength(1)
    expect(properties[0].name).toBe('count')
  })

  it('should allow multiple components to share a property', () => {
    const propDef: PropertyDefinition = {
      name: 'position',
      type: 'position',
      alias: ['x', 'y']
    }

    propertyRegistry.register(propDef, 'star')
    propertyRegistry.register(propDef, 'polygon')

    const starProps = propertyRegistry.getPropertiesForComponent('star')
    const polygonProps = propertyRegistry.getPropertiesForComponent('polygon')

    expect(starProps).toHaveLength(1)
    expect(polygonProps).toHaveLength(1)
    expect(starProps[0].name).toBe('position')
    expect(polygonProps[0].name).toBe('position')
  })

  it('should get property definition by name', () => {
    const propDef: PropertyDefinition = {
      name: 'sides',
      type: 'custom',
      defaultValue: 6
    }

    propertyRegistry.register(propDef, 'polygon')

    const retrieved = propertyRegistry.get('sides')
    expect(retrieved).toBeDefined()
    expect(retrieved?.name).toBe('sides')
    expect(retrieved?.defaultValue).toBe(6)
  })

  it('should unregister component properties', () => {
    const propDef: PropertyDefinition = {
      name: 'radius',
      type: 'dimension',
      defaultValue: 50
    }

    propertyRegistry.register(propDef, 'circle')
    expect(propertyRegistry.has('radius')).toBe(true)

    propertyRegistry.unregisterComponent('circle')

    const properties = propertyRegistry.getPropertiesForComponent('circle')
    expect(properties).toHaveLength(0)
    expect(propertyRegistry.has('radius')).toBe(false)
  })

  it('should keep property if other components still use it', () => {
    const propDef: PropertyDefinition = {
      name: 'dimension',
      type: 'dimension',
      alias: ['width', 'height']
    }

    propertyRegistry.register(propDef, 'rectangle')
    propertyRegistry.register(propDef, 'oval')

    propertyRegistry.unregisterComponent('rectangle')

    expect(propertyRegistry.has('dimension')).toBe(true)
    const ovalProps = propertyRegistry.getPropertiesForComponent('oval')
    expect(ovalProps).toHaveLength(1)
  })

  it('should handle multiple properties for one component', () => {
    const prop1: PropertyDefinition = {
      name: 'count',
      type: 'custom'
    }
    const prop2: PropertyDefinition = {
      name: 'position',
      type: 'position'
    }
    const prop3: PropertyDefinition = {
      name: 'dimension',
      type: 'dimension'
    }

    propertyRegistry.register(prop1, 'star')
    propertyRegistry.register(prop2, 'star')
    propertyRegistry.register(prop3, 'star')

    const properties = propertyRegistry.getPropertiesForComponent('star')
    expect(properties).toHaveLength(3)
  })
})
