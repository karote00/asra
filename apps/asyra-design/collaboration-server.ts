import console from 'node:console'
import { createServer as createHttpServer } from 'node:http'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import { ProviderFailure } from '@asyra/collaboration'
import {
  loadAsyraDesignEnvironment,
  resolveAsyraDesignEnvironment
} from './app-environment.mjs'
import {
  CollaborationMessageTypes,
  decodeCollaborationControlMessage,
  encodeCollaborationControlMessage,
  inspectPublicationFrameHeader,
  parseCollaborationClientMessage,
  type CollaborationFailurePayload,
  type CollaborationHelloMessage,
  type CollaborationServerMessage,
  type FrameConsumedRequest,
  type PeerAppliedRequest,
  type PublicationFrameHeader,
  type SendAwarenessRequest
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

const PEER_QUEUE_CAPACITY_BYTES = 2 * 1024 * 1024
const PUBLICATION_FRAME_FIXED_HEADER_BYTES = 44
const PUBLICATION_FRAME_KIND_OFFSET = 7
const PUBLICATION_FRAME_HEADER_LENGTH_OFFSET = 8
const PUBLICATION_FRAME_PAYLOAD_LENGTH_OFFSET = 12
const PUBLICATION_FRAME_PUBLICATION_INDEX_OFFSET = 16
const PUBLICATION_FRAME_PUBLICATION_COUNT_OFFSET = 20
const PUBLICATION_FRAME_CHUNK_INDEX_OFFSET = 24
const PUBLICATION_FRAME_CHUNK_COUNT_OFFSET = 28
const PUBLICATION_FRAME_REQUEST_ID_LENGTH_OFFSET = 32
const PUBLICATION_FRAME_PUBLICATION_ID_LENGTH_OFFSET = 36
const PUBLICATION_FRAME_ACTOR_ID_LENGTH_OFFSET = 40
const PUBLICATION_FRAME_STRING_UTF8 = 0
const PUBLICATION_FRAME_STRING_UTF16 = 1
const publicationFrameTextEncoder = new TextEncoder()

const rounded = (value: number): number => Math.round(value * 1_000) / 1_000
const elapsed = (startedAtMs: number): number => performance.now() - startedAtMs
const epochNow = (): number => performance.timeOrigin + performance.now()

interface OutboundPublicationFrame {
  readonly bytes: Uint8Array
  readonly header: PublicationFrameHeader
  readonly sourceRequestId: string
  readonly enqueuedAtMs: number
  sendCallbackDone: boolean
  frameConsumed: boolean
}

interface PeerSession {
  readonly socket: WebSocket
  readonly outboundQueue: OutboundPublicationFrame[]
  readonly capacityWaiters: Set<(available: boolean) => void>
  actorId?: string
  fileId?: string
  room?: RoomState
  ready: boolean
  closed: boolean
  queuedBytes: number
}

interface RoomState {
  readonly fileId: string
  readonly peers: Map<string, PeerSession>
  admissionTail: Promise<void>
}

interface InboundPublicationRequest {
  readonly requestId: string
  readonly messageType:
    | typeof CollaborationMessageTypes.SEND_PUBLICATION
    | typeof CollaborationMessageTypes.SEND_PUBLICATIONS
  readonly publicationCount: number
  readonly recipients: readonly PeerSession[]
  readonly receivedAtMs: number
  nextPublicationIndex: number
  nextChunkIndex: number
  currentPublicationId?: string
  currentChunkCount?: number
  frameCount: number
  frameBytes: number
  queueWaitMs: number
}

interface SourceFrameAdmission {
  readonly header: PublicationFrameHeader
  readonly controller: AbortController
}

interface InboundFrameAdmissionResult {
  readonly request: InboundPublicationRequest
  readonly complete: boolean
}

const rooms = new Map<string, RoomState>()

const failureMessage = (error: unknown): CollaborationFailurePayload => ({
  code: error instanceof ProviderFailure ? error.code : 'transport-failed',
  message:
    error instanceof Error
      ? error.message
      : '[collaboration] reference server request failed'
})

const sendControl = (
  socket: WebSocket,
  message: CollaborationServerMessage
): boolean => {
  if (socket.readyState !== WebSocket.OPEN) return false
  socket.send(encodeCollaborationControlMessage(message), {
    binary: false,
    compress: false
  })
  return true
}

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

const isWellFormedFrameString = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (next < 0xdc00 || next > 0xdfff) return false
      index += 1
      continue
    }
    if (code >= 0xdc00 && code <= 0xdfff) return false
  }
  return true
}

const encodeFrameString = (value: string): Uint8Array => {
  if (isWellFormedFrameString(value)) {
    const utf8 = publicationFrameTextEncoder.encode(value)
    const encoded = new Uint8Array(utf8.byteLength + 1)
    encoded[0] = PUBLICATION_FRAME_STRING_UTF8
    encoded.set(utf8, 1)
    return encoded
  }
  const encoded = new Uint8Array(value.length * 2 + 1)
  encoded[0] = PUBLICATION_FRAME_STRING_UTF16
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    encoded[index * 2 + 1] = code & 0xff
    encoded[index * 2 + 2] = code >>> 8
  }
  return encoded
}

const reframePublicationForPeer = (
  source: Uint8Array,
  sourceHeader: PublicationFrameHeader,
  fromActorId: string
): Readonly<{ bytes: Uint8Array; header: PublicationFrameHeader }> => {
  const sourceView = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength
  )
  const sourceHeaderByteLength = sourceView.getUint32(
    PUBLICATION_FRAME_HEADER_LENGTH_OFFSET,
    true
  )
  const requestIdByteLength = sourceView.getUint32(
    PUBLICATION_FRAME_REQUEST_ID_LENGTH_OFFSET,
    true
  )
  const publicationIdByteLength = sourceView.getUint32(
    PUBLICATION_FRAME_PUBLICATION_ID_LENGTH_OFFSET,
    true
  )
  const sourceActorIdByteLength = sourceView.getUint32(
    PUBLICATION_FRAME_ACTOR_ID_LENGTH_OFFSET,
    true
  )
  if (sourceActorIdByteLength !== 0 || sourceHeader.fromActorId !== undefined) {
    throw new ProviderFailure(
      'transport-failed',
      '[collaboration] source publication frame cannot supply fromActorId'
    )
  }
  const publicationIdOffset =
    PUBLICATION_FRAME_FIXED_HEADER_BYTES + requestIdByteLength
  const publicationIdBytes = source.subarray(
    publicationIdOffset,
    publicationIdOffset + publicationIdByteLength
  )
  const actorIdBytes = encodeFrameString(fromActorId)
  const peerHeaderByteLength =
    PUBLICATION_FRAME_FIXED_HEADER_BYTES +
    publicationIdBytes.byteLength +
    actorIdBytes.byteLength
  const payload = source.subarray(sourceHeaderByteLength)
  const peer = new Uint8Array(peerHeaderByteLength + payload.byteLength)
  peer.set(source.subarray(0, 6), 0)
  peer[6] = source[6] ?? 0
  peer[PUBLICATION_FRAME_KIND_OFFSET] =
    sourceHeader.messageType === CollaborationMessageTypes.SEND_PUBLICATION
      ? 3
      : 4
  const peerView = new DataView(peer.buffer)
  peerView.setUint32(
    PUBLICATION_FRAME_HEADER_LENGTH_OFFSET,
    peerHeaderByteLength,
    true
  )
  peerView.setUint32(
    PUBLICATION_FRAME_PAYLOAD_LENGTH_OFFSET,
    payload.byteLength,
    true
  )
  peerView.setUint32(
    PUBLICATION_FRAME_PUBLICATION_INDEX_OFFSET,
    sourceHeader.publicationIndex,
    true
  )
  peerView.setUint32(
    PUBLICATION_FRAME_PUBLICATION_COUNT_OFFSET,
    sourceHeader.publicationCount,
    true
  )
  peerView.setUint32(
    PUBLICATION_FRAME_CHUNK_INDEX_OFFSET,
    sourceHeader.chunkIndex,
    true
  )
  peerView.setUint32(
    PUBLICATION_FRAME_CHUNK_COUNT_OFFSET,
    sourceHeader.chunkCount,
    true
  )
  peerView.setUint32(PUBLICATION_FRAME_REQUEST_ID_LENGTH_OFFSET, 0, true)
  peerView.setUint32(
    PUBLICATION_FRAME_PUBLICATION_ID_LENGTH_OFFSET,
    publicationIdBytes.byteLength,
    true
  )
  peerView.setUint32(
    PUBLICATION_FRAME_ACTOR_ID_LENGTH_OFFSET,
    actorIdBytes.byteLength,
    true
  )
  peer.set(publicationIdBytes, PUBLICATION_FRAME_FIXED_HEADER_BYTES)
  peer.set(
    actorIdBytes,
    PUBLICATION_FRAME_FIXED_HEADER_BYTES + publicationIdBytes.byteLength
  )
  peer.set(payload, peerHeaderByteLength)
  const header = inspectPublicationFrameHeader(peer)
  return { bytes: peer, header }
}

const getOrCreateRoom = (fileId: string): RoomState => {
  const existing = rooms.get(fileId)
  if (existing) return existing
  const room: RoomState = {
    fileId,
    peers: new Map(),
    admissionTail: Promise.resolve()
  }
  rooms.set(fileId, room)
  return room
}

const notifyCapacityWaiters = (peer: PeerSession, available: boolean): void => {
  const waiters = [...peer.capacityWaiters]
  peer.capacityWaiters.clear()
  waiters.forEach((resolveWaiter) => resolveWaiter(available))
}

const canAdmitFrame = (peer: PeerSession, frameByteLength: number): boolean => {
  if (peer.closed) return false
  if (peer.queuedBytes === 0) return true
  return (
    frameByteLength <= PEER_QUEUE_CAPACITY_BYTES &&
    peer.queuedBytes + frameByteLength <= PEER_QUEUE_CAPACITY_BYTES
  )
}

const waitForFrameCapacity = async (
  peer: PeerSession,
  frameByteLength: number,
  signal: AbortSignal
): Promise<boolean> => {
  while (
    !signal.aborted &&
    !peer.closed &&
    !canAdmitFrame(peer, frameByteLength)
  ) {
    const available = await new Promise<boolean>((resolveWaiter) => {
      let settled = false
      const settle = (value: boolean): void => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', abort)
        peer.capacityWaiters.delete(settle)
        resolveWaiter(value)
      }
      const abort = (): void => settle(false)
      peer.capacityWaiters.add(settle)
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) settle(false)
    })
    if (!available) return false
  }
  return !signal.aborted && !peer.closed
}

const removePeer = (peer: PeerSession): void => {
  if (peer.closed) return
  peer.closed = true
  peer.outboundQueue.length = 0
  peer.queuedBytes = 0
  notifyCapacityWaiters(peer, false)
  const room = peer.room
  const actorId = peer.actorId
  if (!room || !actorId || room.peers.get(actorId) !== peer) return
  room.peers.delete(actorId)
  for (const roomPeer of room.peers.values()) {
    sendControl(roomPeer.socket, {
      type: CollaborationMessageTypes.AWARENESS_DISCONNECT,
      actorId,
      reason: 'disconnect'
    })
  }
  if (room.peers.size === 0 && rooms.get(room.fileId) === room) {
    rooms.delete(room.fileId)
  }
}

const retireCompletedOutboundFrames = (peer: PeerSession): void => {
  if (peer.closed) return
  let retired = false
  while (true) {
    const active = peer.outboundQueue[0]
    if (!active?.sendCallbackDone || !active.frameConsumed) break
    peer.outboundQueue.shift()
    peer.queuedBytes -= active.bytes.byteLength
    if (peer.queuedBytes < 0) peer.queuedBytes = 0
    retired = true
    if (collaborationProfilingEnabled) {
      console.log(
        `AI_COLLABORATION_SERVER_PEER_DRAIN ${JSON.stringify({
          requestId: active.sourceRequestId,
          actorId: peer.actorId,
          publicationId: active.header.publicationId,
          frameId: active.header.frameId,
          frameBytes: active.bytes.byteLength,
          queueBytes: peer.queuedBytes,
          drainMs: rounded(elapsed(active.enqueuedAtMs))
        })}`
      )
    }
  }
  if (retired && peer.capacityWaiters.size > 0) {
    notifyCapacityWaiters(peer, true)
  }
}

const failPeerWrite = (
  peer: PeerSession,
  active: OutboundPublicationFrame,
  error: Error
): void => {
  if (collaborationProfilingEnabled) {
    console.log(
      `AI_COLLABORATION_SERVER_PEER_WRITE ${JSON.stringify({
        requestId: active.sourceRequestId,
        actorId: peer.actorId,
        publicationId: active.header.publicationId,
        frameId: active.header.frameId,
        frameBytes: active.bytes.byteLength,
        error: { name: error.name, message: error.message }
      })}`
    )
  }
  removePeer(peer)
  if (
    peer.socket.readyState === WebSocket.OPEN ||
    peer.socket.readyState === WebSocket.CONNECTING
  ) {
    peer.socket.close(1011, 'publication relay failed')
  }
}

const sendAdmittedFrame = (
  peer: PeerSession,
  frame: OutboundPublicationFrame
): void => {
  if (peer.closed) return
  if (peer.socket.readyState !== WebSocket.OPEN) {
    removePeer(peer)
    return
  }
  const sendStartedAtMs = epochNow()
  const bufferedAmountBefore = peer.socket.bufferedAmount
  peer.socket.send(
    frame.bytes,
    { binary: true, compress: false },
    (error?: Error) => {
      if (error) {
        failPeerWrite(peer, frame, error)
        return
      }
      frame.sendCallbackDone = true
      if (collaborationProfilingEnabled) {
        console.log(
          `AI_COLLABORATION_SERVER_PEER_WRITE ${JSON.stringify({
            requestId: frame.sourceRequestId,
            actorId: peer.actorId,
            publicationId: frame.header.publicationId,
            frameId: frame.header.frameId,
            frameBytes: frame.bytes.byteLength,
            sendStartedAtMs,
            writeCallbackAtMs: epochNow(),
            writeCallbackMs: rounded(epochNow() - sendStartedAtMs),
            bufferedAmountBefore,
            bufferedAmountAtCallback: peer.socket.bufferedAmount,
            queueBytes: peer.queuedBytes,
            perMessageDeflate: false
          })}`
        )
      }
      retireCompletedOutboundFrames(peer)
    }
  )
}

const enqueueOutboundFrame = (
  peer: PeerSession,
  frame: Readonly<{ bytes: Uint8Array; header: PublicationFrameHeader }>,
  sourceRequestId: string
): void => {
  if (peer.closed) return
  peer.queuedBytes += frame.bytes.byteLength
  const outbound = {
    ...frame,
    sourceRequestId,
    enqueuedAtMs: performance.now(),
    sendCallbackDone: false,
    frameConsumed: false
  }
  peer.outboundQueue.push(outbound)
  sendAdmittedFrame(peer, outbound)
}

const enqueueRoomAdmission = <T>(
  room: RoomState,
  task: () => Promise<T>
): Promise<T> => {
  const result = room.admissionTail.then(task, task)
  room.admissionTail = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

const admitFrameToRecipients = async (
  recipients: readonly PeerSession[],
  frame: Readonly<{ bytes: Uint8Array; header: PublicationFrameHeader }>,
  sourceRequestId: string,
  signal: AbortSignal
): Promise<void> => {
  for (const peer of recipients) {
    const available = await waitForFrameCapacity(
      peer,
      frame.bytes.byteLength,
      signal
    )
    if (!available) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] publication recipient disconnected before admission'
      )
    }
  }
  if (signal.aborted || recipients.some(({ closed }) => closed)) {
    throw new ProviderFailure(
      'transport-failed',
      '[collaboration] publication admission was cancelled'
    )
  }
  for (const peer of recipients) {
    enqueueOutboundFrame(peer, frame, sourceRequestId)
  }
}

const consumeFrameCredit = (
  peer: PeerSession,
  message: FrameConsumedRequest
): void => {
  const frame = peer.outboundQueue.find(
    (candidate) =>
      !candidate.frameConsumed &&
      candidate.header.frameId === message.frameId &&
      candidate.header.publicationId === message.publicationId &&
      candidate.header.frameByteLength === message.frameByteLength
  )
  if (!frame) return
  frame.frameConsumed = true
  retireCompletedOutboundFrames(peer)
}

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

const webSocketServerOptions = {
  noServer: true,
  maxPayload: 0,
  perMessageDeflate: false
}
const webSocketServer = new WebSocketServer(webSocketServerOptions)

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
  const peer: PeerSession = {
    socket,
    outboundQueue: [],
    capacityWaiters: new Set(),
    ready: false,
    closed: false,
    queuedBytes: 0
  }
  const inboundRequests = new Map<string, InboundPublicationRequest>()
  let sourceFrameAdmission: SourceFrameAdmission | null = null
  let inboundFailed = false

  const helloTimeout = setTimeout(() => {
    if (!peer.ready) socket.close(1008, 'hello timeout')
  }, 5_000)

  const rejectConnection = (error: unknown, reason: string): void => {
    if (inboundFailed) return
    inboundFailed = true
    sourceFrameAdmission?.controller.abort()
    sourceFrameAdmission = null
    inboundRequests.clear()
    sendControl(socket, {
      type: CollaborationMessageTypes.CONNECTION_ERROR,
      ...failureMessage(error)
    })
    socket.close(1008, reason)
  }

  const handleHello = (message: CollaborationHelloMessage): void => {
    if (peer.ready) {
      throw new ProviderFailure(
        'connection-rejected',
        '[collaboration] identity hello can only be sent once'
      )
    }
    const { identity } = message
    const fileId = identity.connectionMetadata?.fileId
    if (!isNonBlankString(fileId)) {
      throw new ProviderFailure(
        'connection-rejected',
        '[collaboration] app-defined fileId and actor identity are required'
      )
    }
    const room = getOrCreateRoom(fileId)
    if (room.peers.has(identity.actorId)) {
      throw new ProviderFailure(
        'connection-rejected',
        '[collaboration] actor is already connected to this room'
      )
    }
    peer.actorId = identity.actorId
    peer.fileId = fileId
    peer.room = room
    peer.ready = true
    room.peers.set(identity.actorId, peer)
    clearTimeout(helloTimeout)
    sendControl(socket, { type: CollaborationMessageTypes.READY })
  }

  const handleAwareness = (message: SendAwarenessRequest): void => {
    const room = peer.room
    if (!room || !peer.actorId || message.message.actorId !== peer.actorId) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] awareness actor must match the connected identity'
      )
    }
    for (const roomPeer of room.peers.values()) {
      if (roomPeer === peer) continue
      sendControl(roomPeer.socket, {
        type: CollaborationMessageTypes.AWARENESS,
        ...message.message
      })
    }
    sendControl(socket, {
      type: CollaborationMessageTypes.RESPONSE,
      requestId: message.requestId,
      ok: true
    })
  }

  const handlePeerApplied = (message: PeerAppliedRequest): void => {
    const room = peer.room
    if (!room || !peer.actorId || message.fromActorId === peer.actorId) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] peer-applied source must be another room actor'
      )
    }
    if (collaborationProfilingEnabled) {
      console.log(
        `AI_COLLABORATION_SERVER_PEER_APPLIED ${JSON.stringify({
          requestId: message.requestId,
          publicationId: message.publicationId,
          fromActorId: message.fromActorId,
          appliedByActorId: peer.actorId
        })}`
      )
    }
    sendControl(socket, {
      type: CollaborationMessageTypes.RESPONSE,
      requestId: message.requestId,
      ok: true
    })
  }

  const handleControl = (encoded: string): void => {
    let message
    try {
      message = parseCollaborationClientMessage(
        decodeCollaborationControlMessage(encoded)
      )
    } catch {
      socket.close(1007, 'invalid wire message')
      return
    }
    if (!message) {
      socket.close(1008, 'invalid protocol message')
      return
    }
    try {
      if (!peer.ready) {
        if (message.type !== CollaborationMessageTypes.HELLO) {
          throw new ProviderFailure(
            'connection-rejected',
            '[collaboration] hello must be the first message'
          )
        }
        handleHello(message)
        return
      }
      switch (message.type) {
        case CollaborationMessageTypes.HELLO:
          handleHello(message)
          return
        case CollaborationMessageTypes.SEND_AWARENESS:
          handleAwareness(message)
          return
        case CollaborationMessageTypes.FRAME_CONSUMED:
          consumeFrameCredit(peer, message)
          return
        case CollaborationMessageTypes.PEER_APPLIED:
          handlePeerApplied(message)
          return
        case CollaborationMessageTypes.SEND_PUBLICATION:
        case CollaborationMessageTypes.SEND_PUBLICATIONS:
          throw new ProviderFailure(
            'transport-failed',
            '[collaboration] publication data requires binary framed transport'
          )
      }
    } catch (error) {
      rejectConnection(error, 'connection rejected')
    }
  }

  const validateAndAdvanceRequest = (
    request: InboundPublicationRequest,
    header: PublicationFrameHeader
  ): boolean => {
    if (
      header.messageType !== request.messageType ||
      header.publicationCount !== request.publicationCount ||
      header.publicationIndex !== request.nextPublicationIndex ||
      header.chunkIndex !== request.nextChunkIndex
    ) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] publication frames are out of order'
      )
    }
    if (header.chunkIndex === 0) {
      request.currentPublicationId = header.publicationId
      request.currentChunkCount = header.chunkCount
    } else if (
      header.publicationId !== request.currentPublicationId ||
      header.chunkCount !== request.currentChunkCount
    ) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] publication chunk metadata changed'
      )
    }
    request.frameCount += 1
    request.frameBytes += header.frameByteLength
    if (header.chunkIndex + 1 < header.chunkCount) {
      request.nextChunkIndex += 1
      return false
    }
    request.nextPublicationIndex += 1
    request.nextChunkIndex = 0
    request.currentPublicationId = undefined
    request.currentChunkCount = undefined
    return request.nextPublicationIndex === request.publicationCount
  }

  const handlePublicationFrame = async (
    sourceBytes: Uint8Array,
    header: PublicationFrameHeader,
    signal: AbortSignal
  ): Promise<InboundFrameAdmissionResult> => {
    if (!peer.ready || !peer.room || !peer.actorId) {
      throw new ProviderFailure(
        'not-connected',
        '[collaboration] provider handshake is incomplete'
      )
    }
    if (
      header.messageType !== CollaborationMessageTypes.SEND_PUBLICATION &&
      header.messageType !== CollaborationMessageTypes.SEND_PUBLICATIONS
    ) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] client binary frame must send a publication'
      )
    }
    if (
      header.messageType === CollaborationMessageTypes.SEND_PUBLICATION &&
      header.publicationCount !== 1
    ) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] single-publication frame kind requires publicationCount 1'
      )
    }
    const requestId = header.requestId
    if (!requestId) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] publication frame request identity is required'
      )
    }
    const existingRequest = inboundRequests.get(requestId)
    let request: InboundPublicationRequest
    if (!existingRequest) {
      if (header.publicationIndex !== 0 || header.chunkIndex !== 0) {
        throw new ProviderFailure(
          'transport-failed',
          '[collaboration] publication request must start at its first frame'
        )
      }
      request = {
        requestId,
        messageType: header.messageType,
        publicationCount: header.publicationCount,
        recipients: [...peer.room.peers.values()].filter(
          (candidate) => candidate !== peer && !candidate.closed
        ),
        receivedAtMs: performance.now(),
        nextPublicationIndex: 0,
        nextChunkIndex: 0,
        frameCount: 0,
        frameBytes: 0,
        queueWaitMs: 0
      }
    } else {
      request = {
        ...existingRequest,
        recipients: existingRequest.recipients
      }
    }
    const complete = validateAndAdvanceRequest(request, header)
    const peerFrame = reframePublicationForPeer(
      sourceBytes,
      header,
      peer.actorId
    )
    const queueStartedAtMs = performance.now()
    await enqueueRoomAdmission(peer.room, () =>
      admitFrameToRecipients(request.recipients, peerFrame, requestId, signal)
    )
    request.queueWaitMs += elapsed(queueStartedAtMs)
    if (signal.aborted) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] publication admission was cancelled'
      )
    }
    if (complete) {
      inboundRequests.delete(requestId)
    } else {
      inboundRequests.set(requestId, request)
    }
    return { request, complete }
  }

  const admitSourceFrame = (
    rawBytes: Uint8Array,
    header: PublicationFrameHeader
  ): void => {
    if (sourceFrameAdmission) {
      rejectConnection(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] multiple uncredited source publication frames are not allowed'
        ),
        'publication frame before admission credit'
      )
      return
    }
    const admission: SourceFrameAdmission = {
      header,
      controller: new AbortController()
    }
    sourceFrameAdmission = admission
    void handlePublicationFrame(rawBytes, header, admission.controller.signal)
      .then(({ request, complete }) => {
        if (
          inboundFailed ||
          peer.closed ||
          sourceFrameAdmission !== admission ||
          admission.controller.signal.aborted
        ) {
          return
        }
        sourceFrameAdmission = null
        const credited = sendControl(socket, {
          type: CollaborationMessageTypes.SOURCE_FRAME_ADMITTED,
          requestId: request.requestId,
          frameId: header.frameId,
          publicationId: header.publicationId,
          frameByteLength: header.frameByteLength
        })
        if (!credited || !complete) return
        sendControl(socket, {
          type: CollaborationMessageTypes.RESPONSE,
          requestId: request.requestId,
          ok: true
        })
        if (collaborationProfilingEnabled) {
          console.log(
            `AI_COLLABORATION_SERVER_PROFILE ${JSON.stringify({
              requestId: request.requestId,
              type: request.messageType,
              publicationCount: request.publicationCount,
              frameCount: request.frameCount,
              frameBytes: request.frameBytes,
              peerCount: request.recipients.filter(({ closed }) => !closed)
                .length,
              queueWaitMs: rounded(request.queueWaitMs),
              totalMs: rounded(elapsed(request.receivedAtMs))
            })}`
          )
        }
      })
      .catch((error) => {
        if (sourceFrameAdmission !== admission || inboundFailed) return
        sourceFrameAdmission = null
        rejectConnection(error, 'publication relay failed')
      })
  }

  socket.on('message', (data, isBinary) => {
    if (inboundFailed) return
    if (isBinary && sourceFrameAdmission) {
      rejectConnection(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] multiple uncredited source publication frames are not allowed'
        ),
        'publication frame before admission credit'
      )
      return
    }
    const rawBytes = rawDataToBytes(data)
    if (!isBinary) {
      handleControl(
        Buffer.from(
          rawBytes.buffer,
          rawBytes.byteOffset,
          rawBytes.byteLength
        ).toString('utf8')
      )
      return
    }
    let header: PublicationFrameHeader
    try {
      header = inspectPublicationFrameHeader(rawBytes)
    } catch {
      socket.close(1007, 'invalid publication frame')
      return
    }
    admitSourceFrame(rawBytes, header)
  })

  const cleanup = (): void => {
    clearTimeout(helloTimeout)
    inboundFailed = true
    sourceFrameAdmission?.controller.abort()
    sourceFrameAdmission = null
    inboundRequests.clear()
    removePeer(peer)
  }
  socket.once('close', cleanup)
  socket.once('error', cleanup)
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
