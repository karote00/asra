import { describe, it, expect, beforeEach } from 'vitest'
import { componentRegistry } from '../component-registry'

import { ComponentRegistration } from '../component-registry'

// Mock constructor for testing
class MockComponent {
  foo = 'bar'
  constructor(_data?: unknown) {
    // Constructor
  }
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
      constructor:
        MockComponent as unknown as ComponentRegistration['constructor'],
      properties: [],
      defaults: {}
    })

    expect(componentRegistry.has('test-component')).toBe(true)
    const registration = componentRegistry.get('test-component')
    expect(registration?.type).toBe('test-component')
    expect(registration?.idPrefix).toBe('test')
    expect(registration?.namePrefix).toBe('Test')
  })

  it('should throw on duplicate registration', () => {
    componentRegistry.register({
      type: 'duplicate',
      idPrefix: 'dup',
      namePrefix: 'Duplicate',
      constructor:
        MockComponent as unknown as ComponentRegistration['constructor'],
      properties: [],
      defaults: {}
    })

    expect(() =>
      componentRegistry.register({
        type: 'duplicate',
        idPrefix: 'dup2',
        namePrefix: 'Duplicate2',
        constructor:
          MockComponent as unknown as ComponentRegistration['constructor'],
        properties: [],
        defaults: {}
      })
    ).toThrow('Component "duplicate" is already registered')
  })

  it('should unregister components', () => {
    componentRegistry.register({
      type: 'removable',
      idPrefix: 'rem',
      namePrefix: 'Removable',
      constructor:
        MockComponent as unknown as ComponentRegistration['constructor'],
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
      constructor:
        MockComponent as unknown as ComponentRegistration['constructor'],
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
      constructor:
        MockComponent as unknown as ComponentRegistration['constructor'],
      properties: [],
      defaults: {}
    })

    componentRegistry.register({
      type: 'comp2',
      idPrefix: 'c2',
      namePrefix: 'Comp2',
      constructor:
        MockComponent as unknown as ComponentRegistration['constructor'],
      properties: [],
      defaults: {}
    })

    const all = componentRegistry.getAll()
    expect(all.size).toBe(2)
    expect(all.has('comp1')).toBe(true)
    expect(all.has('comp2')).toBe(true)
  })
})
