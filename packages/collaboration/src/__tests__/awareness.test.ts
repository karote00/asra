import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
import { AwarenessRuntime, AwarenessValidationError } from '../awareness'
import { createCollaboration } from '..'
import { readOperationLog } from '../yjs-document'

const factory = () => ({
  subscribeToSharedDelivery: vi.fn(() => () => undefined)
})

describe('ephemeral awareness ownership', () => {
  it('binds the default runtime to the collaboration instance actor without emitting presence', () => {
    const yDoc = new Y.Doc()
    const instance = createCollaboration({
      documentId: 'document-a',
      roomId: 'room-a',
      actorId: 'actor-a',
      factory: factory(),
      operationDefinitions: [],
      permissionPolicy: () => true,
      yDoc
    })
    const awareness = instance.awareness as AwarenessRuntime

    expect(awareness.actorId).toBe('actor-a')
    expect(awareness.localClock()).toBe(0)
    expect(readOperationLog(yDoc)).toEqual([])
  })

  it('creates detached outbound presence with a monotonic clock and runtime heartbeat only on update', () => {
    let now = 100
    const runtime = new AwarenessRuntime({
      actorId: 'actor-a',
      now: () => now
    })
    const input = {
      identity: { displayName: 'Asa' },
      cursor: { x: 10, y: 20 },
      selection: { channel: 'element', ids: ['node-a'] },
      viewport: { x: 0, y: 0, zoom: 1 },
      tool: 'select',
      editing: { targetId: 'node-a' }
    }

    const first = runtime.updateLocal(input)
    now = 120
    input.cursor.x = 999
    input.selection.ids.push('mutated')
    const second = runtime.updateLocal({ tool: 'pen' })

    expect(first).toEqual({
      actorId: 'actor-a',
      clock: 1,
      state: {
        identity: { displayName: 'Asa' },
        cursor: { x: 10, y: 20 },
        selection: { channel: 'element', ids: ['node-a'] },
        viewport: { x: 0, y: 0, zoom: 1 },
        tool: 'select',
        editing: { targetId: 'node-a' },
        heartbeatAt: 100
      }
    })
    expect(second).toEqual({
      actorId: 'actor-a',
      clock: 2,
      state: { tool: 'pen', heartbeatAt: 120 }
    })
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.state)).toBe(true)
    expect(runtime.localClock()).toBe(2)
  })

  it('accepts only increasing remote clocks and isolates observer mutations', () => {
    let now = 100
    const runtime = new AwarenessRuntime({
      actorId: 'actor-local',
      now: () => now
    })
    const later = vi.fn()
    runtime.observe((event) => {
      if (event.type === 'updated') {
        ;(event.snapshot.state.cursor as { x: number }).x = 999
      }
    })
    runtime.observe(later)

    expect(
      runtime.applyRemote({
        actorId: 'actor-remote',
        clock: 2,
        state: { cursor: { x: 10, y: 20 }, heartbeatAt: 90 }
      })
    ).toBe(true)
    now = 110
    expect(
      runtime.applyRemote({
        actorId: 'actor-remote',
        clock: 1,
        state: { cursor: { x: 1, y: 2 }, heartbeatAt: 80 }
      })
    ).toBe(false)

    expect(runtime.getRemote('actor-remote')).toEqual({
      actorId: 'actor-remote',
      clock: 2,
      state: { cursor: { x: 10, y: 20 }, heartbeatAt: 90 },
      lastSeenAt: 100
    })
    expect(later).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'updated',
        snapshot: expect.objectContaining({
          state: expect.objectContaining({ cursor: { x: 10, y: 20 } })
        })
      })
    )
  })

  it('clears remote presence on disconnect, explicit leave, and timeout', () => {
    let now = 100
    const runtime = new AwarenessRuntime({
      actorId: 'actor-local',
      timeoutMs: 50,
      now: () => now
    })
    const removed = vi.fn()
    runtime.observe((event) => {
      if (event.type === 'removed') removed(event)
    })
    const apply = (actorId: string) =>
      runtime.applyRemote({
        actorId,
        clock: 1,
        state: { tool: 'select', heartbeatAt: now }
      })

    apply('disconnect-actor')
    runtime.handleDisconnect({
      actorId: 'disconnect-actor',
      reason: 'disconnect'
    })
    apply('leave-actor')
    runtime.applyRemote({ actorId: 'leave-actor', clock: 2, state: null })
    apply('timeout-actor')
    now = 151
    expect(runtime.expire()).toEqual(['timeout-actor'])

    expect(runtime.remoteActors()).toEqual([])
    expect(removed.mock.calls.map(([event]) => event.reason)).toEqual([
      'disconnect',
      'leave',
      'timeout'
    ])
  })

  it('rejects unselected fields and malformed actor/clock input', () => {
    const runtime = new AwarenessRuntime({ actorId: 'actor-local' })

    expect(() => runtime.updateLocal({ role: 'admin' } as never)).toThrowError(
      expect.objectContaining<Partial<AwarenessValidationError>>({
        code: 'unsupported-field'
      })
    )
    expect(() =>
      runtime.applyRemote({ actorId: '', clock: 1, state: { tool: 'pen' } })
    ).toThrowError(
      expect.objectContaining<Partial<AwarenessValidationError>>({
        code: 'invalid-actor'
      })
    )
    expect(() =>
      runtime.applyRemote({
        actorId: 'actor-remote',
        clock: -1,
        state: { tool: 'pen' }
      })
    ).toThrowError(
      expect.objectContaining<Partial<AwarenessValidationError>>({
        code: 'invalid-clock'
      })
    )

    expect(() =>
      runtime.applyRemote({
        actorId: 'actor-remote',
        clock: 2,
        state: { unsupported: true }
      })
    ).toThrowError(
      expect.objectContaining<Partial<AwarenessValidationError>>({
        code: 'unsupported-field'
      })
    )
    expect(
      runtime.applyRemote({
        actorId: 'actor-remote',
        clock: 2,
        state: { tool: 'pen' }
      })
    ).toBe(true)
  })

  it('preserves prototype-named JSON keys as inert awareness data', () => {
    const runtime = new AwarenessRuntime({ actorId: 'actor-local' })
    const identity = JSON.parse(
      '{"__proto__":{"claimedPermission":"write"},"displayName":"Asa"}'
    ) as Record<string, never>

    expect(
      runtime.applyRemote({
        actorId: 'actor-remote',
        clock: 1,
        state: { identity }
      })
    ).toBe(true)

    const cloned = runtime.getRemote('actor-remote')?.state.identity as Record<
      string,
      unknown
    >
    expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype)
    expect(Object.prototype.hasOwnProperty.call(cloned, '__proto__')).toBe(true)
    expect(cloned.__proto__).toEqual({ claimedPermission: 'write' })
    expect('claimedPermission' in cloned).toBe(false)
  })

  it('rejects accessor-backed awareness data without executing it', () => {
    const runtime = new AwarenessRuntime({ actorId: 'actor-local' })
    const nestedGetter = vi.fn(() => 'Asa')
    const identity = {}
    Object.defineProperty(identity, 'displayName', {
      enumerable: true,
      get: nestedGetter
    })

    expect(() =>
      runtime.updateLocal({ identity: identity as never })
    ).toThrowError(
      expect.objectContaining<Partial<AwarenessValidationError>>({
        code: 'invalid-state'
      })
    )
    expect(nestedGetter).not.toHaveBeenCalled()

    const topLevelGetter = vi.fn(() => ({ displayName: 'Asa' }))
    const input = {}
    Object.defineProperty(input, 'identity', {
      enumerable: true,
      get: topLevelGetter
    })
    expect(() => runtime.updateLocal(input)).toThrowError(
      expect.objectContaining<Partial<AwarenessValidationError>>({
        code: 'invalid-state'
      })
    )
    expect(topLevelGetter).not.toHaveBeenCalled()
  })

  it.each(['actorId', 'clock', 'state'] as const)(
    'rejects an accessor-backed inbound %s field without executing it',
    (field) => {
      const runtime = new AwarenessRuntime({ actorId: 'actor-local' })
      const getter = vi.fn(
        () => ({ actorId: 'actor-remote', clock: 1, state: {} })[field]
      )
      const message: Record<string, unknown> = {
        actorId: 'actor-remote',
        clock: 1,
        state: { tool: 'select' }
      }
      Object.defineProperty(message, field, {
        enumerable: true,
        get: getter
      })

      expect(() => runtime.applyRemote(message as never)).toThrowError(
        expect.objectContaining<Partial<AwarenessValidationError>>({
          code: 'invalid-state'
        })
      )
      expect(getter).not.toHaveBeenCalled()
    }
  )

  it('never writes Y.Doc, persistence, transaction, or permission state', () => {
    const yDoc = new Y.Doc()
    const persistence = { append: vi.fn() }
    const transaction = { update: vi.fn(), undo: vi.fn() }
    const permission = vi.fn(() => false)
    const runtime = new AwarenessRuntime({ actorId: 'actor-a' })

    const message = runtime.updateLocal({
      cursor: { x: 10, y: 20 },
      identity: { claimedPermission: 'write' }
    })

    expect(message.state).toEqual(
      expect.objectContaining({
        identity: { claimedPermission: 'write' }
      })
    )
    expect(readOperationLog(yDoc)).toEqual([])
    expect(persistence.append).not.toHaveBeenCalled()
    expect(transaction.update).not.toHaveBeenCalled()
    expect(transaction.undo).not.toHaveBeenCalled()
    expect(permission).not.toHaveBeenCalled()
    expect('authorize' in runtime).toBe(false)
  })

  it('disposes state and observers without affecting another instance', () => {
    const first = new AwarenessRuntime({ actorId: 'actor-a' })
    const second = new AwarenessRuntime({ actorId: 'actor-b' })
    const firstObserver = vi.fn()
    first.observe(firstObserver)
    first.applyRemote({
      actorId: 'actor-c',
      clock: 1,
      state: { tool: 'select' }
    })

    first.dispose()
    first.dispose()
    second.applyRemote({
      actorId: 'actor-c',
      clock: 1,
      state: { tool: 'pen' }
    })

    expect(first.isDisposed()).toBe(true)
    expect(first.remoteActors()).toEqual([])
    expect(firstObserver).toHaveBeenCalledTimes(1)
    expect(second.getRemote('actor-c')?.state).toEqual({ tool: 'pen' })
    expect(second.isDisposed()).toBe(false)
  })

  it('lets an app project and remove presence without changing canonical state', () => {
    const yDoc = new Y.Doc()
    const canonicalDocument = Object.freeze({
      elements: Object.freeze([{ id: 'node-a', x: 10 }])
    })
    const projectedPresence = new Map<string, unknown>()
    const runtime = new AwarenessRuntime({ actorId: 'actor-local' })
    runtime.observe((event) => {
      if (event.type === 'updated') {
        projectedPresence.set(event.snapshot.actorId, event.snapshot.state)
        return
      }
      projectedPresence.delete(event.actorId)
    })

    runtime.applyRemote({
      actorId: 'actor-remote',
      clock: 1,
      state: { cursor: { x: 20, y: 30 }, tool: 'select' }
    })

    expect(projectedPresence.get('actor-remote')).toEqual({
      cursor: { x: 20, y: 30 },
      tool: 'select'
    })
    runtime.handleDisconnect({
      actorId: 'actor-remote',
      reason: 'disconnect'
    })
    expect(projectedPresence.size).toBe(0)
    expect(canonicalDocument).toEqual({ elements: [{ id: 'node-a', x: 10 }] })
    expect(readOperationLog(yDoc)).toEqual([])
  })
})
