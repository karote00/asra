import * as Y from 'yjs'
import { Factory, LocalSharedDataChannel } from '@asyra/factory'
import { describe, expect, it, vi } from 'vitest'
import {
  AwarenessRuntime,
  CollaborationDisposalError,
  createCollaboration,
  type CollaborationInstanceCompositionInput
} from '..'
import {
  MemoryCollaborationHub,
  MemoryCollaborationProvider
} from '../providers/memory-provider'
import type { CollaborationUpdatePersistence } from '../persistence'
import type { CollaborationProvider } from '../provider'
import { readOperationLog } from '../yjs-document'

const createFactory = () => ({
  subscribeToSharedDelivery: vi.fn(() => () => undefined)
})

const createProvider = (
  overrides: Partial<CollaborationProvider> = {}
): CollaborationProvider => ({
  identity: {
    documentId: 'document-a',
    roomId: 'room-a',
    actorId: 'actor-a'
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  reconnect: vi.fn(),
  destroy: vi.fn(),
  getStatus: vi.fn(
    (): ReturnType<CollaborationProvider['getStatus']> => 'idle'
  ),
  onStatusChange: vi.fn(() => () => undefined),
  sendUpdate: vi.fn(),
  onUpdate: vi.fn(() => () => undefined),
  requestSync: vi.fn(async () => new Uint8Array()),
  exchangeStateVector: vi.fn(async () => ({
    remoteStateVector: new Uint8Array(),
    missingRemoteUpdate: new Uint8Array()
  })),
  sendSyncUpdate: vi.fn(),
  onAcknowledgement: vi.fn(() => () => undefined),
  sendAwareness: vi.fn(),
  onAwareness: vi.fn(() => () => undefined),
  onAwarenessDisconnect: vi.fn(() => () => undefined),
  onFailure: vi.fn(() => () => undefined),
  ...overrides
})

const createPersistence = (
  overrides: Partial<CollaborationUpdatePersistence> = {}
): CollaborationUpdatePersistence => ({
  append: vi.fn(),
  load: vi.fn(async () => []),
  dispose: vi.fn(),
  ...overrides
})

const input = (
  overrides: Partial<CollaborationInstanceCompositionInput> = {}
): CollaborationInstanceCompositionInput => ({
  documentId: 'document-a',
  roomId: 'room-a',
  actorId: 'actor-a',
  factory: createFactory(),
  operationDefinitions: [],
  permissionPolicy: () => true,
  ...overrides
})

describe('CollaborationInstance ownership and disposal', () => {
  it('creates isolated Y.Doc and awareness resources only for explicit instances', () => {
    const first = createCollaboration(input())
    const second = createCollaboration(
      input({ documentId: 'document-b', roomId: 'room-b', actorId: 'actor-b' })
    )

    expect(first.yDoc).toBeInstanceOf(Y.Doc)
    expect(second.yDoc).toBeInstanceOf(Y.Doc)
    expect(first.yDoc).not.toBe(second.yDoc)
    expect(first.awareness).toBeInstanceOf(AwarenessRuntime)
    expect(first.awareness).not.toBe(second.awareness)
    expect(first.provider).toBeUndefined()
    expect(first.identity).toEqual({
      documentId: 'document-a',
      roomId: 'room-a',
      actorId: 'actor-a'
    })
  })

  it('receives intentional shared wiring without creating fallback resources', () => {
    const sharedDoc = new Y.Doc()
    const sharedAwareness = new AwarenessRuntime()
    const factory = createFactory()
    const first = createCollaboration(
      input({ factory, yDoc: sharedDoc, awareness: sharedAwareness })
    )
    const second = createCollaboration(
      input({
        factory,
        documentId: 'document-a',
        actorId: 'actor-b',
        yDoc: sharedDoc,
        awareness: sharedAwareness
      })
    )

    expect(first.yDoc).toBe(sharedDoc)
    expect(second.yDoc).toBe(sharedDoc)
    expect(first.awareness).toBe(sharedAwareness)
    expect(second.awareness).toBe(sharedAwareness)
    expect(first.factory).toBe(factory)
    expect(second.factory).toBe(factory)
  })

  it('does not connect an injected provider during construction', () => {
    const provider = createProvider()
    const instance = createCollaboration(input({ provider }))

    expect(instance.provider).toBe(provider)
    expect(provider.connect).not.toHaveBeenCalled()
  })

  it('rejects an operation-enabled composition without the remote transaction boundary', () => {
    expect(() =>
      createCollaboration(
        input({
          operationDefinitions: [
            {
              channel: 'document',
              eventName: 'set-value',
              schemaVersion: 1,
              validate: (payload): payload is { value: number } =>
                typeof (payload as { value?: unknown } | undefined)?.value ===
                'number',
              apply: () => true
            }
          ]
        })
      )
    ).toThrow(
      '[collaboration] operation-enabled Factory requires the remote transaction boundary'
    )
  })

  it('destroys owned resources once and detaches all instance disposers', async () => {
    const yDoc = new Y.Doc()
    const awareness = new AwarenessRuntime()
    const provider = createProvider()
    const persistence = createPersistence()
    const destroyDoc = vi.fn()
    const disposeAwareness = vi.fn()
    yDoc.destroy = destroyDoc
    awareness.dispose = disposeAwareness
    const instance = createCollaboration(
      input({
        yDoc,
        awareness,
        provider,
        persistence,
        resourceOwnership: {
          yDoc: 'owned',
          awareness: 'owned',
          provider: 'owned',
          persistence: 'owned'
        }
      })
    )
    const detachFirst = vi.fn()
    const detachSecond = vi.fn()
    instance.ownDisposer(detachFirst)
    instance.ownDisposer(detachSecond)

    await instance.dispose()
    await instance.dispose()

    expect(detachSecond).toHaveBeenCalledTimes(1)
    expect(detachFirst).toHaveBeenCalledTimes(1)
    expect(provider.destroy).toHaveBeenCalledTimes(1)
    expect(persistence.dispose).toHaveBeenCalledTimes(1)
    expect(disposeAwareness).toHaveBeenCalledTimes(1)
    expect(destroyDoc).toHaveBeenCalledTimes(1)
    expect(instance.isDisposed()).toBe(true)
  })

  it('does not destroy borrowed resources or affect another shared instance', async () => {
    const sharedDoc = new Y.Doc()
    const sharedAwareness = new AwarenessRuntime()
    const provider = createProvider()
    const persistence = createPersistence()
    const destroyDoc = vi.fn()
    const disposeAwareness = vi.fn()
    sharedDoc.destroy = destroyDoc
    sharedAwareness.dispose = disposeAwareness
    const first = createCollaboration(
      input({
        yDoc: sharedDoc,
        awareness: sharedAwareness,
        provider,
        persistence
      })
    )
    const second = createCollaboration(
      input({
        yDoc: sharedDoc,
        awareness: sharedAwareness,
        provider,
        persistence
      })
    )

    await first.dispose()
    sharedDoc.getMap('still-alive').set('value', 1)

    expect(destroyDoc).not.toHaveBeenCalled()
    expect(disposeAwareness).not.toHaveBeenCalled()
    expect(provider.destroy).not.toHaveBeenCalled()
    expect(persistence.dispose).not.toHaveBeenCalled()
    expect(second.yDoc.getMap('still-alive').get('value')).toBe(1)
    expect(second.isDisposed()).toBe(false)
  })

  it('attempts every cleanup and reports one aggregate disposal failure', async () => {
    const firstFailure = new Error('provider destroy failed')
    const secondFailure = new Error('awareness dispose failed')
    const yDoc = new Y.Doc()
    const destroyDoc = vi.fn()
    yDoc.destroy = destroyDoc
    const failingAwareness = new AwarenessRuntime()
    failingAwareness.dispose = vi.fn(() => {
      throw secondFailure
    })
    const instance = createCollaboration(
      input({
        yDoc,
        provider: createProvider({
          destroy: vi.fn(() => {
            throw firstFailure
          })
        }),
        awareness: failingAwareness,
        resourceOwnership: {
          provider: 'owned',
          awareness: 'owned',
          yDoc: 'owned'
        }
      })
    )
    const detached = vi.fn()
    instance.ownDisposer(detached)

    const rejection = await instance.dispose().catch((error) => error)

    expect(rejection).toBeInstanceOf(CollaborationDisposalError)
    expect(rejection.failures).toEqual([firstFailure, secondFailure])
    expect(detached).toHaveBeenCalledTimes(1)
    expect(destroyDoc).toHaveBeenCalledTimes(1)
    expect(instance.isDisposed()).toBe(true)
  })

  it('starts one isolated local-to-remote canonical pipeline without receiver echo', async () => {
    interface SetValuePayload {
      before: number
      after: number
    }
    const channelName = 'document'
    const eventName = 'set-value'
    const hub = new MemoryCollaborationHub()
    const client = (actorId: string) => {
      const factory = new Factory()
      factory.registerSharedDataChannel(
        channelName,
        new LocalSharedDataChannel()
      )
      const state = { value: 0 }
      const deliveries = vi.fn()
      factory.subscribeToSharedDelivery(deliveries)
      factory.registerTransactionInverter(eventName, (event) => {
        const payload = (event as unknown as { payload: SetValuePayload })
          .payload
        return {
          type: event.type,
          payload: { before: payload.after, after: payload.before }
        } as typeof event
      })
      factory.registerTransactionReplayHandler(eventName, (event) => {
        state.value = (
          event as unknown as { payload: SetValuePayload }
        ).payload.after
        return true
      })
      const apply = (
        payload: SetValuePayload,
        sharedDelivery: 'transaction-end' | 'immediate' = 'transaction-end'
      ) => {
        state.value = payload.after
        factory.updateTransaction({
          type: 'updateTransaction' as Parameters<
            Factory['updateTransaction']
          >[0]['type'],
          eventName,
          payload,
          options: {
            undoable: true,
            rollbackable: true,
            shared: channelName,
            sharedDelivery
          }
        })
      }
      const provider = new MemoryCollaborationProvider(hub, {
        documentId: 'document-a',
        roomId: 'room-a',
        actorId
      })
      const instance = createCollaboration({
        documentId: 'document-a',
        roomId: 'room-a',
        actorId,
        factory,
        provider,
        operationDefinitions: [
          {
            channel: channelName,
            eventName,
            schemaVersion: 1,
            validate: (payload): payload is SetValuePayload => {
              if (!payload || typeof payload !== 'object') return false
              const candidate = payload as Partial<SetValuePayload>
              return (
                typeof candidate.before === 'number' &&
                typeof candidate.after === 'number'
              )
            },
            apply: (envelope) => {
              apply(envelope.payload as SetValuePayload)
              return true
            }
          }
        ],
        permissionPolicy: () => true,
        resourceOwnership: { provider: 'owned' }
      })
      return { apply, deliveries, factory, instance, provider, state }
    }
    const first = client('actor-a')
    const second = client('actor-b')
    const settleClients = async () => {
      await first.instance.whenIdle()
      await second.instance.whenIdle()
      await first.instance.whenIdle()
      await second.instance.whenIdle()
    }

    expect(first.provider.getStatus()).toBe('idle')
    await Promise.all([first.instance.start(), second.instance.start()])
    first.deliveries.mockClear()
    second.deliveries.mockClear()
    first.factory.startTransaction()
    first.apply({ before: 0, after: 1 })
    first.factory.endTransaction()
    await settleClients()

    expect(first.state.value).toBe(1)
    expect(second.state.value).toBe(1)
    expect(first.deliveries).toHaveBeenCalledTimes(1)
    expect(second.deliveries).not.toHaveBeenCalled()
    expect(readOperationLog(first.instance.yDoc)).toEqual(
      readOperationLog(second.instance.yDoc)
    )

    await first.instance.updateAwareness({
      cursor: { x: 10, y: 20 },
      tool: 'select'
    })
    await second.instance.whenIdle()
    expect(second.instance.awareness.getRemote('actor-a')?.state).toEqual(
      expect.objectContaining({ cursor: { x: 10, y: 20 }, tool: 'select' })
    )

    await first.instance.disconnect()
    await second.instance.whenIdle()
    expect(second.instance.awareness.getRemote('actor-a')).toBeUndefined()
    first.factory.startTransaction()
    first.apply({ before: 1, after: 2 })
    first.factory.endTransaction()
    await first.instance.whenIdle()
    expect(second.state.value).toBe(1)

    await first.instance.reconnect()
    await settleClients()
    expect(second.state.value).toBe(2)
    expect(readOperationLog(first.instance.yDoc)).toEqual(
      readOperationLog(second.instance.yDoc)
    )

    first.factory.undo()
    await settleClients()
    expect(first.state.value).toBe(1)
    expect(second.state.value).toBe(1)
    second.factory.undo()
    expect(second.state.value).toBe(1)

    const beforeRollbackLogLength = readOperationLog(first.instance.yDoc).length
    first.factory.startTransaction()
    first.apply({ before: 1, after: 4 })
    first.factory.endTransaction({ outcome: 'rollback' })
    await settleClients()
    expect(first.state.value).toBe(1)
    expect(second.state.value).toBe(1)
    expect(readOperationLog(first.instance.yDoc)).toHaveLength(
      beforeRollbackLogLength
    )

    first.factory.startTransaction()
    first.apply({ before: 1, after: 3 }, 'immediate')
    first.factory.endTransaction({ outcome: 'rollback' })
    await settleClients()
    const rollbackOperations = readOperationLog(first.instance.yDoc).slice(-2)
    expect(first.state.value).toBe(1)
    expect(second.state.value).toBe(1)
    expect(rollbackOperations[0]).toEqual(
      expect.objectContaining({ origin: 'action' })
    )
    expect(rollbackOperations[1]).toEqual(
      expect.objectContaining({
        origin: 'rollback-compensation',
        compensatesOperationId: rollbackOperations[0]?.operationId
      })
    )
    expect(readOperationLog(first.instance.yDoc)).toEqual(
      readOperationLog(second.instance.yDoc)
    )

    await Promise.all([first.instance.dispose(), second.instance.dispose()])
  })
})
