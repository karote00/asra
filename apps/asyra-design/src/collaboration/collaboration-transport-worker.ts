import type { SharedPublication } from '@asyra/factory'
import type {
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage,
  ProviderIdentity
} from '@asyra/collaboration'
import {
  CollaborationMessageTypes,
  decodeCollaborationControlMessage,
  encodeCollaborationControlMessage,
  inspectPublicationFrameHeader,
  parseCollaborationServerMessage,
  type CollaborationRequestMessage,
  type PublicationFrameHeader,
  type PublicationFrameMessage
} from './protocol'
import {
  PublicationCodecWorkerRuntime,
  type PublicationCodecWorkerResponse
} from './publication-codec-worker'

export interface ConnectCollaborationTransportWorkerRequest {
  readonly type: 'connect'
  readonly generation: number
  readonly endpoint: string
  readonly identity: ProviderIdentity
}

export interface SendCollaborationTransportRequest {
  readonly type: 'send-request'
  readonly generation: number
  readonly message: CollaborationRequestMessage
}

export interface SettleCollaborationPublicationRequest {
  readonly type: 'settle-publication'
  readonly generation: number
  readonly deliveryId: string
  readonly outcome: 'applied' | 'failed'
  readonly message?: string
}

export interface DisconnectCollaborationTransportWorkerRequest {
  readonly type: 'disconnect'
  readonly generation: number
}

export interface DestroyCollaborationTransportWorkerRequest {
  readonly type: 'destroy'
  readonly generation: number
}

export type CollaborationTransportWorkerRequest =
  | ConnectCollaborationTransportWorkerRequest
  | SendCollaborationTransportRequest
  | SettleCollaborationPublicationRequest
  | DisconnectCollaborationTransportWorkerRequest
  | DestroyCollaborationTransportWorkerRequest

export interface CollaborationTransportConnectedResponse {
  readonly type: 'connected'
  readonly generation: number
}

export interface CollaborationTransportRequestAcceptedResponse {
  readonly type: 'request-accepted'
  readonly generation: number
  readonly requestId: string
}

export interface CollaborationTransportRequestRejectedResponse {
  readonly type: 'request-rejected'
  readonly generation: number
  readonly requestId: string
  readonly code: string
  readonly message: string
  readonly publicationId?: string
}

export interface CollaborationPublicationCapacityReleasedResponse {
  readonly type: 'publication-capacity-released'
  readonly generation: number
}

export interface CollaborationPublicationDeliveryResponse {
  readonly type: 'publication-delivery'
  readonly generation: number
  readonly deliveryId: string
  readonly publication: SharedPublication
  readonly fromActorId?: string
  readonly durationMs?: number
}

export interface CollaborationTransportAwarenessResponse {
  readonly type: 'awareness'
  readonly generation: number
  readonly message: ProviderAwarenessMessage
}

export interface CollaborationTransportAwarenessDisconnectResponse {
  readonly type: 'awareness-disconnect'
  readonly generation: number
  readonly event: ProviderAwarenessDisconnect
}

export interface CollaborationTransportDisconnectedResponse {
  readonly type: 'disconnected'
  readonly generation: number
  readonly code?: number
  readonly reason?: string
}

export interface CollaborationTransportFailureResponse {
  readonly type: 'failure'
  readonly generation: number
  readonly code: string
  readonly message: string
  readonly publicationId?: string
  readonly terminal: boolean
}

export type CollaborationTransportTimingPhase =
  | 'collaboration:outbound-encode'
  | 'collaboration:outbound-wire-send'
  | 'collaboration:codec-worker-encode'
  | 'collaboration:codec-worker-decode'
  | 'collaboration:receiver-handoff'
  | 'collaboration:inbound-receive-to-dispatch'

export interface CollaborationTransportTimingResponse {
  readonly type: 'timing'
  readonly generation: number
  readonly phase: CollaborationTransportTimingPhase
  readonly durationMs: number
  readonly publicationId?: string
}

export type CollaborationTransportDiagnosticCounterName =
  | 'collaboration:inbound-frame-entry'
  | 'collaboration:inbound-frame-byte-length'
  | 'collaboration:outbound-encoded-byte-length'

export interface CollaborationTransportDiagnosticCounterResponse {
  readonly type: 'diagnostic-counter'
  readonly generation: number
  readonly name: CollaborationTransportDiagnosticCounterName
  readonly value: number
}

export type CollaborationTransportWorkerResponse =
  | CollaborationTransportConnectedResponse
  | CollaborationTransportRequestAcceptedResponse
  | CollaborationTransportRequestRejectedResponse
  | CollaborationPublicationCapacityReleasedResponse
  | CollaborationPublicationDeliveryResponse
  | CollaborationTransportAwarenessResponse
  | CollaborationTransportAwarenessDisconnectResponse
  | CollaborationTransportDisconnectedResponse
  | CollaborationTransportFailureResponse
  | CollaborationTransportTimingResponse
  | CollaborationTransportDiagnosticCounterResponse

export type CollaborationTransportWorkerEventName =
  | 'message'
  | 'error'
  | 'messageerror'

export interface CollaborationTransportWorkerEvent {
  readonly data?: CollaborationTransportWorkerResponse
  readonly error?: unknown
}

export type CollaborationTransportWorkerListener = (
  event: CollaborationTransportWorkerEvent
) => void

export interface CollaborationTransportWorkerLike {
  postMessage(message: CollaborationTransportWorkerRequest): void
  addEventListener(
    type: CollaborationTransportWorkerEventName,
    listener: CollaborationTransportWorkerListener
  ): void
  removeEventListener(
    type: CollaborationTransportWorkerEventName,
    listener: CollaborationTransportWorkerListener
  ): void
  terminate(): void
}

type TransportWorkerPost = (
  response: CollaborationTransportWorkerResponse
) => void

interface CollaborationTransportWorkerRuntimeOptions {
  readonly createWebSocket: (endpoint: string) => WebSocket
  readonly postMessage: TransportWorkerPost
}

interface ActiveOutboundPublication {
  readonly generation: number
  readonly requestId: string
  readonly publicationId: string
  frames: (ArrayBuffer | undefined)[]
  nextFrameIndex: number
  inFlightHeader?: PublicationFrameHeader
  accepted: boolean
}

interface ActiveInboundPublication {
  readonly generation: number
  readonly deliveryId: string
  readonly publicationId: string
  readonly fromActorId?: string
}

const SOCKET_OPEN = 1
const SOCKET_CLOSED = 3

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  value instanceof ArrayBuffer ||
  Object.prototype.toString.call(value) === '[object ArrayBuffer]'

const isBinaryValue = (
  value: unknown
): value is ArrayBuffer | ArrayBufferView =>
  isArrayBuffer(value) || ArrayBuffer.isView(value)

const toOwnedArrayBuffer = (
  value: ArrayBuffer | ArrayBufferView
): ArrayBuffer => {
  if (isArrayBuffer(value)) return value
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength
  ) as ArrayBuffer
}

const duration = (startedAt: number): number =>
  Math.max(0, performance.now() - startedAt)

const failureMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim() ? error.message : fallback

const isPublicationRequest = (
  message: CollaborationRequestMessage
): message is Extract<
  CollaborationRequestMessage,
  {
    type:
      | typeof CollaborationMessageTypes.SEND_PUBLICATION
      | typeof CollaborationMessageTypes.SEND_PUBLICATIONS
  }
> =>
  message.type === CollaborationMessageTypes.SEND_PUBLICATION ||
  message.type === CollaborationMessageTypes.SEND_PUBLICATIONS

const publicationIdFromRequest = (
  message: Extract<
    CollaborationRequestMessage,
    {
      type:
        | typeof CollaborationMessageTypes.SEND_PUBLICATION
        | typeof CollaborationMessageTypes.SEND_PUBLICATIONS
    }
  >
): string =>
  message.type === CollaborationMessageTypes.SEND_PUBLICATION
    ? message.publication.publicationId
    : (message.publications[0]?.publicationId ?? message.requestId)

export class CollaborationTransportWorkerRuntime {
  private readonly createWebSocket: (endpoint: string) => WebSocket
  private readonly postMessage: TransportWorkerPost
  private codecRuntime = new PublicationCodecWorkerRuntime()
  private socket: WebSocket | null = null
  private identity: ProviderIdentity | undefined
  private generation = 0
  private connected = false
  private destroyed = false
  private intentionalClose = false
  private terminalFailure = false
  private creditSequence = 0
  private codecSequence = 0
  private deliverySequence = 0
  private activeOutboundPublication: ActiveOutboundPublication | undefined
  private activeInboundPublication: ActiveInboundPublication | undefined
  private readonly pendingControlRequestIds = new Set<string>()
  private readonly inboundCodecStartedAt = new Map<string, number>()
  private readonly inboundPublicationStartedAt = new Map<string, number>()

  constructor(options: CollaborationTransportWorkerRuntimeOptions) {
    this.createWebSocket = options.createWebSocket
    this.postMessage = options.postMessage
  }

  handle(request: CollaborationTransportWorkerRequest): void {
    if (this.destroyed) return
    if (request.type === 'connect') {
      this.connect(request)
      return
    }
    if (request.generation !== this.generation) return
    if (request.type === 'send-request') {
      this.sendRequest(request)
      return
    }
    if (request.type === 'settle-publication') {
      this.settlePublication(request)
      return
    }
    if (request.type === 'disconnect') {
      this.disconnect(request.generation)
      return
    }
    this.destroy()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.intentionalClose = true
    this.closeSocket(1000, 'provider disposed')
    this.clearOwnedState()
  }

  private connect(request: ConnectCollaborationTransportWorkerRequest): void {
    if (this.socket && this.socket.readyState !== SOCKET_CLOSED) {
      this.fail(
        'connection-failed',
        '[collaboration] transport worker is already connected',
        undefined,
        true
      )
      return
    }
    this.generation = request.generation
    this.identity = request.identity
    this.intentionalClose = false
    this.terminalFailure = false
    this.connected = false
    this.codecRuntime.destroy()
    this.codecRuntime = new PublicationCodecWorkerRuntime()
    let socket: WebSocket
    try {
      socket = this.createWebSocket(request.endpoint)
      socket.binaryType = 'arraybuffer'
    } catch (error) {
      this.fail(
        'connection-failed',
        failureMessage(
          error,
          '[collaboration] WebSocket connection construction failed'
        ),
        undefined,
        true
      )
      return
    }
    this.socket = socket
    const generation = request.generation
    socket.addEventListener('open', () => this.handleOpen(generation))
    socket.addEventListener('message', (event) =>
      this.handleSocketMessage(generation, event.data)
    )
    socket.addEventListener('error', () => this.handleSocketError(generation))
    socket.addEventListener('close', (event) =>
      this.handleSocketClose(generation, event.code, event.reason)
    )
  }

  private handleOpen(generation: number): void {
    if (!this.isCurrent(generation)) return
    const socket = this.socket
    const identity = this.identity
    if (!socket || !identity || socket.readyState !== SOCKET_OPEN) return
    try {
      socket.send(
        encodeCollaborationControlMessage({
          type: CollaborationMessageTypes.HELLO,
          identity
        })
      )
    } catch (error) {
      this.fail(
        'transport-failed',
        '[collaboration] WebSocket identity hello send failed',
        undefined,
        true,
        error
      )
    }
  }

  private handleSocketMessage(generation: number, value: unknown): void {
    if (!this.isCurrent(generation) || this.terminalFailure) return
    const receivedAt = performance.now()
    this.postCounter('collaboration:inbound-frame-entry', 1)
    if (typeof value === 'string') {
      this.postCounter(
        'collaboration:inbound-frame-byte-length',
        new TextEncoder().encode(value).byteLength
      )
      this.handleControlMessage(value, receivedAt)
      return
    }
    if (!isBinaryValue(value)) {
      this.fail(
        'transport-failed',
        '[collaboration] invalid WebSocket collaboration message',
        undefined,
        true
      )
      return
    }
    const frame = toOwnedArrayBuffer(value)
    this.postCounter(
      'collaboration:inbound-frame-byte-length',
      frame.byteLength
    )
    const jobId = `decode:${this.generation}:${++this.codecSequence}`
    this.inboundCodecStartedAt.set(jobId, receivedAt)
    this.codecRuntime.handle(
      {
        type: 'decode-publication-frame',
        jobId,
        frame
      },
      (response) => this.handleCodecResponse(response)
    )
  }

  private handleControlMessage(encoded: string, receivedAt: number): void {
    let parsed
    try {
      parsed = parseCollaborationServerMessage(
        decodeCollaborationControlMessage(encoded)
      )
    } catch {
      parsed = undefined
    }
    if (!parsed) {
      this.fail(
        'transport-failed',
        '[collaboration] invalid WebSocket collaboration message',
        undefined,
        true
      )
      return
    }
    this.postTiming(
      'collaboration:inbound-receive-to-dispatch',
      duration(receivedAt)
    )
    switch (parsed.type) {
      case CollaborationMessageTypes.READY:
        if (this.connected) {
          this.fail(
            'transport-failed',
            '[collaboration] duplicate WebSocket ready message',
            undefined,
            true
          )
          return
        }
        this.connected = true
        this.postMessage({ type: 'connected', generation: this.generation })
        return
      case CollaborationMessageTypes.SOURCE_FRAME_ADMITTED:
        this.handleSourceFrameAdmitted(parsed)
        return
      case CollaborationMessageTypes.RESPONSE:
        this.handleControlResponse(parsed)
        return
      case CollaborationMessageTypes.AWARENESS:
        this.postMessage({
          type: 'awareness',
          generation: this.generation,
          message: {
            actorId: parsed.actorId,
            clock: parsed.clock,
            state: parsed.state
          }
        })
        return
      case CollaborationMessageTypes.AWARENESS_DISCONNECT:
        this.postMessage({
          type: 'awareness-disconnect',
          generation: this.generation,
          event: {
            actorId: parsed.actorId,
            reason: 'disconnect'
          }
        })
        return
      case CollaborationMessageTypes.FAILURE:
        this.postMessage({
          type: 'failure',
          generation: this.generation,
          code: parsed.code,
          message: parsed.message,
          ...(parsed.publicationId
            ? { publicationId: parsed.publicationId }
            : {}),
          terminal: false
        })
        return
      case CollaborationMessageTypes.CONNECTION_ERROR:
        this.fail(parsed.code, parsed.message, parsed.publicationId, true)
        return
      case CollaborationMessageTypes.PUBLICATION:
      case CollaborationMessageTypes.PUBLICATIONS:
        this.fail(
          'transport-failed',
          '[collaboration] publication data must use binary frames',
          undefined,
          true
        )
    }
  }

  private sendRequest(request: SendCollaborationTransportRequest): void {
    const { message } = request
    if (!this.requireConnected(message.requestId)) return
    if (isPublicationRequest(message)) {
      this.sendPublicationRequest(message)
      return
    }
    const startedAt = performance.now()
    let encoded: string
    try {
      encoded = encodeCollaborationControlMessage(message)
    } catch {
      this.rejectRequest(
        message.requestId,
        'transport-failed',
        '[collaboration] request contains a value that JSON cannot preserve'
      )
      return
    }
    this.postTiming('collaboration:outbound-encode', duration(startedAt))
    this.postCounter(
      'collaboration:outbound-encoded-byte-length',
      new TextEncoder().encode(encoded).byteLength
    )
    this.pendingControlRequestIds.add(message.requestId)
    const sendStartedAt = performance.now()
    try {
      const socket = this.socket
      if (!socket || socket.readyState !== SOCKET_OPEN) {
        throw new Error('[collaboration] provider is not connected')
      }
      socket.send(encoded)
      this.postTiming(
        'collaboration:outbound-wire-send',
        duration(sendStartedAt)
      )
    } catch (error) {
      this.pendingControlRequestIds.delete(message.requestId)
      this.rejectRequest(
        message.requestId,
        'transport-failed',
        failureMessage(error, '[collaboration] WebSocket request send failed')
      )
    }
  }

  private sendPublicationRequest(
    message: Extract<
      CollaborationRequestMessage,
      {
        type:
          | typeof CollaborationMessageTypes.SEND_PUBLICATION
          | typeof CollaborationMessageTypes.SEND_PUBLICATIONS
      }
    >
  ): void {
    const publicationId = publicationIdFromRequest(message)
    if (this.activeOutboundPublication) {
      this.rejectRequest(
        message.requestId,
        'transport-failed',
        '[collaboration] outbound publication capacity is occupied',
        publicationId
      )
      return
    }
    const jobId = `encode:${this.generation}:${++this.codecSequence}`
    const encodeStartedAt = performance.now()
    this.codecRuntime.handle(
      {
        type: 'encode-publications',
        jobId,
        message: message as PublicationFrameMessage
      },
      (response) => {
        if (
          response.type !== 'encoded-publication-frames' ||
          response.jobId !== jobId
        ) {
          if (response.type === 'publication-codec-failure') {
            this.rejectRequest(
              message.requestId,
              'transport-failed',
              response.message,
              response.publicationId ?? publicationId
            )
          }
          return
        }
        this.postTiming(
          'collaboration:codec-worker-encode',
          response.durationMs,
          publicationId
        )
        this.postTiming(
          'collaboration:outbound-encode',
          duration(encodeStartedAt),
          publicationId
        )
        this.postCounter(
          'collaboration:outbound-encoded-byte-length',
          response.frames.reduce((total, frame) => total + frame.byteLength, 0)
        )
        this.activeOutboundPublication = {
          generation: this.generation,
          requestId: message.requestId,
          publicationId,
          frames: [...response.frames],
          nextFrameIndex: 0,
          accepted: false
        }
        this.sendNextPublicationFrame()
      }
    )
  }

  private sendNextPublicationFrame(): void {
    const active = this.activeOutboundPublication
    if (!active || !this.isCurrent(active.generation)) return
    const frame = active.frames[active.nextFrameIndex]
    if (!frame) {
      this.fail(
        'transport-failed',
        '[collaboration] publication encoding produced no frame',
        active.publicationId,
        true
      )
      return
    }
    let header: PublicationFrameHeader
    try {
      header = inspectPublicationFrameHeader(frame)
      if (header.requestId !== active.requestId) {
        throw new TypeError('encoded publication identity mismatch')
      }
    } catch {
      this.fail(
        'transport-failed',
        '[collaboration] publication frame validation failed',
        active.publicationId,
        true
      )
      return
    }
    active.inFlightHeader = header
    const startedAt = performance.now()
    try {
      const socket = this.socket
      if (!socket || socket.readyState !== SOCKET_OPEN) {
        throw new Error('[collaboration] provider is not connected')
      }
      socket.send(frame)
      this.postTiming(
        'collaboration:outbound-wire-send',
        duration(startedAt),
        active.publicationId
      )
    } catch {
      if (!active.accepted) {
        this.rejectRequest(
          active.requestId,
          'transport-failed',
          '[collaboration] publication frame send failed',
          active.publicationId
        )
      }
      this.fail(
        'transport-failed',
        '[collaboration] publication frame send failed',
        active.publicationId,
        true
      )
      return
    }
    if (!active.accepted) {
      active.accepted = true
      this.postMessage({
        type: 'request-accepted',
        generation: this.generation,
        requestId: active.requestId
      })
    }
  }

  private handleSourceFrameAdmitted(
    message: Extract<
      ReturnType<typeof parseCollaborationServerMessage>,
      { type: typeof CollaborationMessageTypes.SOURCE_FRAME_ADMITTED }
    >
  ): void {
    if (!message) return
    const active = this.activeOutboundPublication
    const header = active?.inFlightHeader
    if (
      !active ||
      !header ||
      message.requestId !== active.requestId ||
      message.frameId !== header.frameId ||
      message.publicationId !== header.publicationId ||
      message.frameByteLength !== header.frameByteLength
    ) {
      this.fail(
        'acknowledgement-failed',
        '[collaboration] source frame admission credit does not match',
        active?.publicationId ?? message.publicationId,
        true
      )
      return
    }
    active.inFlightHeader = undefined
    active.frames[active.nextFrameIndex] = undefined
    active.nextFrameIndex += 1
    if (active.nextFrameIndex < active.frames.length) {
      this.sendNextPublicationFrame()
      return
    }
    this.activeOutboundPublication = undefined
    this.postMessage({
      type: 'publication-capacity-released',
      generation: this.generation
    })
  }

  private handleControlResponse(
    message: Extract<
      ReturnType<typeof parseCollaborationServerMessage>,
      { type: typeof CollaborationMessageTypes.RESPONSE }
    >
  ): void {
    if (!message) return
    const active = this.activeOutboundPublication
    if (active?.requestId === message.requestId) {
      if (message.ok) {
        this.fail(
          'acknowledgement-failed',
          '[collaboration] publication response arrived before source frame admission',
          active.publicationId,
          true
        )
      } else {
        this.fail(
          message.error.code,
          message.error.message,
          active.publicationId,
          true
        )
      }
      return
    }
    if (!this.pendingControlRequestIds.delete(message.requestId)) return
    if (message.ok) {
      this.postMessage({
        type: 'request-accepted',
        generation: this.generation,
        requestId: message.requestId
      })
      return
    }
    this.rejectRequest(
      message.requestId,
      message.error.code,
      message.error.message
    )
  }

  private handleCodecResponse(response: PublicationCodecWorkerResponse): void {
    if (this.destroyed || this.terminalFailure) return
    if (response.type === 'publication-frame-consumed') {
      const frameStartedAt = this.inboundCodecStartedAt.get(response.jobId)
      if (
        frameStartedAt !== undefined &&
        !this.inboundPublicationStartedAt.has(response.header.publicationId)
      ) {
        this.inboundPublicationStartedAt.set(
          response.header.publicationId,
          frameStartedAt
        )
      }
      this.sendFrameConsumed(response.header)
      return
    }
    if (response.type === 'publication-frame-accepted') {
      this.finishInboundCodecTiming(
        response.jobId,
        response.durationMs,
        response.header.publicationId
      )
      return
    }
    if (response.type === 'decoded-publication') {
      this.finishInboundCodecTiming(
        response.jobId,
        response.durationMs,
        response.publication.publicationId
      )
      if (this.activeInboundPublication) {
        this.fail(
          'transport-failed',
          '[collaboration] decoded publication delivery overlapped',
          response.publication.publicationId,
          true
        )
        return
      }
      const handoffStartedAt =
        this.inboundPublicationStartedAt.get(
          response.publication.publicationId
        ) ?? performance.now()
      const deliveryId = `delivery:${this.generation}:${++this.deliverySequence}`
      this.activeInboundPublication = {
        generation: this.generation,
        deliveryId,
        publicationId: response.publication.publicationId,
        ...(response.fromActorId ? { fromActorId: response.fromActorId } : {})
      }
      this.postTiming(
        'collaboration:receiver-handoff',
        duration(handoffStartedAt),
        response.publication.publicationId
      )
      this.postMessage({
        type: 'publication-delivery',
        generation: this.generation,
        deliveryId,
        publication: response.publication,
        ...(response.fromActorId ? { fromActorId: response.fromActorId } : {}),
        ...(response.durationMs === undefined
          ? {}
          : { durationMs: response.durationMs })
      })
      this.inboundPublicationStartedAt.delete(
        response.publication.publicationId
      )
      return
    }
    if (response.type === 'decoded-publication-delivery-settled') return
    if (response.type === 'publication-codec-failure') {
      this.inboundCodecStartedAt.delete(response.jobId)
      this.fail(
        'transport-failed',
        response.message,
        response.publicationId,
        true
      )
    }
  }

  private sendFrameConsumed(header: PublicationFrameHeader): void {
    const requestId = this.nextCreditRequestId()
    try {
      this.sendInternalControl({
        type: CollaborationMessageTypes.FRAME_CONSUMED,
        requestId,
        frameId: header.frameId,
        publicationId: header.publicationId,
        frameByteLength: header.frameByteLength
      })
    } catch {
      this.fail(
        'transport-failed',
        '[collaboration] frame-consumed credit send failed',
        header.publicationId,
        true
      )
    }
  }

  private settlePublication(
    request: SettleCollaborationPublicationRequest
  ): void {
    if (
      !this.connected ||
      !this.socket ||
      this.socket.readyState !== SOCKET_OPEN
    ) {
      return
    }
    const active = this.activeInboundPublication
    if (!active || active.deliveryId !== request.deliveryId) {
      this.fail(
        'transport-failed',
        '[collaboration] invalid publication settlement',
        active?.publicationId,
        true
      )
      return
    }
    if (request.outcome === 'failed') {
      this.terminalFailure = true
      this.intentionalClose = true
      this.closeSocket(1002, 'canonical publication apply failed')
      this.clearOwnedState()
      return
    }
    if (active.fromActorId) {
      try {
        this.sendInternalControl({
          type: CollaborationMessageTypes.PEER_APPLIED,
          requestId: this.nextCreditRequestId(),
          publicationId: active.publicationId,
          fromActorId: active.fromActorId
        })
      } catch {
        this.fail(
          'transport-failed',
          '[collaboration] peer-applied receipt failed',
          active.publicationId,
          true
        )
        return
      }
    }
    this.activeInboundPublication = undefined
    const jobId = `settle:${this.generation}:${++this.codecSequence}`
    this.codecRuntime.handle(
      {
        type: 'settle-decoded-publication-delivery',
        jobId
      },
      (response) => this.handleCodecResponse(response)
    )
  }

  private sendInternalControl(message: CollaborationRequestMessage): void {
    const socket = this.socket
    if (!this.connected || !socket || socket.readyState !== SOCKET_OPEN) {
      throw new Error('[collaboration] provider is not connected')
    }
    const encoded = encodeCollaborationControlMessage(message)
    socket.send(encoded)
  }

  private nextCreditRequestId(): string {
    const actorId = this.identity?.actorId ?? 'transport'
    return `${actorId}:credit:${++this.creditSequence}`
  }

  private finishInboundCodecTiming(
    jobId: string,
    codecDurationMs: number | undefined,
    publicationId: string
  ): void {
    const startedAt = this.inboundCodecStartedAt.get(jobId)
    this.inboundCodecStartedAt.delete(jobId)
    if (codecDurationMs === undefined && startedAt === undefined) return
    this.postTiming(
      'collaboration:codec-worker-decode',
      codecDurationMs ?? (startedAt === undefined ? 0 : duration(startedAt)),
      publicationId
    )
    if (startedAt !== undefined) {
      this.postTiming(
        'collaboration:inbound-receive-to-dispatch',
        duration(startedAt),
        publicationId
      )
    }
  }

  private disconnect(generation: number): void {
    if (!this.isCurrent(generation)) return
    this.intentionalClose = true
    this.connected = false
    const socket = this.socket
    this.clearOwnedState()
    if (!socket || socket.readyState === SOCKET_CLOSED) {
      this.socket = null
      this.postMessage({ type: 'disconnected', generation })
      return
    }
    try {
      socket.close(1000, 'client disconnect')
    } catch {
      this.socket = null
      this.postMessage({ type: 'disconnected', generation })
    }
  }

  private handleSocketError(generation: number): void {
    if (!this.isCurrent(generation) || this.intentionalClose) return
    this.fail(
      this.connected ? 'transport-failed' : 'connection-failed',
      this.connected
        ? '[collaboration] WebSocket transport failed'
        : '[collaboration] WebSocket connection failed',
      undefined,
      true
    )
  }

  private handleSocketClose(
    generation: number,
    code: number,
    reason: string
  ): void {
    if (generation !== this.generation || this.destroyed) return
    this.socket = null
    const wasIntentional = this.intentionalClose
    this.connected = false
    this.clearOwnedState()
    if (this.terminalFailure && !wasIntentional) return
    this.postMessage({
      type: 'disconnected',
      generation,
      ...(code === 1005 ? {} : { code }),
      ...(reason.trim() ? { reason } : {})
    })
  }

  private requireConnected(requestId: string): boolean {
    if (
      this.connected &&
      this.socket &&
      this.socket.readyState === SOCKET_OPEN &&
      !this.terminalFailure
    ) {
      return true
    }
    this.rejectRequest(
      requestId,
      'not-connected',
      '[collaboration] provider is not connected'
    )
    return false
  }

  private rejectRequest(
    requestId: string,
    code: string,
    message: string,
    publicationId?: string
  ): void {
    this.postMessage({
      type: 'request-rejected',
      generation: this.generation,
      requestId,
      code,
      message,
      ...(publicationId ? { publicationId } : {})
    })
  }

  private postTiming(
    phase: CollaborationTransportTimingPhase,
    durationMs: number,
    publicationId?: string
  ): void {
    this.postMessage({
      type: 'timing',
      generation: this.generation,
      phase,
      durationMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0,
      ...(publicationId ? { publicationId } : {})
    })
  }

  private postCounter(
    name: CollaborationTransportDiagnosticCounterName,
    value: number
  ): void {
    this.postMessage({
      type: 'diagnostic-counter',
      generation: this.generation,
      name,
      value: Number.isFinite(value) ? Math.max(0, value) : 0
    })
  }

  private fail(
    code: string,
    message: string,
    publicationId: string | undefined,
    terminal: boolean,
    _cause?: unknown
  ): void {
    if (this.destroyed || (terminal && this.terminalFailure)) return
    this.postMessage({
      type: 'failure',
      generation: this.generation,
      code,
      message,
      ...(publicationId ? { publicationId } : {}),
      terminal
    })
    if (!terminal) return
    this.terminalFailure = true
    this.connected = false
    this.closeSocket(1002, 'collaboration transport failure')
    this.clearOwnedState()
  }

  private closeSocket(code: number, reason: string): void {
    const socket = this.socket
    this.socket = null
    if (!socket || socket.readyState === SOCKET_CLOSED) return
    try {
      socket.close(code, reason)
    } catch {
      // Teardown must still release worker-owned state.
    }
  }

  private clearOwnedState(): void {
    this.codecRuntime.destroy()
    this.activeOutboundPublication = undefined
    this.activeInboundPublication = undefined
    this.pendingControlRequestIds.clear()
    this.inboundCodecStartedAt.clear()
    this.inboundPublicationStartedAt.clear()
  }

  private isCurrent(generation: number): boolean {
    return (
      generation === this.generation && !this.destroyed && !this.terminalFailure
    )
  }
}

interface CollaborationTransportWorkerScope {
  readonly document?: unknown
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<CollaborationTransportWorkerRequest>) => void
  ): void
  postMessage(response: CollaborationTransportWorkerResponse): void
  readonly WebSocket?: typeof WebSocket
}

const workerScope = globalThis as unknown as CollaborationTransportWorkerScope
const WorkerWebSocket = workerScope.WebSocket

if (
  workerScope.document === undefined &&
  typeof workerScope.addEventListener === 'function' &&
  typeof workerScope.postMessage === 'function' &&
  typeof WorkerWebSocket === 'function'
) {
  const runtime = new CollaborationTransportWorkerRuntime({
    createWebSocket: (endpoint) => new WorkerWebSocket(endpoint),
    postMessage: (response) => workerScope.postMessage(response)
  })
  workerScope.addEventListener('message', (event) => runtime.handle(event.data))
}
