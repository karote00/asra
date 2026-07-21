import { Buffer } from 'node:buffer'
import console from 'node:console'
import { createServer as createHttpServer } from 'node:http'
import { resolve } from 'node:path'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { WebSocket, WebSocketServer } from 'ws'
import {
  MemoryHub,
  MemoryProvider,
  ProviderFailure
} from '@asyra/collaboration'
import {
  loadAsyraDesignEnvironment,
  resolveAsyraDesignEnvironment
} from './app-environment.mjs'
import {
  CollaborationMessageTypes,
  parseCollaborationClientMessage,
  type CollaborationFailurePayload,
  type CollaborationHelloMessage,
  type CollaborationRequestMessage,
  type CollaborationServerMessage
} from './src/collaboration/protocol'
import { isNonBlankString } from './src/collaboration/wire-values'

const appEnvironment = resolveAsyraDesignEnvironment(
  loadAsyraDesignEnvironment(process.env, resolve(process.cwd(), '.env'))
)

const host = appEnvironment.collaborationWebSocketHost
const port = appEnvironment.collaborationWebSocketPort
const socketPath = '/asyra-design-collaboration'
const allowedOrigin = appEnvironment.appURL

const encodeBytes = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64')
const decodeBytes = (value: string): Uint8Array =>
  new Uint8Array(Buffer.from(value, 'base64'))

const safeSend = (
  socket: WebSocket,
  message: CollaborationServerMessage
): void => {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(message))
}

const failureMessage = (error: unknown): CollaborationFailurePayload => ({
  code: error instanceof ProviderFailure ? error.code : 'transport-failed',
  message:
    error instanceof Error
      ? error.message
      : '[collaboration] reference server request failed'
})

const hub = new MemoryHub()
const activeActors = new Set<string>()

const httpServer = createHttpServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({
        ok: true,
        transport: 'local-websocket',
        durable: false,
        access: 'public-reference',
        connectionParameter: 'fileId'
      })
    )
    return
  }
  response.writeHead(404)
  response.end()
})
const webSocketServer = new WebSocketServer({ noServer: true })

httpServer.on('upgrade', (request, socket, head) => {
  const requestURL = new URL(request.url ?? '/', `http://${host}:${port}`)
  if (requestURL.pathname !== socketPath) {
    socket.destroy()
    return
  }
  if (request.headers.origin !== allowedOrigin) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    socket.destroy()
    return
  }
  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit('connection', webSocket, request)
  })
})

webSocketServer.on('connection', (socket) => {
  let provider: MemoryProvider | undefined
  let actorKey: string | undefined
  let queue: Promise<void> = Promise.resolve()
  let ready = false

  const helloTimeout = setTimeout(() => {
    if (!ready) socket.close(1008, 'hello timeout')
  }, 5_000)

  const cleanup = async (): Promise<void> => {
    clearTimeout(helloTimeout)
    if (actorKey) activeActors.delete(actorKey)
    if (provider) await provider.destroy().catch(() => undefined)
  }

  const sendResponse = (requestId: string, result?: unknown): void => {
    safeSend(socket, {
      type: CollaborationMessageTypes.RESPONSE,
      requestId,
      ok: true,
      ...(result === undefined ? {} : { result })
    })
  }
  const sendResponseError = (requestId: string, error: unknown): void => {
    safeSend(socket, {
      type: CollaborationMessageTypes.RESPONSE,
      requestId,
      ok: false,
      error: failureMessage(error)
    })
  }

  const handleHello = async (
    message: CollaborationHelloMessage
  ): Promise<void> => {
    if (ready) {
      throw new ProviderFailure(
        'connection-rejected',
        '[collaboration] valid one-time identity hello is required'
      )
    }
    const identity = message.identity
    const connectionMetadata = identity.connectionMetadata
    if (!connectionMetadata) {
      throw new ProviderFailure(
        'connection-rejected',
        '[collaboration] app-defined fileId and actor identity are required'
      )
    }
    const fileId = connectionMetadata.fileId
    if (!isNonBlankString(fileId)) {
      throw new ProviderFailure(
        'connection-rejected',
        '[collaboration] app-defined fileId and actor identity are required'
      )
    }

    actorKey = JSON.stringify([fileId, identity.actorId])
    if (activeActors.has(actorKey)) {
      throw new ProviderFailure(
        'connection-rejected',
        '[collaboration] actor is already connected to this room'
      )
    }

    provider = new MemoryProvider(hub, {
      documentId: fileId,
      roomId: fileId,
      actorId: identity.actorId,
      connectionMetadata: { ...connectionMetadata }
    })
    provider.onUpdate((update) => {
      safeSend(socket, {
        type: CollaborationMessageTypes.UPDATE,
        operationId: update.operationId,
        update: encodeBytes(update.update),
        ...(update.fromActorId ? { fromActorId: update.fromActorId } : {})
      })
    })
    provider.onAcknowledgement((acknowledgement) => {
      safeSend(socket, {
        type: CollaborationMessageTypes.ACKNOWLEDGEMENT,
        ...acknowledgement
      })
    })
    provider.onAwareness((awareness) => {
      safeSend(socket, {
        type: CollaborationMessageTypes.AWARENESS,
        ...awareness
      })
    })
    provider.onAwarenessDisconnect((event) => {
      safeSend(socket, {
        type: CollaborationMessageTypes.AWARENESS_DISCONNECT,
        ...event
      })
    })
    provider.onFailure((failure) => {
      safeSend(socket, {
        type: CollaborationMessageTypes.FAILURE,
        ...failureMessage(failure),
        ...(failure.operationId ? { operationId: failure.operationId } : {})
      })
    })

    await provider.connect()
    activeActors.add(actorKey)
    ready = true
    clearTimeout(helloTimeout)
    safeSend(socket, { type: CollaborationMessageTypes.READY })
  }

  const handleRequest = async (
    message: CollaborationRequestMessage
  ): Promise<void> => {
    if (!provider || !ready) {
      throw new ProviderFailure(
        'not-connected',
        '[collaboration] provider handshake is incomplete'
      )
    }
    const requestId = message.requestId
    try {
      switch (message.type) {
        case CollaborationMessageTypes.SEND_UPDATE:
          await provider.sendUpdate({
            operationId: message.operationId,
            update: decodeBytes(message.update)
          })
          sendResponse(requestId)
          return
        case CollaborationMessageTypes.REQUEST_SYNC: {
          const update = await provider.requestSync(
            decodeBytes(message.stateVector)
          )
          sendResponse(requestId, { update: encodeBytes(update) })
          return
        }
        case CollaborationMessageTypes.EXCHANGE_STATE_VECTOR: {
          const exchange = await provider.exchangeStateVector(
            decodeBytes(message.stateVector)
          )
          sendResponse(requestId, {
            remoteStateVector: encodeBytes(exchange.remoteStateVector),
            missingRemoteUpdate: encodeBytes(exchange.missingRemoteUpdate)
          })
          return
        }
        case CollaborationMessageTypes.SEND_SYNC_UPDATE:
          await provider.sendSyncUpdate(decodeBytes(message.update))
          sendResponse(requestId)
          return
        case CollaborationMessageTypes.SEND_AWARENESS:
          await provider.sendAwareness(message.message)
          sendResponse(requestId)
          return
      }
    } catch (error) {
      sendResponseError(requestId, error)
    }
  }

  socket.on('message', (data, isBinary) => {
    if (isBinary) {
      socket.close(1003, 'text protocol required')
      return
    }
    let message
    try {
      const decoded: unknown = JSON.parse(data.toString())
      message = parseCollaborationClientMessage(decoded)
      if (!message) {
        socket.close(1008, 'invalid protocol message')
        return
      }
    } catch {
      socket.close(1007, 'invalid JSON')
      return
    }
    queue = queue
      .then(async () => {
        if (!ready) {
          if (message.type !== CollaborationMessageTypes.HELLO) {
            throw new ProviderFailure(
              'connection-rejected',
              '[collaboration] hello must be the first message'
            )
          }
          await handleHello(message)
          return
        }
        if (message.type === CollaborationMessageTypes.HELLO) {
          throw new ProviderFailure(
            'connection-rejected',
            '[collaboration] identity hello can only be sent once'
          )
        }
        await handleRequest(message)
      })
      .catch((error) => {
        safeSend(socket, {
          type: CollaborationMessageTypes.CONNECTION_ERROR,
          ...failureMessage(error)
        })
        socket.close(1008, 'connection rejected')
      })
  })
  socket.once('close', () => void cleanup())
  socket.once('error', () => void cleanup())
})

await new Promise<void>((resolveListen, rejectListen) => {
  httpServer.once('error', rejectListen)
  httpServer.listen(port, host, () => {
    httpServer.off('error', rejectListen)
    resolveListen()
  })
})

console.log(
  `[asyra-design collaboration] ws://${host}:${port}${socketPath} (memory-only)`
)

let closing = false
const close = async (): Promise<void> => {
  if (closing) return
  closing = true
  for (const client of webSocketServer.clients) {
    client.close(1001, 'server shutdown')
  }
  await new Promise<void>((resolveClose, rejectClose) =>
    webSocketServer.close((error) =>
      error ? rejectClose(error) : resolveClose()
    )
  )
  await new Promise<void>((resolveClose, rejectClose) =>
    httpServer.close((error) => (error ? rejectClose(error) : resolveClose()))
  )
}

process.once('SIGINT', () => void close().finally(() => process.exit(0)))
process.once('SIGTERM', () => void close().finally(() => process.exit(0)))
