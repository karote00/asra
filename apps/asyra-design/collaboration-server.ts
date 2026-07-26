import console from 'node:console'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createServer as createHttpServer } from 'node:http'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
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
  decodeCollaborationMessage,
  encodeCollaborationMessage,
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
const collaborationProfilingEnabled =
  process.env.ASYRA_DESIGN_COLLABORATION_PROFILE === '1'

interface CollaborationServerRequestProfile {
  readonly receivedAtMs: number
  readonly queuedAtMs: number
  readonly frameBytes: number
  readonly wireDecodeMs: number
  readonly protocolValidateMs: number
  readonly type: 'send-publication' | 'send-publications'
  readonly publicationCount: number
  queueWaitMs: number
  providerMs: number
  peerEncodeMs: number
  peerSendMs: number
  cloneMs: number
}

interface SendTiming {
  readonly encodeMs: number
  readonly sendMs: number
}

const requestProfileContext =
  new AsyncLocalStorage<CollaborationServerRequestProfile>()

if (collaborationProfilingEnabled) {
  ;(
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink = (_phaseName, durationMs) => {
    const requestProfile = requestProfileContext.getStore()
    if (requestProfile) {
      requestProfile.cloneMs += durationMs
    }
  }
}

const elapsed = (startedAtMs: number): number => performance.now() - startedAtMs

const rounded = (value: number): number => Math.round(value * 1_000) / 1_000

const safeSend = (
  socket: WebSocket,
  message: CollaborationServerMessage
): SendTiming => {
  if (socket.readyState !== WebSocket.OPEN) {
    return { encodeMs: 0, sendMs: 0 }
  }
  const encodeStartedAtMs = performance.now()
  const encoded = encodeCollaborationMessage(message)
  const encodeMs = elapsed(encodeStartedAtMs)
  const sendStartedAtMs = performance.now()
  socket.send(encoded, { binary: typeof encoded !== 'string' })
  const sendMs = elapsed(sendStartedAtMs)
  if (
    requestProfileContext.getStore() &&
    (message.type === CollaborationMessageTypes.PUBLICATION ||
      message.type === CollaborationMessageTypes.PUBLICATIONS)
  ) {
    const requestProfile = requestProfileContext.getStore()
    if (requestProfile) {
      requestProfile.peerEncodeMs += encodeMs
      requestProfile.peerSendMs += sendMs
    }
  }
  return { encodeMs, sendMs }
}

const failureMessage = (error: unknown): CollaborationFailurePayload => ({
  code: error instanceof ProviderFailure ? error.code : 'transport-failed',
  message:
    error instanceof Error
      ? error.message
      : '[collaboration] reference server request failed'
})

const rawDataToBytes = (data: RawData): Uint8Array => {
  if (Array.isArray(data)) {
    const byteLength = data.reduce(
      (total, chunk) => total + chunk.byteLength,
      0
    )
    const output = new Uint8Array(byteLength)
    let offset = 0
    data.forEach((chunk) => {
      output.set(
        new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
        offset
      )
      offset += chunk.byteLength
    })
    return output
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

const hub = new MemoryHub()
const activeActors = new Map<string, symbol>()

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
const webSocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: 0
})

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
  let actorReservation:
    | Readonly<{ actorKey: string; connectionToken: symbol }>
    | undefined
  let queue: Promise<void> = Promise.resolve()
  let ready = false

  const helloTimeout = setTimeout(() => {
    if (!ready) socket.close(1008, 'hello timeout')
  }, 5_000)

  const releaseActorReservation = (): void => {
    if (!actorReservation) return
    const { actorKey, connectionToken } = actorReservation
    if (activeActors.get(actorKey) === connectionToken) {
      activeActors.delete(actorKey)
    }
    actorReservation = undefined
  }

  const cleanup = async (): Promise<void> => {
    clearTimeout(helloTimeout)
    releaseActorReservation()
    if (provider) await provider.destroy().catch(() => undefined)
  }

  const sendResponse = (requestId: string): SendTiming =>
    safeSend(socket, {
      type: CollaborationMessageTypes.RESPONSE,
      requestId,
      ok: true
    })
  const sendResponseError = (requestId: string, error: unknown): void => {
    safeSend(socket, {
      type: CollaborationMessageTypes.RESPONSE,
      requestId,
      ok: false,
      error: failureMessage(error)
    })
  }
  const emitRequestProfile = (
    requestProfile: CollaborationServerRequestProfile,
    acknowledgements: readonly SendTiming[]
  ): void => {
    console.log(
      `AI_COLLABORATION_SERVER_PROFILE ${JSON.stringify({
        type: requestProfile.type,
        publicationCount: requestProfile.publicationCount,
        frameBytes: requestProfile.frameBytes,
        queueWaitMs: rounded(requestProfile.queueWaitMs),
        wireDecodeMs: rounded(requestProfile.wireDecodeMs),
        protocolValidateMs: rounded(requestProfile.protocolValidateMs),
        providerMs: rounded(requestProfile.providerMs),
        cloneMs: rounded(requestProfile.cloneMs),
        peerEncodeMs: rounded(requestProfile.peerEncodeMs),
        peerSendMs: rounded(requestProfile.peerSendMs),
        ackEncodeMs: rounded(
          acknowledgements.reduce((total, item) => total + item.encodeMs, 0)
        ),
        ackSendMs: rounded(
          acknowledgements.reduce((total, item) => total + item.sendMs, 0)
        ),
        totalMs: rounded(elapsed(requestProfile.receivedAtMs))
      })}`
    )
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

    const actorKey = JSON.stringify([fileId, identity.actorId])
    if (activeActors.has(actorKey)) {
      throw new ProviderFailure(
        'connection-rejected',
        '[collaboration] actor is already connected to this room'
      )
    }
    const connectionToken = Symbol('asyra-design-collaboration-connection')
    activeActors.set(actorKey, connectionToken)
    actorReservation = { actorKey, connectionToken }

    provider = new MemoryProvider(hub, {
      documentId: fileId,
      roomId: fileId,
      actorId: identity.actorId,
      connectionMetadata: { ...connectionMetadata }
    })
    provider.onPublications((inbound) => {
      const firstInbound = inbound[0]
      if (!firstInbound) return
      const fromActorId = firstInbound.fromActorId
      if (inbound.length === 1) {
        safeSend(socket, {
          type: CollaborationMessageTypes.PUBLICATION,
          publication: firstInbound.publication,
          ...(fromActorId ? { fromActorId } : {})
        })
        return
      }
      safeSend(socket, {
        type: CollaborationMessageTypes.PUBLICATIONS,
        publications: inbound.map(({ publication }) => publication),
        ...(fromActorId ? { fromActorId } : {})
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
        ...(failure.publicationId
          ? { publicationId: failure.publicationId }
          : {})
      })
    })

    await provider.connect()
    ready = true
    clearTimeout(helloTimeout)
    safeSend(socket, { type: CollaborationMessageTypes.READY })
  }

  const handleRequest = async (
    message: CollaborationRequestMessage,
    requestProfile?: CollaborationServerRequestProfile
  ): Promise<void> => {
    if (!provider || !ready) {
      throw new ProviderFailure(
        'not-connected',
        '[collaboration] provider handshake is incomplete'
      )
    }
    const connectedProvider = provider
    const requestId = message.requestId
    try {
      const providerStartedAtMs = performance.now()
      const sendToProvider = async (): Promise<void> => {
        switch (message.type) {
          case CollaborationMessageTypes.SEND_PUBLICATION:
            await connectedProvider.sendPublication(message.publication)
            break
          case CollaborationMessageTypes.SEND_PUBLICATIONS:
            await connectedProvider.sendPublications(message.publications)
            break
          case CollaborationMessageTypes.SEND_AWARENESS:
            await connectedProvider.sendAwareness(message.message)
            break
        }
      }
      if (requestProfile) {
        await requestProfileContext.run(requestProfile, sendToProvider)
      } else {
        await sendToProvider()
      }
      if (requestProfile) {
        requestProfile.providerMs = elapsed(providerStartedAtMs)
      }
      const acknowledgement = sendResponse(requestId)
      if (requestProfile) {
        emitRequestProfile(requestProfile, [acknowledgement])
      }
    } catch (error) {
      sendResponseError(requestId, error)
    }
  }

  socket.on('message', (data, isBinary) => {
    const receivedAtMs = performance.now()
    const rawBytes = rawDataToBytes(data)
    const encoded = isBinary
      ? rawBytes
      : Buffer.from(
          rawBytes.buffer,
          rawBytes.byteOffset,
          rawBytes.byteLength
        ).toString('utf8')
    let message
    let wireDecodeMs = 0
    let protocolValidateMs = 0
    try {
      const wireDecodeStartedAtMs = performance.now()
      const decoded = decodeCollaborationMessage(encoded)
      wireDecodeMs = elapsed(wireDecodeStartedAtMs)
      const protocolValidateStartedAtMs = performance.now()
      message = parseCollaborationClientMessage(decoded)
      protocolValidateMs = elapsed(protocolValidateStartedAtMs)
      if (!message) {
        socket.close(1008, 'invalid protocol message')
        return
      }
    } catch {
      socket.close(1007, 'invalid wire message')
      return
    }
    const queuedAtMs = performance.now()
    const requestProfile: CollaborationServerRequestProfile | undefined =
      collaborationProfilingEnabled &&
      (message.type === CollaborationMessageTypes.SEND_PUBLICATION ||
        message.type === CollaborationMessageTypes.SEND_PUBLICATIONS)
        ? {
            receivedAtMs,
            queuedAtMs,
            frameBytes: rawBytes.byteLength,
            wireDecodeMs,
            protocolValidateMs,
            type: message.type,
            publicationCount:
              message.type === CollaborationMessageTypes.SEND_PUBLICATIONS
                ? message.publications.length
                : 1,
            queueWaitMs: 0,
            providerMs: 0,
            peerEncodeMs: 0,
            peerSendMs: 0,
            cloneMs: 0
          }
        : undefined
    queue = queue
      .then(async () => {
        if (requestProfile) {
          requestProfile.queueWaitMs = elapsed(requestProfile.queuedAtMs)
        }
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
        await handleRequest(message, requestProfile)
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
