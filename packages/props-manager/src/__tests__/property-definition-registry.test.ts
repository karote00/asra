import { describe, it, expect, beforeEach } from 'vitest'
import { elementPropertyRegistry } from '../registries/property-definition'
import type { PropertyDefinition } from '../registries/property-definition'

describe('ElementPropertyRegistry', () => {
  beforeEach(() => {
    // Clear registry by unregistering all component types
    const registry = (
      elementPropertyRegistry as unknown as {
        registry: Map<string, { componentTypes: Set<string> }>
      }
    ).registry
    const allProps = Array.from(registry.entries())
    allProps.forEach(([, registered]) => {
      Array.from(registered.componentTypes).forEach((type) => {
        elementPropertyRegistry.unregisterComponent(type)
      })
    })
  })

  it('should register properties for components', () => {
    const propDef: PropertyDefinition = {
      name: 'count',
      type: 'custom',
      defaultValue: 5
    }

    elementPropertyRegistry.register(propDef, 'star')

    expect(elementPropertyRegistry.has('count')).toBe(true)
    const properties = elementPropertyRegistry.getPropertiesForComponent('star')
    expect(properties).toHaveLength(1)
    expect(properties[0].name).toBe('count')
  })

  it('should allow multiple components to share a property', () => {
    const propDef: PropertyDefinition = {
      name: 'position',
      type: 'position',
      alias: ['x', 'y']
    }

    elementPropertyRegistry.register(propDef, 'star')
    elementPropertyRegistry.register(propDef, 'polygon')

    const starProps = elementPropertyRegistry.getPropertiesForComponent('star')
    const polygonProps =
      elementPropertyRegistry.getPropertiesForComponent('polygon')

    expect(starProps).toHaveLength(1)
    expect(polygonProps).toHaveLength(1)
    expect(starProps[0].name).toBe('position')
    expect(polygonProps[0].name).toBe('position')
  })

  it('preserves exact component-local definitions when names are shared', () => {
    elementPropertyRegistry.register(
      {
        name: 'appearance',
        type: 'fills',
        defaultValue: { color: 'red' }
      },
      'rectangle'
    )
    elementPropertyRegistry.register(
      {
        name: 'appearance',
        type: 'strokes',
        defaultValue: { width: 2 }
      },
      'whiteboard-rectangle'
    )

    expect(
      elementPropertyRegistry.getForComponent('rectangle', 'appearance')
    ).toEqual({
      name: 'appearance',
      type: 'fills',
      defaultValue: { color: 'red' }
    })
    expect(
      elementPropertyRegistry.getForComponent(
        'whiteboard-rectangle',
        'appearance'
      )
    ).toEqual({
      name: 'appearance',
      type: 'strokes',
      defaultValue: { width: 2 }
    })
  })

  it('should get property definition by name', () => {
    const propDef: PropertyDefinition = {
      name: 'sides',
      type: 'custom',
      defaultValue: 6
    }

    elementPropertyRegistry.register(propDef, 'polygon')

    const retrieved = elementPropertyRegistry.get('sides')
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

    elementPropertyRegistry.register(propDef, 'circle')
    expect(elementPropertyRegistry.has('radius')).toBe(true)

    elementPropertyRegistry.unregisterComponent('circle')

    const properties =
      elementPropertyRegistry.getPropertiesForComponent('circle')
    expect(properties).toHaveLength(0)
    expect(elementPropertyRegistry.has('radius')).toBe(false)
  })

  it('should keep property if other components still use it', () => {
    const propDef: PropertyDefinition = {
      name: 'dimension',
      type: 'dimension',
      alias: ['width', 'height']
    }

    elementPropertyRegistry.register(propDef, 'rectangle')
    elementPropertyRegistry.register(propDef, 'oval')

    elementPropertyRegistry.unregisterComponent('rectangle')

    expect(elementPropertyRegistry.has('dimension')).toBe(true)
    const ovalProps = elementPropertyRegistry.getPropertiesForComponent('oval')
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

    elementPropertyRegistry.register(prop1, 'star')
    elementPropertyRegistry.register(prop2, 'star')
    elementPropertyRegistry.register(prop3, 'star')

    const properties = elementPropertyRegistry.getPropertiesForComponent('star')
    expect(properties).toHaveLength(3)
  })

  it('does not expose replacement semantics through the shared registry', () => {
    expect(elementPropertyRegistry).not.toHaveProperty(
      'replaceComponentProperties'
    )
  })
})
