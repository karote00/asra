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
})
