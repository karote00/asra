import { describe, expect, it } from 'vitest'
import { MapRegistry } from '../map-registry.js'

describe('MapRegistry.register', () => {
  it('throws when key already exists', () => {
    const registry = new MapRegistry<string, string>()
    registry.register('a', 'first')

    expect(() => registry.register('a', 'second')).toThrow(
      'Registry key "a" is already registered'
    )
    expect(registry.get('a')).toBe('first')
  })

  it('supports custom duplicate error messages', () => {
    const registry = new MapRegistry<string, string>()
    registry.register('a', 'first')

    expect(() =>
      registry.register('a', 'second', {
        duplicateErrorMessage: 'duplicate key a'
      })
    ).toThrow('duplicate key a')
  })

  it('calls onDuplicate when key already exists', () => {
    const registry = new MapRegistry<string, string>()
    const duplicates: string[] = []
    registry.register('a', 'first')

    expect(() =>
      registry.register('a', 'second', {
        onDuplicate: (key, current, next) => {
          duplicates.push(`${key}:${current}->${next}`)
        }
      })
    ).toThrow('Registry key "a" is already registered')

    expect(duplicates).toEqual(['a:first->second'])
  })
})
