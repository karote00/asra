import { publishEventToObservers } from '@asyra/reactive-events'
import type { RawInputEvent, SystemContextSnapshot } from '@asyra/utils'
import { describe, expect, it, vi } from 'vitest'
import {
  defineFeature,
  FeatureUnregisterError,
  getSessionManager,
  setCorePackages,
  unregisterFeature
} from '../src'
import type { InputSystemLike } from '../src/types/core-packages'

type InputCallback = (raw: RawInputEvent) => void | Promise<void>

class TestInputSystem implements InputSystemLike {
  private readonly listeners = new Map<string, InputCallback[]>()

  on(event: string, callback: InputCallback): this {
    const callbacks = this.listeners.get(event) ?? []
    callbacks.push(callback)
    this.listeners.set(event, callbacks)
    return this
  }

  off(event: string, callback: InputCallback): boolean {
    const callbacks = this.listeners.get(event)
    if (!callbacks) {
      return false
    }
    const index = callbacks.indexOf(callback)
    if (index < 0) {
      return false
    }
    callbacks.splice(index, 1)
    if (callbacks.length === 0) {
      this.listeners.delete(event)
    }
    return true
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0
  }

  async emit(event: string): Promise<void> {
    const raw = {
      type: event,
      detail: {}
    } as unknown as RawInputEvent
    for (const callback of [...(this.listeners.get(event) ?? [])]) {
      await callback(raw)
    }
  }
}

const inputSystem = new TestInputSystem()
const systemContext = {
  getSystemContextSnapshot: () => ({}) as SystemContextSnapshot
}

describe.sequential('feature unregister lifecycle', () => {
  it('removes a pending registration before packages initialize', () => {
    defineFeature('pending-feature', 'input.pending', {
      execution: vi.fn()
    })

    expect(unregisterFeature('pending-feature')).toBe(true)
    setCorePackages({ inputSystem, systemContext })

    expect(inputSystem.listenerCount('input.pending')).toBe(0)
  })

  it('removes only the requested participant from a shared input trigger', async () => {
    const first = vi.fn(() => ({ owner: 'first' }))
    const second = vi.fn(() => ({ owner: 'second' }))
    defineFeature('shared-first', 'input.shared', {
      execution: first,
      exclusive: false
    })
    defineFeature('shared-second', 'input.shared', {
      execution: second,
      exclusive: false
    })

    expect(inputSystem.listenerCount('input.shared')).toBe(1)
    expect(unregisterFeature('shared-first')).toBe(true)
    expect(inputSystem.listenerCount('input.shared')).toBe(1)

    await inputSystem.emit('input.shared')
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()

    expect(unregisterFeature('shared-second')).toBe(true)
    expect(inputSystem.listenerCount('input.shared')).toBe(0)
  })

  it('removes all session handlers and transport listeners after normal end', async () => {
    const onStart = vi.fn(() => ({ started: true }))
    const onEnd = vi.fn()
    defineFeature('session-feature', 'input.drag', {
      session: { onStart, onEnd }
    })

    expect(inputSystem.listenerCount('input.drag.start')).toBe(1)
    expect(inputSystem.listenerCount('input.drag.update')).toBe(1)
    expect(inputSystem.listenerCount('input.drag.end')).toBe(1)

    await inputSystem.emit('input.drag.start')
    await inputSystem.emit('input.drag.end')
    expect(onStart).toHaveBeenCalledOnce()
    expect(onEnd).toHaveBeenCalledOnce()

    expect(unregisterFeature('session-feature')).toBe(true)
    expect(getSessionManager().getRegisteredSessionNames()).not.toContain(
      'input.drag'
    )
    expect(inputSystem.listenerCount('input.drag.start')).toBe(0)
    expect(inputSystem.listenerCount('input.drag.update')).toBe(0)
    expect(inputSystem.listenerCount('input.drag.end')).toBe(0)
  })

  it('rejects unregister while one-shot execution is active', async () => {
    let release: (() => void) | undefined
    let markStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    defineFeature('active-execution', 'input.active', {
      execution: async () => {
        markStarted?.()
        await gate
        return { complete: true }
      }
    })

    const execution = inputSystem.emit('input.active')
    await started

    expect(() => unregisterFeature('active-execution')).toThrowError(
      expect.objectContaining<Partial<FeatureUnregisterError>>({
        code: 'FEATURE_IN_USE',
        featureName: 'active-execution'
      })
    )

    release?.()
    await execution
    expect(unregisterFeature('active-execution')).toBe(true)
  })

  it('rejects unregister while a feature session is active', async () => {
    defineFeature('active-session', 'input.active-session', {
      session: {
        onStart: () => ({ started: true }),
        onEnd: vi.fn()
      }
    })

    await inputSystem.emit('input.active-session.start')
    expect(() => unregisterFeature('active-session')).toThrowError(
      expect.objectContaining<Partial<FeatureUnregisterError>>({
        code: 'FEATURE_IN_USE',
        featureName: 'active-session'
      })
    )

    await inputSystem.emit('input.active-session.end')
    expect(unregisterFeature('active-session')).toBe(true)
  })

  it('unsubscribes renderer transport before registering a replacement', async () => {
    const original = vi.fn(() => ({ owner: 'original' }))
    const replacement = vi.fn(() => ({ owner: 'replacement' }))
    defineFeature('renderer-original', 'render.extension.lifecycle', {
      execution: original
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(unregisterFeature('renderer-original')).toBe(true)
    defineFeature('renderer-replacement', 'render.extension.lifecycle', {
      execution: replacement
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    publishEventToObservers({
      type: 'render.extension.lifecycle',
      payload: {}
    } as never)

    await vi.waitFor(() => expect(replacement).toHaveBeenCalledOnce())
    expect(original).not.toHaveBeenCalled()
    expect(unregisterFeature('renderer-replacement')).toBe(true)
  })

  it('returns false for a missing feature without removing shared transport', () => {
    const listenerCount = inputSystem.listenerCount('input.missing')
    expect(unregisterFeature('missing-feature')).toBe(false)
    expect(inputSystem.listenerCount('input.missing')).toBe(listenerCount)
  })
})
