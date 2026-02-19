import { describe, it, expect, beforeEach } from 'vitest'
import { uiPropertyRegistry } from '../ui-property-registry'
import type { PropertyDefinition } from '../ui-property-registry'

describe('UIPropertyRegistry', () => {
  beforeEach(() => {
    // Clear registry by unregistering all component types
    const registry = (
      uiPropertyRegistry as unknown as {
        registry: Map<string, { componentTypes: Set<string> }>
      }
    ).registry
    const allProps = Array.from(registry.entries())
    allProps.forEach(([, registered]) => {
      Array.from(registered.componentTypes).forEach((type) => {
        uiPropertyRegistry.unregisterComponent(type)
      })
    })
  })

  it('should register properties for components', () => {
    const propDef: PropertyDefinition = {
      name: 'count',
      type: 'custom',
      defaultValue: 5
    }

    uiPropertyRegistry.register(propDef, 'star')

    expect(uiPropertyRegistry.has('count')).toBe(true)
    const properties = uiPropertyRegistry.getPropertiesForComponent('star')
    expect(properties).toHaveLength(1)
    expect(properties[0].name).toBe('count')
  })

  it('should allow multiple components to share a property', () => {
    const propDef: PropertyDefinition = {
      name: 'position',
      type: 'position',
      alias: ['x', 'y']
    }

    uiPropertyRegistry.register(propDef, 'star')
    uiPropertyRegistry.register(propDef, 'polygon')

    const starProps = uiPropertyRegistry.getPropertiesForComponent('star')
    const polygonProps = uiPropertyRegistry.getPropertiesForComponent('polygon')

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

    uiPropertyRegistry.register(propDef, 'polygon')

    const retrieved = uiPropertyRegistry.get('sides')
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

    uiPropertyRegistry.register(propDef, 'circle')
    expect(uiPropertyRegistry.has('radius')).toBe(true)

    uiPropertyRegistry.unregisterComponent('circle')

    const properties = uiPropertyRegistry.getPropertiesForComponent('circle')
    expect(properties).toHaveLength(0)
    expect(uiPropertyRegistry.has('radius')).toBe(false)
  })

  it('should keep property if other components still use it', () => {
    const propDef: PropertyDefinition = {
      name: 'dimension',
      type: 'dimension',
      alias: ['width', 'height']
    }

    uiPropertyRegistry.register(propDef, 'rectangle')
    uiPropertyRegistry.register(propDef, 'oval')

    uiPropertyRegistry.unregisterComponent('rectangle')

    expect(uiPropertyRegistry.has('dimension')).toBe(true)
    const ovalProps = uiPropertyRegistry.getPropertiesForComponent('oval')
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

    uiPropertyRegistry.register(prop1, 'star')
    uiPropertyRegistry.register(prop2, 'star')
    uiPropertyRegistry.register(prop3, 'star')

    const properties = uiPropertyRegistry.getPropertiesForComponent('star')
    expect(properties).toHaveLength(3)
  })
})
