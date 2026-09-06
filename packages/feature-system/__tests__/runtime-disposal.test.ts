import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RawInputEvent, SystemContextSnapshot } from '@asyra/utils'
import type { InputSystemLike } from '../src/types/core-packages'

const snapshot = () => ({}) as SystemContextSnapshot
const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
type InputCallback = (raw: RawInputEvent) => void | Promise<void>
class InputHost implements InputSystemLike {
  readonly listeners = new Map<string, InputCallback>()
  on(event: string, callback: InputCallback) {
    this.listeners.set(event, callback)
  }
  off(event: string, callback: InputCallback) {
    if (this.listeners.get(event) !== callback) return false
    return this.listeners.delete(event)
  }
}

describe.sequential('complete Feature runtime disposal', () => {
  let runtime: typeof import('../src')
  beforeEach(async () => {
    vi.resetModules()
    runtime = await import('../src')
    expect(runtime.disposeFeatureSystem).toBeTypeOf('function')
    expect(runtime.beginFeatureSystemRuntime).toBeTypeOf('function')
  })

  it('joins repeated disposal and keeps admission closed until explicit restart', async () => {
    expect(() => runtime.beginFeatureSystemRuntime()).toThrow()
    const closing = runtime.disposeFeatureSystem(snapshot)
    expect(runtime.disposeFeatureSystem(snapshot)).toBe(closing)
    await closing
    await expect(runtime.interactionQueue.run(() => 1)).rejects.toMatchObject({
      code: 'FEATURE_RUNTIME_CLOSED'
    })
    expect(() =>
      runtime.defineFeature('closed', undefined, { api: {} })
    ).toThrow()
    expect(() => runtime.setCorePackages({})).toThrow()
    runtime.beginFeatureSystemRuntime()
    await expect(runtime.interactionQueue.run(() => 2)).resolves.toBe(2)
    await runtime.disposeFeatureSystem(snapshot)
  })

  it('rejects waiting work and waits for the running command before completing', async () => {
    const started = deferred(),
      release = deferred()
    const late = vi.fn()
    const running = runtime.interactionQueue.run(async () => {
      started.resolve()
      await release.promise
    })
    await started.promise
    const queued = runtime.interactionQueue.run(late)
    const rejected = expect(queued).rejects.toMatchObject({
      code: 'FEATURE_RUNTIME_CLOSED'
    })
    let stopped = false
    const closing = runtime.disposeFeatureSystem(snapshot).then(() => {
      stopped = true
    })
    expect(() => runtime.beginFeatureSystemRuntime()).toThrow()
    await expect(runtime.interactionQueue.run(late)).rejects.toThrow()
    await Promise.resolve()
    expect(stopped).toBe(false)
    release.resolve()
    await Promise.all([running, closing, rejected])
    expect(late).not.toHaveBeenCalled()
  })

  it('aborts tasks immediately but does not mistake abort for settlement', async () => {
    const started = deferred(),
      release = deferred()
    let signal!: AbortSignal
    runtime.defineFeature('task', undefined, {
      priority: 10,
      exclusive: true,
      task: async (_, context) => {
        signal = context.signal
        started.resolve()
        await release.promise
        return 'settled'
      }
    })
    const invocation = runtime.invokeFeatureTask('task', {})
    await started.promise
    let stopped = false
    const closing = runtime.disposeFeatureSystem(snapshot).then(() => {
      stopped = true
    })
    expect(signal.aborted).toBe(true)
    await expect(runtime.invokeFeatureTask('task', {})).rejects.toMatchObject({
      code: 'FEATURE_RUNTIME_CLOSED'
    })
    await Promise.resolve()
    expect(stopped).toBe(false)
    release.resolve()
    await invocation
    await closing
    expect(runtime.getFeatureRegistry().size()).toBe(0)
  })

  it('discards an active commit-current session through ordinary rollback', async () => {
    const events = await import('@asyra/reactive-events')
    const ends: unknown[] = []
    const subscription = events.subscribeToEndTransaction((event) =>
      ends.push(event.payload)
    )
    ends.length = 0
    const onCancel = vi.fn(),
      onEnd = vi.fn()
    runtime.setCorePackages({})
    runtime.defineFeature('drag', 'input.drag', {
      priority: 10,
      exclusive: true,
      cancelPolicy: 'commit-current',
      session: { onStart: () => ({}), onCancel, onEnd }
    })
    await runtime.getSessionManager().handleStart('input.drag', snapshot())
    await runtime.disposeFeatureSystem(snapshot)
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onEnd).not.toHaveBeenCalled()
    expect(ends).toEqual([
      { outcome: 'rollback', failure: { kind: 'cancelled' } }
    ])
    subscription.unsubscribe()
  })

  it('waits for the actual handler after its timeout already rolled back', async () => {
    const release = deferred()
    const manager = runtime.getSessionManager()
    ;(manager as unknown as { handlerTimeoutMs: number }).handlerTimeoutMs = 5
    manager.registerSession('slow', 'slow', 10, true, 'rollback', {
      onStart: () => ({}),
      onUpdate: () => release.promise
    })
    await manager.handleStart('slow', snapshot())
    await expect(
      manager.handleUpdate('slow', snapshot())
    ).rejects.toBeInstanceOf(runtime.FeatureHandlerTimeoutError)
    let stopped = false
    const closing = runtime.disposeFeatureSystem(snapshot).then(() => {
      stopped = true
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(stopped).toBe(false)
    expect(() => runtime.beginFeatureSystemRuntime()).toThrow()
    release.resolve()
    await closing
  })

  it('aborts an in-progress start and waits for its real completion and cleanup', async () => {
    const started = deferred(),
      release = deferred()
    let signal!: AbortSignal
    const onCancel = vi.fn()
    const manager = runtime.getSessionManager()
    manager.registerSession('starting', 'starting', 10, true, {
      onStart: async (context) => {
        signal = (context as { detail: { signal: AbortSignal } }).detail.signal
        started.resolve()
        await release.promise
        return {}
      },
      onCancel
    })
    const starting = manager.handleStart('starting', snapshot())
    await started.promise
    const closing = runtime.disposeFeatureSystem(snapshot)
    expect(signal.aborted).toBe(true)
    release.resolve()
    await starting
    await closing
    expect(onCancel).toHaveBeenCalledOnce()
    expect(manager.getAllActiveSessions().size).toBe(0)
  })

  it('retires old input callbacks and SessionManagers across successor initialization', async () => {
    const input = new InputHost(),
      oldOperation = vi.fn(),
      newOperation = vi.fn()
    runtime.setCorePackages({
      inputSystem: input,
      systemContext: { getSystemContextSnapshot: snapshot }
    })
    const old = runtime.defineFeature('action', 'input.action', {
      priority: 10,
      exclusive: true,
      execution: oldOperation
    })
    const callback = input.listeners.get('input.action')
    if (!callback) throw new Error('Old input binding was not installed')
    const manager = runtime.getSessionManager()
    await runtime.disposeFeatureSystem(snapshot)
    expect(input.listeners.size).toBe(0)
    runtime.beginFeatureSystemRuntime()
    runtime.setCorePackages({
      inputSystem: input,
      systemContext: { getSystemContextSnapshot: snapshot }
    })
    runtime.defineFeature('action', 'input.action', {
      priority: 10,
      exclusive: true,
      execution: newOperation
    })
    expect(old.dispose()).toBe(false)
    await expect(callback({} as RawInputEvent)).rejects.toMatchObject({
      code: 'FEATURE_RUNTIME_CLOSED'
    })
    await expect(
      manager.runAfterCancellingActiveSessions(snapshot, oldOperation, 'old')
    ).rejects.toThrow()
    const currentCallback = input.listeners.get('input.action')
    if (!currentCallback)
      throw new Error('Successor input binding was not installed')
    await currentCallback({} as RawInputEvent)
    expect(oldOperation).not.toHaveBeenCalled()
    expect(newOperation).toHaveBeenCalledOnce()
    await runtime.disposeFeatureSystem(snapshot)
  })

  it('contains delayed renderer subscriptions and removes pending definitions', async () => {
    const events = await import('@asyra/reactive-events')
    const operation = vi.fn()
    runtime.defineFeature('pending', 'input.pending', {
      priority: 10,
      exclusive: true,
      execution: operation
    })
    await runtime.disposeFeatureSystem(snapshot)
    runtime.beginFeatureSystemRuntime()
    const input = new InputHost()
    runtime.setCorePackages({
      inputSystem: input,
      systemContext: { getSystemContextSnapshot: snapshot }
    })
    expect(input.listeners.size).toBe(0)
    runtime.defineFeature('render', 'render.test.reset', {
      priority: 10,
      exclusive: true,
      execution: operation
    })
    await runtime.disposeFeatureSystem(snapshot)
    await Promise.resolve()
    events.publishEventToObservers({ type: 'render.test.reset' })
    await Promise.resolve()
    expect(operation).not.toHaveBeenCalled()
  })

  it('keeps cleanup failure closed and does not allow a successor', async () => {
    runtime.setCorePackages({})
    runtime.defineFeature('failing', 'input.failing', {
      priority: 10,
      exclusive: true,
      session: {
        onStart: () => ({}),
        onCancel: () => {
          throw new Error('cleanup failed')
        }
      }
    })
    await runtime.getSessionManager().handleStart('input.failing', snapshot())
    const closing = runtime.disposeFeatureSystem(snapshot)
    await expect(closing).rejects.toThrow('cleanup failed')
    expect(runtime.disposeFeatureSystem(snapshot)).toBe(closing)
    expect(() => runtime.beginFeatureSystemRuntime()).toThrow()
    await expect(runtime.interactionQueue.run(() => 1)).rejects.toThrow()
  })

  it('joins disposal reentered synchronously by an owned abort listener', async () => {
    const started = deferred()
    let reentered: Promise<void> | undefined
    runtime.defineFeature('reentrant', undefined, {
      priority: 10,
      exclusive: true,
      task: (_, context) =>
        new Promise<void>((resolve) => {
          context.signal.addEventListener(
            'abort',
            () => {
              reentered = runtime.disposeFeatureSystem(snapshot)
              resolve()
            },
            { once: true }
          )
          started.resolve()
        })
    })
    const running = runtime.invokeFeatureTask('reentrant', {})
    await started.promise
    const closing = runtime.disposeFeatureSystem(snapshot)
    await Promise.all([closing, running])
    expect(reentered).toBe(closing)
  })

  it('does not start a task handler still waiting for its first microtask', async () => {
    const handler = vi.fn()
    runtime.defineFeature('not-started', undefined, {
      priority: 10,
      exclusive: true,
      task: handler
    })
    const running = runtime.invokeFeatureTask('not-started', {})
    const rejected = expect(running).rejects.toMatchObject({
      code: 'FEATURE_RUNTIME_CLOSED'
    })
    await runtime.disposeFeatureSystem(snapshot)
    await rejected
    expect(handler).not.toHaveBeenCalled()
  })
})
