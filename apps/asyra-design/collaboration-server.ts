import console from 'node:console'
import { createHash } from 'node:crypto'
import { createServer as createHttpServer } from 'node:http'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import { loadEnvironment, resolveEnvironment } from './app-environment.mjs'
import {
  CollaborationMessageTypes,
  decodeCollaborationControlMessage,
  encodeCollaborationControlMessage,
  inspectPublicationFrameHeader,
  parseCollaborationClientMessage,
  type BootstrapConsumedRequest,
  type CollaborationFailurePayload,
  type CollaborationHelloMessage,
  type CollaborationServerMessage,
  type DocumentSessionBootstrap,
  type FrameConsumedRequest,
  type PeerAppliedRequest,
  type PublicationFrameHeader,
  type ResetDocumentRequest,
  type SendAwarenessRequest
} from './src/collaboration/protocol'
import { createFormalInitialDocument } from './src/collaboration/initial-document'
import { isNonBlankString } from './src/collaboration/wire-values'
import {
  createHttpDocumentPersistenceClient,
  type DocumentBootstrapCheckpoint
} from './server/document-persistence-client'
import {
  DEFAULT_DOCUMENT_PERSISTENCE_FLUSH_INTERVAL_MS,
  DEFAULT_DOCUMENT_PERSISTENCE_MAX_PUBLICATIONS,
  DEFAULT_DOCUMENT_PERSISTENCE_MAX_SERIALIZED_BYTES,
  DEFAULT_DOCUMENT_PERSISTENCE_RETRY_INTERVAL_MS,
  createDocumentPersistenceQueue,
  type DocumentPersistenceQueue
} from './server/document-persistence-queue'

type SocketServerFailureCode =
  | 'acknowledgement-failed'
  | 'connection-rejected'
  | 'not-connected'
  | 'transport-failed'

class SocketServerFailure extends Error {
  readonly code: SocketServerFailureCode
  readonly cause?: unknown
  readonly publicationId?: string

  constructor(
    code: SocketServerFailureCode,
    message: string,
    cause?: unknown,
    publicationId?: string
  ) {
    super(message)
    this.name = 'SocketServerFailure'
    this.code = code
    this.cause = cause
    this.publicationId = publicationId
  }
}

const appEnvironment = resolveEnvironment(
  loadEnvironment(process.env, resolve(process.cwd(), '.env'))
)

const host = appEnvironment.collaborationWebSocketHost
const port = appEnvironment.collaborationWebSocketPort
const socketPath = '/collaboration'
const allowedOrigin = appEnvironment.appURL
const collaborationProfilingEnabled = process.env.COLLABORATION_PROFILE === '1'
const persistenceBackendURL = (() => {
  const value = process.env.DOCUMENT_PERSISTENCE_BACKEND_URL?.trim()
  if (!value) {
    throw new Error(
      'DOCUMENT_PERSISTENCE_BACKEND_URL must define the production persistence backend origin'
    )
  }
  const resolved = new URL(value)
  if (
    (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') ||
    resolved.username ||
    resolved.password ||
    resolved.pathname !== '/' ||
    resolved.search ||
    resolved.hash
  ) {
    throw new Error(
      'DOCUMENT_PERSISTENCE_BACKEND_URL must be an http(s) origin'
    )
  }
  return resolved.origin
})()
const documentPersistenceClient = createHttpDocumentPersistenceClient({
  baseURL: persistenceBackendURL
})
const persistencePolicyNumber = (name: string, fallback: number): number => {
  const value = process.env[name]?.trim()
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}
const persistenceFlushIntervalMs = persistencePolicyNumber(
  'DOCUMENT_PERSISTENCE_FLUSH_INTERVAL_MS',
  DEFAULT_DOCUMENT_PERSISTENCE_FLUSH_INTERVAL_MS
)
const persistenceRetryIntervalMs = persistencePolicyNumber(
  'DOCUMENT_PERSISTENCE_RETRY_INTERVAL_MS',
  DEFAULT_DOCUMENT_PERSISTENCE_RETRY_INTERVAL_MS
)
const persistenceMaxPublicationCount = persistencePolicyNumber(
  'DOCUMENT_PERSISTENCE_MAX_PUBLICATIONS',
  DEFAULT_DOCUMENT_PERSISTENCE_MAX_PUBLICATIONS
)
const persistenceMaxSerializedBytes = persistencePolicyNumber(
  'DOCUMENT_PERSISTENCE_MAX_SERIALIZED_BYTES',
  DEFAULT_DOCUMENT_PERSISTENCE_MAX_SERIALIZED_BYTES
)

const PEER_QUEUE_CAPACITY_BYTES = 2 * 1024 * 1024
const PUBLICATION_FRAME_FIXED_HEADER_BYTES = 52
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
const PUBLICATION_FRAME_SEQUENCE_OFFSET = 44
const PUBLICATION_FRAME_STRING_UTF8 = 0
const PUBLICATION_FRAME_STRING_UTF16 = 1
const publicationFrameTextEncoder = new TextEncoder()
const rounded = (value: number): number => Math.round(value * 1_000) / 1_000
const elapsed = (startedAtMs: number): number => performance.now() - startedAtMs
const epochNow = (): number => performance.timeOrigin + performance.now()

const COLLABORATION_PROFILE_BATCH_SIZE = 8
type CollaborationProfilePrefix =
  | 'AI_COLLABORATION_SERVER_PROFILE'
  | 'AI_COLLABORATION_SERVER_PEER_WRITE'
  | 'AI_COLLABORATION_SERVER_PEER_DRAIN'
  | 'AI_COLLABORATION_SERVER_PEER_APPLIED'
interface CollaborationProfileBatch {
  readonly sampleCount: number
  readonly latest: Readonly<Record<string, unknown>>
  readonly maxima: Readonly<Record<string, number>>
}
const collaborationProfileMaximumKeys: Readonly<
  Record<CollaborationProfilePrefix, readonly string[]>
> = {
  AI_COLLABORATION_SERVER_PROFILE: [
    'digestMs',
    'persistenceCapacityMs',
    'peerAdmissionMs',
    'queueWaitMs',
    'totalMs'
  ],
  AI_COLLABORATION_SERVER_PEER_WRITE: ['writeCallbackMs', 'queueBytes'],
  AI_COLLABORATION_SERVER_PEER_DRAIN: ['drainMs', 'queueBytes'],
  AI_COLLABORATION_SERVER_PEER_APPLIED: []
}
const collaborationProfileBatches = new Map<
  CollaborationProfilePrefix,
  CollaborationProfileBatch
>()

const recordCollaborationProfile = (
  prefix: CollaborationProfilePrefix,
  evidence: Readonly<Record<string, unknown>>,
  { immediate = false }: Readonly<{ immediate?: boolean }> = {}
): void => {
  if (!collaborationProfilingEnabled) return
  if (immediate) {
    console.log(`${prefix} ${JSON.stringify({ ...evidence, sampleCount: 1 })}`)
    return
  }

  const current = collaborationProfileBatches.get(prefix)
  const maxima = { ...(current?.maxima ?? {}) }
  collaborationProfileMaximumKeys[prefix].forEach((key) => {
    const value = evidence[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return
    }
    maxima[key] = Math.max(maxima[key] ?? 0, value)
  })
  const batch = {
    sampleCount: (current?.sampleCount ?? 0) + 1,
    latest: evidence,
    maxima
  }
  if (batch.sampleCount < COLLABORATION_PROFILE_BATCH_SIZE) {
    collaborationProfileBatches.set(prefix, batch)
    return
  }

  collaborationProfileBatches.delete(prefix)
  console.log(
    `${prefix} ${JSON.stringify({
      ...batch.latest,
      ...batch.maxima,
      sampleCount: batch.sampleCount
    })}`
  )
}

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
  identified: boolean
  ready: boolean
  bootstrapHeadSequence?: number
  closed: boolean
  queuedBytes: number
}

interface RoomState {
  readonly fileId: string
  readonly peers: Map<string, PeerSession>
  readonly acceptedPublications: Map<string, SequencedDocumentPublication>
  readonly persistenceQueue: DocumentPersistenceQueue
  bootstrapCheckpointSeed?: DocumentBootstrapCheckpoint
  pendingPublications: SequencedDocumentPublication[]
  headSequence: number
  admissionTail: Promise<void>
  resetting: boolean
}

interface SequencedDocumentPublication {
  readonly sequence: number
  readonly publicationId: string
  readonly encodedPublicationFrames: readonly string[]
  readonly encodedPayloadDigest: string
  readonly fromActorId: string
  readonly byteLength: number
}

interface InboundPublicationFrame {
  readonly bytes: Uint8Array
  readonly header: PublicationFrameHeader
}

interface InboundPublicationRequest {
  readonly requestId: string
  readonly messageType:
    | typeof CollaborationMessageTypes.SEND_PUBLICATION
    | typeof CollaborationMessageTypes.SEND_PUBLICATIONS
  readonly publicationCount: number
  readonly recipients: readonly PeerSession[]
  readonly receivedAtMs: number
  readonly frames: InboundPublicationFrame[]
  nextPublicationIndex: number
  nextChunkIndex: number
  currentPublicationId?: string
  currentChunkCount?: number
  frameCount: number
  frameBytes: number
  digestMs: number
  persistenceCapacityMs: number
  peerAdmissionMs: number
  queueWaitMs: number
}

interface SourceFrameAdmission {
  readonly header: PublicationFrameHeader
  readonly controller: AbortController
}

interface InboundFrameAdmissionResult {
  readonly request: InboundPublicationRequest
  readonly complete: boolean
  readonly acceptedSequences?: readonly number[]
}

const rooms = new Map<string, RoomState>()
const roomInitializations = new Map<string, Promise<RoomState>>()

const failureMessage = (error: unknown): CollaborationFailurePayload => ({
  code: error instanceof SocketServerFailure ? error.code : 'transport-failed',
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
  fromActorId: string,
  sequence: number
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
    throw new SocketServerFailure(
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
  peerView.setBigUint64(
    PUBLICATION_FRAME_SEQUENCE_OFFSET,
    BigInt(sequence),
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

const sourcePublicationPayloadDigest = (
  frames: readonly InboundPublicationFrame[]
): string => {
  const digest = createHash('sha256')
  for (const { bytes } of frames) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const headerByteLength = view.getUint32(
      PUBLICATION_FRAME_HEADER_LENGTH_OFFSET,
      true
    )
    const payload = bytes.subarray(headerByteLength)
    const payloadLength = new Uint8Array(4)
    new DataView(payloadLength.buffer).setUint32(0, payload.byteLength, true)
    digest.update(payloadLength)
    digest.update(payload)
  }
  return digest.digest('hex')
}

const encodePublicationFramesForStorage = (
  frames: readonly InboundPublicationFrame[]
): readonly string[] =>
  Object.freeze(
    frames.map(({ bytes }) =>
      Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(
        'base64'
      )
    )
  )

const getOrCreateRoom = async (fileId: string): Promise<RoomState> => {
  const existing = rooms.get(fileId)
  if (existing) return existing
  const pending = roomInitializations.get(fileId)
  if (pending) return pending

  const initialization = (async (): Promise<RoomState> => {
    const bootstrapCheckpoint =
      await documentPersistenceClient.readCheckpoint(fileId)
    const roomReference: { current?: RoomState } = {}
    const persistenceQueue = createDocumentPersistenceQueue({
      documentId: fileId,
      initialDurableSequence: bootstrapCheckpoint.durableSequence,
      flushIntervalMs: persistenceFlushIntervalMs,
      retryIntervalMs: persistenceRetryIntervalMs,
      maxPublicationCount: persistenceMaxPublicationCount,
      maxSerializedBytes: persistenceMaxSerializedBytes,
      sendBatch: (batch) => documentPersistenceClient.sendBatch(batch),
      onDurableSequenceChange: (durableSequence) => {
        const room = roomReference.current
        if (!room) return
        room.pendingPublications = room.pendingPublications.filter(
          ({ sequence }) => sequence > durableSequence
        )
        if (
          room.peers.size === 0 &&
          room.pendingPublications.length === 0 &&
          rooms.get(fileId) === room
        ) {
          room.persistenceQueue.dispose()
          rooms.delete(fileId)
        }
      }
    })
    const room: RoomState = {
      fileId,
      peers: new Map(),
      acceptedPublications: new Map(),
      pendingPublications: [],
      persistenceQueue,
      bootstrapCheckpointSeed: bootstrapCheckpoint,
      headSequence: bootstrapCheckpoint.durableSequence,
      admissionTail: Promise.resolve(),
      resetting: false
    }
    roomReference.current = room
    rooms.set(fileId, room)
    return room
  })()
  roomInitializations.set(fileId, initialization)
  try {
    return await initialization
  } finally {
    if (roomInitializations.get(fileId) === initialization) {
      roomInitializations.delete(fileId)
    }
  }
}

const notifyCapacityWaiters = (peer: PeerSession, available: boolean): void => {
  const waiters = [...peer.capacityWaiters]
  peer.capacityWaiters.clear()
  waiters.forEach((resolveWaiter) => resolveWaiter(available))
}

const canAdmitFrame = (peer: PeerSession, frameByteLength: number): boolean => {
  if (peer.closed || peer.socket.readyState !== WebSocket.OPEN) return false
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
    peer.socket.readyState === WebSocket.OPEN &&
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
  return (
    !signal.aborted && !peer.closed && peer.socket.readyState === WebSocket.OPEN
  )
}

const removePeer = (peer: PeerSession): void => {
  if (peer.closed) return
  const wasReady = peer.ready
  peer.closed = true
  peer.outboundQueue.length = 0
  peer.queuedBytes = 0
  notifyCapacityWaiters(peer, false)
  const room = peer.room
  const actorId = peer.actorId
  if (!room || !actorId || room.peers.get(actorId) !== peer) return
  room.peers.delete(actorId)
  if (wasReady) {
    for (const roomPeer of room.peers.values()) {
      if (!roomPeer.ready) continue
      sendControl(roomPeer.socket, {
        type: CollaborationMessageTypes.AWARENESS_DISCONNECT,
        actorId,
        reason: 'disconnect'
      })
    }
  }
  if (
    room.peers.size === 0 &&
    room.pendingPublications.length === 0 &&
    rooms.get(room.fileId) === room
  ) {
    room.persistenceQueue.dispose()
    rooms.delete(room.fileId)
    return
  }
  if (room.peers.size === 0) void room.persistenceQueue.flushNow()
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
    recordCollaborationProfile('AI_COLLABORATION_SERVER_PEER_DRAIN', {
      requestId: active.sourceRequestId,
      actorId: peer.actorId,
      publicationId: active.header.publicationId,
      frameId: active.header.frameId,
      frameBytes: active.bytes.byteLength,
      queueBytes: peer.queuedBytes,
      drainMs: rounded(elapsed(active.enqueuedAtMs))
    })
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
  recordCollaborationProfile(
    'AI_COLLABORATION_SERVER_PEER_WRITE',
    {
      requestId: active.sourceRequestId,
      actorId: peer.actorId,
      publicationId: active.header.publicationId,
      frameId: active.header.frameId,
      frameBytes: active.bytes.byteLength,
      error: { name: error.name, message: error.message }
    },
    { immediate: true }
  )
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
      const writeCallbackAtMs = epochNow()
      recordCollaborationProfile('AI_COLLABORATION_SERVER_PEER_WRITE', {
        requestId: frame.sourceRequestId,
        actorId: peer.actorId,
        publicationId: frame.header.publicationId,
        frameId: frame.header.frameId,
        frameBytes: frame.bytes.byteLength,
        sendStartedAtMs,
        writeCallbackAtMs,
        writeCallbackMs: rounded(writeCallbackAtMs - sendStartedAtMs),
        bufferedAmountBefore,
        bufferedAmountAtCallback: peer.socket.bufferedAmount,
        queueBytes: peer.queuedBytes,
        perMessageDeflate: false
      })
      retireCompletedOutboundFrames(peer)
    }
  )
}

const enqueueOutboundFrame = (
  peer: PeerSession,
  frame: Readonly<{ bytes: Uint8Array; header: PublicationFrameHeader }>,
  sourceRequestId: string
): void => {
  if (peer.closed || peer.socket.readyState !== WebSocket.OPEN) {
    removePeer(peer)
    return
  }
  peer.queuedBytes += frame.bytes.byteLength
  const outbound = {
    ...frame,
    sourceRequestId,
    enqueuedAtMs: performance.now(),
    sendCallbackDone: false,
    frameConsumed: false
  }
  peer.outboundQueue.push(outbound)
  if (peer.ready) sendAdmittedFrame(peer, outbound)
}

const sendQueuedBootstrapSuccessorFrames = (peer: PeerSession): void => {
  for (const frame of peer.outboundQueue) {
    if (!frame.sendCallbackDone) sendAdmittedFrame(peer, frame)
  }
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

const createDocumentSessionBootstrap = async (
  room: RoomState
): Promise<DocumentSessionBootstrap> => {
  let checkpoint =
    room.bootstrapCheckpointSeed ??
    (await documentPersistenceClient.readCheckpoint(room.fileId))
  room.bootstrapCheckpointSeed = undefined
  if (
    checkpoint.durableSequence <
    room.persistenceQueue.getState().durableSequence
  ) {
    checkpoint = await documentPersistenceClient.readCheckpoint(room.fileId)
  }
  if (
    checkpoint.durableSequence <
    room.persistenceQueue.getState().durableSequence
  ) {
    throw new SocketServerFailure(
      'connection-rejected',
      '[collaboration] backend checkpoint is behind acknowledged durability'
    )
  }
  if (checkpoint.durableSequence > room.headSequence) {
    throw new SocketServerFailure(
      'connection-rejected',
      '[collaboration] backend checkpoint is ahead of the document session'
    )
  }
  let checkpointDocument = checkpoint.checkpoint
  if (checkpointDocument == null) {
    if (checkpoint.durableSequence !== 0) {
      throw new SocketServerFailure(
        'connection-rejected',
        '[collaboration] a durable document checkpoint is missing'
      )
    }
    checkpointDocument = createFormalInitialDocument()
  }
  const pendingTail = [...room.acceptedPublications.values()]
    .filter(
      ({ sequence }) =>
        sequence > checkpoint.durableSequence && sequence <= room.headSequence
    )
    .sort((left, right) => left.sequence - right.sequence)
  if (
    pendingTail.length !== room.headSequence - checkpoint.durableSequence ||
    pendingTail.some(
      ({ sequence }, index) =>
        sequence !== checkpoint.durableSequence + index + 1
    )
  ) {
    throw new SocketServerFailure(
      'connection-rejected',
      '[collaboration] document bootstrap tail is not gap-free'
    )
  }
  return Object.freeze({
    checkpoint: checkpointDocument,
    documentGeneration: checkpoint.documentGeneration,
    durableSequence: checkpoint.durableSequence,
    headSequence: room.headSequence,
    pendingTail: Object.freeze(
      pendingTail.map(
        ({ sequence, publicationId, encodedPublicationFrames, fromActorId }) =>
          Object.freeze({
            sequence,
            publicationId,
            encodedPublicationFrames: Object.freeze(
              encodedPublicationFrames.map((encodedFrame) => {
                const sourceBytes = new Uint8Array(
                  Buffer.from(encodedFrame, 'base64')
                )
                const sourceHeader = inspectPublicationFrameHeader(sourceBytes)
                return Buffer.from(
                  reframePublicationForPeer(
                    sourceBytes,
                    sourceHeader,
                    fromActorId,
                    sequence
                  ).bytes
                ).toString('base64')
              })
            ),
            fromActorId
          })
      )
    )
  })
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
    if (!available && signal.aborted) {
      throw new SocketServerFailure(
        'transport-failed',
        '[collaboration] publication admission was cancelled'
      )
    }
  }
  if (signal.aborted) {
    throw new SocketServerFailure(
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
    identified: false,
    ready: false,
    closed: false,
    queuedBytes: 0
  }
  const inboundRequests = new Map<string, InboundPublicationRequest>()
  let sourceFrameAdmission: SourceFrameAdmission | null = null
  let inboundFailed = false
  let controlTail = Promise.resolve()

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

  const handleHello = async (
    message: CollaborationHelloMessage
  ): Promise<void> => {
    if (peer.identified) {
      throw new SocketServerFailure(
        'connection-rejected',
        '[collaboration] identity hello can only be sent once'
      )
    }
    peer.identified = true
    const { identity } = message
    const fileId = identity.connectionMetadata?.fileId
    if (!isNonBlankString(fileId)) {
      throw new SocketServerFailure(
        'connection-rejected',
        '[collaboration] app-defined fileId and actor identity are required'
      )
    }
    const room = await getOrCreateRoom(fileId)
    const bootstrap = await enqueueRoomAdmission(room, async () => {
      if (room.resetting) {
        throw new SocketServerFailure(
          'connection-rejected',
          '[collaboration] document Reset is in progress'
        )
      }
      if (room.peers.has(identity.actorId)) {
        throw new SocketServerFailure(
          'connection-rejected',
          '[collaboration] actor is already connected to this room'
        )
      }
      const sessionBootstrap = await createDocumentSessionBootstrap(room)
      peer.actorId = identity.actorId
      peer.fileId = fileId
      peer.room = room
      peer.bootstrapHeadSequence = sessionBootstrap.headSequence
      room.peers.set(identity.actorId, peer)
      return sessionBootstrap
    })
    clearTimeout(helloTimeout)
    sendControl(socket, {
      type: CollaborationMessageTypes.READY,
      bootstrap
    })
  }

  const handleBootstrapConsumed = (message: BootstrapConsumedRequest): void => {
    if (
      peer.ready ||
      !peer.room ||
      !peer.actorId ||
      peer.bootstrapHeadSequence === undefined ||
      message.headSequence !== peer.bootstrapHeadSequence
    ) {
      throw new SocketServerFailure(
        'connection-rejected',
        '[collaboration] document bootstrap completion does not match the reserved cutoff'
      )
    }
    peer.ready = true
    sendControl(socket, {
      type: CollaborationMessageTypes.RESPONSE,
      requestId: message.requestId,
      ok: true
    })
    sendQueuedBootstrapSuccessorFrames(peer)
  }

  const handleAwareness = (message: SendAwarenessRequest): void => {
    const room = peer.room
    if (!room || !peer.actorId || message.message.actorId !== peer.actorId) {
      throw new SocketServerFailure(
        'transport-failed',
        '[collaboration] awareness actor must match the connected identity'
      )
    }
    for (const roomPeer of room.peers.values()) {
      if (roomPeer === peer || !roomPeer.ready) continue
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
      throw new SocketServerFailure(
        'transport-failed',
        '[collaboration] peer-applied source must be another room actor'
      )
    }
    recordCollaborationProfile('AI_COLLABORATION_SERVER_PEER_APPLIED', {
      requestId: message.requestId,
      publicationId: message.publicationId,
      fromActorId: message.fromActorId,
      appliedByActorId: peer.actorId
    })
    sendControl(socket, {
      type: CollaborationMessageTypes.RESPONSE,
      requestId: message.requestId,
      ok: true
    })
  }

  const handleResetDocument = async (
    message: ResetDocumentRequest
  ): Promise<void> => {
    const room = peer.room
    if (!room || !peer.actorId) {
      throw new SocketServerFailure(
        'not-connected',
        '[collaboration] provider handshake is incomplete'
      )
    }
    try {
      await enqueueRoomAdmission(room, async () => {
        if (room.resetting) {
          throw new SocketServerFailure(
            'transport-failed',
            '[collaboration] document Reset is already in progress'
          )
        }
        room.resetting = true
        await room.persistenceQueue.discardForReset()
        const documentGeneration =
          await documentPersistenceClient.resetCheckpoint(room.fileId)
        room.acceptedPublications.clear()
        room.pendingPublications = []
        room.headSequence = 0
        room.bootstrapCheckpointSeed = {
          checkpoint: createFormalInitialDocument(),
          durableSequence: 0,
          documentGeneration
        }
      })
    } finally {
      if (room.resetting && rooms.get(room.fileId) === room) {
        rooms.delete(room.fileId)
      }
      if (room.resetting) {
        for (const roomPeer of room.peers.values()) {
          if (roomPeer === peer || roomPeer.closed) continue
          roomPeer.socket.close(1012, 'document reset')
        }
      }
    }
    sendControl(socket, {
      type: CollaborationMessageTypes.RESPONSE,
      requestId: message.requestId,
      ok: true
    })
  }

  const handleControl = async (encoded: string): Promise<void> => {
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
    if (!peer.identified) {
      if (message.type !== CollaborationMessageTypes.HELLO) {
        throw new SocketServerFailure(
          'connection-rejected',
          '[collaboration] hello must be the first message'
        )
      }
      await handleHello(message)
      return
    }
    if (!peer.ready) {
      if (message.type === CollaborationMessageTypes.BOOTSTRAP_CONSUMED) {
        handleBootstrapConsumed(message)
        return
      }
      throw new SocketServerFailure(
        'connection-rejected',
        '[collaboration] document bootstrap must complete before live collaboration'
      )
    }
    switch (message.type) {
      case CollaborationMessageTypes.HELLO:
        await handleHello(message)
        return
      case CollaborationMessageTypes.BOOTSTRAP_CONSUMED:
        handleBootstrapConsumed(message)
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
      case CollaborationMessageTypes.RESET_DOCUMENT:
        await handleResetDocument(message)
        return
      case CollaborationMessageTypes.SEND_PUBLICATION:
      case CollaborationMessageTypes.SEND_PUBLICATIONS:
        throw new SocketServerFailure(
          'transport-failed',
          '[collaboration] publication data requires binary framed transport'
        )
    }
  }

  const enqueueControl = (encoded: string): void => {
    const task = controlTail.then(
      () => handleControl(encoded),
      () => handleControl(encoded)
    )
    controlTail = task.then(
      () => undefined,
      () => undefined
    )
    void task.catch((error) => {
      rejectConnection(error, 'connection rejected')
    })
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
      throw new SocketServerFailure(
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
      throw new SocketServerFailure(
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

  const acceptCompletedPublicationRequest = async (
    request: InboundPublicationRequest,
    signal: AbortSignal
  ): Promise<readonly number[]> => {
    const room = peer.room
    const actorId = peer.actorId
    if (!room || !actorId) {
      throw new SocketServerFailure(
        'not-connected',
        '[collaboration] provider handshake is incomplete'
      )
    }
    const digestStartedAtMs = performance.now()
    const publications = Array.from(
      { length: request.publicationCount },
      (_, publicationIndex) => {
        const frames = request.frames.filter(
          ({ header }) => header.publicationIndex === publicationIndex
        )
        const publicationId = frames[0]?.header.publicationId
        if (
          !publicationId ||
          frames.length === 0 ||
          frames.some(({ header }) => header.publicationId !== publicationId)
        ) {
          throw new SocketServerFailure(
            'transport-failed',
            '[collaboration] publication frame identity is inconsistent'
          )
        }
        const encodedPublicationFrames =
          encodePublicationFramesForStorage(frames)
        return Object.freeze({
          publicationId,
          frames,
          encodedPublicationFrames,
          encodedPayloadDigest: sourcePublicationPayloadDigest(frames),
          byteLength: encodedPublicationFrames.reduce(
            (total, frame) => total + frame.length,
            0
          )
        })
      }
    )
    request.digestMs += elapsed(digestStartedAtMs)

    return enqueueRoomAdmission(room, async () => {
      if (room.resetting) {
        throw new SocketServerFailure(
          'transport-failed',
          '[collaboration] document Reset is in progress'
        )
      }
      const accepted = publications.map(({ publicationId }) =>
        room.acceptedPublications.get(publicationId)
      )
      const acceptedCount = accepted.filter(Boolean).length
      if (acceptedCount > 0 && acceptedCount !== publications.length) {
        throw new SocketServerFailure(
          'acknowledgement-failed',
          '[collaboration] publication request mixes accepted and new identities',
          undefined,
          publications[0]?.publicationId
        )
      }
      if (acceptedCount === publications.length) {
        accepted.forEach((entry, index) => {
          if (
            !entry ||
            entry.encodedPayloadDigest !==
              publications[index]?.encodedPayloadDigest
          ) {
            throw new SocketServerFailure(
              'acknowledgement-failed',
              '[collaboration] publication identity was reused with different content',
              undefined,
              publications[index]?.publicationId
            )
          }
        })
        return accepted.map((entry) => entry?.sequence as number)
      }
      const firstSequence = room.headSequence + 1
      const lastSequence = room.headSequence + publications.length
      if (!Number.isSafeInteger(lastSequence)) {
        throw new SocketServerFailure(
          'transport-failed',
          '[collaboration] document publication sequence overflow'
        )
      }
      const sequenced = publications.map((publication, index) => ({
        publicationId: publication.publicationId,
        encodedPublicationFrames: publication.encodedPublicationFrames,
        encodedPayloadDigest: publication.encodedPayloadDigest,
        fromActorId: actorId,
        sequence: firstSequence + index,
        byteLength: publication.byteLength
      }))
      const persistenceCapacityStartedAtMs = performance.now()
      try {
        await room.persistenceQueue.enqueueBatchWhenAvailable(
          sequenced.map(
            ({
              sequence,
              publicationId,
              encodedPublicationFrames,
              byteLength
            }) => ({
              sequence,
              publicationId,
              encodedPublicationFrames,
              byteLength
            })
          )
        )
      } catch (error) {
        throw new SocketServerFailure(
          'transport-failed',
          '[collaboration] document persistence is unavailable until accepted changes are durable',
          error
        )
      }
      request.persistenceCapacityMs += elapsed(persistenceCapacityStartedAtMs)
      sequenced.forEach((entry) => {
        room.acceptedPublications.set(entry.publicationId, entry)
        room.pendingPublications.push(entry)
      })
      room.headSequence = lastSequence

      const sequences = sequenced.map(({ sequence }) => sequence)
      const peerAdmissionStartedAtMs = performance.now()
      for (const frame of request.frames) {
        const sequence = sequences[frame.header.publicationIndex]
        if (!sequence) {
          throw new SocketServerFailure(
            'transport-failed',
            '[collaboration] publication sequence is missing'
          )
        }
        const peerFrame = reframePublicationForPeer(
          frame.bytes,
          frame.header,
          actorId,
          sequence
        )
        await admitFrameToRecipients(
          request.recipients,
          peerFrame,
          request.requestId,
          signal
        )
      }
      request.peerAdmissionMs += elapsed(peerAdmissionStartedAtMs)
      return sequences
    })
  }

  const handlePublicationFrame = async (
    sourceBytes: Uint8Array,
    header: PublicationFrameHeader,
    signal: AbortSignal
  ): Promise<InboundFrameAdmissionResult> => {
    if (!peer.ready || !peer.room || !peer.actorId) {
      throw new SocketServerFailure(
        'not-connected',
        '[collaboration] provider handshake is incomplete'
      )
    }
    if (
      header.messageType !== CollaborationMessageTypes.SEND_PUBLICATION &&
      header.messageType !== CollaborationMessageTypes.SEND_PUBLICATIONS
    ) {
      throw new SocketServerFailure(
        'transport-failed',
        '[collaboration] client binary frame must send a publication'
      )
    }
    if (
      header.messageType === CollaborationMessageTypes.SEND_PUBLICATION &&
      header.publicationCount !== 1
    ) {
      throw new SocketServerFailure(
        'transport-failed',
        '[collaboration] single-publication frame kind requires publicationCount 1'
      )
    }
    const requestId = header.requestId
    if (!requestId) {
      throw new SocketServerFailure(
        'transport-failed',
        '[collaboration] publication frame request identity is required'
      )
    }
    const existingRequest = inboundRequests.get(requestId)
    let request: InboundPublicationRequest
    if (!existingRequest) {
      if (header.publicationIndex !== 0 || header.chunkIndex !== 0) {
        throw new SocketServerFailure(
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
        frames: [],
        nextPublicationIndex: 0,
        nextChunkIndex: 0,
        frameCount: 0,
        frameBytes: 0,
        digestMs: 0,
        persistenceCapacityMs: 0,
        peerAdmissionMs: 0,
        queueWaitMs: 0
      }
    } else {
      request = {
        ...existingRequest,
        recipients: existingRequest.recipients
      }
    }
    const complete = validateAndAdvanceRequest(request, header)
    request.frames.push({
      bytes: sourceBytes.slice(),
      header
    })
    if (!complete) {
      inboundRequests.set(requestId, request)
      return { request, complete: false }
    }
    const queueStartedAtMs = performance.now()
    const acceptedSequences = await acceptCompletedPublicationRequest(
      request,
      signal
    )
    request.queueWaitMs += elapsed(queueStartedAtMs)
    if (signal.aborted) {
      throw new SocketServerFailure(
        'transport-failed',
        '[collaboration] publication admission was cancelled'
      )
    }
    inboundRequests.delete(requestId)
    return { request, complete: true, acceptedSequences }
  }

  const admitSourceFrame = (
    rawBytes: Uint8Array,
    header: PublicationFrameHeader
  ): void => {
    if (sourceFrameAdmission) {
      rejectConnection(
        new SocketServerFailure(
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
      .then(({ request, complete, acceptedSequences }) => {
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
          ok: true,
          acceptedSequences
        })
        recordCollaborationProfile('AI_COLLABORATION_SERVER_PROFILE', {
          requestId: request.requestId,
          type: request.messageType,
          publicationCount: request.publicationCount,
          frameCount: request.frameCount,
          frameBytes: request.frameBytes,
          peerCount: request.recipients.filter(({ closed }) => !closed).length,
          digestMs: rounded(request.digestMs),
          persistenceCapacityMs: rounded(request.persistenceCapacityMs),
          peerAdmissionMs: rounded(request.peerAdmissionMs),
          queueWaitMs: rounded(request.queueWaitMs),
          totalMs: rounded(elapsed(request.receivedAtMs))
        })
      })
      .catch((error) => {
        if (sourceFrameAdmission !== admission || inboundFailed) return
        sourceFrameAdmission = null
        if (
          error instanceof SocketServerFailure &&
          error.code === 'acknowledgement-failed'
        ) {
          const rejectedRequestId = header.requestId
          if (!rejectedRequestId) {
            rejectConnection(error, 'publication rejection identity missing')
            return
          }
          inboundRequests.delete(rejectedRequestId)
          const credited = sendControl(socket, {
            type: CollaborationMessageTypes.SOURCE_FRAME_ADMITTED,
            requestId: rejectedRequestId,
            frameId: header.frameId,
            publicationId: header.publicationId,
            frameByteLength: header.frameByteLength
          })
          if (!credited) return
          sendControl(socket, {
            type: CollaborationMessageTypes.RESPONSE,
            requestId: rejectedRequestId,
            ok: false,
            error: failureMessage(error)
          })
          return
        }
        rejectConnection(error, 'publication relay failed')
      })
  }

  socket.on('message', (data, isBinary) => {
    if (inboundFailed) return
    if (isBinary && sourceFrameAdmission) {
      rejectConnection(
        new SocketServerFailure(
          'transport-failed',
          '[collaboration] multiple uncredited source publication frames are not allowed'
        ),
        'publication frame before admission credit'
      )
      return
    }
    const rawBytes = rawDataToBytes(data)
    if (!isBinary) {
      enqueueControl(
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
  `[collaboration] ws://${host}:${port}${socketPath} (backend: ${persistenceBackendURL})`
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
  await Promise.all(
    [...rooms.values()].map((room) => room.persistenceQueue.flushForShutdown())
  )
  for (const room of rooms.values()) {
    room.persistenceQueue.dispose()
  }
  await new Promise<void>((resolveClose, rejectClose) =>
    httpServer.close((error) => (error ? rejectClose(error) : resolveClose()))
  )
}

process.once('SIGINT', () => void close().finally(() => process.exit(0)))
process.once('SIGTERM', () => void close().finally(() => process.exit(0)))
