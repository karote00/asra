import type { SharedPublication } from '@asyra/factory'
import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket as NodeWebSocket, WebSocketServer, type RawData } from 'ws'
import {
  PUBLICATION_FRAME_VERSION_OFFSET,
  decodeCollaborationMessage,
  decodePublicationMessageFrames,
  encodePublicationMessageFrames,
  inspectPublicationFrameHeader,
  isPublicationFrame,
  type PublicationFrameHeader
} from '../../collaboration/protocol'
import {
  PublicationCodecWorkerRuntime,
  type PublicationCodecWorkerRequest,
  type PublicationCodecWorkerResponse
} from '../../collaboration/publication-codec-worker'
import {
  CollaborationWebSocketProvider,
  type PublicationCodecWorkerLike
} from '../../collaboration/websocket-provider'

type ClientMessage = Readonly<{
  type: string
  requestId?: string
  frameId?: string
  publicationId?: string
  frameByteLength?: number
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
  readonly payload?: object
  readonly suffix?: string
  readonly transactionId?: number
}

const createPublication = ({
  channel = 'sceneTree',
  eventName = 'updateComputedData',
  payload = { value: 1 },
  suffix = 'a',
  transactionId = 1
}: PublicationFixtureOptions = {}): SharedPublication => {
  const artifactId = `${transactionId}:artifact`
  const batchId = `${transactionId}:batch:${suffix}`
  const deliveryId = `${transactionId}:delivery:${suffix}`
  const recordId = `${transactionId}:record:${suffix}`
  const sliceId = `${transactionId}:slice:${suffix}`
  const record = {
    recordId,
    deliveryId,
    occurrence: 0,
    orderedIds: [`element-${suffix}`],
    payload,
    inverseEvents: []
  }
  const delivery = {
    deliveryId,
    artifactId,
    batchId,
    transactionId,
    origin: 'action' as const,
    kind: 'forward' as const,
    channel,
    eventName,
    payload,
    recordId,
    record,
    sharedDelivery: 'immediate' as const
  }
  return {
    publicationId: `publication-${suffix}`,
    artifactId,
    transactionId,
    origin: 'action',
    deliveries: [delivery],
    batches: [
      {
        batchId,
        sliceId,
        artifactId,
        transactionId,
        origin: 'action',
        kind: 'forward',
        channel,
        sharedDelivery: 'immediate',
        deliveries: [delivery],
        records: [record],
        changes: [payload]
      }
    ],
    deliveryPlan: {
      mode: 'progressive',
      slices: [{ sliceId, orderedIds: [deliveryId] }]
    }
  }
}

const publication = createPublication()

const createTwoRecordPublication = (
  sourceLength = 2_048
): SharedPublication => {
  const artifactId = '4:artifact'
  const batchId = '4:batch:multi'
  const sliceId = '4:slice:multi'
  const payloads = [
    { id: 'element-multi-a', source: 'a'.repeat(sourceLength) },
    { id: 'element-multi-b', source: 'b'.repeat(sourceLength) }
  ]
  const records = payloads.map((payload, index) => {
    const deliveryId = `4:delivery:${index}`
    return {
      recordId: `4:record:${index}`,
      deliveryId,
      occurrence: index,
      orderedIds: [payload.id],
      payload,
      inverseEvents: []
    }
  })
  const deliveries = records.map((record, index) => ({
    deliveryId: record.deliveryId,
    artifactId,
    batchId,
    transactionId: 4,
    origin: 'action' as const,
    kind: 'forward' as const,
    channel: 'sceneTree',
    eventName: 'updateComputedData',
    payload: payloads[index] as object,
    recordId: record.recordId,
    record,
    sharedDelivery: 'immediate' as const
  }))
  return {
    publicationId: 'publication-multi',
    artifactId,
    transactionId: 4,
    origin: 'action',
    deliveries,
    batches: [
      {
        batchId,
        sliceId,
        artifactId,
        transactionId: 4,
        origin: 'action',
        kind: 'forward',
        channel: 'sceneTree',
        sharedDelivery: 'immediate',
        deliveries,
        records,
        changes: payloads
      }
    ],
    deliveryPlan: {
      mode: 'progressive',
      slices: [
        {
          sliceId,
          orderedIds: deliveries.map(({ deliveryId }) => deliveryId)
        }
      ]
    }
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
const codecWorkers: TestPublicationCodecWorker[] = []

type TestWorkerEventName = 'error' | 'message' | 'messageerror'
type TestWorkerListener = (event: {
  readonly data?: PublicationCodecWorkerResponse
  readonly error?: unknown
}) => void

class TestPublicationCodecWorker implements PublicationCodecWorkerLike {
  readonly posted: {
    readonly message: PublicationCodecWorkerRequest
    readonly transfer: readonly Transferable[]
  }[] = []
  readonly responseTransfers: Transferable[][] = []
  paused = false
  postObserver?: (message: PublicationCodecWorkerRequest) => void
  terminateCount = 0

  private readonly runtime = new PublicationCodecWorkerRuntime()
  private readonly listeners = new Map<
    TestWorkerEventName,
    Set<TestWorkerListener>
  >()
  private readonly queuedTasks: (() => void)[] = []
  private terminated = false

  postMessage(
    message: PublicationCodecWorkerRequest,
    transfer: readonly Transferable[] = []
  ): void {
    if (this.terminated) throw new Error('worker is terminated')
    this.posted.push({ message, transfer })
    this.postObserver?.(message)
    const workerMessage = structuredClone(message, {
      transfer: [...transfer]
    })
    const run = () => {
      if (this.terminated) return
      this.runtime.handle(workerMessage, (response, responseTransfer = []) => {
        this.responseTransfers.push(responseTransfer)
        const mainResponse = structuredClone(response, {
          transfer: [...responseTransfer]
        })
        this.emit('message', { data: mainResponse })
      })
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
    onSourceFrame
  }: Readonly<{
    autoAdmitSourceFrames?: boolean
    onSourceFrame?: (
      socket: NodeWebSocket,
      header: PublicationFrameHeader
    ) => void
  }> = {}
): Promise<LoopbackServer> => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  const sockets = new Set<NodeWebSocket>()
  server.on('connection', (socket) => {
    const publicationFramesByRequest = new Map<string, ArrayBuffer[]>()
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('message', (data: RawData, isBinary) => {
      const encoded = isBinary ? asBinaryMessage(data) : data.toString()
      if (isBinary && isPublicationFrame(encoded)) {
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
      onMessage(
        socket,
        decodeCollaborationMessage(encoded) as ClientMessage,
        encoded
      )
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
    endpoint: `ws://127.0.0.1:${address.port}/asyra-design-collaboration`,
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

const createProvider = (endpoint: string) =>
  new CollaborationWebSocketProvider({
    endpoint,
    codecWorkerFactory: () => {
      const worker = new TestPublicationCodecWorker()
      codecWorkers.push(worker)
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
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: NodeWebSocket
  })
})

afterEach(async () => {
  await Promise.all([...servers].map((server) => server.close()))
  servers.clear()
  codecWorkers.length = 0
  delete (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: unknown
    }
  ).__asyraBrowserDragPhaseSink
  delete (
    globalThis as typeof globalThis & {
      __asyraDiagnosticCounterSink?: unknown
    }
  ).__asyraDiagnosticCounterSink
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: originalWebSocket
  })
})

describe('CollaborationWebSocketProvider real connection contract', () => {
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
        message: '[collaboration] WebSocket identity hello send failed',
        cause: sendFailure
      })
      expect(provider.getStatus()).toBe('failed')
    } finally {
      send.mockRestore()
      await provider.destroy()
    }
  })

  it('sends one publication and settles only after server response', async () => {
    let sent: SharedPublication | undefined
    const phaseSink = vi.fn()
    const counterSink = vi.fn()
    ;(
      globalThis as typeof globalThis & {
        __asyraBrowserDragPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraBrowserDragPhaseSink = phaseSink
    ;(
      globalThis as typeof globalThis & {
        __asyraDiagnosticCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraDiagnosticCounterSink = counterSink
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        return
      }
      if (message.type !== 'send-publication' || !message.requestId) return
      sent = message.publication
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
    phaseSink.mockClear()
    counterSink.mockClear()

    await provider.sendPublication(publication)

    expect(sent).toEqual(publication)
    const worker = codecWorkers[0]
    expect(worker).toBeDefined()
    const encodePosts = worker?.posted.filter(
      ({ message }) => message.type === 'encode-publications'
    )
    expect(encodePosts).toHaveLength(1)
    expect(encodePosts?.[0]?.transfer).toEqual([])
    expect(
      worker?.responseTransfers.some(
        (transfer) =>
          transfer.length > 0 &&
          transfer.every((value) => value instanceof ArrayBuffer)
      )
    ).toBe(true)
    expect(phaseSink.mock.calls.map(([phaseName]) => phaseName)).toEqual(
      expect.arrayContaining([
        'collaboration:outbound-encode',
        'collaboration:outbound-wire-send',
        'collaboration:outbound-send-to-ack',
        'collaboration:inbound-receive-to-dispatch',
        'collaboration:inbound-wire-decode'
      ])
    )
    expect(counterSink).toHaveBeenCalledWith(
      'collaboration:inbound-frame-byte-length',
      expect.any(Number)
    )
    const frameEntryCallOrder = counterSink.mock.invocationCallOrder[0]
    const decodeCallIndex = phaseSink.mock.calls.findIndex(
      ([phaseName]) => phaseName === 'collaboration:inbound-wire-decode'
    )
    expect(frameEntryCallOrder).toBeDefined()
    expect(decodeCallIndex).toBeGreaterThanOrEqual(0)
    expect(frameEntryCallOrder).toBeLessThan(
      phaseSink.mock.invocationCallOrder[decodeCallIndex] as number
    )
    expect(
      phaseSink.mock.calls.every(
        ([, durationMs]) =>
          typeof durationMs === 'number' &&
          Number.isFinite(durationMs) &&
          durationMs >= 0
      )
    ).toBe(true)
    await provider.destroy()
  })

  it('keeps one outbound publication frame in flight until exact source admission credit', async () => {
    const headers: PublicationFrameHeader[] = []
    let sourceSocket: NodeWebSocket | undefined
    let completedRequestId: string | undefined
    const server = await createLoopbackServer(
      (socket, message) => {
        if (message.type === 'hello') {
          socket.send(JSON.stringify({ type: 'ready' }))
          return
        }
        if (message.type !== 'send-publication' || !message.requestId) return
        sourceSocket = socket
        completedRequestId = message.requestId
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
    const sending = provider.sendPublication(
      createTwoRecordPublication(700_000)
    )
    let settled = false
    void sending.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      }
    )

    await vi.waitFor(() => expect(headers).toHaveLength(1))
    const frameCount = headers[0]?.chunkCount ?? 0
    expect(frameCount).toBeGreaterThan(1)
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(headers).toHaveLength(1)

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
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(settled).toBe(false)
    await vi.waitFor(() =>
      expect(completedRequestId).toBe(headers[0]?.requestId)
    )
    sourceSocket?.send(
      JSON.stringify({
        type: 'response',
        requestId: completedRequestId,
        ok: true
      })
    )
    await sending
    await provider.destroy()
  })

  it('rejects an inexact source frame admission credit and clears pending transport work', async () => {
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
    await provider.connect()
    const sending = provider
      .sendPublication(createTwoRecordPublication(700_000))
      .catch((error: unknown) => error)
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

    expect(await sending).toMatchObject({
      code: 'acknowledgement-failed',
      message: '[collaboration] source frame admission credit does not match'
    })
    expect(provider.getStatus()).toBe('failed')
    await provider.destroy()
  })

  it('rejects a successful response received before source frame admission', async () => {
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
    await provider.connect()

    await expect(
      provider.sendPublication(createTwoRecordPublication(700_000))
    ).rejects.toMatchObject({
      code: 'acknowledgement-failed',
      message:
        '[collaboration] publication response arrived before source frame admission'
    })
    expect(headers).toHaveLength(1)
    expect(provider.getStatus()).toBe('failed')
    await provider.destroy()
  })

  it('clears active and queued publication frames when disconnected', async () => {
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
    const firstOutcome = provider
      .sendPublication(createTwoRecordPublication(700_000))
      .catch((error: unknown) => error)
    const secondOutcome = provider
      .sendPublication(createTwoRecordPublication(700_000))
      .catch((error: unknown) => error)

    await vi.waitFor(() => expect(headers).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(headers).toHaveLength(1)
    await provider.disconnect()

    expect(await firstOutcome).toMatchObject({ code: 'not-connected' })
    expect(await secondOutcome).toMatchObject({ code: 'not-connected' })
    expect(headers).toHaveLength(1)
    await provider.destroy()
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
      createTwoRecordPublication(700_000)
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
        ok: true
      })
    )
    await publicationSending
    await provider.destroy()
  })

  it('sends peer-applied as a JSON control and waits for its server response', async () => {
    let receipt: ClientMessage | undefined
    let acknowledgeReceipt: (() => void) | undefined
    const server = await createLoopbackServer((socket, message, encoded) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        return
      }
      if (message.type !== 'peer-applied') return
      expect(typeof encoded).toBe('string')
      receipt = message
      acknowledgeReceipt = () =>
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
    let settled = false
    const sending = provider
      .sendPeerApplied('publication-a', 'actor-source')
      .then(() => {
        settled = true
      })

    await vi.waitFor(() => expect(receipt).toBeDefined())
    expect(receipt).toMatchObject({
      type: 'peer-applied',
      publicationId: 'publication-a',
      fromActorId: 'actor-source'
    })
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(settled).toBe(false)
    acknowledgeReceipt?.()
    await sending
    await provider.destroy()
  })

  it('captures inbound frame entry before optional string byte profiling', async () => {
    let sendInbound: (() => void) | undefined
    const counterSink = vi.fn()
    ;(
      globalThis as typeof globalThis & {
        __asyraDiagnosticCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraDiagnosticCounterSink = counterSink
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
    const encode = vi.spyOn(TextEncoder.prototype, 'encode')

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
      expect(encode).toHaveBeenCalledOnce()
      expect(
        counterSink.mock.invocationCallOrder[frameEntryCallIndex]
      ).toBeLessThan(encode.mock.invocationCallOrder[0] as number)
    } finally {
      encode.mockRestore()
      await provider.destroy()
    }
  })

  it('does not scan inbound string bytes when diagnostics are disabled', async () => {
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
    const encode = vi.spyOn(TextEncoder.prototype, 'encode')

    try {
      expect(sendInbound).toBeDefined()
      sendInbound?.()
      await vi.waitFor(() => expect(awareness).toHaveBeenCalledOnce())

      expect(encode).not.toHaveBeenCalled()
    } finally {
      encode.mockRestore()
      await provider.destroy()
    }
  })

  it('keeps awareness controls on JSON and bypasses the codec worker', async () => {
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
    const worker = codecWorkers[0]
    if (!worker) throw new Error('Expected a codec worker')

    await provider.sendAwareness({
      actorId: 'actor-a',
      clock: 1,
      state: { cursor: { x: 1, y: 2 } }
    })

    expect(receivedAwareness).toMatchObject({ type: 'send-awareness' })
    expect(worker.posted).toEqual([])
    await provider.destroy()
  })

  it('encodes one ordered publication batch and settles it with one response', async () => {
    let sent: readonly SharedPublication[] | undefined
    let requestCount = 0
    const counterSink = vi.fn()
    ;(
      globalThis as typeof globalThis & {
        __asyraDiagnosticCounterSink?: (
          counterName: string,
          value: number
        ) => void
      }
    ).__asyraDiagnosticCounterSink = counterSink
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        return
      }
      if (message.type !== 'send-publications' || !message.requestId) return
      requestCount += 1
      sent = message.publications
      socket.send(
        JSON.stringify({
          type: 'response',
          requestId: message.requestId,
          ok: true
        })
      )
    })
    const provider = createProvider(server.endpoint) as ReturnType<
      typeof createProvider
    > & {
      sendPublications(
        publications: readonly SharedPublication[]
      ): Promise<void>
    }
    const secondPublication = createPublication({
      suffix: 'b',
      transactionId: 2
    })
    await provider.connect()

    expect(provider.maxConcurrentPublicationSends).toBe(1)
    expect(provider.maxPublicationsPerSend).toBe(4)
    await provider.sendPublications([publication, secondPublication])

    expect(requestCount).toBe(1)
    expect(sent).toEqual([publication, secondPublication])
    expect(counterSink).toHaveBeenCalledWith(
      'collaboration:outbound-batch-request-count',
      1
    )
    expect(counterSink).toHaveBeenCalledWith(
      'collaboration:outbound-batch-publication-count',
      2
    )
    expect(counterSink).toHaveBeenCalledWith(
      'collaboration:outbound-encoded-byte-length',
      expect.any(Number)
    )
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
          ok: true
        })
      )
    })
    const provider = createProvider(server.endpoint)
    await provider.connect()

    await provider.sendPublication(largePublication)

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
    const inbound = vi.fn()
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

    expect(inbound).toHaveBeenCalledWith({
      publication: largePublication,
      fromActorId: 'actor-b'
    })
    const worker = codecWorkers[0]
    const decodePosts = worker?.posted.filter(
      ({ message }) => message.type === 'decode-publication-frame'
    )
    expect(decodePosts).toHaveLength(1)
    expect(decodePosts?.[0]?.transfer).toHaveLength(1)
    expect(Object.prototype.toString.call(decodePosts?.[0]?.transfer[0])).toBe(
      '[object ArrayBuffer]'
    )
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
    const inboundPublication = createTwoRecordPublication()
    const inboundFrames = encodePublicationMessageFrames(
      {
        type: 'publication',
        publication: inboundPublication,
        fromActorId: 'actor-b'
      },
      { softTargetBytes: 256 }
    )
    expect(inboundFrames.length).toBeGreaterThan(1)
    let sendInbound: (() => void) | undefined
    const phaseSink = vi.fn()
    ;(
      globalThis as typeof globalThis & {
        __asyraBrowserDragPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraBrowserDragPhaseSink = phaseSink
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
          ok: true
        })
      )
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn()
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
    } finally {
      send.mockRestore()
      await provider.destroy()
    }
  })

  it('releases ordered inbound publications one at a time while preserving subscribers', async () => {
    const secondPublication = createPublication({
      suffix: 'b',
      transactionId: 2
    })
    let sendInbound: (() => void) | undefined
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      sendInbound = () =>
        sendPublicationFrames(socket, {
          type: 'publications',
          publications: [publication, secondPublication],
          fromActorId: 'actor-b'
        })
    })
    const provider = createProvider(server.endpoint) as ReturnType<
      typeof createProvider
    > & {
      onPublications(
        subscriber: (
          publications: readonly {
            publication: SharedPublication
            fromActorId?: string
          }[]
        ) => void
      ): () => void
    }
    const batchInbound = vi.fn()
    const singleInbound = vi.fn()
    const timeline: string[] = []
    provider.onPublications(batchInbound)
    provider.onPublication(singleInbound)

    await provider.connect()
    const worker = codecWorkers[0]
    if (!worker) throw new Error('Expected a codec worker')
    worker.postObserver = (message) => {
      if (message.type !== 'decode-publication-frame') return
      timeline.push(
        `worker:${inspectPublicationFrameHeader(message.frame).publicationIndex}`
      )
    }
    batchInbound.mockImplementation(
      (inbound: readonly { publication: SharedPublication }[]) =>
        timeline.push(`batch:${inbound[0]?.publication.publicationId}`)
    )
    sendInbound?.()
    await vi.waitFor(() => expect(batchInbound).toHaveBeenCalledTimes(2))

    expect(batchInbound.mock.calls.map(([value]) => value)).toEqual([
      [{ publication, fromActorId: 'actor-b' }],
      [{ publication: secondPublication, fromActorId: 'actor-b' }]
    ])
    expect(singleInbound.mock.calls.map(([value]) => value)).toEqual([
      { publication, fromActorId: 'actor-b' },
      { publication: secondPublication, fromActorId: 'actor-b' }
    ])
    expect(timeline).toEqual([
      'worker:0',
      'batch:publication-a',
      'worker:1',
      'batch:publication-b'
    ])
    await provider.destroy()
  })

  it('assembles interleaved multi-chunk publications and releases them in first-seen order', async () => {
    const firstPublication = createTwoRecordPublication()
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
    ;(
      globalThis as typeof globalThis & {
        __asyraBrowserDragPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraBrowserDragPhaseSink = phaseSink
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
      if (message.type === 'frame-consumed') {
        consumedFrameIds.push(message.frameId)
      }
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn()
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)
    await provider.connect()

    try {
      sendInterleaved?.()
      await vi.waitFor(() => expect(inbound).toHaveBeenCalledTimes(2))

      expect(failures).not.toHaveBeenCalled()
      expect(inbound.mock.calls.map(([value]) => value)).toEqual([
        { publication: firstPublication, fromActorId: 'actor-b' },
        { publication: secondPublication, fromActorId: 'actor-c' }
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
        codecWorkers[0]?.posted.some(
          ({ message }) => message.type === 'release-decoded-publication'
        )
      ).toBe(true)
      expect(
        phaseSink.mock.calls.filter(
          ([phaseName]) => phaseName === 'collaboration:codec-worker-decode'
        )
      ).toHaveLength(firstFrames.length + secondFrames.length)
    } finally {
      await provider.destroy()
    }
  })

  it('isolates batch and single inbound subscribers from observer mutation', async () => {
    const secondPublication = createPublication({
      suffix: 'b',
      transactionId: 2
    })
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      sendPublicationFrames(socket, {
        type: 'publications',
        publications: [publication, secondPublication],
        fromActorId: 'actor-b'
      })
    })
    const provider = createProvider(server.endpoint)
    const laterBatchInbound = vi.fn()
    const singleInbound = vi.fn()
    provider.onPublications((inbound) => {
      const payload = inbound[0]?.publication.deliveries[0]?.payload as {
        value: number
      }
      payload.value = 999
    })
    provider.onPublications(laterBatchInbound)
    provider.onPublication((inbound) => {
      const payload = inbound.publication.deliveries[0]?.payload as {
        value: number
      }
      payload.value = 555
    })
    provider.onPublication(singleInbound)

    await provider.connect()
    await vi.waitFor(() => expect(laterBatchInbound).toHaveBeenCalledTimes(2))

    expect(
      (
        laterBatchInbound.mock.calls[0]?.[0][0].publication.deliveries[0]
          ?.payload as { value: number }
      ).value
    ).toBe(1)
    expect(
      (
        singleInbound.mock.calls[0]?.[0].publication.deliveries[0]?.payload as {
          value: number
        }
      ).value
    ).toBe(1)
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
    const inbound = vi.fn()
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

  it('receives one detached live publication with sender context', async () => {
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
    const inbound = vi.fn()
    provider.onPublication(inbound)

    await provider.connect()
    await vi.waitFor(() => expect(inbound).toHaveBeenCalledOnce())

    expect(inbound).toHaveBeenCalledWith({
      publication,
      fromActorId: 'actor-b'
    })
    expect(inbound.mock.calls[0]?.[0].publication).not.toBe(publication)
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
    const inbound = vi.fn()
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
    const server = await createLoopbackServer((socket, message) => {
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
    const inbound = vi.fn()
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
    expect(provider.getStatus()).toBe('failed')
    await provider.destroy()
  })

  it('maps a truncated binary publication frame to one ProviderFailure without delivery', async () => {
    let sendTruncatedFrame: (() => void) | undefined
    const server = await createLoopbackServer((socket, message) => {
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
    const inbound = vi.fn()
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
    expect(provider.getStatus()).toBe('failed')
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
    const inbound = vi.fn()
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)
    await provider.connect()
    const worker = codecWorkers[0]
    if (!worker) throw new Error('Expected a codec worker')
    worker.paused = true
    const send = vi.spyOn(NodeWebSocket.prototype, 'send')

    try {
      sendInbound?.()
      await vi.waitFor(() =>
        expect(
          worker.posted.some(
            ({ message }) => message.type === 'decode-publication-frame'
          )
        ).toBe(true)
      )

      worker.emitError(new Error('inbound codec failed'))
      await vi.waitFor(() => expect(failures).toHaveBeenCalledOnce())
      await provider.destroy()
      worker.flush()
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
          message: '[collaboration] publication codec worker failed'
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
    expect(codecWorkers).toEqual([])

    await provider.connect()
    const worker = codecWorkers[0]
    if (!worker) throw new Error('Expected a codec worker')
    worker.paused = true
    const sendingOutcome = provider
      .sendPublication(publication)
      .catch((error: unknown) => error)
    await vi.waitFor(() =>
      expect(
        worker.posted.some(
          ({ message }) => message.type === 'encode-publications'
        )
      ).toBe(true)
    )

    await provider.destroy()

    expect(await sendingOutcome).toMatchObject({ code: 'disposed' })
    expect(worker.terminateCount).toBe(1)
    worker.flush()
  })

  it('rejects a pending publication when its socket disconnects', async () => {
    let requestReceived: (() => void) | undefined
    const request = new Promise<void>((resolve) => {
      requestReceived = resolve
    })
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
      } else if (message.type === 'send-publication') {
        requestReceived?.()
      }
    })
    const provider = createProvider(server.endpoint)
    await provider.connect()
    const sendingOutcome = provider
      .sendPublication(publication)
      .catch((error: unknown) => error)
    await request

    await provider.disconnect()

    expect(await sendingOutcome).toMatchObject({ code: 'not-connected' })
    await provider.destroy()
  })

  it('preserves the server close code and reason for a rejected pending publication', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
      } else if (message.type === 'send-publication') {
        socket.close(1008, 'canonical publication rejected')
      }
    })
    const provider = createProvider(server.endpoint)
    await provider.connect()

    await expect(provider.sendPublication(publication)).rejects.toMatchObject({
      code: 'not-connected',
      message:
        '[collaboration] WebSocket connection closed (1008: canonical publication rejected)'
    })
    await provider.destroy()
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
