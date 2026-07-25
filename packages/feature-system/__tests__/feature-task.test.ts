import {
  subscribeToEndTransaction,
  type EndTransactionEvent
} from '@asyra/reactive-events'
import { describe, expect, it, vi } from 'vitest'
import {
  cancelFeatureTask,
  defineFeature,
  FeatureTaskActiveError,
  invokeFeatureTask,
  unregisterFeature
} from '../src'

const captureEndEvents = () => {
  const events: EndTransactionEvent[] = []
  const subscription = subscribeToEndTransaction((event) => {
    events.push(event)
  })
  events.length = 0
  return { events, subscription }
}

describe.sequential('programmatic feature task lifecycle', () => {
  it('invokes one typed task with a Feature-owned signal and no transaction', async () => {
    const handler = vi.fn(
      async (input: { intent: string }, context: { signal: AbortSignal }) => ({
        intent: input.intent,
        signal: context.signal
      })
    )
    const { events, subscription } = captureEndEvents()

    defineFeature<
      Record<string, never>,
      Record<string, never>,
      { intent: string },
      { intent: string; signal: AbortSignal }
    >('feature-task-basic', undefined, {
      priority: 90,
      exclusive: true,
      task: handler
    })

    const externalController = new AbortController()
    const result = await invokeFeatureTask<
      { intent: string },
      { intent: string; signal: AbortSignal }
    >(
      'feature-task-basic',
      { intent: 'create a rectangle' },
      { signal: externalController.signal }
    )

    expect(result.intent).toBe('create a rectangle')
    expect(result.signal).not.toBe(externalController.signal)
    expect(result.signal.aborted).toBe(false)
    expect(handler).toHaveBeenCalledOnce()
    expect(events).toEqual([])
    expect(cancelFeatureTask('feature-task-basic')).toBe(false)
    expect(unregisterFeature('feature-task-basic')).toBe(true)

    subscription.unsubscribe()
  })

  it('rejects overlap instead of creating a second task queue', async () => {
    let markStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })

    defineFeature('feature-task-exclusive', undefined, {
      priority: 90,
      exclusive: true,
      task: async (
        input: { intent: string },
        { signal }: { signal: AbortSignal }
      ) => {
        markStarted?.()
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true })
        })
        return { status: 'cancelled' as const, intent: input.intent }
      }
    })

    const first = invokeFeatureTask('feature-task-exclusive', {
      intent: 'first'
    })
    await started

    await expect(
      invokeFeatureTask('feature-task-exclusive', { intent: 'second' })
    ).rejects.toEqual(
      expect.objectContaining<Partial<FeatureTaskActiveError>>({
        code: 'FEATURE_TASK_ACTIVE',
        featureName: 'feature-task-exclusive'
      })
    )

    expect(cancelFeatureTask('feature-task-exclusive')).toBe(true)
    await expect(first).resolves.toEqual({
      status: 'cancelled',
      intent: 'first'
    })
    expect(unregisterFeature('feature-task-exclusive')).toBe(true)
  })

  it('protects active unregister until task settlement', async () => {
    let release: (() => void) | undefined
    let markStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    defineFeature('feature-task-unregister', undefined, {
      task: async () => {
        markStarted?.()
        await gate
        return { complete: true }
      }
    })

    const invocation = invokeFeatureTask('feature-task-unregister', {})
    await started

    expect(() => unregisterFeature('feature-task-unregister')).toThrowError(
      expect.objectContaining({
        code: 'FEATURE_IN_USE',
        featureName: 'feature-task-unregister'
      })
    )

    release?.()
    await invocation
    expect(unregisterFeature('feature-task-unregister')).toBe(true)
  })

  it('propagates a pre-aborted caller signal and removes settled ownership', async () => {
    const controller = new AbortController()
    controller.abort('caller-cancelled')
    const handler = vi.fn(
      async (_input: unknown, { signal }: { signal: AbortSignal }) => ({
        aborted: signal.aborted,
        reason: signal.reason
      })
    )

    defineFeature('feature-task-pre-aborted', undefined, {
      task: handler
    })

    await expect(
      invokeFeatureTask(
        'feature-task-pre-aborted',
        {},
        { signal: controller.signal }
      )
    ).resolves.toEqual({
      aborted: true,
      reason: 'caller-cancelled'
    })
    expect(handler).toHaveBeenCalledOnce()
    expect(cancelFeatureTask('feature-task-pre-aborted')).toBe(false)
    expect(unregisterFeature('feature-task-pre-aborted')).toBe(true)
  })

  it('removes the external abort listener after successful settlement', async () => {
    const controller = new AbortController()
    const originalAddEventListener = controller.signal.addEventListener.bind(
      controller.signal
    )
    const originalRemoveEventListener =
      controller.signal.removeEventListener.bind(controller.signal)
    const addEventListener = vi.fn(originalAddEventListener)
    const removeEventListener = vi.fn(originalRemoveEventListener)
    controller.signal.addEventListener = addEventListener
    controller.signal.removeEventListener = removeEventListener

    defineFeature('feature-task-listener-cleanup', undefined, {
      task: async () => ({ complete: true })
    })

    await invokeFeatureTask(
      'feature-task-listener-cleanup',
      {},
      { signal: controller.signal }
    )

    expect(addEventListener).toHaveBeenCalledOnce()
    expect(removeEventListener).toHaveBeenCalledOnce()
    expect(removeEventListener.mock.calls[0][1]).toBe(
      addEventListener.mock.calls[0][1]
    )
    expect(unregisterFeature('feature-task-listener-cleanup')).toBe(true)
  })

  it('releases active ownership after task failure without a transaction', async () => {
    const failure = new Error('task failed')
    const { events, subscription } = captureEndEvents()

    defineFeature('feature-task-failure', undefined, {
      task: async () => {
        throw failure
      }
    })

    await expect(invokeFeatureTask('feature-task-failure', {})).rejects.toBe(
      failure
    )
    expect(events).toEqual([])
    expect(cancelFeatureTask('feature-task-failure')).toBe(false)
    expect(unregisterFeature('feature-task-failure')).toBe(true)

    subscription.unsubscribe()
  })
})
