import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as collaborationModule from '@asyra/collaboration'
import type { SharedPublication } from '@asyra/factory'
import { IDTypes, idCounter } from '@asyra/utils'
import { CollaborationWebSocketProvider } from '../../collaboration/websocket-provider'
import {
  createRemotePublicationHandler,
  disposeCollaboration,
  startCollaboration
} from '../../collaboration/lifecycle'
import { factory } from '../../contexts'

const remotePublication = (publicationId: string): SharedPublication => ({
  publicationId,
  artifactId: `artifact-${publicationId}`,
  transactionId: 1,
  origin: 'action',
  deliveries: [],
  batches: [],
  deliveryPlan: { mode: 'atomic', slices: [] }
})

const harness = {
  collaboration: {
    identity: {
      documentId: 'file-lifecycle',
      roomId: 'file-lifecycle',
      actorId: 'actor-lifecycle'
    },
    provider: { getStatus: vi.fn(() => 'idle') },
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
  harness.collaboration.start.mockReset().mockResolvedValue(undefined)
  harness.collaboration.dispose.mockReset().mockResolvedValue(undefined)
  delete window.__AsyraCollaboration__
})

afterEach(async () => {
  await disposeCollaboration()
  idCounter.clear()
  vi.restoreAllMocks()
})

it('does not emit peer-applied for a policy-rejected publication outcome', async () => {
  const sendPeerApplied = vi.fn(async () => undefined)
  const processRemotePublication = createRemotePublicationHandler(
    () => false,
    sendPeerApplied
  )

  await processRemotePublication(remotePublication('policy-rejected'), {
    fromActorId: 'actor-source'
  })

  expect(sendPeerApplied).not.toHaveBeenCalled()
})

it('starts the real app collaboration composition without an Awareness preview route', async () => {
  const createCollaboration = vi
    .spyOn(collaborationModule, 'createCollaboration')
    .mockReturnValue(harness.collaboration as never)

  await startCollaboration({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/asyra-design-collaboration'
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
  expect(window.__AsyraCollaboration__).toBeDefined()
})

it('exposes remote publication outcomes through the local collaboration handle', async () => {
  vi.spyOn(collaborationModule, 'createCollaboration').mockReturnValue(
    harness.collaboration as never
  )
  const handle = await startCollaboration({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/asyra-design-collaboration'
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

it('emits peer-applied only after a remote publication transaction succeeds', async () => {
  const order: string[] = []
  let resolveReceipt: (() => void) | undefined
  vi.spyOn(factory, 'runRemoteTransaction').mockImplementation((mutate) => {
    order.push('remote-transaction')
    return mutate()
  })
  const sendPeerApplied = vi
    .spyOn(CollaborationWebSocketProvider.prototype, 'sendPeerApplied')
    .mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveReceipt = resolve
          order.push('peer-applied')
        })
    )
  const createCollaboration = vi
    .spyOn(collaborationModule, 'createCollaboration')
    .mockReturnValue(harness.collaboration as never)

  await startCollaboration({
    fileId: 'file-lifecycle',
    actorId: 'actor-lifecycle',
    endpoint: 'ws://127.0.0.1:4101/asyra-design-collaboration'
  })
  const composition = createCollaboration.mock.calls[0]?.[0]
  if (!composition) throw new Error('Expected collaboration composition')

  const processing = composition.processRemotePublication(
    remotePublication('remote-success'),
    { fromActorId: 'actor-source' }
  )
  await vi.waitFor(() => expect(sendPeerApplied).toHaveBeenCalledOnce())
  let settled = false
  void Promise.resolve(processing).then(() => {
    settled = true
  })
  await Promise.resolve()

  expect(sendPeerApplied).toHaveBeenCalledWith('remote-success', 'actor-source')
  expect(order).toEqual(['remote-transaction', 'peer-applied'])
  expect(settled).toBe(false)

  resolveReceipt?.()
  await processing
  expect(settled).toBe(true)

  sendPeerApplied.mockClear()
  vi.mocked(factory.runRemoteTransaction).mockImplementationOnce(() => {
    throw new Error('remote apply failed')
  })
  await expect(
    composition.processRemotePublication(remotePublication('remote-failure'), {
      fromActorId: 'actor-source'
    })
  ).rejects.toThrow('remote apply failed')
  expect(sendPeerApplied).not.toHaveBeenCalled()
})
