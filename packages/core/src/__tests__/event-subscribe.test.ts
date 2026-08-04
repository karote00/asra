import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineEvent, eventRegistry } from '@asyra/reactive-events'
import { Core } from '../core.js'

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
      init: async () => ({ canvas: null }),
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1,
      registerLayer: vi.fn(),
      unregisterLayer: () => true
    } as never,
    sceneTree: {} as never,
    selection: {} as never,
    systemContext: {} as never
  })

describe('Core subscribeEvent', () => {
  beforeEach(() => {
    eventRegistry.clear()
  })

  it('throws when subscribing to an unregistered event', () => {
    const core = createCoreForTest()
    const event = defineEvent<{ id: number }>('test.unregistered')

    expect(() => core.subscribeEvent(event, vi.fn())).toThrow(
      'is not registered'
    )
  })

  it('subscribes through registered event and returns disposer', () => {
    const core = createCoreForTest()
    const event = defineEvent<{ id: number }>('test.registered')
    const registration = core.registerEvent(event)
    const handler = (payload?: { id: number }) => payload

    const spyCalls: ({ id: number } | undefined)[] = []
    const dispose = core.subscribeEvent(event, (payload) => {
      spyCalls.push(handler(payload))
    })

    registration.publish({ id: 1 })
    expect(spyCalls).toEqual([{ id: 1 }])

    dispose()
    registration.publish({ id: 2 })
    expect(spyCalls).toEqual([{ id: 1 }])
  })
})
