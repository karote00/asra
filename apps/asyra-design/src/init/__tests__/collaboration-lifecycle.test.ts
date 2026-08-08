import 'fake-indexeddb/auto'
import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as collaborationModule from '@asyra/collaboration'
import { ProviderFailure } from '@asyra/collaboration'
import factory, { type SharedPublication } from '@asyra/factory'
import { EventTypes } from '@asyra/reactive-events'
import {
  IDTypes,
  PROPS_ACTIONS,
  SharedDataChannelNames,
  idCounter
} from '@asyra/utils'
import * as collaborationOperations from '../../collaboration/publication-processor'
import { createFormalInitialDocument } from '../../collaboration/initial-document'
import { CollaborationWebSocketProvider } from '../../collaboration/websocket-provider'
import {
  CollaborationMessageTypes,
  encodePublicationMessageFrames
} from '../../collaboration/protocol'
import {
  createRemotePublicationHandler,
  disposeCollaboration,
  getActiveCollaborationHandle,
  prepareCollaborationDocumentSession,
  startCollaboration
} from '../../collaboration/lifecycle'
import core from '../../contexts'

const collaborationModuleState = vi.hoisted(() => ({
  actualCreateCollaboration:
    undefined as unknown as typeof collaborationModule.createCollaboration,
  createCollaboration:
    undefined as unknown as typeof collaborationModule.createCollaboration
}))

vi.mock('@asyra/collaboration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@asyra/collaboration')>()
  collaborationModuleState.actualCreateCollaboration =
    actual.createCollaboration
  collaborationModuleState.createCollaboration = actual.createCollaboration
  return {
    ...actual,
    createCollaboration: (
      ...args: Parameters<typeof actual.createCollaboration>
    ) => collaborationModuleState.createCollaboration(...args)
  }
})

const EMPTY_DOCUMENT = {
  version: '1.0.0',
  sceneTree: {
    workspace: '',
    workspaceList: [],
    elements: {}
  },
  props: {}
} as const

const createDeferred = <Value>() => {
  let resolve!: (value: Value | PromiseLike<Value>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

const freezePublication = (
  publication: SharedPublication
): SharedPublication => {
  const freezeValue = (value: unknown): void => {
    if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
      return
    }
    Object.values(value).forEach(freezeValue)
    Object.freeze(value)
  }
  freezeValue(publication)
  return publication
}

const remotePublication = (publicationId: string): SharedPublication => {
  const artifactId = `artifact-${publicationId}`
  const batchId = `batch-${publicationId}`
  const deliveryId = `delivery-${publicationId}`
  const payload = {
    action: PROPS_ACTIONS.UPDATE_PROPERTY,
    eventName: EventTypes.UPDATE_PROPERTY,
    id: `position-${publicationId}`,
    key: 'x',
    before: 0,
    after: 10
  }
  const delivery = {
    deliveryId,
    eventName: EventTypes.UPDATE_PROPERTY,
    orderedIds: [`position-${publicationId}`],
    payload
  }
  return freezePublication({
    publicationId,
    artifactId,
    transactionId: 1,
    origin: 'action',
    mode: 'atomic',
    slices: [
      {
        sliceId: batchId,
        orderedIds: [deliveryId],
        batches: [
          {
            batchId,
            channel: SharedDataChannelNames.PROPS,
            deliveries: [delivery]
          }
        ]
      }
    ]
  })
}

const bootstrapTailItem = (
  sequence: number,
  publication: SharedPublication,
  fromActorId: string
) => ({
  sequence,
  publicationId: publication.publicationId,
  encodedPublicationFrames: encodePublicationMessageFrames({
    type: CollaborationMessageTypes.PUBLICATION,
    publication,
    fromActorId,
    sequence
  }).map((frame) => Buffer.from(frame).toString('base64')),
  fromActorId
})

const harness = {
  collaboration: {
    identity: {
      documentId: 'file-lifecycle',
      roomId: 'file-lifecycle',
      actorId: 'actor-lifecycle'
    },
    provider: {
      getStatus: vi.fn(() => 'idle'),
      onStatusChange: vi.fn(
        (_subscriber: (status: collaborationModule.ProviderStatus) => void) =>
          vi.fn()
      )
    },
    updateAwareness: vi.fn(),
    observePublicationOutcomes: vi.fn(
      (
        _subscriber: (
          outcome: collaborationModule.CollaborationPublicationOutcome
        ) => void
      ) => vi.fn()
    ),
    start: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    reconnect: vi.fn(async () => undefined),
    whenIdle: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined)
  }
}

beforeEach(async () => {
  await disposeCollaboration()
  vi.restoreAllMocks()
  collaborationModuleState.createCollaboration =
    collaborationModuleState.actualCreateCollaboration
  idCounter.clear()
  vi.spyOn(
    CollaborationWebSocketProvider.prototype,
    'openDocumentSession'
  ).mockResolvedValue({
    checkpoint: EMPTY_DOCUMENT,
    durableSequence: 0,
    headSequence: 0,
    pendingTail: []
  })
  vi.spyOn(
    CollaborationWebSocketProvider.prototype,
    'completeDocumentBootstrap'
  ).mockResolvedValue(undefined)
  harness.collaboration.updateAwareness.mockReset()
  harness.collaboration.observePublicationOutcomes
    .mockReset()
    .mockReturnValue(vi.fn())
  harness.collaboration.provider.onStatusChange
    .mockReset()
    .mockReturnValue(vi.fn())
  harness.collaboration.start.mockReset().mockResolvedValue(undefined)
  harness.collaboration.dispose.mockReset().mockResolvedValue(undefined)
})

afterEach(async () => {
  await disposeCollaboration()
  vi.useRealTimers()
  idCounter.clear()
  vi.restoreAllMocks()
})

it('rejects the consumer promise for a policy-rejected publication outcome', async () => {
  const processRemotePublication = createRemotePublicationHandler(() => false)

  await expect(
    processRemotePublication(remotePublication('policy-rejected'))
  ).rejects.toThrow(
    '[collaboration] remote publication policy-rejected was rejected'
  )
})

it('settles each remote publication projection before releasing the handler', async () => {
  const remoteApplication = createDeferred<undefined>()
  const projectionSettlement = createDeferred<undefined>()
  const order: string[] = []
  const processRemotePublication = (
    createRemotePublicationHandler as unknown as (
      applyRemotePublication: (
        publication: SharedPublication
      ) => boolean | Promise<boolean>,
      settleProjection: () => Promise<void>
    ) => (publication: SharedPublication) => Promise<void>
  )(
    async () => {
      order.push('canonical-apply-start')
      await remoteApplication.promise
      order.push('canonical-apply-complete')
      return true
    },
    async () => {
      order.push('projection-start')
      await projectionSettlement.promise
      order.push('projection-settled')
    }
  )

  let handlerSettled = false
  const handling = processRemotePublication(
    remotePublication('projection-settlement')
  ).then(() => {
    handlerSettled = true
  })
  await Promise.resolve()

  expect(order).toEqual(['canonical-apply-start'])
  expect(handlerSettled).toBe(false)

  remoteApplication.resolve(undefined)
  await Promise.resolve()
  await Promise.resolve()

  expect(order).toEqual([
    'canonical-apply-start',
    'canonical-apply-complete',
    'projection-start'
  ])
  expect(handlerSettled).toBe(false)

  projectionSettlement.resolve(undefined)
  await handling

  expect(order).toEqual([
    'canonical-apply-start',
    'canonical-apply-complete',
    'projection-start',
    'projection-settled'
  ])
  expect(handlerSettled).toBe(true)
})

it('opens the socket bootstrap before activation and applies its tail before live delivery starts', async () => {
  const order: string[] = []
  const publication = remotePublication('bootstrap-tail')
  vi.spyOn(
    CollaborationWebSocketProvider.prototype,
    'openDocumentSession'
  ).mockImplementation(async () => {
    order.push('open-session')
    return {
      checkpoint: EMPTY_DOCUMENT,
      durableSequence: 0,
      headSequence: 1,
      pendingTail: [bootstrapTailItem(1, publication, 'actor-peer')]
    }
  })
  vi.spyOn(
    CollaborationWebSocketProvider.prototype,
    'completeDocumentBootstrap'
  ).mockImplementation(async () => {
    order.push('bootstrap-consumed')
  })
  vi.spyOn(core, 'applyCanonicalChanges').mockImplementation(() => {
    order.push('core-apply')
  })
  vi.spyOn(factory, 'runRemoteTransaction').mockImplementation((mutate) => {
    order.push('remote-transaction')
    return mutate()
  })

  const prepared = await prepareCollaborationDocumentSession({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })

  expect(prepared.bootstrap.checkpoint).toEqual(EMPTY_DOCUMENT)
  expect(order).toEqual(['open-session'])
  expect(getActiveCollaborationHandle()).toBeUndefined()

  await prepared.activate()

  expect(order).toEqual([
    'open-session',
    'remote-transaction',
    'core-apply',
    'open-session',
    'bootstrap-consumed'
  ])
  expect(getActiveCollaborationHandle()).toBeDefined()
})

it('reopens the socket bootstrap and hydrates checkpoint plus tail before reconnect becomes live', async () => {
  const order: string[] = []
  const reconnectDocument = {
    ...EMPTY_DOCUMENT,
    sceneTree: {
      ...EMPTY_DOCUMENT.sceneTree,
      workspace: 'workspace-reconnect',
      workspaceList: ['workspace-reconnect']
    }
  }
  vi.mocked(CollaborationWebSocketProvider.prototype.openDocumentSession)
    .mockResolvedValueOnce({
      checkpoint: EMPTY_DOCUMENT,
      durableSequence: 0,
      headSequence: 0,
      pendingTail: []
    })
    .mockImplementationOnce(async () => {
      order.push('reconnect-open')
      return {
        checkpoint: reconnectDocument,
        durableSequence: 0,
        headSequence: 1,
        pendingTail: [
          bootstrapTailItem(
            1,
            remotePublication('reconnect-tail'),
            'actor-peer'
          )
        ]
      }
    })
    .mockImplementationOnce(async () => {
      order.push('reconnect-open')
      return {
        checkpoint: reconnectDocument,
        durableSequence: 0,
        headSequence: 1,
        pendingTail: [
          bootstrapTailItem(
            1,
            remotePublication('reconnect-tail'),
            'actor-peer'
          )
        ]
      }
    })
  vi.mocked(
    CollaborationWebSocketProvider.prototype.completeDocumentBootstrap
  ).mockImplementation(async () => {
    order.push('bootstrap-consumed')
  })
  vi.spyOn(core, 'load').mockImplementation((document) => {
    expect(document).toEqual(reconnectDocument)
    order.push('core-load')
  })
  vi.spyOn(core, 'applyCanonicalChanges').mockImplementation(() => {
    order.push('core-apply')
  })
  vi.spyOn(factory, 'runRemoteTransaction').mockImplementation((mutate) => {
    order.push('remote-transaction')
    return mutate()
  })

  const prepared = await prepareCollaborationDocumentSession({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })
  const handle = await prepared.activate()
  order.length = 0

  await handle.reconnect()

  expect(order).toEqual([
    'reconnect-open',
    'core-load',
    'remote-transaction',
    'core-apply',
    'bootstrap-consumed'
  ])
})

it('keeps a provisional local session active and retries an unavailable socket at one non-overlapping 30-second cadence', async () => {
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)
  const retry =
    createDeferred<
      Awaited<ReturnType<CollaborationWebSocketProvider['openDocumentSession']>>
    >()
  vi.mocked(CollaborationWebSocketProvider.prototype.openDocumentSession)
    .mockRejectedValueOnce(
      new ProviderFailure('connection-failed', 'socket server unavailable')
    )
    .mockImplementationOnce(() => retry.promise)
  const load = vi.spyOn(core, 'load').mockImplementation(() => undefined)

  const prepared = await prepareCollaborationDocumentSession({
    fileId: 'file-offline-retry',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })
  vi.useFakeTimers()
  const handle = await prepared.activate()

  expect(prepared.bootstrap).toEqual({
    checkpoint: createFormalInitialDocument(),
    durableSequence: 0,
    headSequence: 0,
    pendingTail: []
  })
  expect(handle.getSessionState()).toEqual(
    expect.objectContaining({
      connection: 'disconnected',
      pendingCount: 0,
      sync: 'synced',
      notification: undefined
    })
  )
  expect(
    CollaborationWebSocketProvider.prototype.openDocumentSession
  ).toHaveBeenCalledTimes(1)

  vi.advanceTimersByTime(29_999)
  expect(
    CollaborationWebSocketProvider.prototype.openDocumentSession
  ).toHaveBeenCalledTimes(1)

  await vi.advanceTimersByTimeAsync(1)
  expect(
    CollaborationWebSocketProvider.prototype.openDocumentSession
  ).toHaveBeenCalledTimes(2)

  vi.advanceTimersByTime(60_000)
  expect(
    CollaborationWebSocketProvider.prototype.openDocumentSession
  ).toHaveBeenCalledTimes(2)

  vi.useRealTimers()
  retry.resolve({
    checkpoint: EMPTY_DOCUMENT,
    durableSequence: 0,
    headSequence: 0,
    pendingTail: []
  })
  await Promise.race([
    handle.whenIdle(),
    new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `idle stalled at ${JSON.stringify(handle.getSessionState())}`
            )
          ),
        1_000
      )
    })
  ])

  expect(load).toHaveBeenCalledWith(EMPTY_DOCUMENT)
  expect(handle.getSessionState()).toEqual(
    expect.objectContaining({
      connection: 'connected',
      pendingCount: 0,
      sync: 'synced'
    })
  )
  expect(consoleError).toHaveBeenCalledWith(
    '[collaboration] initial document session failed:',
    expect.objectContaining({ code: 'connection-failed' })
  )
})

it('retains disconnected Factory publications and removes them after reconnect source acceptance', async () => {
  let publish: ((publication: SharedPublication) => void) | undefined
  vi.spyOn(factory, 'subscribeToSharedPublication').mockImplementation(
    (subscriber) => {
      publish = subscriber
      return () => {
        publish = undefined
      }
    }
  )
  const sendPublication = vi
    .spyOn(
      CollaborationWebSocketProvider.prototype,
      'sendPublicationWithAcceptance'
    )
    .mockImplementation(async (publication, consumeAcceptedSource) => {
      await consumeAcceptedSource(publication)
      return {
        publicationId: publication.publicationId,
        sequence: 1
      }
    })
  vi.spyOn(core, 'applyCanonicalChanges').mockImplementation(() => undefined)
  vi.spyOn(factory, 'runRemoteTransaction').mockImplementation((mutate) =>
    mutate()
  )
  const prepared = await prepareCollaborationDocumentSession({
    fileId: 'file-offline-publication',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })
  const handle = await prepared.activate()
  await handle.disconnect()

  publish?.(remotePublication('offline-local'))
  await handle.whenIdle()

  expect(sendPublication).not.toHaveBeenCalled()
  expect(handle.getSessionState()).toEqual(
    expect.objectContaining({
      connection: 'disconnected',
      pendingCount: 1,
      sync: 'pending'
    })
  )

  await Promise.race([
    handle.reconnect(),
    new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `reconnect stalled at ${JSON.stringify(handle.getSessionState())}`
            )
          ),
        1_000
      )
    })
  ])
  await handle.whenIdle()

  expect(sendPublication).toHaveBeenCalledWith(
    expect.objectContaining({ publicationId: 'offline-local' }),
    expect.any(Function)
  )
  expect(core.applyCanonicalChanges).toHaveBeenCalledOnce()
  expect(handle.getSessionState()).toEqual(
    expect.objectContaining({
      connection: 'connected',
      pendingCount: 0,
      sync: 'synced'
    })
  )
})

it('includes a queued local publication in the reconnect recovery cutoff before replacing Core state', async () => {
  const reconnectBootstrap =
    createDeferred<
      Awaited<ReturnType<CollaborationWebSocketProvider['openDocumentSession']>>
    >()
  vi.mocked(CollaborationWebSocketProvider.prototype.openDocumentSession)
    .mockResolvedValueOnce({
      checkpoint: EMPTY_DOCUMENT,
      durableSequence: 0,
      headSequence: 0,
      pendingTail: []
    })
    .mockResolvedValueOnce({
      checkpoint: EMPTY_DOCUMENT,
      durableSequence: 0,
      headSequence: 0,
      pendingTail: []
    })
    .mockImplementationOnce(() => reconnectBootstrap.promise)
    .mockResolvedValue({
      checkpoint: EMPTY_DOCUMENT,
      durableSequence: 0,
      headSequence: 0,
      pendingTail: []
    })
  let publish: ((publication: SharedPublication) => void) | undefined
  vi.spyOn(factory, 'subscribeToSharedPublication').mockImplementation(
    (subscriber) => {
      publish = subscriber
      return () => {
        publish = undefined
      }
    }
  )
  vi.spyOn(
    CollaborationWebSocketProvider.prototype,
    'sendPublicationWithAcceptance'
  ).mockImplementation(async (publication, consumeAcceptedSource) => {
    await consumeAcceptedSource(publication)
    return {
      publicationId: publication.publicationId,
      sequence: 1
    }
  })
  const applyCanonicalChanges = vi
    .spyOn(core, 'applyCanonicalChanges')
    .mockImplementation(() => undefined)
  vi.spyOn(factory, 'runRemoteTransaction').mockImplementation((mutate) =>
    mutate()
  )
  vi.spyOn(core, 'load').mockImplementation(() => undefined)

  const prepared = await prepareCollaborationDocumentSession({
    fileId: 'file-reconnect-cutoff',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })
  const handle = await prepared.activate()
  await handle.disconnect()

  const reconnecting = handle.reconnect()
  publish?.(remotePublication('queued-before-reconnect'))
  reconnectBootstrap.resolve({
    checkpoint: EMPTY_DOCUMENT,
    durableSequence: 0,
    headSequence: 0,
    pendingTail: []
  })
  await reconnecting
  await handle.whenIdle()

  expect(applyCanonicalChanges).toHaveBeenCalledOnce()
  expect(handle.getSessionState()).toEqual(
    expect.objectContaining({
      connection: 'connected',
      pendingCount: 0,
      sync: 'synced'
    })
  )
})

it('disposes the previous composition before a reconnect replacement becomes live', async () => {
  const order: string[] = []
  const firstComposition = {
    ...harness.collaboration,
    start: vi.fn(async () => {
      order.push('first-start')
    }),
    disconnect: vi.fn(async () => {
      order.push('first-disconnect')
    }),
    dispose: vi.fn(async () => {
      order.push('first-dispose')
    })
  }
  const secondComposition = {
    ...harness.collaboration,
    start: vi.fn(async () => {
      order.push('second-start')
    }),
    disconnect: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined)
  }
  collaborationModuleState.createCollaboration = vi
    .fn()
    .mockReturnValueOnce(firstComposition as never)
    .mockReturnValueOnce(secondComposition as never)

  const prepared = await prepareCollaborationDocumentSession({
    fileId: 'file-reconnect-disposal',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })
  const handle = await prepared.activate()
  await handle.disconnect()
  await handle.reconnect()

  expect(order).toEqual([
    'first-start',
    'first-disconnect',
    'first-dispose',
    'second-start'
  ])
})

it('retains an acknowledgement-rejected publication as an explicit conflict', async () => {
  let publish: ((publication: SharedPublication) => void) | undefined
  vi.spyOn(factory, 'subscribeToSharedPublication').mockImplementation(
    (subscriber) => {
      publish = subscriber
      return () => {
        publish = undefined
      }
    }
  )
  vi.spyOn(
    CollaborationWebSocketProvider.prototype,
    'sendPublicationWithAcceptance'
  ).mockRejectedValue(
    new ProviderFailure(
      'acknowledgement-failed',
      '[collaboration] parent element no longer exists',
      undefined,
      'conflicted-local'
    )
  )
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)
  const prepared = await prepareCollaborationDocumentSession({
    fileId: 'file-conflicted-publication',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })
  const handle = await prepared.activate()

  publish?.(remotePublication('conflicted-local'))
  await handle.whenIdle()

  expect(handle.getSessionState()).toEqual(
    expect.objectContaining({
      connection: 'connected',
      pendingCount: 1,
      sync: 'conflicted'
    })
  )
  expect(handle.getSessionState().notification).toEqual(
    expect.objectContaining({ type: 'conflicted' })
  )
  expect(consoleError).toHaveBeenCalledWith(
    '[collaboration] publication conflicted-local was rejected:',
    expect.objectContaining({ code: 'acknowledgement-failed' })
  )
})

it('starts the real app collaboration composition without an Awareness preview route', async () => {
  const createCollaboration = vi
    .fn()
    .mockReturnValue(harness.collaboration as never)
  collaborationModuleState.createCollaboration = createCollaboration

  await startCollaboration({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })

  expect(createCollaboration).toHaveBeenCalledOnce()
  const composition = createCollaboration.mock.calls[0][0]
  expect(composition.provider).toBeInstanceOf(CollaborationWebSocketProvider)
  expect(composition.provider?.identity).toEqual({
    documentId: 'file-lifecycle',
    roomId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    connectionMetadata: { fileId: 'file-lifecycle' }
  })
  expect(composition.processRemotePublication).toEqual(expect.any(Function))
  expect('operationDefinitions' in composition).toBe(false)
  expect('permissionPolicy' in composition).toBe(false)
  expect('conflictPolicies' in composition).toBe(false)
  expect(idCounter.current(IDTypes.ELEMENT)).toBe('el-actor-lifecycle-0')
  expect(harness.collaboration.updateAwareness).not.toHaveBeenCalled()
  expect(getActiveCollaborationHandle()).toBeDefined()
})

it('binds source-sliced remote canonical requests to one Factory coordinator', async () => {
  const createPublicationProcessor = vi.spyOn(
    collaborationOperations,
    'createPublicationProcessor'
  )
  collaborationModuleState.createCollaboration = vi.fn(
    () => harness.collaboration as never
  )

  await startCollaboration({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })

  expect(createPublicationProcessor).toHaveBeenCalledOnce()
  const options = createPublicationProcessor.mock.calls[0]?.[0]
  expect(options).toEqual({
    decideRemotePublication: expect.any(Function),
    applyRemoteCanonicalChangeSlices: expect.any(Function)
  })
  expect(options).not.toHaveProperty('applyRemoteEvent')
  expect(options).not.toHaveProperty('owners')
})

it('exposes remote publication outcomes through the local collaboration handle', async () => {
  collaborationModuleState.createCollaboration = vi.fn(
    () => harness.collaboration as never
  )
  const handle = await startCollaboration({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })
  const subscriber = vi.fn()

  const unsubscribe = (
    handle as typeof handle & {
      observePublicationOutcomes(callback: typeof subscriber): () => void
    }
  ).observePublicationOutcomes(subscriber)

  expect(harness.collaboration.observePublicationOutcomes).toHaveBeenCalledWith(
    expect.any(Function)
  )
  const forwardOutcome =
    harness.collaboration.observePublicationOutcomes.mock.calls[0]?.[0]
  forwardOutcome?.({
    direction: 'remote',
    status: 'processed',
    publicationId: 'forwarded-outcome'
  })
  expect(subscriber).toHaveBeenCalledWith({
    direction: 'remote',
    status: 'processed',
    publicationId: 'forwarded-outcome'
  })
  expect(unsubscribe).toEqual(expect.any(Function))
})

it('exposes provider status through the local collaboration handle', async () => {
  const onStatusChange = vi.spyOn(
    CollaborationWebSocketProvider.prototype,
    'onStatusChange'
  )
  collaborationModuleState.createCollaboration = vi.fn(
    () => harness.collaboration as never
  )
  const handle = await startCollaboration({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })
  const subscriber = vi.fn()

  const unsubscribe = handle.onStatusChange(subscriber)

  expect(onStatusChange).toHaveBeenCalledWith(expect.any(Function))
  const forwardStatus = onStatusChange.mock.calls[0]?.[0]
  forwardStatus?.('failed')
  expect(subscriber).toHaveBeenCalledWith('disconnected')
  expect(unsubscribe).toEqual(expect.any(Function))
})

it('settles after remote apply without saving the receiving document', async () => {
  const order: string[] = []
  vi.spyOn(core, 'applyCanonicalChanges').mockImplementation(() => {
    order.push('core-apply')
  })
  vi.spyOn(factory, 'runRemoteTransaction').mockImplementation((mutate) => {
    order.push('remote-transaction')
    return mutate()
  })
  const createCollaboration = vi
    .fn()
    .mockReturnValue(harness.collaboration as never)
  collaborationModuleState.createCollaboration = createCollaboration

  await startCollaboration({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })
  const composition = createCollaboration.mock.calls[0]?.[0]
  if (!composition) throw new Error('Expected collaboration composition')

  await composition.processRemotePublication(
    remotePublication('remote-success')
  )
  expect(order).toEqual(['remote-transaction', 'core-apply'])
  expect(createRemotePublicationHandler).toHaveLength(1)

  vi.mocked(factory.runRemoteTransaction).mockImplementationOnce(() => {
    throw new Error('remote apply failed')
  })
  await expect(
    composition.processRemotePublication(remotePublication('remote-failure'))
  ).rejects.toThrow('remote apply failed')
  expect(order).toEqual(['remote-transaction', 'core-apply'])
})
