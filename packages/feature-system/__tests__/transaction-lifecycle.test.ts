import { describe, expect, it, vi } from 'vitest'
import {
  endTransaction,
  subscribeToEndTransaction,
  type EndTransactionEvent
} from '@asyra/reactive-events'
import type { SystemContextSnapshot } from '@asyra/utils'
import type { SystemContextSnapshotWithDetail } from '@asyra/utils'
import * as publicFeatureSystem from '../src'
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
  it('keeps legacy five-argument session registration with commit-current default', async () => {
    const manager = new SessionManager()
    const onEnd = vi.fn()
    const { events, subscription } = captureEndEvents()

    manager.registerSession('legacy-drag', 'legacy', 10, true, {
      onStart: () => ({ started: true }),
      onEnd
    })

    await expect(manager.handleStart('legacy-drag', snapshot)).resolves.toBe(
      true
    )
    await manager.cancelActiveSessions({ ...snapshot, detail: {} })

    expect(onEnd).toHaveBeenCalledOnce()
    expect(events).toHaveLength(1)
    expect(events[0].payload).toEqual({ outcome: 'commit' })

    subscription.unsubscribe()
  })

  it('supports explicit rollback and uses onEnd as cleanup fallback', async () => {
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
    const commitEnd = vi.fn()
    const commitCancel = vi.fn()
    const { events, subscription } = captureEndEvents()
    manager.registerSession(
      'commit-drag',
      'commit',
      10,
      true,
      'commit-current',
      {
        onStart: () => ({ started: true }),
        onEnd: commitEnd,
        onCancel: commitCancel
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
    expect(commitEnd).toHaveBeenCalledOnce()
    expect(commitEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ cancelled: true })
      }),
      { started: true }
    )
    expect(commitCancel).not.toHaveBeenCalled()

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

  it('uses failure cleanup when a later session start participant fails', async () => {
    const manager = new SessionManager()
    const earlierEnd = vi.fn()
    const earlierCancel = vi.fn()
    const failure = new Error('later start failed')
    const { events, subscription } = captureEndEvents()
    manager.registerSession('drag', 'earlier', 20, false, 'commit-current', {
      onStart: () => ({ participant: 'earlier' }),
      onEnd: earlierEnd,
      onCancel: earlierCancel
    })
    manager.registerSession('drag', 'failing', 10, false, 'commit-current', {
      onStart: () => {
        throw failure
      }
    })

    await expect(manager.handleStart('drag', snapshot)).rejects.toBe(failure)

    expect(earlierCancel).toHaveBeenCalledOnce()
    expect(earlierEnd).not.toHaveBeenCalled()
    expect(events[0].payload).toMatchObject({
      outcome: 'rollback',
      failure: { kind: 'handler-error', cause: failure }
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

  it('treats throw undefined from an update handler as a rollback failure', async () => {
    const manager = new SessionManager()
    const cleanup = vi.fn()
    const { events, subscription } = captureEndEvents()
    manager.registerSession(
      'drag',
      'undefined-update',
      10,
      true,
      'commit-current',
      {
        onStart: () => ({ started: true }),
        onUpdate: () => {
          throw undefined
        },
        onCancel: cleanup
      }
    )

    await manager.handleStart('drag', snapshot)
    let rejected = false
    let rejection: unknown = 'not-captured'
    try {
      await manager.handleUpdate('drag', snapshot)
    } catch (error) {
      rejected = true
      rejection = error
    }

    expect(rejected).toBe(true)
    expect(rejection).toBeUndefined()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(events[0].payload).toMatchObject({
      outcome: 'rollback',
      failure: { kind: 'handler-error' }
    })

    subscription.unsubscribe()
  })

  it('treats throw undefined from an end handler as a rollback failure', async () => {
    const manager = new SessionManager()
    const laterEnd = vi.fn()
    const { events, subscription } = captureEndEvents()
    manager.registerSession('drag', 'undefined-end', 20, false, 'rollback', {
      onStart: () => ({ participant: 'undefined-end' }),
      onEnd: () => {
        throw undefined
      }
    })
    manager.registerSession('drag', 'later', 10, false, 'rollback', {
      onStart: () => ({ participant: 'later' }),
      onEnd: laterEnd
    })

    await manager.handleStart('drag', snapshot)
    let rejected = false
    let rejection: unknown = 'not-captured'
    try {
      await manager.handleEnd('drag', snapshot)
    } catch (error) {
      rejected = true
      rejection = error
    }

    expect(rejected).toBe(true)
    expect(rejection).toBeUndefined()
    expect(laterEnd).toHaveBeenCalledTimes(1)
    expect(events[0].payload).toMatchObject({
      outcome: 'rollback',
      failure: { kind: 'handler-error' }
    })

    subscription.unsubscribe()
  })

  it('propagates throw undefined from cancellation cleanup as a handler failure', async () => {
    const manager = new SessionManager()
    const laterCleanup = vi.fn()
    const { events, subscription } = captureEndEvents()
    manager.registerSession('drag', 'undefined-cancel', 20, false, 'rollback', {
      onStart: () => ({ participant: 'undefined-cancel' }),
      onCancel: () => {
        throw undefined
      }
    })
    manager.registerSession('drag', 'later', 10, false, 'rollback', {
      onStart: () => ({ participant: 'later' }),
      onCancel: laterCleanup
    })

    await manager.handleStart('drag', snapshot)
    let rejected = false
    let rejection: unknown = 'not-captured'
    try {
      await manager.cancelActiveSessions({ ...snapshot, detail: {} })
    } catch (error) {
      rejected = true
      rejection = error
    }

    expect(rejected).toBe(true)
    expect(rejection).toBeUndefined()
    expect(laterCleanup).toHaveBeenCalledTimes(1)
    expect(events[0].payload).toMatchObject({
      outcome: 'rollback',
      failure: { kind: 'handler-error' }
    })

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

  it('finishes an active update before committing the interruption moment', async () => {
    const manager = new SessionManager()
    const order: string[] = []
    const { events, subscription } = captureEndEvents()
    let releaseUpdate: (() => void) | undefined
    const updateGate = new Promise<void>((resolve) => {
      releaseUpdate = resolve
    })
    manager.registerSession('drag', 'queued', 10, true, {
      onStart: () => ({ latest: 'start' }),
      onUpdate: async (_snapshot, state) => {
        order.push('update:start')
        await updateGate
        state.latest = 'cancel-moment'
        order.push('update:end')
      },
      onEnd: (_snapshot, state) => {
        order.push(`end:${state.latest}`)
      },
      onCancel: () => {
        order.push('cancel')
      }
    })

    await manager.handleStart('drag', snapshot)
    const update = manager.handleUpdate('drag', snapshot)
    await Promise.resolve()
    const cancel = manager.cancelActiveSessions({ ...snapshot, detail: {} })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const orderBeforeRelease = [...order]
    releaseUpdate?.()
    await Promise.all([update, cancel])

    expect(orderBeforeRelease).toEqual(['update:start'])
    expect(order).toEqual(['update:start', 'update:end', 'end:cancel-moment'])
    expect(events[0].payload).toEqual({ outcome: 'commit' })

    subscription.unsubscribe()
  })

  it('replaces an active session before a repeated public start', async () => {
    const manager = new SessionManager()
    const cancelledStates: unknown[] = []
    const { events, subscription } = captureEndEvents()
    let startCount = 0
    manager.registerSession('drag', 'replaceable', 10, true, 'rollback', {
      onStart: () => ({ start: ++startCount }),
      onCancel: (_snapshot, state) => {
        cancelledStates.push(state)
      }
    })

    let stateAfterSecondStart:
      | { cancelledStates: unknown[]; outcomes: string[] }
      | undefined
    try {
      await manager.handleStart('drag', snapshot)
      await manager.handleStart('drag', snapshot)
      stateAfterSecondStart = {
        cancelledStates: [...cancelledStates],
        outcomes: events.map((event) => event.payload.outcome)
      }
    } finally {
      await manager.cancelActiveSessions({ ...snapshot, detail: {} })
      endTransaction()
      subscription.unsubscribe()
    }

    expect(stateAfterSecondStart).toEqual({
      cancelledStates: [{ start: 1 }],
      outcomes: ['rollback']
    })
    expect(cancelledStates).toEqual([{ start: 1 }, { start: 2 }])
    expect(events.map((event) => event.payload.outcome)).toEqual([
      'rollback',
      'rollback'
    ])
  })

  it('serializes standalone managers against the shared transaction owner', async () => {
    const firstManager = new SessionManager()
    const secondManager = new SessionManager()
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const { events, subscription } = captureEndEvents()
    firstManager.registerSession('first-drag', 'first', 10, true, 'rollback', {
      onStart: () => ({ manager: 'first' }),
      onCancel: firstCleanup
    })
    secondManager.registerSession(
      'second-drag',
      'second',
      10,
      true,
      'rollback',
      {
        onStart: () => ({ manager: 'second' }),
        onCancel: secondCleanup
      }
    )

    let stateAfterSecondStart:
      | { firstActive: boolean; cleanupCount: number; outcomes: string[] }
      | undefined
    try {
      await firstManager.handleStart('first-drag', snapshot)
      await secondManager.handleStart('second-drag', snapshot)
      stateAfterSecondStart = {
        firstActive: firstManager.getActiveSession('first-drag') !== undefined,
        cleanupCount: firstCleanup.mock.calls.length,
        outcomes: events.map((event) => event.payload.outcome)
      }
    } finally {
      await secondManager.cancelActiveSessions({ ...snapshot, detail: {} })
      await firstManager.cancelActiveSessions({ ...snapshot, detail: {} })
      endTransaction()
      subscription.unsubscribe()
    }

    expect(stateAfterSecondStart).toEqual({
      firstActive: false,
      cleanupCount: 1,
      outcomes: ['rollback']
    })
    expect(secondCleanup).toHaveBeenCalledOnce()
    expect(events.map((event) => event.payload.outcome)).toEqual([
      'rollback',
      'rollback'
    ])
  })

  it('exports the identifiable timeout error from the package facade', () => {
    expect(publicFeatureSystem).toHaveProperty(
      'FeatureHandlerTimeoutError',
      FeatureHandlerTimeoutError
    )
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
