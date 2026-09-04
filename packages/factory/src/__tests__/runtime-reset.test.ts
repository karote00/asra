import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  TransactionEventTypes,
  startTransaction,
  endTransaction
} from '@asyra/reactive-events'
import defaultFactory, {
  Factory,
  LocalSharedDataChannel,
  type SharedDataChannelBatchChangeHandler
} from '../index.js'

const event = (
  id = 'A',
  shared?: string
): Parameters<Factory['updateTransaction']>[0] => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: EventTypes.UPDATE_PROPERTY,
  payload: { id, before: 0, after: 1 },
  options: { undoable: true, ...(shared ? { shared } : {}) }
})
const commit = (factory: Factory, id = 'A', shared?: string) => {
  factory.startTransaction()
  factory.updateTransaction(event(id, shared))
  factory.endTransaction()
}

describe('Factory complete runtime reset', () => {
  beforeEach(() =>
    expect(Factory.prototype.resetRuntime).toBeTypeOf('function')
  )

  it('clears Undo and Redo without replaying canonical changes and can reset repeatedly', () => {
    const factory = new Factory(),
      replay = vi.fn(() => true)
    factory.registerTransactionReplayHandler(EventTypes.UPDATE_PROPERTY, replay)
    commit(factory)
    factory.undo()
    replay.mockClear()
    factory.resetRuntime()
    factory.resetRuntime()
    factory.redo()
    factory.undo()
    expect(factory.getUndoHistoryDepth()).toBe(0)
    expect(replay).not.toHaveBeenCalled()
    factory.registerTransactionReplayHandler(EventTypes.UPDATE_PROPERTY, replay)
    commit(factory, 'B')
    expect(factory.getUndoHistoryDepth()).toBe(1)
    factory.undo()
    expect(replay).toHaveBeenCalledOnce()
  })

  it('releases custom validators, inverters and replay registrations', () => {
    const factory = new Factory()
    const register = () => {
      factory.registerTransactionValidator('custom', () => undefined)
      factory.registerTransactionInverter('custom', (change) => change)
      factory.registerTransactionReplayHandler('custom', () => true)
    }
    register()
    factory.resetRuntime()
    expect(register).not.toThrow()
  })

  it('rejects active reset before changing history, channels or the transaction', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel('channel', new LocalSharedDataChannel())
    commit(factory)
    factory.startTransaction()
    factory.updateTransaction(event('pending'))
    expect(() => factory.resetRuntime()).toThrow(/active|settlement/)
    expect(factory.getUndoHistoryDepth()).toBe(1)
    expect(factory.hasSharedDataChannel('channel')).toBe(true)
    factory.endTransaction()
    expect(factory.getUndoHistoryDepth()).toBe(2)
    factory.resetRuntime()
    expect(factory.getUndoHistoryDepth()).toBe(0)
  })

  it('rejects reset reentered from commit, publication and status delivery', () => {
    const factory = new Factory(),
      attempts: unknown[] = []
    factory.registerSharedDataChannel('channel', new LocalSharedDataChannel())
    const tryReset = () => {
      try {
        factory.resetRuntime()
        attempts.push('unexpected success')
      } catch (error) {
        attempts.push(error)
      }
    }
    factory.subscribeToCommitCapture(tryReset)
    factory.subscribeToSharedPublication(tryReset)
    factory.subscribeToTransactionStatus(tryReset)
    commit(factory, 'A', 'channel')
    expect(attempts).toHaveLength(3)
    attempts.forEach((error) => expect(error).toBeInstanceOf(Error))
    expect(factory.getUndoHistoryDepth()).toBe(1)
    factory.resetRuntime()
  })

  it('releases owned observers but not a creator-owned direct channel subscription', () => {
    const factory = new Factory(),
      channel = new LocalSharedDataChannel()
    const projection = vi.fn(),
      direct = vi.fn(),
      status = vi.fn(),
      capture = vi.fn(),
      delivery = vi.fn(),
      publication = vi.fn()
    channel.observe(direct)
    factory.registerSharedDataChannel('channel', channel)
    const staleDispose = factory.observeSharedDataChannel('channel', projection)
    factory.subscribeToTransactionStatus(status)
    factory.subscribeToCommitCapture(capture)
    factory.subscribeToSharedDeliveryBatch(delivery)
    factory.subscribeToSharedPublication(publication)
    commit(factory, 'A', 'channel')
    ;[projection, direct, status, capture, delivery, publication].forEach(
      (spy) => spy.mockClear()
    )
    factory.resetRuntime()
    expect(factory.hasSharedDataChannel('channel')).toBe(false)
    channel.append({ old: true })
    expect(direct).toHaveBeenCalledOnce()
    expect(projection).not.toHaveBeenCalled()
    const next = new LocalSharedDataChannel(),
      nextProjection = vi.fn()
    factory.registerSharedDataChannel('channel', next)
    factory.observeSharedDataChannel('channel', nextProjection)
    staleDispose()
    commit(factory, 'B', 'channel')
    expect(nextProjection).toHaveBeenCalledOnce()
    ;[projection, status, capture, delivery, publication].forEach((spy) =>
      expect(spy).not.toHaveBeenCalled()
    )
  })

  it('attempts all channel cleanups and invalidates retained callbacks after a cleanup error', () => {
    const factory = new Factory(),
      observers: SharedDataChannelBatchChangeHandler[] = []
    const remainingCleanup = vi.fn(),
      oldProjection = vi.fn()
    const add = (name: string, cleanup: () => void) => {
      factory.registerSharedDataChannel(name, {
        appendBatch: () => undefined,
        observeBatch: (handler) => {
          observers.push(handler)
          return cleanup
        }
      })
      factory.observeSharedDataChannel(name, oldProjection)
    }
    add('first', () => {
      throw new Error('channel cleanup failed')
    })
    add('second', remainingCleanup)
    expect(() => factory.resetRuntime()).toThrow('channel cleanup failed')
    expect(remainingCleanup).toHaveBeenCalledOnce()
    observers.forEach((callback) => callback([{ old: true }]))
    expect(oldProjection).not.toHaveBeenCalled()
    expect(factory.hasSharedDataChannel('first')).toBe(false)
    expect(factory.hasSharedDataChannel('second')).toBe(false)
  })

  it('invalidates retained staged delivery handles even after sequence numbers restart', () => {
    const factory = new Factory()
    factory.startTransaction()
    const old = factory.getActiveStagedDeliveryController()
    if (!old) throw new Error('Missing active delivery controller')
    factory.endTransaction()
    factory.resetRuntime()
    factory.startTransaction()
    expect(() => old.stageSlice('old')).toThrow('no longer active')
    factory.endTransaction()
  })

  it('rejects reset during direct shared-channel callback delivery', () => {
    const factory = new Factory(),
      channel = new LocalSharedDataChannel(),
      following = vi.fn()
    let rejection: unknown
    factory.registerSharedDataChannel('channel', channel)
    factory.observeSharedDataChannel('channel', () => {
      try {
        factory.resetRuntime()
      } catch (error) {
        rejection = error
      }
    })
    factory.observeSharedDataChannel('channel', following)
    channel.append({ value: 'old' })
    expect(rejection).toBeInstanceOf(Error)
    expect(following).toHaveBeenCalledOnce()
    factory.resetRuntime()
    channel.append({ value: 'late' })
    expect(following).toHaveBeenCalledOnce()
  })

  it('rejects reset before an observation disposer has been acquired', () => {
    const factory = new Factory(),
      cleanup = vi.fn()
    let rejection: unknown
    factory.registerSharedDataChannel('channel', {
      appendBatch: () => undefined,
      observeBatch: () => {
        try {
          factory.resetRuntime()
        } catch (error) {
          rejection = error
        }
        return cleanup
      }
    })
    factory.observeSharedDataChannel('channel', () => undefined)
    expect(rejection).toBeInstanceOf(Error)
    expect(cleanup).not.toHaveBeenCalled()
    factory.resetRuntime()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('rejects reset while progressive remote application is suspended', async () => {
    const factory = new Factory()
    let release!: () => void, started!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const waiting = new Promise<void>((resolve) => {
      started = resolve
    })
    const applying = factory.runRemoteTransactionProgressively(
      [
        () => {
          factory.updateTransaction(event('remote-one'))
        },
        () => {
          factory.updateTransaction(event('remote-two'))
        }
      ],
      async () => {
        started()
        await gate
      }
    )
    await waiting
    try {
      expect(() => factory.resetRuntime()).toThrow(/active|settlement/)
    } finally {
      release()
    }
    await applying
    expect(factory.getUndoHistoryDepth()).toBe(0)
    factory.resetRuntime()
    commit(factory, 'local')
    expect(factory.getUndoHistoryDepth()).toBe(1)
  })

  it('preserves the default transaction bridge and isolates a different Factory', () => {
    const separate = new Factory()
    commit(separate, 'separate')
    defaultFactory.resetRuntime()
    startTransaction()
    defaultFactory.updateTransaction(event('before-reset'))
    endTransaction()
    expect(defaultFactory.getUndoHistoryDepth()).toBe(1)
    defaultFactory.resetRuntime()
    startTransaction()
    defaultFactory.updateTransaction(event('after-reset'))
    endTransaction()
    expect(defaultFactory.getUndoHistoryDepth()).toBe(1)
    expect(separate.getUndoHistoryDepth()).toBe(1)
    defaultFactory.resetRuntime()
  })
})
