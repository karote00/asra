import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as collaborationModule from '@asyra/collaboration'
import type { SharedPublication } from '@asyra/factory'
import { EventTypes } from '@asyra/reactive-events'
import {
  IDTypes,
  PROPS_ACTIONS,
  SharedDataChannelNames,
  idCounter
} from '@asyra/utils'
import * as collaborationOperations from '../../collaboration/operations'
import { CollaborationWebSocketProvider } from '../../collaboration/websocket-provider'
import {
  createRemotePublicationHandler,
  disposeCollaboration,
  getActiveCollaborationHandle,
  startCollaboration
} from '../../collaboration/lifecycle'
import core, { factory } from '../../contexts'

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
  return {
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
  }
}

const harness = {
  collaboration: {
    identity: {
      documentId: 'file-lifecycle',
      roomId: 'file-lifecycle',
      actorId: 'actor-lifecycle'
    },
    provider: {
      getStatus: vi.fn(() => 'idle'),
      onStatusChange: vi.fn(() => vi.fn())
    },
    updateAwareness: vi.fn(),
    observePublicationOutcomes: vi.fn(() => vi.fn()),
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
  idCounter.clear()
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

it('starts the real app collaboration composition without an Awareness preview route', async () => {
  const createCollaboration = vi
    .spyOn(collaborationModule, 'createCollaboration')
    .mockReturnValue(harness.collaboration as never)

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

it('binds one remote canonical request to the Core-owned coordinator', async () => {
  const createPublicationProcessor = vi.spyOn(
    collaborationOperations,
    'createPublicationProcessor'
  )
  vi.spyOn(collaborationModule, 'createCollaboration').mockReturnValue(
    harness.collaboration as never
  )

  await startCollaboration({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })

  expect(createPublicationProcessor).toHaveBeenCalledOnce()
  const options = createPublicationProcessor.mock.calls[0]?.[0]
  expect(options).toEqual({
    runRemoteTransaction: expect.any(Function),
    decideRemotePublication: expect.any(Function),
    applyCanonicalChanges: expect.any(Function)
  })
  expect(options).not.toHaveProperty('applyRemoteEvent')
  expect(options).not.toHaveProperty('owners')
})

it('exposes remote publication outcomes through the local collaboration handle', async () => {
  vi.spyOn(collaborationModule, 'createCollaboration').mockReturnValue(
    harness.collaboration as never
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
    subscriber
  )
  expect(unsubscribe).toEqual(expect.any(Function))
})

it('exposes provider status through the local collaboration handle', async () => {
  vi.spyOn(collaborationModule, 'createCollaboration').mockReturnValue(
    harness.collaboration as never
  )
  const handle = await startCollaboration({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/collaboration'
  })
  const subscriber = vi.fn()

  const unsubscribe = handle.onStatusChange(subscriber)

  expect(harness.collaboration.provider.onStatusChange).toHaveBeenCalledWith(
    subscriber
  )
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
    .spyOn(collaborationModule, 'createCollaboration')
    .mockReturnValue(harness.collaboration as never)

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
