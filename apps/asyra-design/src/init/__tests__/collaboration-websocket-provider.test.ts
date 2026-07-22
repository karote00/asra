import type { SharedPublication } from '@asyra/factory'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket as NodeWebSocket, WebSocketServer, type RawData } from 'ws'
import { CollaborationWebSocketProvider } from '../../collaboration/websocket-provider'

type ClientMessage = Readonly<{
  type: string
  requestId?: string
  identity?: unknown
  publication?: SharedPublication
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

const servers = new Set<LoopbackServer>()
const originalWebSocket = globalThis.WebSocket

const createLoopbackServer = async (
  onMessage: (socket: NodeWebSocket, message: ClientMessage) => void
): Promise<LoopbackServer> => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  const sockets = new Set<NodeWebSocket>()
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('message', (data: RawData) => {
      onMessage(socket, JSON.parse(data.toString()) as ClientMessage)
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

  it('sends one publication and settles only after server response', async () => {
    let sent: SharedPublication | undefined
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
