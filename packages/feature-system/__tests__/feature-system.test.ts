import { describe, it, expect, vi } from 'vitest'
import {
  defineFeature,
  importFeature,
  getFeatureRegistry,
  getSessionManager
} from '../src'

describe('Feature System', () => {
  it('should define and register a feature', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const feature: any = defineFeature('test-feature', ({ packages }) => ({
      api: {
        hello: () => 'hello world',
        add: (a: number, b: number) => a + b
      },
      define: ({ on }) => {
        console.log('Test feature defined')
      }
    }))

    expect(feature.api).toBeDefined()
    expect(feature.api.hello()).toBe('hello world')
    expect(feature.api.add(1, 2)).toBe(3)

    consoleSpy.mockRestore()
  })

  it('should import feature API', () => {
    defineFeature('import-test', ({ packages }) => ({
      api: {
        value: 42
      },
      define: () => {}
    }))

    const api = importFeature('import-test')
    expect(api.value).toBe(42)
  })

  it('should throw error when importing non-existent feature', () => {
    expect(() => importFeature('non-existent')).toThrowError(
      'Feature "non-existent" not found'
    )
  })

  it('should get feature registry', () => {
    const registry = getFeatureRegistry()
    expect(registry).toBeDefined()
    expect(registry.size()).toBeGreaterThan(0)
  })

  it('should throw error when registering duplicate feature', () => {
    expect(() => {
      defineFeature('test-feature', ({ packages }) => ({
        api: {},
        define: () => {}
      }))
    }).toThrow('Feature "test-feature" is already registered')
  })

  it('should get session manager', () => {
    const manager = getSessionManager()
    expect(manager).toBeDefined()
  })
})
