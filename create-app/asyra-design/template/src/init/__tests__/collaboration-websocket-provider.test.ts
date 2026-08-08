import type { SharedPublication } from '@asyra/factory'
import {
  subscribeToBrowserDragPhases,
  subscribeToDiagnosticCounters
} from '@asyra/utils'
import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket as NodeWebSocket, WebSocketServer, type RawData } from 'ws'
import {
  PUBLICATION_FRAME_VERSION_OFFSET,
  decodeCollaborationMessage,
  decodePublicationMessageFrames,
  encodePublicationMessageFrames as encodeProtocolPublicationMessageFrames,
  inspectPublicationFrameHeader,
  isPublicationFrame,
  type PublicationFrameHeader
} from '../../collaboration/protocol'
import {
  CollaborationTransportWorkerRuntime,
  type CollaborationTransportWorkerLike,
  type CollaborationTransportWorkerRequest,
  type CollaborationTransportWorkerResponse
} from '../../collaboration/collaboration-transport-worker'
import { CollaborationWebSocketProvider } from '../../collaboration/websocket-provider'

type ClientMessage = Readonly<{
  type: string
  requestId?: string
  frameId?: string
  publicationId?: string
  frameByteLength?: number
  headSequence?: number
  identity?: unknown
  publication?: SharedPublication
  publications?: readonly SharedPublication[]
}>

interface LoopbackServer {
  readonly endpoint: string
  close(): Promise<void>
}

interface PublicationFixtureOptions {
  readonly channel?: string
  readonly eventName?: string
  readonly origin?: SharedPublication['origin']
  readonly payload?: object
  readonly suffix?: string
  readonly transactionId?: number
}

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T | PromiseLike<T>): void
  reject(error: unknown): void
}

const diagnosticDisposers: (() => void)[] = []
let inboundDocumentSequence = 0

const encodePublicationMessageFrames = (
  message: Parameters<typeof encodeProtocolPublicationMessageFrames>[0],
  options?: Parameters<typeof encodeProtocolPublicationMessageFrames>[1]
): ReturnType<typeof encodeProtocolPublicationMessageFrames> => {
  if (message.type === 'publication') {
    const sequenced = {
      ...message,
      sequence:
        'sequence' in message && typeof message.sequence === 'number'
          ? message.sequence
          : ++inboundDocumentSequence
    }
    return encodeProtocolPublicationMessageFrames(sequenced, options)
  }
  if (message.type === 'publications') {
    const firstSequence = inboundDocumentSequence + 1
    const sequences =
      'sequences' in message && Array.isArray(message.sequences)
        ? message.sequences
        : message.publications.map((_, index) => firstSequence + index)
    inboundDocumentSequence = Math.max(
      inboundDocumentSequence,
      sequences.at(-1) ?? inboundDocumentSequence
    )
    return encodeProtocolPublicationMessageFrames(
      { ...message, sequences },
      options
    )
  }
  return encodeProtocolPublicationMessageFrames(message, options)
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: Deferred<T>['resolve']
  let reject!: Deferred<T>['reject']
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle
    reject = fail
  })
  return { promise, resolve, reject }
}

const createPublication = ({
  channel = 'sceneTree',
  eventName = 'updateComputedData',
  origin = 'action',
  payload = { value: 1 },
  suffix = 'a',
  transactionId = 1
}: PublicationFixtureOptions = {}): SharedPublication => {
  const artifactId = `${transactionId}:artifact`
  const batchId = `${transactionId}:batch:${suffix}`
  const deliveryId = `${transactionId}:delivery:${suffix}`
  const sliceId = `${transactionId}:slice:${suffix}`
  const delivery = {
    deliveryId,
    eventName,
    orderedIds: [`element-${suffix}`],
    payload
  }
  return {
    publicationId: `publication-${suffix}`,
    artifactId,
    transactionId,
    origin,
    mode: 'progressive',
    slices: [
      {
        sliceId,
        orderedIds: delivery.orderedIds,
        batches: [
          {
            batchId,
            channel,
            deliveries: [delivery]
          }
        ]
      }
    ]
  }
}

const publication = createPublication()

const bootstrapTailItem = (
  sequence: number,
  item: SharedPublication,
  fromActorId: string
) => ({
  sequence,
  publicationId: item.publicationId,
  encodedPublicationFrames: encodeProtocolPublicationMessageFrames({
    type: 'publication',
    publication: item,
    fromActorId,
    sequence
  }).map((frame) => Buffer.from(frame).toString('base64')),
  fromActorId
})

const createTwoDeliveryPublication = (
  sourceLength = 2_048,
  {
    suffix = 'multi',
    transactionId = 4
  }: Pick<PublicationFixtureOptions, 'suffix' | 'transactionId'> = {}
): SharedPublication => {
  const artifactId = `${transactionId}:artifact`
  const batchId = `${transactionId}:batch:${suffix}`
  const sliceId = `${transactionId}:slice:${suffix}`
  const payloads = [
    { id: `element-${suffix}-a`, source: 'a'.repeat(sourceLength) },
    { id: `element-${suffix}-b`, source: 'b'.repeat(sourceLength) }
  ]
  const deliveries = payloads.map((payload, index) => ({
    deliveryId: `${transactionId}:delivery:${suffix}:${index}`,
    eventName: 'updateComputedData',
    orderedIds: [payload.id],
    payload
  }))
  return {
    publicationId: `publication-${suffix}`,
    artifactId,
    transactionId,
    origin: 'action',
    mode: 'progressive',
    slices: [
      {
        sliceId,
        orderedIds: deliveries.flatMap(({ orderedIds }) => orderedIds),
        batches: [
          {
            batchId,
            channel: 'sceneTree',
            deliveries
          }
        ]
      }
    ]
  }
}

const createLargePublication = (): SharedPublication => {
  const pointIds = Array.from(
    { length: 1024 },
    (_, index) => `vector-point-${String(index).padStart(6, '0')}`
  )
  return createPublication({
    channel: 'props',
    eventName: 'addProperty',
    payload: {
      action: 'addProperty',
      data: pointIds.map((id, index) => ({
        id,
        type: 'vectorSegment',
        startId: id,
        endId: pointIds[(index + 1) % pointIds.length],
        networkId: 'vector-network-shared'
      })),
      eventName: 'addProperty'
    },
    suffix: 'large'
  })
}

const servers = new Set<LoopbackServer>()
const originalWebSocket = globalThis.WebSocket
const transportWorkers: TestCollaborationTransportWorker[] = []
const mainThreadWebSocketConstructor = vi.fn()

type TestWorkerEventName = 'error' | 'message' | 'messageerror'
type TestWorkerListener = (event: {
  readonly data?: CollaborationTransportWorkerResponse
  readonly error?: unknown
}) => void

class TestCollaborationTransportWorker
  implements CollaborationTransportWorkerLike
{
  readonly posted: {
    readonly message: CollaborationTransportWorkerRequest
  }[] = []
  readonly mainBoundMessages: CollaborationTransportWorkerResponse[] = []
  socketConstructionCount = 0
  paused = false
  postObserver?: (message: CollaborationTransportWorkerRequest) => void
  terminateCount = 0

  private readonly runtime = new CollaborationTransportWorkerRuntime({
    createWebSocket: (endpoint) => {
      this.socketConstructionCount += 1
      return new NodeWebSocket(endpoint) as unknown as WebSocket
    },
    postMessage: (response) => {
      const mainResponse = structuredClone(response)
      this.mainBoundMessages.push(mainResponse)
      this.emit('message', { data: mainResponse })
    }
  })
  private readonly listeners = new Map<
    TestWorkerEventName,
    Set<TestWorkerListener>
  >()
  private readonly queuedTasks: (() => void)[] = []
  private terminated = false

  postMessage(message: CollaborationTransportWorkerRequest): void {
    if (this.terminated) throw new Error('worker is terminated')
    this.posted.push({ message })
    this.postObserver?.(message)
    const workerMessage = structuredClone(message)
    const run = () => {
      if (this.terminated) return
      this.runtime.handle(workerMessage)
    }
    if (this.paused) {
      this.queuedTasks.push(run)
    } else {
      queueMicrotask(run)
    }
  }

  addEventListener(
    type: TestWorkerEventName,
    listener: TestWorkerListener
  ): void {
    const listeners = this.listeners.get(type) ?? new Set<TestWorkerListener>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(
    type: TestWorkerEventName,
    listener: TestWorkerListener
  ): void {
    this.listeners.get(type)?.delete(listener)
  }

  terminate(): void {
    if (this.terminated) return
    this.terminated = true
    this.terminateCount += 1
    this.runtime.destroy()
  }

  flush(): void {
    this.queuedTasks.splice(0).forEach((run) => queueMicrotask(run))
  }

  emitError(error: unknown): void {
    this.emit('error', { error })
  }

  private emit(
    type: TestWorkerEventName,
    event: Parameters<TestWorkerListener>[0]
  ): void {
    this.listeners.get(type)?.forEach((listener) => listener(event))
  }
}

const asBinaryMessage = (data: RawData): Uint8Array => {
  const bytes = Array.isArray(data) ? Buffer.concat(data) : data
  return bytes instanceof ArrayBuffer
    ? new Uint8Array(bytes)
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

const createLoopbackServer = async (
  onMessage: (
    socket: NodeWebSocket,
    message: ClientMessage,
    encoded: string | Uint8Array
  ) => void,
  {
    autoAdmitSourceFrames = true,
    autoCompleteBootstrap = true,
    onSourceFrame
  }: Readonly<{
    autoAdmitSourceFrames?: boolean
    autoCompleteBootstrap?: boolean
    onSourceFrame?: (
      socket: NodeWebSocket,
      header: PublicationFrameHeader
    ) => void
  }> = {}
): Promise<LoopbackServer> => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  const sockets = new Set<NodeWebSocket>()
  server.on('connection', (socket) => {
    const originalSend = socket.send
    let bootstrapReleased = true
    const bootstrapSuccessorMessages: Readonly<{
      readonly data: unknown
      readonly args: readonly unknown[]
    }>[] = []
    const sendOriginal = (data: unknown, args: readonly unknown[]): unknown =>
      Reflect.apply(originalSend, socket, [data, ...args])
    const flushBootstrapSuccessors = (): void => {
      bootstrapSuccessorMessages
        .splice(0)
        .forEach(({ data, args }) => sendOriginal(data, args))
    }
    socket.send = ((data: unknown, ...args: unknown[]) => {
      let normalized = data
      let beginsBootstrap = false
      if (typeof data === 'string') {
        try {
          const message = JSON.parse(data)
          if (message?.type === 'ready') {
            beginsBootstrap = true
            bootstrapReleased = false
            if (message.bootstrap === undefined) {
              normalized = JSON.stringify({
                ...message,
                bootstrap: {
                  checkpoint: {
                    version: '1.0.0',
                    sceneTree: {
                      workspace: '',
                      workspaceList: [],
                      elements: {}
                    },
                    props: {}
                  },
                  durableSequence: 0,
                  headSequence: 0,
                  pendingTail: []
                }
              })
            }
          }
        } catch {
          // Individual tests retain ownership of malformed wire payloads.
        }
      }
      if (beginsBootstrap) return sendOriginal(normalized, args)
      if (!bootstrapReleased) {
        bootstrapSuccessorMessages.push({ data: normalized, args })
        return
      }
      return sendOriginal(normalized, args)
    }) as typeof socket.send
    const publicationFramesByRequest = new Map<string, ArrayBuffer[]>()
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('message', (data: RawData, isBinary) => {
      const encoded = isBinary ? asBinaryMessage(data) : data.toString()
      if (typeof encoded !== 'string' && isPublicationFrame(encoded)) {
        const frame = encoded.buffer.slice(
          encoded.byteOffset,
          encoded.byteOffset + encoded.byteLength
        ) as ArrayBuffer
        const header = inspectPublicationFrameHeader(frame)
        onSourceFrame?.(socket, header)
        if (autoAdmitSourceFrames && header.requestId) {
          socket.send(
            JSON.stringify({
              type: 'source-frame-admitted',
              requestId: header.requestId,
              frameId: header.frameId,
              publicationId: header.publicationId,
              frameByteLength: header.frameByteLength
            })
          )
        }
        const requestKey = header.requestId ?? header.frameId
        const frames = publicationFramesByRequest.get(requestKey) ?? []
        frames.push(frame)
        publicationFramesByRequest.set(requestKey, frames)
        const headers = frames.map((item) =>
          inspectPublicationFrameHeader(item)
        )
        const complete =
          new Set(headers.map(({ publicationIndex }) => publicationIndex))
            .size === header.publicationCount &&
          Array.from(
            { length: header.publicationCount },
            (_, index) => index
          ).every((publicationIndex) => {
            const publicationHeaders = headers.filter(
              (item) => item.publicationIndex === publicationIndex
            )
            return (
              publicationHeaders.length > 0 &&
              publicationHeaders.length === publicationHeaders[0]?.chunkCount
            )
          })
        if (!complete) return
        publicationFramesByRequest.delete(requestKey)
        const orderedFrames = frames
          .map((item) => ({
            frame: item,
            header: inspectPublicationFrameHeader(item)
          }))
          .sort(
            (left, right) =>
              left.header.publicationIndex - right.header.publicationIndex ||
              left.header.chunkIndex - right.header.chunkIndex
          )
          .map(({ frame: item }) => item)
        onMessage(
          socket,
          decodePublicationMessageFrames(orderedFrames) as ClientMessage,
          encoded
        )
        return
      }
      const message = decodeCollaborationMessage(encoded) as ClientMessage
      const releasesBootstrap = message.type === 'bootstrap-consumed'
      if (releasesBootstrap) bootstrapReleased = true
      onMessage(socket, message, encoded)
      if (
        autoCompleteBootstrap &&
        message.type === 'bootstrap-consumed' &&
        message.requestId
      ) {
        socket.send(
          JSON.stringify({
            type: 'response',
            requestId: message.requestId,
            ok: true
          })
        )
      }
      if (releasesBootstrap) flushBootstrapSuccessors()
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('loopback WebSocket server did not expose a TCP port')
  }
  const loopback: LoopbackServer = {
    endpoint: `ws://127.0.0.1:${address.port}/collaboration`,
    close: async () => {
      sockets.forEach((socket) => socket.terminate())
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }
  servers.add(loopback)
  return loopback
}

const sendPublicationFrames = (
  socket: NodeWebSocket,
  message: Parameters<typeof encodePublicationMessageFrames>[0]
): void => {
  encodePublicationMessageFrames(message).forEach((frame) =>
    socket.send(new Uint8Array(frame))
  )
}

type TestProvider = CollaborationWebSocketProvider

const createProvider = (endpoint: string): TestProvider =>
  new CollaborationWebSocketProvider({
    endpoint,
    transportWorkerFactory: () => {
      const worker = new TestCollaborationTransportWorker()
      transportWorkers.push(worker)
      return worker
    },
    identity: {
      documentId: 'internal-document',
      roomId: 'internal-room',
      actorId: 'actor-a',
      connectionMetadata: {
        fileId: 'app-file-17',
        appSpecificValue: { branch: 'draft' }
      }
    }
  })

beforeEach(() => {
  inboundDocumentSequence = 0
  mainThreadWebSocketConstructor.mockClear()
  function MainThreadWebSocketSentinel() {
    mainThreadWebSocketConstructor()
    throw new Error('main-thread WebSocket construction is forbidden')
  }
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: MainThreadWebSocketSentinel
  })
})

afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()))
  servers.clear()
  transportWorkers.length = 0
  diagnosticDisposers.splice(0).forEach((dispose) => dispose())
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: originalWebSocket
  })
})

describe('CollaborationWebSocketProvider real connection contract', () => {
  it('exposes bootstrap before explicitly releasing the reserved live cutoff', async () => {
    const bootstrapCompletions: ClientMessage[] = []
    const pendingTailItem = bootstrapTailItem(4, publication, 'actor-b')
    const server = await createLoopbackServer(
      (socket, message) => {
        if (message.type === 'hello') {
          socket.send(
            JSON.stringify({
              type: 'ready',
              bootstrap: {
                checkpoint: { elements: [{ id: 'element-a' }] },
                durableSequence: 3,
                headSequence: 4,
                pendingTail: [pendingTailItem]
              }
            })
          )
          return
        }
        if (message.type === 'bootstrap-consumed' && message.requestId) {
          bootstrapCompletions.push(message)
          socket.send(
            JSON.stringify({
              type: 'response',
              requestId: message.requestId,
              ok: true
            })
          )
        }
      },
      { autoCompleteBootstrap: false }
    )
    const provider = new CollaborationWebSocketProvider({
      endpoint: server.endpoint,
      transportWorkerFactory: () => {
        const worker = new TestCollaborationTransportWorker()
        transportWorkers.push(worker)
        return worker
      },
      identity: {
        documentId: 'internal-document',
        roomId: 'internal-room',
        actorId: 'actor-a',
        connectionMetadata: { fileId: 'app-file-17' }
      }
    })

    await expect(provider.openDocumentSession()).resolves.toEqual({
      checkpoint: { elements: [{ id: 'element-a' }] },
      durableSequence: 3,
      headSequence: 4,
      pendingTail: [pendingTailItem]
    })
    expect(bootstrapCompletions).toEqual([])
    await expect(provider.sendPublication(publication)).rejects.toMatchObject({
      code: 'not-connected'
    })

    await provider.completeDocumentBootstrap()

    expect(bootstrapCompletions).toEqual([
      expect.objectContaining({
        type: 'bootstrap-consumed',
        headSequence: 4
      })
    ])
    await provider.destroy()
  })

  it('keeps bounded wire admission inside the transport worker while App apply is pending', async () => {
    const frameConsumedIds: string[] = []
    let sendInbound: (() => void) | undefined
    const secondPublication = createPublication({
      suffix: 'worker-b',
      transactionId: 2
    })
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendInbound = () =>
          sendPublicationFrames(socket, {
            type: 'publications',
            publications: [publication, secondPublication],
            fromActorId: 'actor-b'
          })
        return
      }
      if (message.type === 'frame-consumed' && message.frameId) {
        frameConsumedIds.push(message.frameId)
      }
    })
    const mainBoundMessages: CollaborationTransportWorkerResponse[] = []
    const runtime = new CollaborationTransportWorkerRuntime({
      createWebSocket: (endpoint) =>
        new NodeWebSocket(endpoint) as unknown as WebSocket,
      postMessage: (message) => {
        mainBoundMessages.push(structuredClone(message))
      }
    })

    runtime.handle({
      type: 'connect',
      generation: 1,
      endpoint: server.endpoint,
      identity: {
        documentId: 'internal-document',
        roomId: 'internal-room',
        actorId: 'actor-a'
      }
    })

    await vi.waitFor(() =>
      expect(mainBoundMessages.some(({ type }) => type === 'connected')).toBe(
        true
      )
    )
    runtime.handle({
      type: 'send-request',
      generation: 1,
      message: {
        type: 'bootstrap-consumed',
        requestId: 'direct-worker-bootstrap-consumed',
        headSequence: 0
      }
    })
    await vi.waitFor(() =>
      expect(
        mainBoundMessages.some(
          (message) =>
            message.type === 'request-accepted' &&
            message.requestId === 'direct-worker-bootstrap-consumed'
        )
      ).toBe(true)
    )
    sendInbound?.()
    await vi.waitFor(() => expect(frameConsumedIds).toHaveLength(2))
    await vi.waitFor(() =>
      expect(
        mainBoundMessages.filter(({ type }) => type === 'publication-delivery')
      ).toHaveLength(1)
    )

    expect(
      mainBoundMessages.some((message) => {
        const data = message as unknown
        return data instanceof ArrayBuffer || ArrayBuffer.isView(data)
      })
    ).toBe(false)
    const firstDelivery = mainBoundMessages.find(
      (message) => message.type === 'publication-delivery'
    )
    expect(firstDelivery).toMatchObject({
      type: 'publication-delivery',
      publication: { publicationId: publication.publicationId }
    })
    const firstDeliveryIndex = mainBoundMessages.findIndex(
      (message) => message === firstDelivery
    )
    const firstHandoffTimingIndex = mainBoundMessages.findIndex(
      (message) =>
        message.type === 'timing' &&
        message.phase === 'collaboration:receiver-handoff' &&
        message.publicationId === publication.publicationId
    )
    expect(firstDeliveryIndex).toBeGreaterThanOrEqual(0)
    expect(firstHandoffTimingIndex).toBeGreaterThan(firstDeliveryIndex)

    if (!firstDelivery || firstDelivery.type !== 'publication-delivery') {
      throw new Error('Expected the first worker-owned publication delivery')
    }
    runtime.handle({
      type: 'settle-publication',
      generation: 1,
      deliveryId: firstDelivery.deliveryId,
      outcome: 'applied'
    })
    await vi.waitFor(() =>
      expect(
        mainBoundMessages
          .filter(({ type }) => type === 'publication-delivery')
          .map((message) =>
            message.type === 'publication-delivery'
              ? message.publication.publicationId
              : undefined
          )
      ).toEqual([publication.publicationId, secondPublication.publicationId])
    )

    runtime.destroy()
  })

  it('forwards opaque app metadata and reports connected', async () => {
    let hello: ClientMessage | undefined
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      hello = message
      socket.send(JSON.stringify({ type: 'ready' }))
    })
    const provider = createProvider(server.endpoint)

    await provider.connect()

    expect(hello).toEqual({
      type: 'hello',
      identity: {
        documentId: 'internal-document',
        roomId: 'internal-room',
        actorId: 'actor-a',
        connectionMetadata: {
          fileId: 'app-file-17',
          appSpecificValue: { branch: 'draft' }
        }
      }
    })
    expect(provider.getStatus()).toBe('connected')
    await provider.destroy()
  })

  it('reports a rejected real connection as failed', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(
        JSON.stringify({
          type: 'connection-error',
          code: 'connection-rejected',
          message: 'app server rejected connection parameters'
        })
      )
    })
    const provider = createProvider(server.endpoint)

    await expect(provider.connect()).rejects.toMatchObject({
      code: 'connection-rejected',
      message: 'app server rejected connection parameters'
    })
    expect(provider.getStatus()).toBe('failed')
    await provider.destroy()
  })

  it('fails a socket that never completes the document-session handshake', async () => {
    const server = await createLoopbackServer(() => undefined)
    const provider = new CollaborationWebSocketProvider({
      endpoint: server.endpoint,
      connectionTimeoutMs: 25,
      transportWorkerFactory: () => {
        const worker = new TestCollaborationTransportWorker()
        transportWorkers.push(worker)
        return worker
      },
      identity: {
        documentId: 'internal-document',
        roomId: 'internal-room',
        actorId: 'actor-a',
        connectionMetadata: { fileId: 'app-file-17' }
      }
    })
    let settlement: 'pending' | 'resolved' | 'rejected' = 'pending'
    let failure: unknown
    void provider.openDocumentSession().then(
      () => {
        settlement = 'resolved'
      },
      (error: unknown) => {
        settlement = 'rejected'
        failure = error
      }
    )

    try {
      await new Promise((resolve) => setTimeout(resolve, 75))

      expect(settlement).toBe('rejected')
      expect(failure).toMatchObject({
        code: 'connection-failed',
        message:
          '[collaboration] document-session handshake timed out before ready'
      })
      expect(provider.getStatus()).toBe('failed')
    } finally {
      await provider.destroy()
    }
  })

  it('keeps the async publication consumer exclusive across its subscription lifecycle', async () => {
    const provider = createProvider('ws://127.0.0.1:1')
    const firstConsumer = vi.fn(
      async (_publication: SharedPublication) => undefined
    )
    const secondConsumer = vi.fn(
      async (_publication: SharedPublication) => undefined
    )
    const unsubscribeFirst = provider.onPublication(firstConsumer)

    expect(() => provider.onPublication(secondConsumer)).toThrow(
      '[collaboration] an inbound publication consumer is already registered'
    )

    unsubscribeFirst()
    const unsubscribeSecond = provider.onPublication(secondConsumer)
    unsubscribeSecond()
    await provider.destroy()

    expect(() => provider.onPublication(firstConsumer)).toThrow(
      expect.objectContaining({
        code: 'disposed'
      })
    )
  })

  it('reports a hello send failure as transport failure instead of invalid identity', async () => {
    const server = await createLoopbackServer(() => undefined)
    const provider = createProvider(server.endpoint)
    const sendFailure = new Error('socket send failed')
    const send = vi
      .spyOn(NodeWebSocket.prototype, 'send')
      .mockImplementationOnce(() => {
        throw sendFailure
      })

    try {
      await expect(provider.connect()).rejects.toMatchObject({
        code: 'transport-failed',
        message: '[collaboration] WebSocket identity hello send failed'
      })
      expect(
        transportWorkers[0]?.mainBoundMessages.find(
          ({ type }) => type === 'failure'
        )
      ).not.toHaveProperty('cause')
      expect(provider.getStatus()).toBe('failed')
    } finally {
      send.mockRestore()
      await provider.destroy()
    }
  })

  it('accepts one validated publication only after the server assigns its document sequence', async () => {
    let sent: SharedPublication | undefined
    const headers: PublicationFrameHeader[] = []
    const phaseSink = vi.fn()
    const counterSink = vi.fn()
    diagnosticDisposers.push(subscribeToBrowserDragPhases(phaseSink))
    diagnosticDisposers.push(subscribeToDiagnosticCounters(counterSink))
    const server = await createLoopbackServer(
      (socket, message) => {
        if (message.type === 'hello') {
          socket.send(JSON.stringify({ type: 'ready' }))
          return
        }
        if (message.type === 'send-publication') {
          sent = message.publication
        }
      },
      {
        autoAdmitSourceFrames: false,
        onSourceFrame: (socket, header) => {
          headers.push(header)
          socket.send(
            JSON.stringify({
              type: 'source-frame-admitted',
              requestId: header.requestId,
              frameId: header.frameId,
              publicationId: header.publicationId,
              frameByteLength: header.frameByteLength
            })
          )
          socket.send(
            JSON.stringify({
              type: 'response',
              requestId: header.requestId,
              ok: true,
              acceptedSequences: [1]
            })
          )
        }
      }
    )
    const provider = createProvider(server.endpoint)
    await provider.connect()
    phaseSink.mockClear()
    counterSink.mockClear()

    let settlement: 'pending' | 'accepted' | 'rejected' = 'pending'
    const sending = provider.sendPublication(publication)
    void sending.then(
      () => {
        settlement = 'accepted'
      },
      () => {
        settlement = 'rejected'
      }
    )

    try {
      await vi.waitFor(() => expect(headers).toHaveLength(1))
      await vi.waitFor(() => expect(settlement).toBe('accepted'))

      expect(sent).toEqual(publication)
      const worker = transportWorkers[0]
      expect(worker).toBeDefined()
      const publicationPosts = worker?.posted.filter(
        ({ message }) =>
          message.type === 'send-request' &&
          message.message.type === 'send-publication'
      )
      expect(publicationPosts).toHaveLength(1)
      expect(worker?.socketConstructionCount).toBe(1)
      expect(mainThreadWebSocketConstructor).not.toHaveBeenCalled()
      expect(
        worker?.mainBoundMessages.some(
          (message) =>
            (message as unknown) instanceof ArrayBuffer ||
            ArrayBuffer.isView(message as unknown as ArrayBufferView)
        )
      ).toBe(false)
      expect(phaseSink.mock.calls.map(([phaseName]) => phaseName)).toEqual(
        expect.arrayContaining([
          'collaboration:outbound-encode',
          'collaboration:outbound-wire-send'
        ])
      )
      expect(counterSink).toHaveBeenCalledWith(
        'collaboration:outbound-encoded-byte-length',
        expect.any(Number)
      )
      expect(settlement).not.toBe('rejected')
    } finally {
      await provider.destroy()
    }
  })

  it('returns matching source acceptance and consumes an early peer successor only after the source sequence', async () => {
    const peerPublication = createPublication({
      suffix: 'peer-after-source',
      transactionId: 2
    })
    const order: string[] = []
    const server = await createLoopbackServer(
      (socket, message) => {
        if (message.type === 'hello') {
          socket.send(JSON.stringify({ type: 'ready' }))
        }
      },
      {
        autoAdmitSourceFrames: false,
        onSourceFrame: (socket, header) => {
          sendPublicationFrames(socket, {
            type: 'publication',
            publication: peerPublication,
            fromActorId: 'actor-peer',
            sequence: 2
          })
          socket.send(
            JSON.stringify({
              type: 'source-frame-admitted',
              requestId: header.requestId,
              frameId: header.frameId,
              publicationId: header.publicationId,
              frameByteLength: header.frameByteLength
            })
          )
          socket.send(
            JSON.stringify({
              type: 'response',
              requestId: header.requestId,
              ok: true,
              acceptedSequences: [1]
            })
          )
        }
      }
    )
    const provider = createProvider(server.endpoint)
    provider.onPublication(async (inbound) => {
      order.push(`peer:${inbound.publicationId}`)
    })
    await provider.connect()

    try {
      await expect(
        provider.sendPublicationWithAcceptance(
          publication,
          async (accepted) => {
            order.push(`source:${accepted.publicationId}`)
          }
        )
      ).resolves.toEqual({
        publicationId: publication.publicationId,
        sequence: 1
      })
      await vi.waitFor(() =>
        expect(order).toEqual([
          `source:${publication.publicationId}`,
          `peer:${peerPublication.publicationId}`
        ])
      )
      expect(provider.getAppliedDocumentSequence()).toBe(2)
    } finally {
      await provider.destroy()
    }
  })

  it('rejects when the first publication frame cannot be sent before acceptance', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
      }
    })
    const provider = createProvider(server.endpoint)
    const failures = vi.fn()
    provider.onFailure(failures)
    await provider.connect()
    const sendFailure = new Error('publication socket send failed')
    const send = vi
      .spyOn(NodeWebSocket.prototype, 'send')
      .mockImplementationOnce(() => {
        throw sendFailure
      })

    try {
      await expect(provider.sendPublication(publication)).rejects.toMatchObject(
        {
          code: 'transport-failed',
          message: '[collaboration] publication frame send failed'
        }
      )
      expect(
        transportWorkers[0]?.mainBoundMessages.find(
          ({ type }) => type === 'failure'
        )
      ).not.toHaveProperty('cause')
      expect(failures).toHaveBeenCalledOnce()
      expect(provider.getStatus()).toBe('failed')
    } finally {
      send.mockRestore()
      await provider.destroy()
    }
  })

  it('waits for bounded outbound capacity before accepting the next FIFO publication', async () => {
    const headers: PublicationFrameHeader[] = []
    let sourceSocket: NodeWebSocket | undefined
    const server = await createLoopbackServer(
      (socket, message) => {
        if (message.type === 'hello') {
          socket.send(JSON.stringify({ type: 'ready' }))
        }
      },
      {
        autoAdmitSourceFrames: false,
        onSourceFrame: (socket, header) => {
          sourceSocket = socket
          headers.push(header)
        }
      }
    )
    const provider = createProvider(server.endpoint)
    await provider.connect()
    const secondPublication = createPublication({
      suffix: 'bounded-b',
      transactionId: 2
    })
    let firstSettlement: 'pending' | 'accepted' | 'rejected' = 'pending'
    let secondSettlement: 'pending' | 'accepted' | 'rejected' = 'pending'
    const firstSending = provider.sendPublication(publication)
    const secondSending = provider.sendPublication(secondPublication)
    void firstSending.then(
      () => {
        firstSettlement = 'accepted'
      },
      () => {
        firstSettlement = 'rejected'
      }
    )
    void secondSending.then(
      () => {
        secondSettlement = 'accepted'
      },
      () => {
        secondSettlement = 'rejected'
      }
    )

    try {
      await vi.waitFor(() => expect(headers).toHaveLength(1))
      await new Promise((resolve) => setTimeout(resolve, 25))
      expect(firstSettlement).toBe('pending')
      expect(secondSettlement).toBe('pending')
      expect(headers).toHaveLength(1)

      const firstHeader = headers[0] as PublicationFrameHeader
      sourceSocket?.send(
        JSON.stringify({
          type: 'source-frame-admitted',
          requestId: firstHeader.requestId,
          frameId: firstHeader.frameId,
          publicationId: firstHeader.publicationId,
          frameByteLength: firstHeader.frameByteLength
        })
      )
      await vi.waitFor(() => expect(headers).toHaveLength(2))
      expect(firstSettlement).toBe('pending')
      sourceSocket?.send(
        JSON.stringify({
          type: 'response',
          requestId: firstHeader.requestId,
          ok: true,
          acceptedSequences: [1]
        })
      )
      await vi.waitFor(() => expect(firstSettlement).toBe('accepted'))
      const secondHeader = headers[1] as PublicationFrameHeader
      sourceSocket?.send(
        JSON.stringify({
          type: 'source-frame-admitted',
          requestId: secondHeader.requestId,
          frameId: secondHeader.frameId,
          publicationId: secondHeader.publicationId,
          frameByteLength: secondHeader.frameByteLength
        })
      )
      sourceSocket?.send(
        JSON.stringify({
          type: 'response',
          requestId: secondHeader.requestId,
          ok: true,
          acceptedSequences: [2]
        })
      )
      await vi.waitFor(() => expect(secondSettlement).toBe('accepted'))
      expect(headers.map(({ publicationId }) => publicationId)).toEqual([
        publication.publicationId,
        secondPublication.publicationId
      ])
      expect(firstSettlement).not.toBe('rejected')
      expect(secondSettlement).not.toBe('rejected')
    } finally {
      await provider.destroy()
    }
  })

  it('rejects an inexact source admission before publication acceptance', async () => {
    let sourceSocket: NodeWebSocket | undefined
    let firstHeader: PublicationFrameHeader | undefined
    const server = await createLoopbackServer(
      (socket, message) => {
        if (message.type === 'hello') {
          socket.send(JSON.stringify({ type: 'ready' }))
        }
      },
      {
        autoAdmitSourceFrames: false,
        onSourceFrame: (socket, header) => {
          sourceSocket = socket
          firstHeader = header
        }
      }
    )
    const provider = createProvider(server.endpoint)
    const failures = vi.fn()
    provider.onFailure(failures)
    await provider.connect()
    const sending = provider.sendPublication(
      createTwoDeliveryPublication(700_000)
    )
    void sending.catch(() => undefined)

    try {
      await vi.waitFor(() => expect(firstHeader).toBeDefined())
      const header = firstHeader as unknown as PublicationFrameHeader
      sourceSocket?.send(
        JSON.stringify({
          type: 'source-frame-admitted',
          requestId: header.requestId,
          frameId: header.frameId,
          publicationId: header.publicationId,
          frameByteLength: header.frameByteLength + 1
        })
      )

      await vi.waitFor(() => expect(failures).toHaveBeenCalledOnce())
      await expect(sending).rejects.toMatchObject({
        code: 'acknowledgement-failed'
      })
      expect(failures).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'acknowledgement-failed',
          message:
            '[collaboration] source frame admission credit does not match'
        })
      )
      expect(provider.getStatus()).toBe('failed')
    } finally {
      await provider.destroy()
    }
  })

  it('rejects a premature server response before source frame admission', async () => {
    const headers: PublicationFrameHeader[] = []
    const server = await createLoopbackServer(
      (socket, message) => {
        if (message.type === 'hello') {
          socket.send(JSON.stringify({ type: 'ready' }))
        }
      },
      {
        autoAdmitSourceFrames: false,
        onSourceFrame: (socket, header) => {
          headers.push(header)
          socket.send(
            JSON.stringify({
              type: 'response',
              requestId: header.requestId,
              ok: true
            })
          )
        }
      }
    )
    const provider = createProvider(server.endpoint)
    const failures = vi.fn()
    provider.onFailure(failures)
    await provider.connect()

    try {
      await expect(
        provider.sendPublication(createTwoDeliveryPublication(700_000))
      ).rejects.toMatchObject({ code: 'acknowledgement-failed' })
      await vi.waitFor(() => expect(failures).toHaveBeenCalledOnce())

      expect(failures).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'acknowledgement-failed',
          message:
            '[collaboration] publication response arrived before source frame admission'
        })
      )
      expect(headers).toHaveLength(1)
      expect(provider.getStatus()).toBe('failed')
    } finally {
      await provider.destroy()
    }
  })

  it('rejects pending acceptance and its capacity waiter when disconnected', async () => {
    const headers: PublicationFrameHeader[] = []
    const server = await createLoopbackServer(
      (socket, message) => {
        if (message.type === 'hello') {
          socket.send(JSON.stringify({ type: 'ready' }))
        }
      },
      {
        autoAdmitSourceFrames: false,
        onSourceFrame: (_socket, header) => {
          headers.push(header)
        }
      }
    )
    const provider = createProvider(server.endpoint)
    await provider.connect()
    const firstOutcome = provider.sendPublication(
      createTwoDeliveryPublication(700_000)
    )
    void firstOutcome.catch(() => undefined)
    const secondOutcome = provider
      .sendPublication(createTwoDeliveryPublication(700_000))
      .catch((error: unknown) => error)

    try {
      await vi.waitFor(() => expect(headers).toHaveLength(1))
      await new Promise((resolve) => setTimeout(resolve, 25))
      expect(headers).toHaveLength(1)
      await provider.disconnect()

      await expect(firstOutcome).rejects.toMatchObject({
        code: 'not-connected'
      })
      expect(await secondOutcome).toMatchObject({ code: 'not-connected' })
      expect(headers).toHaveLength(1)
    } finally {
      await provider.destroy()
    }
  })

  it('keeps JSON control requests live while a publication awaits admission', async () => {
    const headers: PublicationFrameHeader[] = []
    let sourceSocket: NodeWebSocket | undefined
    let publicationRequestId: string | undefined
    const server = await createLoopbackServer(
      (socket, message) => {
        if (message.type === 'hello') {
          socket.send(JSON.stringify({ type: 'ready' }))
          return
        }
        if (message.type === 'send-awareness') {
          socket.send(
            JSON.stringify({
              type: 'response',
              requestId: message.requestId,
              ok: true
            })
          )
          return
        }
        if (message.type === 'send-publication') {
          publicationRequestId = message.requestId
        }
      },
      {
        autoAdmitSourceFrames: false,
        onSourceFrame: (socket, header) => {
          sourceSocket = socket
          headers.push(header)
        }
      }
    )
    const provider = createProvider(server.endpoint)
    await provider.connect()
    const publicationSending = provider.sendPublication(
      createTwoDeliveryPublication(700_000)
    )

    await vi.waitFor(() => expect(headers).toHaveLength(1))
    await expect(
      provider.sendAwareness({
        actorId: 'actor-a',
        clock: 1,
        state: { cursor: { x: 10, y: 20 } }
      })
    ).resolves.toBeUndefined()
    expect(headers).toHaveLength(1)

    const frameCount = headers[0]?.chunkCount ?? 0
    for (let index = 0; index < frameCount; index += 1) {
      await vi.waitFor(() => expect(headers.length).toBe(index + 1))
      const header = headers[index] as PublicationFrameHeader
      sourceSocket?.send(
        JSON.stringify({
          type: 'source-frame-admitted',
          requestId: header.requestId,
          frameId: header.frameId,
          publicationId: header.publicationId,
          frameByteLength: header.frameByteLength
        })
      )
    }
    await vi.waitFor(() => expect(publicationRequestId).toBeDefined())
    sourceSocket?.send(
      JSON.stringify({
        type: 'response',
        requestId: publicationRequestId,
        ok: true,
        acceptedSequences: [1]
      })
    )
    await publicationSending
    await provider.destroy()
  })

  it('forwards worker-owned inbound byte counters as bounded scalars', async () => {
    let sendInbound: (() => void) | undefined
    const counterSink = vi.fn()
    diagnosticDisposers.push(subscribeToDiagnosticCounters(counterSink))
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      sendInbound = () =>
        socket.send(
          JSON.stringify({
            type: 'awareness',
            actorId: 'actor-b',
            clock: 1,
            state: { cursor: null }
          })
        )
    })
    const provider = createProvider(server.endpoint)
    const awareness = vi.fn()
    provider.onAwareness(awareness)
    await provider.connect()
    counterSink.mockClear()

    try {
      expect(sendInbound).toBeDefined()
      sendInbound?.()
      await vi.waitFor(() => expect(awareness).toHaveBeenCalledOnce())

      const frameEntryCallIndex = counterSink.mock.calls.findIndex(
        ([counterName]) => counterName === 'collaboration:inbound-frame-entry'
      )
      const byteLengthCallIndex = counterSink.mock.calls.findIndex(
        ([counterName]) =>
          counterName === 'collaboration:inbound-frame-byte-length'
      )
      expect(frameEntryCallIndex).toBeGreaterThanOrEqual(0)
      expect(byteLengthCallIndex).toBeGreaterThan(frameEntryCallIndex)
      expect(
        transportWorkers[0]?.mainBoundMessages.some(
          (message) =>
            message.type === 'diagnostic-counter' &&
            message.name === 'collaboration:inbound-frame-byte-length' &&
            message.value > 0
        )
      ).toBe(true)
    } finally {
      await provider.destroy()
    }
  })

  it('does not expose inbound control payloads to main when diagnostics are disabled', async () => {
    let sendInbound: (() => void) | undefined
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      sendInbound = () =>
        socket.send(
          JSON.stringify({
            type: 'awareness',
            actorId: 'actor-b',
            clock: 1,
            state: { cursor: null }
          })
        )
    })
    const provider = createProvider(server.endpoint)
    const awareness = vi.fn()
    provider.onAwareness(awareness)
    await provider.connect()

    try {
      expect(sendInbound).toBeDefined()
      sendInbound?.()
      await vi.waitFor(() => expect(awareness).toHaveBeenCalledOnce())

      expect(
        transportWorkers[0]?.mainBoundMessages.some(
          (message) =>
            typeof (message as unknown) === 'string' ||
            (message as unknown) instanceof ArrayBuffer ||
            ArrayBuffer.isView(message as unknown as ArrayBufferView)
        )
      ).toBe(false)
    } finally {
      await provider.destroy()
    }
  })

  it('keeps awareness controls on the transport worker JSON path', async () => {
    let receivedAwareness: unknown
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        return
      }
      if (message.type !== 'send-awareness' || !message.requestId) return
      receivedAwareness = message
      socket.send(
        JSON.stringify({
          type: 'response',
          requestId: message.requestId,
          ok: true
        })
      )
    })
    const provider = createProvider(server.endpoint)
    await provider.connect()
    const worker = transportWorkers[0]
    if (!worker) throw new Error('Expected a transport worker')

    await provider.sendAwareness({
      actorId: 'actor-a',
      clock: 1,
      state: { cursor: { x: 1, y: 2 } }
    })

    expect(receivedAwareness).toMatchObject({ type: 'send-awareness' })
    expect(
      worker.posted.filter(
        ({ message }) =>
          message.type === 'send-request' &&
          message.message.type === 'send-awareness'
      )
    ).toHaveLength(1)
    await provider.destroy()
  })

  it('requests document Reset through the live collaboration control path', async () => {
    let receivedReset: unknown
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        return
      }
      if (message.type !== 'reset-document' || !message.requestId) return
      receivedReset = message
      socket.send(
        JSON.stringify({
          type: 'response',
          requestId: message.requestId,
          ok: true
        })
      )
    })
    const provider = createProvider(server.endpoint)
    await provider.connect()

    await provider.resetDocument()

    expect(receivedReset).toMatchObject({ type: 'reset-document' })
    expect(
      transportWorkers[0]?.posted.filter(
        ({ message }) =>
          message.type === 'send-request' &&
          message.message.type === 'reset-document'
      )
    ).toHaveLength(1)
    await provider.destroy()
  })

  it('exposes no public batch, lease, or max-capability publication modes', async () => {
    const provider = createProvider('ws://127.0.0.1:1')

    expect('sendPublications' in provider).toBe(false)
    expect('onPublications' in provider).toBe(false)
    expect('onInboundPublicationLease' in provider).toBe(false)
    expect('maxConcurrentPublicationSends' in provider).toBe(false)
    expect('maxPublicationsPerSend' in provider).toBe(false)

    await provider.destroy()
  })

  it('losslessly compacts a large outbound publication before transport', async () => {
    const largePublication = createLargePublication()
    let encodedRequest: string | Uint8Array = ''
    let received: SharedPublication | undefined
    const server = await createLoopbackServer((socket, message, encoded) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        return
      }
      if (message.type !== 'send-publication' || !message.requestId) return
      encodedRequest = encoded
      received = message.publication
      socket.send(
        JSON.stringify({
          type: 'response',
          requestId: message.requestId,
          ok: true,
          acceptedSequences: [1]
        })
      )
    })
    const provider = createProvider(server.endpoint)
    await provider.connect()

    await provider.sendPublication(largePublication)
    await vi.waitFor(() => expect(received).toEqual(largePublication))

    const plain = JSON.stringify({
      type: 'send-publication',
      requestId: 'actor-a:1',
      publication: largePublication
    })
    expect(received).toEqual(largePublication)
    expect(encodedRequest).toBeInstanceOf(Uint8Array)
    expect(encodedRequest.length).toBeLessThan(plain.length * 0.6)
    await provider.destroy()
  })

  it('decodes one compact large inbound publication before notifying subscribers', async () => {
    const largePublication = createLargePublication()
    let sendInbound: (() => void) | undefined
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      sendInbound = () =>
        sendPublicationFrames(socket, {
          type: 'publication',
          publication: largePublication,
          fromActorId: 'actor-b'
        })
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)

    await provider.connect()
    const send = vi.spyOn(NodeWebSocket.prototype, 'send')
    sendInbound?.()
    await vi.waitFor(() => {
      expect(failures.mock.calls).toEqual([])
      expect(inbound).toHaveBeenCalledOnce()
    })

    expect(inbound).toHaveBeenCalledWith(largePublication)
    const worker = transportWorkers[0]
    expect(
      worker?.mainBoundMessages.filter(
        ({ type }) => type === 'publication-delivery'
      )
    ).toHaveLength(1)
    expect(mainThreadWebSocketConstructor).not.toHaveBeenCalled()
    const creditSendIndex = send.mock.calls.findIndex(
      ([value]) =>
        typeof value === 'string' && value.includes('"frame-consumed"')
    )
    expect(creditSendIndex).toBeGreaterThanOrEqual(0)
    expect(send.mock.invocationCallOrder[creditSendIndex]).toBeLessThan(
      inbound.mock.invocationCallOrder[0] as number
    )
    send.mockRestore()
    await provider.destroy()
  })

  it('credits every inbound binary frame exactly once before delivery and records finite worker timings', async () => {
    const inboundPublication = createTwoDeliveryPublication()
    const inboundFrames = encodePublicationMessageFrames(
      {
        type: 'publication',
        publication: inboundPublication,
        fromActorId: 'actor-b',
        sequence: 2
      },
      { softTargetBytes: 256 }
    )
    expect(inboundFrames.length).toBeGreaterThan(1)
    let sendInbound: (() => void) | undefined
    const phaseSink = vi.fn()
    diagnosticDisposers.push(subscribeToBrowserDragPhases(phaseSink))
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendInbound = () =>
          inboundFrames.forEach((frame) => socket.send(new Uint8Array(frame)))
        return
      }
      if (message.type !== 'send-publication' || !message.requestId) return
      socket.send(
        JSON.stringify({
          type: 'response',
          requestId: message.requestId,
          ok: true,
          acceptedSequences: [1]
        })
      )
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    provider.onPublication(inbound)
    await provider.connect()
    const send = vi.spyOn(NodeWebSocket.prototype, 'send')

    try {
      await provider.sendPublication(publication)
      sendInbound?.()
      await vi.waitFor(() => expect(inbound).toHaveBeenCalledOnce())

      const creditCalls = send.mock.calls.flatMap(([value], index) => {
        if (typeof value !== 'string') return []
        const message = decodeCollaborationMessage(value) as ClientMessage
        if (message.type !== 'frame-consumed') return []
        return [
          {
            message,
            invocationOrder: send.mock.invocationCallOrder[index] as number
          }
        ]
      })
      const expectedHeaders = inboundFrames.map((frame) =>
        inspectPublicationFrameHeader(frame)
      )

      expect(creditCalls).toHaveLength(inboundFrames.length)
      expect(creditCalls.map(({ message }) => message)).toEqual(
        expectedHeaders.map((header) =>
          expect.objectContaining({
            type: 'frame-consumed',
            requestId: expect.stringMatching(/^actor-a:credit:\d+$/),
            frameId: header.frameId,
            publicationId: header.publicationId,
            frameByteLength: header.frameByteLength
          })
        )
      )
      expect(
        new Set(creditCalls.map(({ message }) => message.frameId)).size
      ).toBe(inboundFrames.length)
      creditCalls.forEach(({ invocationOrder }) =>
        expect(invocationOrder).toBeLessThan(
          inbound.mock.invocationCallOrder[0] as number
        )
      )

      const codecTimings = phaseSink.mock.calls.filter(
        ([phaseName]) =>
          phaseName === 'collaboration:codec-worker-encode' ||
          phaseName === 'collaboration:codec-worker-decode'
      )
      expect(
        codecTimings.some(
          ([phaseName]) => phaseName === 'collaboration:codec-worker-encode'
        )
      ).toBe(true)
      expect(
        codecTimings.some(
          ([phaseName]) => phaseName === 'collaboration:codec-worker-decode'
        )
      ).toBe(true)
      expect(
        codecTimings.every(
          ([, durationMs]) =>
            typeof durationMs === 'number' &&
            Number.isFinite(durationMs) &&
            durationMs >= 0
        )
      ).toBe(true)
      expect(
        phaseSink.mock.calls.some(
          ([phaseName, durationMs]) =>
            phaseName === 'collaboration:receiver-handoff' &&
            typeof durationMs === 'number' &&
            Number.isFinite(durationMs) &&
            durationMs >= 0
        )
      ).toBe(true)
    } finally {
      send.mockRestore()
      await provider.destroy()
    }
  })

  it('credits each retained inbound chunk before the next chunk is admitted', async () => {
    const inboundPublication = createTwoDeliveryPublication()
    const inboundFrames = encodePublicationMessageFrames(
      {
        type: 'publication',
        publication: inboundPublication,
        fromActorId: 'actor-b'
      },
      { softTargetBytes: 256 }
    )
    expect(inboundFrames.length).toBeGreaterThan(2)
    let sendFirstChunk: (() => void) | undefined
    let nextChunkIndex = 1
    const consumedFrameIds: string[] = []
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendFirstChunk = () => {
          const frame = inboundFrames[0]
          if (frame) socket.send(new Uint8Array(frame))
        }
        return
      }
      if (message.type === 'frame-consumed' && message.frameId) {
        consumedFrameIds.push(message.frameId)
        const nextFrame = inboundFrames[nextChunkIndex]
        nextChunkIndex += 1
        if (nextFrame) socket.send(new Uint8Array(nextFrame))
        return
      }
      if (message.type === 'peer-applied' && message.requestId) {
        socket.send(
          JSON.stringify({
            type: 'response',
            requestId: message.requestId,
            ok: true
          })
        )
      }
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    provider.onPublication(inbound)
    await provider.connect()

    try {
      sendFirstChunk?.()
      await vi.waitFor(
        () => {
          expect(inbound).toHaveBeenCalledOnce()
        },
        { timeout: 3_000 }
      )

      expect(inbound).toHaveBeenCalledWith(inboundPublication)
      expect(consumedFrameIds).toEqual(
        inboundFrames.map(
          (frame) => inspectPublicationFrameHeader(frame).frameId
        )
      )
    } finally {
      await provider.destroy()
    }
  })

  it('waits for inbound capacity instead of failing after a decoded oversized publication fills the window', async () => {
    const firstPublication = createPublication({
      suffix: 'capacity-first',
      transactionId: 50
    })
    const oversizedPublication = createTwoDeliveryPublication(1_100_000, {
      suffix: 'capacity-oversized',
      transactionId: 51
    })
    const trailingPublication = createPublication({
      suffix: 'capacity-trailing',
      transactionId: 52
    })
    const firstFrames = encodePublicationMessageFrames({
      type: 'publication',
      publication: firstPublication,
      fromActorId: 'actor-b'
    })
    const oversizedFrames = encodePublicationMessageFrames({
      type: 'publication',
      publication: oversizedPublication,
      fromActorId: 'actor-b'
    })
    const trailingFrames = encodePublicationMessageFrames({
      type: 'publication',
      publication: trailingPublication,
      fromActorId: 'actor-b'
    })
    const inboundFrames = [
      ...firstFrames,
      ...oversizedFrames,
      ...trailingFrames
    ]
    expect(firstFrames).toHaveLength(1)
    expect(oversizedFrames.length).toBeGreaterThan(1)
    expect(trailingFrames).toHaveLength(1)
    expect(
      oversizedFrames.reduce(
        (sum, frame) =>
          sum + inspectPublicationFrameHeader(frame).frameByteLength,
        0
      )
    ).toBeGreaterThan(2 * 1024 * 1024)
    let sendFirstFrame: (() => void) | undefined
    let nextFrameIndex = 1
    const consumedFrameIds: string[] = []
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendFirstFrame = () => {
          const frame = inboundFrames[0]
          if (frame) socket.send(new Uint8Array(frame))
        }
        return
      }
      if (message.type === 'frame-consumed' && message.frameId) {
        consumedFrameIds.push(message.frameId)
        const nextFrame = inboundFrames[nextFrameIndex]
        nextFrameIndex += 1
        if (nextFrame) socket.send(new Uint8Array(nextFrame))
        return
      }
      if (message.type === 'peer-applied' && message.requestId) {
        socket.send(
          JSON.stringify({
            type: 'response',
            requestId: message.requestId,
            ok: true
          })
        )
      }
    })
    const provider = createProvider(server.endpoint)
    const firstSettlement = createDeferred<undefined>()
    void firstSettlement.promise.catch(() => undefined)
    const received: SharedPublication[] = []
    const failures = vi.fn()
    provider.onPublication(async (inbound) => {
      received.push(inbound)
      if (inbound.publicationId === firstPublication.publicationId) {
        await firstSettlement.promise
      }
    })
    provider.onFailure(failures)
    await provider.connect()

    try {
      sendFirstFrame?.()
      await vi.waitFor(() => expect(received).toHaveLength(1))
      await vi.waitFor(() => expect(nextFrameIndex).toBe(inboundFrames.length))

      expect(failures).not.toHaveBeenCalled()
      expect(provider.getStatus()).toBe('connected')
      expect(consumedFrameIds).toHaveLength(inboundFrames.length - 1)

      firstSettlement.resolve(undefined)
      await vi.waitFor(() => expect(received).toHaveLength(3))
      await vi.waitFor(() =>
        expect(consumedFrameIds).toHaveLength(inboundFrames.length)
      )

      expect(received).toEqual([
        firstPublication,
        oversizedPublication,
        trailingPublication
      ])
      expect(failures).not.toHaveBeenCalled()
      expect(provider.getStatus()).toBe('connected')
    } finally {
      firstSettlement.resolve(undefined)
      await provider.destroy()
    }
  })

  it('bounds retained wire credit while one exclusive async consumer remains pending', async () => {
    const publications = Array.from({ length: 4 }, (_, index) =>
      createPublication({
        payload: {
          id: `window-${index}`,
          source: String(index).repeat(600 * 1024)
        },
        origin: index === 1 ? 'undo' : 'action',
        suffix: `window-${index}`,
        transactionId: index + 10
      })
    )
    const inboundFrames = encodePublicationMessageFrames({
      type: 'publications',
      publications,
      fromActorId: 'actor-b'
    })
    expect(inboundFrames).toHaveLength(publications.length)
    const frameByteLengths = inboundFrames.map(
      (frame) => inspectPublicationFrameHeader(frame).frameByteLength
    )
    expect(
      frameByteLengths.slice(0, 3).reduce((sum, size) => sum + size, 0)
    ).toBeLessThanOrEqual(2 * 1024 * 1024)
    expect(
      frameByteLengths.reduce((sum, size) => sum + size, 0)
    ).toBeGreaterThan(2 * 1024 * 1024)
    let sendInbound: (() => void) | undefined
    const consumedFrameIds: string[] = []
    const appliedPublicationIds: string[] = []
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendInbound = () =>
          inboundFrames
            .slice(0, 3)
            .forEach((frame) => socket.send(new Uint8Array(frame)))
        return
      }
      if (message.type === 'frame-consumed' && message.frameId) {
        consumedFrameIds.push(message.frameId)
        if (consumedFrameIds.length === 1) {
          const tailFrame = inboundFrames[3]
          if (tailFrame) socket.send(new Uint8Array(tailFrame))
        }
        return
      }
      if (
        message.type === 'peer-applied' &&
        message.publicationId &&
        message.requestId
      ) {
        appliedPublicationIds.push(message.publicationId)
        socket.send(
          JSON.stringify({
            type: 'response',
            requestId: message.requestId,
            ok: true
          })
        )
      }
    })
    const provider = createProvider(server.endpoint)
    const firstSettlement = createDeferred<undefined>()
    void firstSettlement.promise.catch(() => undefined)
    const received: SharedPublication[] = []
    const phaseSink = vi.fn()
    diagnosticDisposers.push(subscribeToBrowserDragPhases(phaseSink))
    provider.onPublication(async (inbound) => {
      received.push(inbound)
      if (inbound.publicationId === publications[0]?.publicationId) {
        await firstSettlement.promise
      }
    })
    await provider.connect()

    try {
      sendInbound?.()
      await vi.waitFor(() =>
        expect(consumedFrameIds).toHaveLength(inboundFrames.length)
      )
      await vi.waitFor(() => expect(received).toHaveLength(1))

      expect(
        transportWorkers[0]?.mainBoundMessages.filter(
          ({ type }) => type === 'publication-delivery'
        )
      ).toHaveLength(1)
      expect(received[0]?.publicationId).toBe(publications[0]?.publicationId)
      expect(Object.isFrozen(received[0])).toBe(false)
      expect(
        Object.isFrozen(
          received[0]?.slices[0]?.batches[0]?.deliveries[0]?.payload
        )
      ).toBe(false)
      expect(appliedPublicationIds).toEqual([])
      expect(new Set(consumedFrameIds)).toEqual(
        new Set(
          inboundFrames.map(
            (frame) => inspectPublicationFrameHeader(frame).frameId
          )
        )
      )

      firstSettlement.resolve(undefined)
      await vi.waitFor(() => expect(received).toHaveLength(publications.length))
      await vi.waitFor(() =>
        expect(appliedPublicationIds).toHaveLength(publications.length)
      )
      await vi.waitFor(() =>
        expect(consumedFrameIds).toHaveLength(inboundFrames.length)
      )

      expect(received.map(({ publicationId }) => publicationId)).toEqual(
        publications.map(({ publicationId }) => publicationId)
      )
      expect(appliedPublicationIds).toEqual(
        publications.map(({ publicationId }) => publicationId)
      )
      expect(new Set(consumedFrameIds).size).toBe(inboundFrames.length)
      expect(provider.getStatus()).toBe('connected')
      expect(
        phaseSink.mock.calls.some(
          ([phaseName]) => phaseName === 'collaboration:inbound-provider-clone'
        )
      ).toBe(false)
    } finally {
      await provider.destroy()
    }
  })

  it('keeps terminal app rejection out of ProviderFailure without advancing past the gap', async () => {
    const secondPublication = createPublication({
      suffix: 'terminal-b',
      transactionId: 20
    })
    let sendInbound: (() => void) | undefined
    const consumedPublicationIds: string[] = []
    const appliedPublicationIds: string[] = []
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendInbound = () =>
          sendPublicationFrames(socket, {
            type: 'publications',
            publications: [publication, secondPublication],
            fromActorId: 'actor-b'
          })
        return
      }
      if (message.type === 'frame-consumed' && message.publicationId) {
        consumedPublicationIds.push(message.publicationId)
        return
      }
      if (message.type === 'peer-applied' && message.publicationId) {
        appliedPublicationIds.push(message.publicationId)
      }
    })
    const provider = createProvider(server.endpoint)
    const applyFailure = new Error('remote apply failed')
    const firstSettlement = createDeferred<undefined>()
    void firstSettlement.promise.catch(() => undefined)
    const receivedPublicationIds: string[] = []
    const failures = vi.fn()
    provider.onPublication(async (inbound) => {
      receivedPublicationIds.push(inbound.publicationId)
      if (inbound.publicationId === publication.publicationId) {
        await firstSettlement.promise
      }
    })
    provider.onFailure(failures)
    await provider.connect()

    try {
      sendInbound?.()
      await vi.waitFor(() =>
        expect(consumedPublicationIds).toEqual([
          publication.publicationId,
          secondPublication.publicationId
        ])
      )
      await vi.waitFor(() =>
        expect(receivedPublicationIds).toEqual([publication.publicationId])
      )

      firstSettlement.reject(applyFailure)
      await new Promise((resolve) => setTimeout(resolve, 25))

      expect(receivedPublicationIds).toEqual([publication.publicationId])
      expect(appliedPublicationIds).toEqual([])
      expect(failures).not.toHaveBeenCalled()
      expect(transportWorkers[0]?.terminateCount).toBe(1)
      expect(provider.getStatus()).toBe('failed')
    } finally {
      await provider.destroy()
    }
  })

  it('rejects a live document-sequence gap before invoking the App consumer', async () => {
    let sendGap: (() => void) | undefined
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      sendGap = () =>
        sendPublicationFrames(socket, {
          type: 'publication',
          publication,
          fromActorId: 'actor-b',
          sequence: 2
        })
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async () => undefined)
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)
    await provider.connect()

    sendGap?.()

    await vi.waitFor(() =>
      expect(failures).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'transport-failed',
          message: '[collaboration] live document sequence is not contiguous'
        })
      )
    )
    expect(inbound).not.toHaveBeenCalled()
    expect(provider.getStatus()).toBe('failed')
    await provider.destroy()
  })

  it('accepts one oversized indivisible inbound frame through an empty window', async () => {
    const oversizedPublication = createPublication({
      payload: {
        id: 'oversized-record',
        source: 'o'.repeat(2 * 1024 * 1024)
      },
      suffix: 'oversized',
      transactionId: 21
    })
    const frames = encodePublicationMessageFrames({
      type: 'publication',
      publication: oversizedPublication,
      fromActorId: 'actor-b'
    })
    expect(frames).toHaveLength(1)
    expect(frames[0]?.byteLength).toBeGreaterThan(2 * 1024 * 1024)
    let sendInbound: (() => void) | undefined
    const consumedFrameIds: string[] = []
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendInbound = () => {
          const frame = frames[0]
          if (frame) socket.send(new Uint8Array(frame))
        }
        return
      }
      if (message.type === 'frame-consumed' && message.frameId) {
        consumedFrameIds.push(message.frameId)
        return
      }
      if (message.type === 'peer-applied' && message.requestId) {
        socket.send(
          JSON.stringify({
            type: 'response',
            requestId: message.requestId,
            ok: true
          })
        )
      }
    })
    const provider = createProvider(server.endpoint)
    const received: SharedPublication[] = []
    provider.onPublication(async (inbound) => {
      received.push(inbound)
    })
    await provider.connect()

    try {
      sendInbound?.()
      await vi.waitFor(() => expect(received).toHaveLength(1))

      expect(consumedFrameIds).toHaveLength(1)
      expect(received[0]).toEqual(oversizedPublication)
    } finally {
      await provider.destroy()
    }
  })

  it('ignores late async consumer settlement after transport teardown', async () => {
    const secondPublication = createPublication({
      suffix: 'teardown-b',
      transactionId: 22
    })
    let sendInbound: (() => void) | undefined
    const appliedPublicationIds: string[] = []
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendInbound = () =>
          sendPublicationFrames(socket, {
            type: 'publications',
            publications: [publication, secondPublication],
            fromActorId: 'actor-b'
          })
        return
      }
      if (message.type === 'peer-applied' && message.publicationId) {
        appliedPublicationIds.push(message.publicationId)
      }
    })
    const provider = createProvider(server.endpoint)
    const settlement = createDeferred<undefined>()
    const receivedPublicationIds: string[] = []
    provider.onPublication(async (inbound) => {
      receivedPublicationIds.push(inbound.publicationId)
      await settlement.promise
    })
    await provider.connect()

    sendInbound?.()
    await vi.waitFor(() =>
      expect(receivedPublicationIds).toEqual([publication.publicationId])
    )
    await provider.destroy()
    settlement.resolve(undefined)
    await Promise.resolve()
    await Promise.resolve()

    expect(receivedPublicationIds).toEqual([publication.publicationId])
    expect(appliedPublicationIds).toEqual([])
    expect(transportWorkers[0]?.terminateCount).toBe(1)
    expect(provider.getStatus()).toBe('disposed')
  })

  it('delivers ordered publications directly through the one async consumer', async () => {
    const secondPublication = createPublication({
      suffix: 'b',
      transactionId: 2
    })
    let sendInbound: (() => void) | undefined
    const delayedReceiptResponses: (() => void)[] = []
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendInbound = () =>
          sendPublicationFrames(socket, {
            type: 'publications',
            publications: [publication, secondPublication],
            fromActorId: 'actor-b'
          })
        return
      }
      if (
        message.type === 'peer-applied' &&
        message.publicationId &&
        message.requestId
      ) {
        delayedReceiptResponses.push(() =>
          socket.send(
            JSON.stringify({
              type: 'response',
              requestId: message.requestId,
              ok: true
            })
          )
        )
      }
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_received: SharedPublication) => undefined)
    provider.onPublication(inbound)

    await provider.connect()
    const send = vi.spyOn(NodeWebSocket.prototype, 'send')

    try {
      sendInbound?.()
      await vi.waitFor(() => expect(inbound).toHaveBeenCalledTimes(2))
      await vi.waitFor(() => expect(delayedReceiptResponses).toHaveLength(2))

      const peerAppliedSends = send.mock.calls.flatMap(([value], index) => {
        if (typeof value !== 'string') return []
        const message = decodeCollaborationMessage(value) as ClientMessage
        if (message.type !== 'peer-applied') return []
        return [
          {
            message,
            invocationOrder: send.mock.invocationCallOrder[index] as number
          }
        ]
      })
      const firstPeerApplied = peerAppliedSends.find(
        ({ message }) => message.publicationId === publication.publicationId
      )

      expect(inbound.mock.calls.map(([value]) => value)).toEqual([
        publication,
        secondPublication
      ])
      expect(firstPeerApplied).toBeDefined()
      expect(firstPeerApplied?.invocationOrder).toBeLessThan(
        inbound.mock.invocationCallOrder[1] as number
      )

      delayedReceiptResponses.forEach((respond) => respond())
    } finally {
      send.mockRestore()
      await provider.destroy()
    }
  })

  it('assembles interleaved multi-chunk publications and releases them in first-seen order', async () => {
    const firstPublication = createTwoDeliveryPublication()
    const secondPublication = createPublication({
      suffix: 'interleaved-b',
      transactionId: 5
    })
    const firstFrames = encodePublicationMessageFrames(
      {
        type: 'publication',
        publication: firstPublication,
        fromActorId: 'actor-b'
      },
      { softTargetBytes: 256 }
    )
    const secondFrames = encodePublicationMessageFrames({
      type: 'publication',
      publication: secondPublication,
      fromActorId: 'actor-c'
    })
    expect(firstFrames.length).toBeGreaterThan(1)
    expect(secondFrames).toHaveLength(1)
    let sendInterleaved: (() => void) | undefined
    const consumedFrameIds: string[] = []
    const phaseSink = vi.fn()
    diagnosticDisposers.push(subscribeToBrowserDragPhases(phaseSink))
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendInterleaved = () => {
          socket.send(new Uint8Array(firstFrames[0] as ArrayBuffer))
          socket.send(new Uint8Array(secondFrames[0] as ArrayBuffer))
          firstFrames
            .slice(1)
            .forEach((frame) => socket.send(new Uint8Array(frame)))
        }
        return
      }
      if (message.type === 'frame-consumed' && message.frameId) {
        consumedFrameIds.push(message.frameId)
        return
      }
      if (message.type === 'peer-applied' && message.requestId) {
        socket.send(
          JSON.stringify({
            type: 'response',
            requestId: message.requestId,
            ok: true
          })
        )
      }
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)
    await provider.connect()

    try {
      sendInterleaved?.()
      await vi.waitFor(() => expect(inbound).toHaveBeenCalledTimes(2))

      expect(failures).not.toHaveBeenCalled()
      expect(inbound.mock.calls.map(([value]) => value)).toEqual([
        firstPublication,
        secondPublication
      ])
      await vi.waitFor(() =>
        expect(consumedFrameIds).toHaveLength(
          firstFrames.length + secondFrames.length
        )
      )
      const expectedFrameIds = [...firstFrames, ...secondFrames].map(
        (frame) => inspectPublicationFrameHeader(frame).frameId
      )
      expect(new Set(consumedFrameIds)).toEqual(new Set(expectedFrameIds))
      expect(
        phaseSink.mock.calls.filter(
          ([phaseName]) => phaseName === 'collaboration:codec-worker-decode'
        )
      ).toHaveLength(firstFrames.length + secondFrames.length)
    } finally {
      await provider.destroy()
    }
  })

  it('rejects a duplicate inbound chunk without issuing duplicate frame credit', async () => {
    const inboundPublication = createTwoDeliveryPublication()
    const frames = encodePublicationMessageFrames(
      {
        type: 'publication',
        publication: inboundPublication,
        fromActorId: 'actor-b'
      },
      { softTargetBytes: 256 }
    )
    const duplicateFrame = frames[0]
    if (!duplicateFrame) throw new Error('Expected a publication frame')
    let sendDuplicate: (() => void) | undefined
    const consumedFrameIds: string[] = []
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendDuplicate = () => {
          socket.send(new Uint8Array(duplicateFrame))
          socket.send(new Uint8Array(duplicateFrame))
        }
        return
      }
      if (message.type === 'frame-consumed' && message.frameId) {
        consumedFrameIds.push(message.frameId)
      }
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)
    await provider.connect()

    try {
      sendDuplicate?.()
      await vi.waitFor(() => expect(failures).toHaveBeenCalledOnce())

      expect(consumedFrameIds).toEqual([
        inspectPublicationFrameHeader(duplicateFrame).frameId
      ])
      expect(inbound).not.toHaveBeenCalled()
      expect(provider.getStatus()).toBe('failed')
      expect(transportWorkers[0]?.terminateCount).toBe(1)
    } finally {
      await provider.destroy()
    }
  })

  it('rejects an out-of-order publication before credit or delivery', async () => {
    const secondPublication = createPublication({
      suffix: 'ordered-b',
      transactionId: 23
    })
    const frames = encodePublicationMessageFrames({
      type: 'publications',
      publications: [publication, secondPublication],
      fromActorId: 'actor-b'
    })
    expect(frames).toHaveLength(2)
    const firstFrame = frames.find(
      (frame) => inspectPublicationFrameHeader(frame).publicationIndex === 0
    )
    const secondFrame = frames.find(
      (frame) => inspectPublicationFrameHeader(frame).publicationIndex === 1
    )
    if (!firstFrame || !secondFrame) {
      throw new Error('Expected ordered publication frames')
    }
    let sendOutOfOrder: (() => void) | undefined
    const consumedFrameIds: string[] = []
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendOutOfOrder = () => {
          socket.send(new Uint8Array(secondFrame))
          socket.send(new Uint8Array(firstFrame))
        }
        return
      }
      if (message.type === 'frame-consumed' && message.frameId) {
        consumedFrameIds.push(message.frameId)
      }
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)
    await provider.connect()

    try {
      sendOutOfOrder?.()
      await vi.waitFor(() => expect(failures).toHaveBeenCalledOnce())

      expect(consumedFrameIds).toEqual([])
      expect(inbound).not.toHaveBeenCalled()
      expect(failures).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'transport-failed',
          message: expect.stringContaining(
            'out-of-order inbound publication frame'
          )
        })
      )
      expect(provider.getStatus()).toBe('failed')
    } finally {
      await provider.destroy()
    }
  })

  it('rejects a later publication before the prior publication finishes within one burst', async () => {
    const firstPublication = createTwoDeliveryPublication()
    const secondPublication = createPublication({
      suffix: 'same-burst-b',
      transactionId: 24
    })
    const frames = encodePublicationMessageFrames(
      {
        type: 'publications',
        publications: [firstPublication, secondPublication],
        fromActorId: 'actor-b'
      },
      { softTargetBytes: 256 }
    )
    const firstOpeningFrame = frames.find((frame) => {
      const header = inspectPublicationFrameHeader(frame)
      return header.publicationIndex === 0 && header.chunkIndex === 0
    })
    const secondOpeningFrame = frames.find((frame) => {
      const header = inspectPublicationFrameHeader(frame)
      return header.publicationIndex === 1 && header.chunkIndex === 0
    })
    if (!firstOpeningFrame || !secondOpeningFrame) {
      throw new Error('Expected two ordered publication openings')
    }
    expect(
      inspectPublicationFrameHeader(firstOpeningFrame).chunkCount
    ).toBeGreaterThan(1)
    let sendInterleavedBurst: (() => void) | undefined
    const consumedFrameIds: string[] = []
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendInterleavedBurst = () => {
          socket.send(new Uint8Array(firstOpeningFrame))
          socket.send(new Uint8Array(secondOpeningFrame))
        }
        return
      }
      if (message.type === 'frame-consumed' && message.frameId) {
        consumedFrameIds.push(message.frameId)
      }
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)
    await provider.connect()

    try {
      sendInterleavedBurst?.()
      await vi.waitFor(() => expect(failures).toHaveBeenCalledOnce())

      expect(consumedFrameIds).toEqual([
        inspectPublicationFrameHeader(firstOpeningFrame).frameId
      ])
      expect(inbound).not.toHaveBeenCalled()
      expect(failures).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'transport-failed',
          message: expect.stringContaining(
            'out-of-order inbound publication frame'
          )
        })
      )
      expect(provider.getStatus()).toBe('failed')
    } finally {
      await provider.destroy()
    }
  })

  it('delivers one detached worker handoff without a Provider freeze', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        sendPublicationFrames(socket, {
          type: 'publication',
          publication,
          fromActorId: 'actor-b'
        })
        return
      }
      if (message.type === 'peer-applied' && message.requestId) {
        socket.send(
          JSON.stringify({
            type: 'response',
            requestId: message.requestId,
            ok: true
          })
        )
      }
    })
    const provider = createProvider(server.endpoint)
    const received: SharedPublication[] = []
    provider.onPublication(async (inbound) => {
      received.push(inbound)
    })

    await provider.connect()
    await vi.waitFor(() => expect(received).toHaveLength(1))

    expect(received[0]).toEqual(publication)
    expect(received[0]).not.toBe(publication)
    expect(Object.isFrozen(received[0])).toBe(false)
    expect(
      Object.isFrozen(
        received[0]?.slices[0]?.batches[0]?.deliveries[0]?.payload
      )
    ).toBe(false)
    await provider.destroy()
  })

  it('rejects a publication before JSON encoding can change its payload', async () => {
    let publicationRequestCount = 0
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        return
      }
      if (message.type !== 'send-publication' || !message.requestId) return
      publicationRequestCount += 1
      socket.send(
        JSON.stringify({
          type: 'response',
          requestId: message.requestId,
          ok: true
        })
      )
    })
    const provider = createProvider(server.endpoint)
    await provider.connect()
    const unsafeValues: unknown[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      undefined,
      Symbol('not-json-safe'),
      () => 'not-json-safe'
    ]

    for (const value of unsafeValues) {
      const unsafePublication = createPublication({
        payload: { value },
        suffix: 'unsafe'
      })
      await expect(
        provider.sendPublication(unsafePublication)
      ).rejects.toMatchObject({ code: 'transport-failed' })
    }
    expect(publicationRequestCount).toBe(0)
    await provider.destroy()
  })

  it('rejects a schema-valid JSON publication once without delivering it', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      socket.send(
        JSON.stringify({
          type: 'publication',
          publication,
          fromActorId: 'actor-b'
        })
      )
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)

    try {
      await provider.connect()
      await vi.waitFor(() =>
        expect(
          failures.mock.calls.length + inbound.mock.calls.length
        ).toBeGreaterThan(0)
      )

      expect(failures).toHaveBeenCalledOnce()
      expect(failures).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'transport-failed' })
      )
      expect(inbound).not.toHaveBeenCalled()
    } finally {
      await provider.destroy()
    }
  })

  it('receives one detached live publication as the direct callback payload', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      sendPublicationFrames(socket, {
        type: 'publication',
        publication,
        fromActorId: 'actor-b'
      })
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    provider.onPublication(inbound)

    await provider.connect()
    await vi.waitFor(() => expect(inbound).toHaveBeenCalledOnce())

    expect(inbound).toHaveBeenCalledWith(publication)
    expect(inbound.mock.calls[0]?.[0]).not.toBe(publication)
    await provider.destroy()
  })

  it('rejects malformed publication messages as transport failure', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      socket.send(
        JSON.stringify({
          type: 'publication',
          publication: { ...publication, deliveries: null }
        })
      )
    })
    const provider = createProvider(server.endpoint)
    const failures = vi.fn()
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    provider.onFailure(failures)
    provider.onPublication(inbound)

    await provider.connect()
    await vi.waitFor(() =>
      expect(failures).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'transport-failed' })
      )
    )

    expect(inbound).not.toHaveBeenCalled()
    await provider.destroy()
  })

  it('maps an unsupported binary publication frame to ProviderFailure without delivery', async () => {
    let sendInvalidFrame: (() => void) | undefined
    const consumed = vi.fn()
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'frame-consumed') {
        consumed()
        return
      }
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      const frame = encodePublicationMessageFrames({
        type: 'publication',
        publication,
        fromActorId: 'actor-b'
      })[0]
      if (!frame) throw new Error('Expected a publication frame')
      const invalid = frame.slice(0)
      new Uint8Array(invalid)[PUBLICATION_FRAME_VERSION_OFFSET] = 0xff
      sendInvalidFrame = () => socket.send(new Uint8Array(invalid))
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)
    await provider.connect()

    sendInvalidFrame?.()
    await vi.waitFor(() =>
      expect(failures).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'transport-failed',
          message: expect.stringContaining(
            'unsupported publication frame version'
          )
        })
      )
    )

    expect(failures).toHaveBeenCalledOnce()
    expect(inbound).not.toHaveBeenCalled()
    expect(consumed).not.toHaveBeenCalled()
    expect(provider.getStatus()).toBe('failed')
    expect(transportWorkers[0]?.terminateCount).toBe(1)
    await provider.destroy()
  })

  it('maps a truncated binary publication frame to one ProviderFailure without delivery', async () => {
    let sendTruncatedFrame: (() => void) | undefined
    const consumed = vi.fn()
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'frame-consumed') {
        consumed()
        return
      }
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      const frame = encodePublicationMessageFrames({
        type: 'publication',
        publication,
        fromActorId: 'actor-b'
      })[0]
      if (!frame) throw new Error('Expected a publication frame')
      const truncated = frame.slice(0, frame.byteLength - 1)
      sendTruncatedFrame = () => socket.send(new Uint8Array(truncated))
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)
    await provider.connect()

    sendTruncatedFrame?.()
    await vi.waitFor(() => expect(failures).toHaveBeenCalledOnce())

    expect(failures).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'transport-failed',
        message: expect.stringContaining('truncated publication frame payload')
      })
    )
    expect(inbound).not.toHaveBeenCalled()
    expect(consumed).not.toHaveBeenCalled()
    expect(provider.getStatus()).toBe('failed')
    expect(transportWorkers[0]?.terminateCount).toBe(1)
    await provider.destroy()
  })

  it('does not emit late delivery or credit after a pending inbound worker failure tears down the codec', async () => {
    let sendInbound: (() => void) | undefined
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      sendInbound = () =>
        sendPublicationFrames(socket, {
          type: 'publication',
          publication,
          fromActorId: 'actor-b'
        })
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn(async (_publication: SharedPublication) => undefined)
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)
    await provider.connect()
    const worker = transportWorkers[0]
    if (!worker) throw new Error('Expected a transport worker')
    const send = vi.spyOn(NodeWebSocket.prototype, 'send')

    try {
      worker.emitError(new Error('inbound transport worker failed'))
      await vi.waitFor(() => expect(failures).toHaveBeenCalledOnce())
      sendInbound?.()
      await provider.destroy()
      await Promise.resolve()
      await Promise.resolve()

      const creditCalls = send.mock.calls.filter(
        ([value]) =>
          typeof value === 'string' && value.includes('"frame-consumed"')
      )
      expect(failures).toHaveBeenCalledOnce()
      expect(failures).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'transport-failed',
          message: '[collaboration] collaboration transport worker failed'
        })
      )
      expect(inbound).not.toHaveBeenCalled()
      expect(creditCalls).toEqual([])
      expect(worker.terminateCount).toBe(1)
    } finally {
      send.mockRestore()
      await provider.destroy()
    }
  })

  it('does not encode while disconnected and rejects pending codec work on teardown', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
      }
    })
    const provider = createProvider(server.endpoint)

    await expect(provider.sendPublication(publication)).rejects.toMatchObject({
      code: 'not-connected'
    })
    expect(transportWorkers).toEqual([])

    await provider.connect()
    const worker = transportWorkers[0]
    if (!worker) throw new Error('Expected a transport worker')
    worker.paused = true
    const sendingOutcome = provider
      .sendPublication(publication)
      .catch((error: unknown) => error)
    await vi.waitFor(() =>
      expect(
        worker.posted.some(
          ({ message }) =>
            message.type === 'send-request' &&
            message.message.type === 'send-publication'
        )
      ).toBe(true)
    )

    await provider.destroy()

    expect(await sendingOutcome).toMatchObject({ code: 'disposed' })
    expect(worker.terminateCount).toBe(1)
    worker.flush()
  })

  it('reports one ProviderFailure when the server closes before publication acceptance', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
      } else if (message.type === 'send-publication') {
        socket.close(1008, 'canonical publication rejected')
      }
    })
    const provider = createProvider(server.endpoint)
    const failures = vi.fn()
    provider.onFailure(failures)
    await provider.connect()

    try {
      await expect(provider.sendPublication(publication)).rejects.toMatchObject(
        { code: 'not-connected' }
      )
      await vi.waitFor(() => expect(failures).toHaveBeenCalledOnce())
      await new Promise((resolve) => setTimeout(resolve, 25))

      expect(failures).toHaveBeenCalledOnce()
      expect(failures).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'not-connected',
          message:
            '[collaboration] WebSocket connection closed (1008: canonical publication rejected)'
        })
      )
      expect(provider.getStatus()).toBe('disconnected')
    } finally {
      await provider.destroy()
    }
  })

  it('reconnects with a new socket and exposes no state-vector methods', async () => {
    let connectionCount = 0
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      connectionCount += 1
      socket.send(JSON.stringify({ type: 'ready' }))
    })
    const provider = createProvider(server.endpoint)

    await provider.connect()
    await provider.disconnect()
    await provider.reconnect()

    expect(connectionCount).toBe(2)
    expect('requestSync' in provider).toBe(false)
    expect('exchangeStateVector' in provider).toBe(false)
    expect('sendSyncUpdate' in provider).toBe(false)
    await provider.destroy()
  })
})
