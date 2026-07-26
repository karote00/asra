import type { SharedPublication } from '@asyra/factory'
import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket as NodeWebSocket, WebSocketServer, type RawData } from 'ws'
import {
  decodeCollaborationMessage,
  encodeCollaborationMessage
} from '../../collaboration/protocol'
import { CollaborationWebSocketProvider } from '../../collaboration/websocket-provider'

type ClientMessage = Readonly<{
  type: string
  requestId?: string
  identity?: unknown
  publication?: SharedPublication
  publications?: readonly SharedPublication[]
}>

interface LoopbackServer {
  readonly endpoint: string
  close(): Promise<void>
}

const publication: SharedPublication = {
  publicationId: 'publication-a',
  transactionId: 1,
  origin: 'action',
  deliveries: [
    {
      deliveryId: 'delivery-a',
      transactionId: 1,
      origin: 'action',
      kind: 'forward',
      channel: 'sceneTree',
      eventName: 'updateComputedData',
      payload: { value: 1 },
      sharedDelivery: 'immediate'
    }
  ]
}

const publicationDelivery = (): SharedPublication['deliveries'][number] => {
  const delivery = publication.deliveries[0]
  if (!delivery) throw new Error('Fixture publication delivery is unavailable')
  return delivery
}

const createLargePublication = (): SharedPublication => {
  const pointIds = Array.from(
    { length: 1024 },
    (_, index) => `vector-point-${String(index).padStart(6, '0')}`
  )
  return {
    ...publication,
    publicationId: 'publication-large',
    deliveries: [
      {
        ...publicationDelivery(),
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
        }
      }
    ]
  }
}

const servers = new Set<LoopbackServer>()
const originalWebSocket = globalThis.WebSocket

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
  ) => void
): Promise<LoopbackServer> => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  const sockets = new Set<NodeWebSocket>()
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('message', (data: RawData, isBinary) => {
      const encoded = isBinary ? asBinaryMessage(data) : data.toString()
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

const createProvider = (endpoint: string) =>
  new CollaborationWebSocketProvider({
    endpoint,
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

    await provider.sendPublication(publication)

    expect(sent).toEqual(publication)
    expect(phaseSink.mock.calls.map(([phaseName]) => phaseName)).toEqual(
      expect.arrayContaining([
        'collaboration:outbound-encode',
        'collaboration:outbound-wire-send',
        'collaboration:outbound-send-to-ack',
        'collaboration:inbound-receive-to-dispatch',
        'collaboration:inbound-wire-decode'
      ])
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
    const secondPublication: SharedPublication = {
      ...publication,
      publicationId: 'publication-b'
    }
    await provider.connect()

    expect(provider.maxConcurrentPublicationSends).toBe(16)
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
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      socket.send(
        encodeCollaborationMessage({
          type: 'publication',
          publication: largePublication,
          fromActorId: 'actor-b'
        })
      )
    })
    const provider = createProvider(server.endpoint)
    const inbound = vi.fn()
    const failures = vi.fn()
    provider.onPublication(inbound)
    provider.onFailure(failures)

    await provider.connect()
    await vi.waitFor(() => {
      expect(failures.mock.calls).toEqual([])
      expect(inbound).toHaveBeenCalledOnce()
    })

    expect(inbound).toHaveBeenCalledWith({
      publication: largePublication,
      fromActorId: 'actor-b'
    })
    await provider.destroy()
  })

  it('emits one ordered inbound publication batch while preserving single subscribers', async () => {
    const secondPublication: SharedPublication = {
      ...publication,
      publicationId: 'publication-b'
    }
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      socket.send(
        JSON.stringify({
          type: 'publications',
          publications: [publication, secondPublication],
          fromActorId: 'actor-b'
        })
      )
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
    provider.onPublications(batchInbound)
    provider.onPublication(singleInbound)

    await provider.connect()
    await vi.waitFor(() => expect(batchInbound).toHaveBeenCalledOnce())

    expect(batchInbound).toHaveBeenCalledWith([
      { publication, fromActorId: 'actor-b' },
      { publication: secondPublication, fromActorId: 'actor-b' }
    ])
    expect(singleInbound.mock.calls.map(([value]) => value)).toEqual([
      { publication, fromActorId: 'actor-b' },
      { publication: secondPublication, fromActorId: 'actor-b' }
    ])
    await provider.destroy()
  })

  it('isolates batch and single inbound subscribers from observer mutation', async () => {
    const secondPublication: SharedPublication = {
      ...publication,
      publicationId: 'publication-b'
    }
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      socket.send(
        JSON.stringify({
          type: 'publications',
          publications: [publication, secondPublication],
          fromActorId: 'actor-b'
        })
      )
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
    await vi.waitFor(() => expect(laterBatchInbound).toHaveBeenCalledOnce())

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
      const unsafePublication: SharedPublication = {
        ...publication,
        deliveries: [
          {
            ...publication.deliveries[0],
            payload: { value }
          }
        ]
      }
      await expect(
        provider.sendPublication(unsafePublication)
      ).rejects.toMatchObject({ code: 'transport-failed' })
    }
    expect(publicationRequestCount).toBe(0)
    await provider.destroy()
  })

  it('receives one detached live publication with sender context', async () => {
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
