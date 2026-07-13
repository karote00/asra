import { describe, expect, it, vi } from 'vitest'
import {
  subscribeToEndTransaction,
  type EndTransactionEvent
} from '@asyra/reactive-events'
import type { SystemContextSnapshot } from '@asyra/utils'
import type { SystemContextSnapshotWithDetail } from '@asyra/utils'
import { ExecutionRegistryClass } from '../src/core/execution-registry'
import {
  FeatureHandlerTimeoutError,
  SessionManager
} from '../src/core/session-manager'
import { InteractionQueue } from '../src/core/interaction-queue'

const snapshot = {} as SystemContextSnapshot

const captureEndEvents = () => {
  const events: EndTransactionEvent[] = []
  const subscription = subscribeToEndTransaction((event) => {
    events.push(event)
  })
  events.length = 0
  return { events, subscription }
}

describe('feature transaction lifecycle', () => {
  it('defaults session cancellation to rollback and uses onEnd as cleanup fallback', async () => {
    const manager = new SessionManager()
    const onEnd = vi.fn()
    const { events, subscription } = captureEndEvents()
    manager.registerSession('drag', 'move', 10, true, 'rollback', {
      onStart: () => ({ started: true }),
      onEnd
    })

    await manager.handleStart('drag', snapshot)
    await manager.cancelActiveSessions({
      ...snapshot,
      detail: { cancelledBy: 'escape' }
    })

    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          cancelled: true,
          cancelledBy: 'escape'
        })
      }),
      { started: true }
    )
    expect(events).toHaveLength(1)
    expect(events[0].payload).toMatchObject({
      outcome: 'rollback',
      failure: { kind: 'cancelled' }
    })

    subscription.unsubscribe()
  })

  it('supports commit-current and feature-defined cancel outcomes', async () => {
    const manager = new SessionManager()
    const { events, subscription } = captureEndEvents()
    manager.registerSession(
      'commit-drag',
      'commit',
      10,
      true,
      'commit-current',
      {
        onStart: () => ({ started: true }),
        onCancel: vi.fn()
      }
    )
    manager.registerSession(
      'defined-drag',
      'defined',
      10,
      true,
      'feature-defined',
      {
        onStart: () => ({ started: true }),
        onCancel: () => 'commit-current'
      }
    )

    await manager.handleStart('commit-drag', snapshot)
    await manager.cancelActiveSessions({ ...snapshot, detail: {} })
    await manager.handleStart('defined-drag', snapshot)
    await manager.cancelActiveSessions({ ...snapshot, detail: {} })

    expect(events.map((event) => event.payload.outcome)).toEqual([
      'commit',
      'commit'
    ])

    subscription.unsubscribe()
  })

  it('lets any rollback participant win during cancellation', async () => {
    const manager = new SessionManager()
    const { events, subscription } = captureEndEvents()
    manager.registerSession('drag', 'commit', 20, false, 'commit-current', {
      onStart: () => ({ participant: 'commit' }),
      onCancel: vi.fn()
    })
    manager.registerSession('drag', 'rollback', 10, false, 'rollback', {
      onStart: () => ({ participant: 'rollback' }),
      onCancel: vi.fn()
    })

    await manager.handleStart('drag', snapshot)
    await manager.cancelActiveSessions({ ...snapshot, detail: {} })

    expect(events[0].payload.outcome).toBe('rollback')

    subscription.unsubscribe()
  })

  it('rolls back, cleans every participant, and rethrows update timeout', async () => {
    const manager = new SessionManager()
    const cleanupFirst = vi.fn()
    const cleanupSecond = vi.fn()
    const { events, subscription } = captureEndEvents()
    ;(manager as unknown as { handlerTimeoutMs: number }).handlerTimeoutMs = 5
    manager.registerSession('drag', 'slow', 20, false, 'rollback', {
      onStart: () => ({ participant: 'slow' }),
      onUpdate: () => new Promise<void>(() => undefined),
      onCancel: cleanupFirst
    })
    manager.registerSession('drag', 'other', 10, false, 'rollback', {
      onStart: () => ({ participant: 'other' }),
      onUpdate: vi.fn(),
      onCancel: cleanupSecond
    })

    await manager.handleStart('drag', snapshot)

    await expect(manager.handleUpdate('drag', snapshot)).rejects.toBeInstanceOf(
      FeatureHandlerTimeoutError
    )
    expect(cleanupFirst).toHaveBeenCalledTimes(1)
    expect(cleanupSecond).toHaveBeenCalledTimes(1)
    expect(manager.getActiveSession('drag')).toBeUndefined()
    expect(events[0].payload.outcome).toBe('rollback')

    subscription.unsubscribe()
  })

  it('aborts the session signal before a timed-out end handler can write late', async () => {
    const manager = new SessionManager()
    const lateMutation = vi.fn()
    ;(manager as unknown as { handlerTimeoutMs: number }).handlerTimeoutMs = 5
    manager.registerSession('drag', 'slow-end', 10, true, 'rollback', {
      onStart: () => ({ started: true }),
      onEnd: async (handlerSnapshot) => {
        const signal = (handlerSnapshot as SystemContextSnapshotWithDetail)
          .detail?.signal as AbortSignal
        await new Promise((resolve) => setTimeout(resolve, 15))
        if (!signal.aborted) {
          lateMutation()
        }
      }
    })

    await manager.handleStart('drag', snapshot)
    await expect(manager.handleEnd('drag', snapshot)).rejects.toBeInstanceOf(
      FeatureHandlerTimeoutError
    )
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(lateMutation).not.toHaveBeenCalled()
  })

  it('stops lower session starts and rolls back when onStart fails', async () => {
    const manager = new SessionManager()
    const lowerStart = vi.fn(() => ({ participant: 'lower' }))
    const failure = new Error('start failed')
    const { events, subscription } = captureEndEvents()
    manager.registerSession('drag', 'failing', 20, false, 'rollback', {
      onStart: () => {
        throw failure
      }
    })
    manager.registerSession('drag', 'lower', 10, false, 'rollback', {
      onStart: lowerStart
    })

    await expect(manager.handleStart('drag', snapshot)).rejects.toBe(failure)

    expect(lowerStart).not.toHaveBeenCalled()
    expect(events[0].payload).toMatchObject({
      outcome: 'rollback',
      failure: { kind: 'handler-error' }
    })

    subscription.unsubscribe()
  })

  it('gives every onEnd a cleanup opportunity before rolling back the first failure', async () => {
    const manager = new SessionManager()
    const failure = new Error('end failed')
    const laterEnd = vi.fn()
    const { events, subscription } = captureEndEvents()
    manager.registerSession('drag', 'failing', 20, false, 'rollback', {
      onStart: () => ({ participant: 'failing' }),
      onEnd: () => {
        throw failure
      }
    })
    manager.registerSession('drag', 'later', 10, false, 'rollback', {
      onStart: () => ({ participant: 'later' }),
      onEnd: laterEnd
    })

    await manager.handleStart('drag', snapshot)
    await expect(manager.handleEnd('drag', snapshot)).rejects.toBe(failure)

    expect(laterEnd).toHaveBeenCalledTimes(1)
    expect(events[0].payload.outcome).toBe('rollback')

    subscription.unsubscribe()
  })

  it('commits a normally completed session', async () => {
    const manager = new SessionManager()
    const { events, subscription } = captureEndEvents()
    manager.registerSession('drag', 'normal', 10, true, 'rollback', {
      onStart: () => ({ started: true }),
      onEnd: vi.fn()
    })

    await manager.handleStart('drag', snapshot)
    await manager.handleEnd('drag', snapshot)

    expect(events[0].payload).toEqual({ outcome: 'commit' })

    subscription.unsubscribe()
  })

  it('stops lower execution handlers and rolls back when one-shot execution fails', async () => {
    const registry = new ExecutionRegistryClass()
    const lower = vi.fn(() => ({ ran: true }))
    const failure = new Error('execution failed')
    const { events, subscription } = captureEndEvents()
    registry.register('command', 'failing', { priority: 20 }, () => {
      throw failure
    })
    registry.register('command', 'lower', { priority: 10 }, lower)

    await expect(registry.execute('command', snapshot)).rejects.toBe(failure)

    expect(lower).not.toHaveBeenCalled()
    expect(events[0].payload).toMatchObject({
      outcome: 'rollback',
      failure: { kind: 'handler-error', cause: failure }
    })

    subscription.unsubscribe()
  })

  it('serializes interaction operations after both success and failure', async () => {
    const queue = new InteractionQueue()
    const order: string[] = []
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = queue.run(async () => {
      order.push('first:start')
      await firstGate
      order.push('first:end')
    })
    const second = queue.run(async () => {
      order.push('second')
      throw new Error('second failed')
    })
    const third = queue.run(async () => {
      order.push('third')
    })

    await Promise.resolve()
    expect(order).toEqual(['first:start'])
    releaseFirst?.()
    await first
    await expect(second).rejects.toThrow('second failed')
    await third

    expect(order).toEqual(['first:start', 'first:end', 'second', 'third'])
  })
})
