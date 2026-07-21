import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket as NodeWebSocket, WebSocketServer, type RawData } from 'ws'
import { CollaborationWebSocketProvider } from '../../collaboration/websocket-provider'

type ClientMessage = Readonly<{
  type: string
  requestId?: string
  identity?: unknown
}>

interface LoopbackServer {
  readonly endpoint: string
  close(): Promise<void>
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

  it('rejects malformed payloads for known server message types', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      socket.send(JSON.stringify({ type: 'ready' }))
      socket.send(
        JSON.stringify({
          type: 'update',
          operationId: 42,
          update: null
        })
      )
    })
    const provider = createProvider(server.endpoint)
    const failures: string[] = []
    const updates: unknown[] = []
    provider.onFailure((failure) => failures.push(failure.code))
    provider.onUpdate((update) => updates.push(update))

    await provider.connect()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(failures).toContain('transport-failed')
    expect(updates).toEqual([])
    await provider.destroy()
  })

  it('rejects a malformed sync response instead of treating it as an empty update', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        return
      }
      if (message.type !== 'request-sync' || !message.requestId) return
      socket.send(
        JSON.stringify({
          type: 'response',
          requestId: message.requestId,
          ok: true,
          result: { update: 42 }
        })
      )
    })
    const provider = createProvider(server.endpoint)
    await provider.connect()

    await expect(provider.requestSync(new Uint8Array())).rejects.toMatchObject({
      code: 'transport-failed'
    })
    await provider.destroy()
  })

  it('rejects a pending request when the server sends an invalid protocol frame', async () => {
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
        return
      }
      if (message.type === 'request-sync') {
        socket.send('{"type":')
      }
    })
    const provider = createProvider(server.endpoint)
    await provider.connect()

    try {
      const outcome = await Promise.race([
        provider.requestSync(new Uint8Array()).catch((error: unknown) => error),
        new Promise<Error>((resolve) =>
          setTimeout(() => resolve(new Error('request remained pending')), 100)
        )
      ])

      expect(outcome).toMatchObject({ code: 'transport-failed' })
    } finally {
      await provider.destroy()
    }
  })

  it('stays disposed when a real server sends ready after teardown begins', async () => {
    let releaseReady: (() => void) | undefined
    let helloReceived: (() => void) | undefined
    const hello = new Promise<void>((resolve) => {
      helloReceived = resolve
    })
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      helloReceived?.()
      releaseReady = () => {
        if (socket.readyState === NodeWebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ready' }))
        }
      }
    })
    const provider = createProvider(server.endpoint)
    const connecting = provider.connect()
    await hello

    await provider.destroy()
    releaseReady?.()

    await expect(connecting).rejects.toMatchObject({ code: 'disposed' })
    expect(provider.getStatus()).toBe('disposed')
  })

  it('keeps an explicit disconnect and reconnects with a new real socket', async () => {
    let connectionCount = 0
    let firstHelloReceived: (() => void) | undefined
    const firstHello = new Promise<void>((resolve) => {
      firstHelloReceived = resolve
    })
    const server = await createLoopbackServer((socket, message) => {
      if (message.type !== 'hello') return
      connectionCount += 1
      if (connectionCount === 1) {
        firstHelloReceived?.()
        return
      }
      socket.send(JSON.stringify({ type: 'ready' }))
    })
    const provider = createProvider(server.endpoint)
    const connecting = provider.connect()
    const connectionOutcome = connecting.catch((error: unknown) => error)
    await firstHello

    await provider.disconnect()
    expect(await connectionOutcome).toMatchObject({ code: 'not-connected' })
    expect(provider.getStatus()).toBe('disconnected')

    await provider.connect()
    expect(connectionCount).toBe(2)
    expect(provider.getStatus()).toBe('connected')
    await provider.destroy()
  })

  it('reports a real WebSocket constructor failure and permits retry', async () => {
    const provider = createProvider('invalid-websocket-protocol://local')

    await expect(provider.connect()).rejects.toMatchObject({
      code: 'connection-failed'
    })
    expect(provider.getStatus()).toBe('failed')
    await expect(provider.connect()).rejects.toMatchObject({
      code: 'connection-failed'
    })
    expect(provider.getStatus()).toBe('failed')
  })

  it('rejects a real pending request when its socket disconnects', async () => {
    let requestReceived: (() => void) | undefined
    const request = new Promise<void>((resolve) => {
      requestReceived = resolve
    })
    const server = await createLoopbackServer((socket, message) => {
      if (message.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ready' }))
      } else if (message.type === 'send-update') {
        requestReceived?.()
      }
    })
    const provider = createProvider(server.endpoint)
    await provider.connect()
    const sendingOutcome = provider
      .sendUpdate({
        operationId: 'pending-update',
        update: new Uint8Array()
      })
      .catch((error: unknown) => error)
    await request

    await provider.disconnect()

    expect(await sendingOutcome).toMatchObject({ code: 'not-connected' })
    await provider.destroy()
  })
})
