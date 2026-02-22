import { describe, it, expect, beforeEach } from 'vitest'
import { propertyDefinitionRegistry } from '../property-definition-registry'
import type { PropertyDefinition } from '../property-definition-registry'

describe('PropertyDefinitionRegistry', () => {
  beforeEach(() => {
    // Clear registry by unregistering all component types
    const registry = (
      propertyDefinitionRegistry as unknown as {
        registry: Map<string, { componentTypes: Set<string> }>
      }
    ).registry
    const allProps = Array.from(registry.entries())
    allProps.forEach(([, registered]) => {
      Array.from(registered.componentTypes).forEach((type) => {
        propertyDefinitionRegistry.unregisterComponent(type)
      })
    })
  })

  it('should register properties for components', () => {
    const propDef: PropertyDefinition = {
      name: 'count',
      type: 'custom',
      defaultValue: 5
    }

    propertyDefinitionRegistry.register(propDef, 'star')

    expect(propertyDefinitionRegistry.has('count')).toBe(true)
    const properties = propertyDefinitionRegistry.getPropertiesForComponent('star')
    expect(properties).toHaveLength(1)
    expect(properties[0].name).toBe('count')
  })

  it('should allow multiple components to share a property', () => {
    const propDef: PropertyDefinition = {
      name: 'position',
      type: 'position',
      alias: ['x', 'y']
    }

    propertyDefinitionRegistry.register(propDef, 'star')
    propertyDefinitionRegistry.register(propDef, 'polygon')

    const starProps = propertyDefinitionRegistry.getPropertiesForComponent('star')
    const polygonProps = propertyDefinitionRegistry.getPropertiesForComponent('polygon')

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

    propertyDefinitionRegistry.register(propDef, 'polygon')

    const retrieved = propertyDefinitionRegistry.get('sides')
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

    propertyDefinitionRegistry.register(propDef, 'circle')
    expect(propertyDefinitionRegistry.has('radius')).toBe(true)

    propertyDefinitionRegistry.unregisterComponent('circle')

    const properties = propertyDefinitionRegistry.getPropertiesForComponent('circle')
    expect(properties).toHaveLength(0)
    expect(propertyDefinitionRegistry.has('radius')).toBe(false)
  })

  it('should keep property if other components still use it', () => {
    const propDef: PropertyDefinition = {
      name: 'dimension',
      type: 'dimension',
      alias: ['width', 'height']
    }

    propertyDefinitionRegistry.register(propDef, 'rectangle')
    propertyDefinitionRegistry.register(propDef, 'oval')

    propertyDefinitionRegistry.unregisterComponent('rectangle')

    expect(propertyDefinitionRegistry.has('dimension')).toBe(true)
    const ovalProps = propertyDefinitionRegistry.getPropertiesForComponent('oval')
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

    propertyDefinitionRegistry.register(prop1, 'star')
    propertyDefinitionRegistry.register(prop2, 'star')
    propertyDefinitionRegistry.register(prop3, 'star')

    const properties = propertyDefinitionRegistry.getPropertiesForComponent('star')
    expect(properties).toHaveLength(3)
  })
})
