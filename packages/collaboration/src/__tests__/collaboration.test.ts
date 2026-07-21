import * as Y from 'yjs'
import {
  Factory,
  LocalSharedDataChannel,
  type SharedDelivery
} from '@asyra/factory'
import { describe, expect, it, vi } from 'vitest'
import {
  Awareness,
  DisposalError,
  createCollaboration,
  defineCanonicalOperationApply,
  type CreateCollaborationInput
} from '..'
import { MemoryHub, MemoryProvider } from '../providers/memory'
import type { UpdatePersistence } from '../persistence'
import type { Provider, ProviderStateVectorExchange } from '../provider'
import { readOperationLog } from '../yjs-document'

const createFactory = () => ({
  subscribeToSharedPublication: vi.fn(() => () => undefined)
})

const createProvider = (overrides: Partial<Provider> = {}): Provider => ({
  identity: {
    documentId: 'document-a',
    roomId: 'room-a',
    actorId: 'actor-a'
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  reconnect: vi.fn(),
  destroy: vi.fn(),
  getStatus: vi.fn((): ReturnType<Provider['getStatus']> => 'idle'),
  onStatusChange: vi.fn(() => () => undefined),
  sendUpdate: vi.fn(),
  onUpdate: vi.fn(() => () => undefined),
  requestSync: vi.fn(async () => new Uint8Array()),
  exchangeStateVector: vi.fn(async () => {
    const remoteDocument = new Y.Doc()
    return {
      remoteStateVector: Y.encodeStateVector(remoteDocument),
      missingRemoteUpdate: Y.encodeStateAsUpdate(remoteDocument)
    }
  }),
  sendSyncUpdate: vi.fn(),
  onAcknowledgement: vi.fn(() => () => undefined),
  sendAwareness: vi.fn(),
  onAwareness: vi.fn(() => () => undefined),
  onAwarenessDisconnect: vi.fn(() => () => undefined),
  onFailure: vi.fn(() => () => undefined),
  ...overrides
})

const createPersistence = (
  overrides: Partial<UpdatePersistence> = {}
): UpdatePersistence => ({
  append: vi.fn(),
  load: vi.fn(async () => []),
  dispose: vi.fn(),
  ...overrides
})

const input = (
  overrides: Partial<CreateCollaborationInput> = {}
): CreateCollaborationInput => ({
  documentId: 'document-a',
  roomId: 'room-a',
  actorId: 'actor-a',
  factory: createFactory(),
  operationDefinitions: [],
  permissionPolicy: () => true,
  ...overrides
})

const createPublicationHarness = (provider: Provider) => {
  const factory = new Factory()
  factory.registerSharedDataChannel('document', new LocalSharedDataChannel())
  const instance = createCollaboration(
    input({
      factory,
      provider,
      operationDefinitions: [
        {
          channel: 'document',
          eventName: 'set-value',
          schemaVersion: 1,
          validate: (payload): payload is { value: number } =>
            typeof (payload as { value?: unknown } | undefined)?.value ===
            'number',
          apply: defineCanonicalOperationApply(() => true)
        }
      ],
      resourceOwnership: { provider: 'owned' }
    })
  )
  const publish = () => {
    factory.startTransaction()
    factory.updateTransaction({
      type: 'updateTransaction' as Parameters<
        Factory['updateTransaction']
      >[0]['type'],
      eventName: 'set-value',
      payload: { value: 1 },
      options: {
        undoable: false,
        rollbackable: false,
        shared: 'document'
      }
    })
    factory.endTransaction()
  }
  return { instance, publish }
}

describe('Collaboration ownership, processing, and disposal', () => {
  it('creates isolated Y.Doc and awareness resources only for explicit instances', () => {
    const first = createCollaboration(input())
    const second = createCollaboration(
      input({ documentId: 'document-b', roomId: 'room-b', actorId: 'actor-b' })
    )

    expect(first.yDoc).toBeInstanceOf(Y.Doc)
    expect(second.yDoc).toBeInstanceOf(Y.Doc)
    expect(first.yDoc).not.toBe(second.yDoc)
    expect(first.awareness).toBeInstanceOf(Awareness)
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
    const sharedAwareness = new Awareness()
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
    expect(provider.onAcknowledgement).not.toHaveBeenCalled()
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
              apply: defineCanonicalOperationApply(() => true)
            }
          ]
        })
      )
    ).toThrow(
      '[collaboration] operation-enabled Factory requires the remote transaction boundary'
    )
  })

  it('destroys owned resources once and detaches all observers', async () => {
    const yDoc = new Y.Doc()
    const awareness = new Awareness()
    const detachSharedPublication = vi.fn()
    const detachProviderUpdate = vi.fn()
    const provider = createProvider({
      onUpdate: vi.fn(() => detachProviderUpdate)
    })
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
        factory: {
          subscribeToSharedPublication: vi.fn(() => detachSharedPublication)
        },
        resourceOwnership: {
          yDoc: 'owned',
          awareness: 'owned',
          provider: 'owned',
          persistence: 'owned'
        }
      })
    )

    await instance.start()

    await instance.dispose()
    await instance.dispose()

    expect(detachSharedPublication).toHaveBeenCalledTimes(1)
    expect(detachProviderUpdate).toHaveBeenCalledTimes(1)
    expect(provider.destroy).toHaveBeenCalledTimes(1)
    expect(persistence.dispose).toHaveBeenCalledTimes(1)
    expect(disposeAwareness).toHaveBeenCalledTimes(1)
    expect(destroyDoc).toHaveBeenCalledTimes(1)
    expect(instance.isDisposed()).toBe(true)
  })

  it('destroys an owned provider before awaiting a pending connection', async () => {
    let rejectConnect: ((error: Error) => void) | undefined
    const connectFailure = new Error('connection aborted by disposal')
    const provider = createProvider({
      connect: vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectConnect = reject
          })
      ),
      destroy: vi.fn(async () => rejectConnect?.(connectFailure))
    })
    const instance = createCollaboration(
      input({ provider, resourceOwnership: { provider: 'owned' } })
    )
    const startPromise = instance.start().catch((error) => error)
    await Promise.resolve()

    const disposePromise = instance.dispose()

    try {
      await vi.waitFor(
        () => expect(provider.destroy).toHaveBeenCalledTimes(1),
        { timeout: 100 }
      )
    } finally {
      rejectConnect?.(connectFailure)
      await Promise.all([startPromise, disposePromise])
    }
  })

  it('does not become started when disposal settles an in-flight state-vector exchange', async () => {
    let resolveExchange:
      | ((exchange: ProviderStateVectorExchange) => void)
      | undefined
    const provider = createProvider({
      exchangeStateVector: vi.fn(
        () =>
          new Promise<ProviderStateVectorExchange>((resolve) => {
            resolveExchange = resolve
          })
      ),
      destroy: vi.fn(async () => {
        const remoteDocument = new Y.Doc()
        resolveExchange?.({
          remoteStateVector: Y.encodeStateVector(remoteDocument),
          missingRemoteUpdate: Y.encodeStateAsUpdate(remoteDocument)
        })
        remoteDocument.destroy()
      })
    })
    const instance = createCollaboration(
      input({ provider, resourceOwnership: { provider: 'owned' } })
    )
    const startPromise = instance.start()
    await vi.waitFor(
      () => expect(provider.exchangeStateVector).toHaveBeenCalledTimes(1),
      { timeout: 100 }
    )

    await Promise.all([startPromise, instance.dispose()])

    expect(instance.isDisposed()).toBe(true)
    expect(instance.isStarted()).toBe(false)
  })

  it('bypasses a queued local publication after disposal begins', async () => {
    const provider = createProvider()
    const { instance, publish } = createPublicationHarness(provider)
    await instance.start()

    publish()
    await instance.dispose()

    expect(readOperationLog(instance.yDoc)).toEqual([])
    expect(provider.sendUpdate).not.toHaveBeenCalled()
  })

  it('destroys an owned provider to settle an in-flight send before queue teardown', async () => {
    let rejectSend: ((error: Error) => void) | undefined
    const sendFailure = new Error('send aborted by disposal')
    const provider = createProvider({
      sendUpdate: vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectSend = reject
          })
      ),
      destroy: vi.fn(async () => rejectSend?.(sendFailure))
    })
    const { instance, publish } = createPublicationHarness(provider)
    await instance.start()
    publish()
    await vi.waitFor(
      () => expect(provider.sendUpdate).toHaveBeenCalledTimes(1),
      { timeout: 100 }
    )

    const disposePromise = instance.dispose()

    await vi.waitFor(() => expect(provider.destroy).toHaveBeenCalledTimes(1), {
      timeout: 100
    })
    rejectSend?.(sendFailure)
    await disposePromise
  })

  it('clears local remote-awareness snapshots on disconnect and provider failure', async () => {
    let statusSubscriber: Parameters<Provider['onStatusChange']>[0] | undefined
    const provider = createProvider({
      onStatusChange: vi.fn((subscriber) => {
        statusSubscriber = subscriber
        return () => undefined
      })
    })
    const instance = createCollaboration(input({ provider }))
    await instance.start()
    instance.awareness.applyRemote({
      actorId: 'actor-b',
      clock: 1,
      state: { tool: 'select' }
    })

    await instance.disconnect()
    expect(instance.awareness.remoteActors()).toEqual([])

    instance.awareness.applyRemote({
      actorId: 'actor-b',
      clock: 1,
      state: { tool: 'pen' }
    })
    statusSubscriber?.('failed')
    await instance.whenIdle()
    expect(instance.awareness.remoteActors()).toEqual([])

    await instance.dispose()
  })

  it('does not destroy borrowed resources or affect another shared instance', async () => {
    const sharedDoc = new Y.Doc()
    const sharedAwareness = new Awareness()
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
    const failingAwareness = new Awareness()
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
    const rejection = await instance.dispose().catch((error) => error)

    expect(rejection).toBeInstanceOf(DisposalError)
    expect(rejection.failures).toEqual([firstFailure, secondFailure])
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
    const hub = new MemoryHub()
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
        sharedDelivery: SharedDelivery['sharedDelivery'] = 'transaction-end'
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
      const provider = new MemoryProvider(hub, {
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
            apply: defineCanonicalOperationApply((envelope) => {
              apply(envelope.payload as SetValuePayload)
              return true
            })
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
    expect(first.state.value).toBe(1)
    expect(second.state.value).toBe(1)
    expect(readOperationLog(first.instance.yDoc)).toHaveLength(
      beforeRollbackLogLength
    )
    expect(readOperationLog(first.instance.yDoc)).toEqual(
      readOperationLog(second.instance.yDoc)
    )

    await Promise.all([first.instance.dispose(), second.instance.dispose()])
  })

  it('does not apply a remote operation after disposal begins during async permission', async () => {
    const channelName = 'document'
    const eventName = 'set-value'
    const hub = new MemoryHub()
    let permissionStarted: (() => void) | undefined
    const permissionPending = new Promise<void>((resolve) => {
      permissionStarted = resolve
    })
    let resolvePermission: ((allowed: boolean) => void) | undefined
    const state = { value: 0 }

    const createClient = (
      actorId: string,
      permissionPolicy: CreateCollaborationInput['permissionPolicy']
    ) => {
      const factory = new Factory()
      factory.registerSharedDataChannel(
        channelName,
        new LocalSharedDataChannel()
      )
      const provider = new MemoryProvider(hub, {
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
            validate: (payload): payload is { value: number } =>
              typeof (payload as { value?: unknown } | undefined)?.value ===
              'number',
            apply: defineCanonicalOperationApply((envelope) => {
              state.value = (envelope.payload as { value: number }).value
              return true
            })
          }
        ],
        permissionPolicy,
        resourceOwnership: { provider: 'owned' }
      })
      return { factory, instance }
    }

    const sender = createClient('actor-a', () => true)
    const receiver = createClient(
      'actor-b',
      () =>
        new Promise<boolean>((resolve) => {
          resolvePermission = resolve
          permissionStarted?.()
        })
    )
    await Promise.all([sender.instance.start(), receiver.instance.start()])

    sender.factory.startTransaction()
    sender.factory.updateTransaction({
      type: 'updateTransaction' as Parameters<
        Factory['updateTransaction']
      >[0]['type'],
      eventName,
      payload: { value: 1 },
      options: {
        undoable: false,
        rollbackable: false,
        shared: channelName
      }
    })
    sender.factory.endTransaction()
    await permissionPending

    const disposal = receiver.instance.dispose()
    resolvePermission?.(true)
    await disposal

    expect(state.value).toBe(0)
    await sender.instance.dispose()
  })
})
