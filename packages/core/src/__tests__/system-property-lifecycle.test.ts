import systemContext from '@asyra/system-context'
import { describe, expect, it, vi } from 'vitest'
import { Core } from '../core'

const PROPERTY_KEY = 'preset-cleanup-test-property'

const createCoreForTest = () =>
  new Core({
    inputSystem: {} as never,
    factory: {
      registerTransactionReplayHandler: vi.fn(() => () => undefined),
      subscribeToCommitCapture: vi.fn(() => () => undefined),
      subscribeToTransactionStatus: vi.fn(() => () => undefined),
      reportPersistenceStatus: vi.fn()
    } as never,
    props: {} as never,
    render: {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1
    } as never,
    sceneTree: {} as never,
    selection: {} as never,
    systemContext: {} as never
  })

describe('Core system-property lifecycle facade', () => {
  it('reports and unregisters a managed property while composition is open', () => {
    const core = createCoreForTest()
    try {
      expect(core.hasSystemProperty(PROPERTY_KEY)).toBe(false)
      core.defineSystemProperty(PROPERTY_KEY, 1)
      expect(core.hasSystemProperty(PROPERTY_KEY)).toBe(true)
      expect(core.unregisterSystemProperty(PROPERTY_KEY)).toBe(true)
      expect(core.hasSystemProperty(PROPERTY_KEY)).toBe(false)
      expect(core.unregisterSystemProperty(PROPERTY_KEY)).toBe(false)
    } finally {
      systemContext.unregisterProperty(PROPERTY_KEY)
    }
  })

  it('rejects unregister after startup closes composition', async () => {
    const core = createCoreForTest()
    core.defineSystemProperty(PROPERTY_KEY, 1)
    core.setRenderer({
      name: 'system-property-test-renderer',
      init: vi.fn(async () => ({ canvas: null, instance: null })),
      destroy: vi.fn(),
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      setViewportPosition: vi.fn(),
      setViewportScale: vi.fn(),
      resize: vi.fn(),
      getCanvas: () => null,
      getInstance: () => null
    })
    try {
      await core.start(document.createElement('div'), { width: 1, height: 1 })

      expect(() => core.unregisterSystemProperty(PROPERTY_KEY)).toThrow(
        'Registration composition is permanently closed'
      )
      expect(core.hasSystemProperty(PROPERTY_KEY)).toBe(true)
    } finally {
      systemContext.unregisterProperty(PROPERTY_KEY)
    }
  })
})
