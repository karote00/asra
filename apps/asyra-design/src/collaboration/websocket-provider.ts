import type { SharedPublication } from '@asyra/factory'
import {
  emitDiagnosticCounter,
  measureBrowserDragAsyncPhase,
  measureBrowserDragPhase
} from '@asyra/utils'
import {
  ProviderFailure,
  createProviderIdentitySnapshot,
  isProviderFailureCode,
  type Provider,
  type ProviderIdentity,
  type ProviderStatus,
  type ProviderAwarenessDisconnect,
  type ProviderAwarenessMessage
} from '@asyra/collaboration'
import {
  CollaborationMessageTypes,
  PUBLICATION_FRAME_INBOUND_WINDOW_BYTES,
  decodeCollaborationControlMessage,
  encodeCollaborationControlMessage,
  inspectPublicationFrameHeader,
  parseCollaborationServerMessage,
  type CollaborationHelloMessage,
  type FrameConsumedRequest,
  type PublicationFrameHeader,
  type CollaborationRequestInput,
  type CollaborationRequestMessage,
  type PublicationFrameMessage,
  type CollaborationServerMessage,
  type SourceFrameAdmittedMessage
} from './protocol'
import type {
  PublicationCodecWorkerRequest,
  PublicationCodecWorkerResponse
} from './publication-codec-worker'

type Subscriber<T> = (value: T) => void
type PublicationConsumer = (publication: SharedPublication) => Promise<void>

const isEncodedBinaryMessage = (
  value: unknown
): value is ArrayBuffer | ArrayBufferView =>
  value instanceof ArrayBuffer ||
  ArrayBuffer.isView(value) ||
  Object.prototype.toString.call(value) === '[object ArrayBuffer]'

const isArrayBufferValue = (value: unknown): value is ArrayBuffer =>
  value instanceof ArrayBuffer ||
  Object.prototype.toString.call(value) === '[object ArrayBuffer]'

const encodedMessageByteLength = (value: unknown): number => {
  if (typeof value === 'string') {
    return new TextEncoder().encode(value).byteLength
  }
  if (isArrayBufferValue(value) || ArrayBuffer.isView(value)) {
    return value.byteLength
  }
  return 0
}

const hasDiagnosticCounterSink = (): boolean =>
  typeof (
    globalThis as typeof globalThis & {
      __asyraDiagnosticCounterSink?: unknown
    }
  ).__asyraDiagnosticCounterSink === 'function'

const recordInboundFrameDiagnostics = (value: unknown): void => {
  if (!hasDiagnosticCounterSink()) return
  emitDiagnosticCounter('collaboration:inbound-frame-entry')
  emitDiagnosticCounter(
    'collaboration:inbound-frame-byte-length',
    encodedMessageByteLength(value)
  )
}

const recordCodecWorkerTiming = (
  phase: 'decode' | 'encode',
  durationMs: number
): void => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink
  if (!sink) return
  try {
    sink(`collaboration:codec-worker-${phase}`, durationMs)
  } catch {
    // Profiling observers cannot alter codec settlement.
  }
}

const toTransferableArrayBuffer = (
  value: ArrayBuffer | ArrayBufferView
): ArrayBuffer => {
  if (isArrayBufferValue(value)) return value
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength
  ) as ArrayBuffer
}

interface PendingRequest {
  resolve(value: unknown): void
  reject(error: unknown): void
}

type OutboundPublicationRequestMessage = Extract<
  CollaborationRequestMessage,
  { type: typeof CollaborationMessageTypes.SEND_PUBLICATION }
>

interface OutboundPublicationRequest {
  readonly requestId: string
  readonly generation: number
  frames?: (ArrayBuffer | undefined)[]
  frameCount: number
  nextFrameIndex: number
  state: 'encoding' | 'queued' | 'awaiting-frame-admission'
}

interface OutboundPublicationCapacityWaiter {
  readonly generation: number
  resolve(): void
  reject(failure: ProviderFailure): void
}

interface OutboundPublicationFrameInFlight {
  readonly request: OutboundPublicationRequest
  readonly header: PublicationFrameHeader
}

interface PendingCodecEncode {
  readonly kind: 'encode'
  resolve(frames: readonly ArrayBuffer[]): void
  reject(error: ProviderFailure): void
}

interface PendingInboundCodecJob {
  readonly frameByteLength: number
  readonly assemblyKey?: string
  consumed: boolean
}

interface ActiveInboundPublicationDelivery {
  readonly token: object
  readonly publicationId: string
  readonly assemblyKey: string
  readonly publication: SharedPublication
  readonly fromActorId?: string
  readonly generation: number
  state: 'awaiting-consumer' | 'applying' | 'failed'
}

interface QueuedInboundFrame {
  readonly frame: ArrayBuffer
  readonly assemblyKey?: string
}

type PublicationCodecWorkerEventName = 'error' | 'message' | 'messageerror'

interface PublicationCodecWorkerEvent {
  readonly data?: PublicationCodecWorkerResponse
  readonly error?: unknown
}

type PublicationCodecWorkerListener = (
  event: PublicationCodecWorkerEvent
) => void

export interface PublicationCodecWorkerLike {
  postMessage(
    message: PublicationCodecWorkerRequest,
    transfer?: readonly Transferable[]
  ): void
  addEventListener(
    type: PublicationCodecWorkerEventName,
    listener: PublicationCodecWorkerListener
  ): void
  removeEventListener(
    type: PublicationCodecWorkerEventName,
    listener: PublicationCodecWorkerListener
  ): void
  terminate(): void
}

export interface CollaborationWebSocketProviderOptions {
  endpoint: string
  identity: ProviderIdentity
  codecWorkerFactory?: () => PublicationCodecWorkerLike
}

const toFailure = (
  code: unknown,
  message: unknown,
  publicationId?: string
): ProviderFailure =>
  new ProviderFailure(
    isProviderFailureCode(code) ? code : 'transport-failed',
    typeof message === 'string' && message.trim()
      ? message
      : '[collaboration] WebSocket transport failed',
    undefined,
    publicationId
  )

const inboundPublicationAssemblyKey = (
  header: PublicationFrameHeader
): string =>
  JSON.stringify([
    header.messageType,
    header.fromActorId ?? '',
    header.publicationId,
    header.publicationIndex,
    header.publicationCount
  ])

const deepFreezePublication = <T>(
  value: T,
  seen = new WeakSet<object>()
): T => {
  if (value === null || typeof value !== 'object') return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  Reflect.ownKeys(object).forEach((key) =>
    deepFreezePublication(Reflect.get(object, key), seen)
  )
  return Object.freeze(value)
}

export class CollaborationWebSocketProvider implements Provider {
  readonly identity: ProviderIdentity

  private readonly endpoint: string
  private readonly codecWorkerFactory: () => PublicationCodecWorkerLike
  private status: ProviderStatus = 'idle'
  private socket: WebSocket | null = null
  private connectPromise: Promise<void> | null = null
  private cancelConnect?: (failure: ProviderFailure) => void
  private connectionGeneration = 0
  private requestSequence = 0
  private codecSequence = 0
  private creditSequence = 0
  private codecWorker: PublicationCodecWorkerLike | null = null
  private codecWorkerGeneration = 0
  private readonly pendingCodecEncodes = new Map<string, PendingCodecEncode>()
  private readonly inboundFrames: QueuedInboundFrame[] = []
  private readonly pendingInboundCodecJobs = new Map<
    string,
    PendingInboundCodecJob
  >()
  private inboundFrameIngressBytes = 0
  private workerInboundReservedBytes = 0
  private readonly workerInboundAssemblyBytes = new Map<string, number>()
  private workerInboundOversizedAssemblyKey: string | null = null
  private pendingInboundSettlementJobId: string | null = null
  private publicationConsumer: PublicationConsumer | null = null
  private activeInboundPublicationDelivery: ActiveInboundPublicationDelivery | null =
    null
  private readonly pendingRequests = new Map<string, PendingRequest>()
  private readonly outboundPublicationRequests = new Map<
    string,
    OutboundPublicationRequest
  >()
  private outboundPublicationCapacityReserved = false
  private readonly outboundPublicationCapacityWaiters: OutboundPublicationCapacityWaiter[] =
    []
  private activeOutboundPublicationRequest: OutboundPublicationRequest | null =
    null
  private outboundPublicationFrameInFlight: OutboundPublicationFrameInFlight | null =
    null
  private readonly statusSubscribers = new Set<Subscriber<ProviderStatus>>()
  private readonly awarenessSubscribers = new Set<
    Subscriber<ProviderAwarenessMessage>
  >()
  private readonly awarenessDisconnectSubscribers = new Set<
    Subscriber<ProviderAwarenessDisconnect>
  >()
  private readonly failureSubscribers = new Set<Subscriber<ProviderFailure>>()

  constructor(options: CollaborationWebSocketProviderOptions) {
    this.endpoint = options.endpoint
    this.identity = createProviderIdentitySnapshot(options.identity)
    this.codecWorkerFactory =
      options.codecWorkerFactory ??
      (() =>
        new Worker(new URL('./publication-codec-worker.ts', import.meta.url), {
          type: 'module'
        }) as unknown as PublicationCodecWorkerLike)
  }

  connect(): Promise<void> {
    this.requireUsable()
    if (this.status === 'connected') return Promise.resolve()
    if (this.connectPromise) return this.connectPromise

    const generation = ++this.connectionGeneration
    this.setStatus('connecting')
    try {
      this.startCodecWorker(generation)
    } catch (error) {
      const failure = new ProviderFailure(
        'connection-failed',
        '[collaboration] publication codec worker construction failed',
        error
      )
      this.setStatus('failed')
      this.emit(this.failureSubscribers, failure)
      return Promise.reject(failure)
    }
    let socket: WebSocket
    try {
      socket = new WebSocket(this.endpoint)
    } catch (error) {
      const failure = new ProviderFailure(
        'connection-failed',
        '[collaboration] WebSocket construction failed',
        error
      )
      this.stopCodecWorker(failure)
      this.setStatus('failed')
      this.emit(this.failureSubscribers, failure)
      return Promise.reject(failure)
    }
    socket.binaryType = 'arraybuffer'
    this.socket = socket
    this.connectPromise = new Promise<void>((resolve, reject) => {
      let settled = false
      let postReadyFailureReported = false

      const reportPostReadyFailure = (
        failure: ProviderFailure,
        status: Extract<ProviderStatus, 'disconnected' | 'failed'>
      ): void => {
        if (
          postReadyFailureReported ||
          generation !== this.connectionGeneration ||
          this.status === 'disposed'
        ) {
          return
        }
        postReadyFailureReported = true
        this.rejectPending(failure)
        this.stopCodecWorker(failure)
        this.setStatus(status)
        this.emit(this.failureSubscribers, failure)
      }

      const rejectConnection = (failure: ProviderFailure) => {
        if (settled) return
        settled = true
        if (generation === this.connectionGeneration) {
          this.connectPromise = null
          this.cancelConnect = undefined
        }
        if (this.status === 'disposed') {
          reject(
            new ProviderFailure(
              'disposed',
              '[collaboration] provider was disposed before connection ready'
            )
          )
          return
        }
        if (
          generation !== this.connectionGeneration ||
          this.status === 'disconnected'
        ) {
          reject(
            failure.code === 'not-connected'
              ? failure
              : new ProviderFailure(
                  'not-connected',
                  '[collaboration] provider connection was cancelled',
                  failure
                )
          )
          return
        }
        this.stopCodecWorker(failure)
        this.setStatus('failed')
        this.emit(this.failureSubscribers, failure)
        reject(failure)
      }
      this.cancelConnect = rejectConnection

      socket.addEventListener('open', () => {
        const hello: CollaborationHelloMessage = {
          type: CollaborationMessageTypes.HELLO,
          identity: this.identity
        }
        let encodedHello: string
        try {
          encodedHello = encodeCollaborationControlMessage(hello)
        } catch (error) {
          rejectConnection(
            new ProviderFailure(
              'transport-failed',
              '[collaboration] identity contains a value that JSON cannot preserve',
              error
            )
          )
          socket.close(1007, 'invalid hello payload')
          return
        }
        try {
          socket.send(encodedHello)
        } catch (error) {
          rejectConnection(
            new ProviderFailure(
              'transport-failed',
              '[collaboration] WebSocket identity hello send failed',
              error
            )
          )
          socket.close(1011, 'hello send failed')
        }
      })
      socket.addEventListener('message', (event) => {
        if (generation !== this.connectionGeneration) return
        recordInboundFrameDiagnostics(event.data)
        measureBrowserDragPhase(
          'collaboration:inbound-receive-to-dispatch',
          () => {
            if (
              typeof event.data !== 'string' &&
              isEncodedBinaryMessage(event.data)
            ) {
              if (!settled) {
                const failure = new ProviderFailure(
                  'transport-failed',
                  '[collaboration] publication frame arrived before ready'
                )
                rejectConnection(failure)
                socket.close(1002, 'publication before ready')
                return
              }
              this.enqueueInboundFrame(event.data)
              return
            }
            const message = this.parseMessage(event.data)
            if (!message) {
              const failure = new ProviderFailure(
                'transport-failed',
                '[collaboration] invalid WebSocket server message'
              )
              if (!settled) {
                rejectConnection(failure)
              } else {
                this.rejectPending(failure)
                this.setStatus('failed')
                this.emit(this.failureSubscribers, failure)
              }
              socket.close(1002, 'invalid server message')
              return
            }
            if (message.type === CollaborationMessageTypes.READY) {
              if (!settled) {
                if (this.status === 'disposed') {
                  rejectConnection(
                    new ProviderFailure(
                      'disposed',
                      '[collaboration] provider was disposed before connection ready'
                    )
                  )
                  return
                }
                settled = true
                this.connectPromise = null
                this.cancelConnect = undefined
                this.setStatus('connected')
                resolve()
              }
              return
            }
            if (message.type === CollaborationMessageTypes.CONNECTION_ERROR) {
              rejectConnection(toFailure(message.code, message.message))
              socket.close()
              return
            }
            this.handleMessage(message)
          }
        )
      })
      socket.addEventListener('error', () => {
        const failure = new ProviderFailure(
          'connection-failed',
          '[collaboration] WebSocket connection failed'
        )
        if (!settled) {
          rejectConnection(failure)
          return
        }
        if (this.status !== 'failed') {
          reportPostReadyFailure(failure, 'failed')
        }
      })
      socket.addEventListener('close', (event) => {
        if (generation !== this.connectionGeneration) return
        this.socket = null
        const closeReason = event.reason.trim()
        const closeDetail =
          event.code === 1005 && closeReason.length === 0
            ? ''
            : ` (${event.code}${closeReason ? `: ${closeReason}` : ''})`
        const closeFailure = new ProviderFailure(
          'not-connected',
          `[collaboration] WebSocket connection closed${closeDetail}`
        )
        if (!settled) {
          rejectConnection(
            new ProviderFailure(
              'connection-failed',
              '[collaboration] WebSocket closed before ready'
            )
          )
          return
        }
        if (this.status === 'failed') {
          this.rejectPending(closeFailure)
          this.stopCodecWorker(closeFailure)
          return
        }
        reportPostReadyFailure(closeFailure, 'disconnected')
      })
    })
    return this.connectPromise
  }

  async disconnect(): Promise<void> {
    this.requireUsable()
    const socket = this.socket
    this.connectionGeneration += 1
    this.socket = null
    this.cancelConnect?.(
      new ProviderFailure(
        'not-connected',
        '[collaboration] provider connection was cancelled'
      )
    )
    this.cancelConnect = undefined
    this.connectPromise = null
    this.setStatus('disconnected')
    const disconnectFailure = new ProviderFailure(
      'not-connected',
      '[collaboration] provider disconnected before request completion'
    )
    this.rejectPending(disconnectFailure)
    this.stopCodecWorker(disconnectFailure)
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      return
    }
    await new Promise<void>((resolve) => {
      socket.addEventListener('close', () => resolve(), { once: true })
      socket.close(1000, 'client disconnect')
    })
  }

  async reconnect(): Promise<void> {
    this.requireUsable()
    if (this.socket) await this.disconnect()
    await this.connect()
  }

  async destroy(): Promise<void> {
    if (this.status === 'disposed') return
    const socket = this.socket
    this.connectionGeneration += 1
    this.setStatus('disposed')
    const disposedFailure = new ProviderFailure(
      'disposed',
      '[collaboration] provider is disposed'
    )
    this.cancelConnect?.(disposedFailure)
    this.cancelConnect = undefined
    this.connectPromise = null
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close(1000, 'provider disposed')
    }
    this.socket = null
    this.rejectPending(disposedFailure)
    this.stopCodecWorker(disposedFailure)
    this.statusSubscribers.clear()
    this.publicationConsumer = null
    this.awarenessSubscribers.clear()
    this.awarenessDisconnectSubscribers.clear()
    this.failureSubscribers.clear()
  }

  getStatus(): ProviderStatus {
    return this.status
  }

  onStatusChange(subscriber: Subscriber<ProviderStatus>): () => void {
    return this.subscribe(this.statusSubscribers, subscriber)
  }

  async sendPublication(publication: SharedPublication): Promise<void> {
    await measureBrowserDragAsyncPhase(
      'collaboration:outbound-send-to-acceptance',
      () =>
        this.request({
          type: CollaborationMessageTypes.SEND_PUBLICATION,
          publication
        })
    )
  }

  onPublication(consume: PublicationConsumer): () => void {
    this.requireUsable()
    if (this.publicationConsumer) {
      throw new Error(
        '[collaboration] an inbound publication consumer is already registered'
      )
    }
    this.publicationConsumer = consume
    this.consumeActiveInboundPublication()
    return () => {
      if (this.publicationConsumer === consume) {
        this.publicationConsumer = null
      }
    }
  }

  async sendAwareness(message: ProviderAwarenessMessage): Promise<void> {
    if (message.actorId !== this.identity.actorId) {
      const failure = new ProviderFailure(
        'invalid-awareness-actor',
        '[collaboration] awareness actor must match provider identity'
      )
      this.emit(this.failureSubscribers, failure)
      throw failure
    }
    await this.request({
      type: CollaborationMessageTypes.SEND_AWARENESS,
      message
    })
  }

  onAwareness(subscriber: Subscriber<ProviderAwarenessMessage>): () => void {
    return this.subscribe(this.awarenessSubscribers, subscriber)
  }

  onAwarenessDisconnect(
    subscriber: Subscriber<ProviderAwarenessDisconnect>
  ): () => void {
    return this.subscribe(this.awarenessDisconnectSubscribers, subscriber)
  }

  onFailure(subscriber: Subscriber<ProviderFailure>): () => void {
    return this.subscribe(this.failureSubscribers, subscriber)
  }

  private async request(input: CollaborationRequestInput): Promise<unknown> {
    this.requireConnected()
    const requestId = `${this.identity.actorId}:${++this.requestSequence}`
    const message: CollaborationRequestMessage = {
      ...input,
      requestId
    }
    if (message.type === CollaborationMessageTypes.SEND_PUBLICATION) {
      return this.requestPublication(message)
    }
    const socket = this.socket as WebSocket
    let encodedMessages: readonly (string | ArrayBuffer)[]
    try {
      encodedMessages = await measureBrowserDragAsyncPhase(
        'collaboration:outbound-encode',
        async () => [encodeCollaborationControlMessage(message)]
      )
    } catch (error) {
      if (error instanceof ProviderFailure) throw error
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] request contains a value that JSON cannot preserve',
        error
      )
    }
    emitDiagnosticCounter(
      'collaboration:outbound-encoded-byte-length',
      encodedMessages.reduce(
        (total, encodedMessage) =>
          total +
          (typeof encodedMessage === 'string'
            ? new TextEncoder().encode(encodedMessage).byteLength
            : encodedMessage.byteLength),
        0
      )
    )
    this.requireConnected()
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject })
      try {
        measureBrowserDragPhase('collaboration:outbound-wire-send', () => {
          encodedMessages.forEach((encodedMessage) =>
            socket.send(encodedMessage)
          )
        })
      } catch (error) {
        this.pendingRequests.delete(requestId)
        reject(toFailure('transport-failed', String(error)))
      }
    })
  }

  private async requestPublication(
    message: OutboundPublicationRequestMessage
  ): Promise<void> {
    const generation = this.connectionGeneration
    await this.acquireOutboundPublicationCapacity(generation)
    try {
      this.requireConnectedGeneration(generation)
    } catch (error) {
      this.releaseOutboundPublicationCapacity()
      throw error
    }

    const request: OutboundPublicationRequest = {
      requestId: message.requestId,
      generation,
      frameCount: 0,
      nextFrameIndex: 0,
      state: 'encoding'
    }
    this.outboundPublicationRequests.set(request.requestId, request)
    this.activeOutboundPublicationRequest = request

    let frames: readonly ArrayBuffer[]
    try {
      frames = await measureBrowserDragAsyncPhase(
        'collaboration:outbound-encode',
        () => this.encodePublicationRequest(message)
      )
      this.requireConnectedGeneration(generation)
      this.validateOutboundPublicationFrames(request, frames)
    } catch (error) {
      this.removeOutboundPublicationRequest(request)
      throw error instanceof ProviderFailure
        ? error
        : new ProviderFailure(
            'transport-failed',
            '[collaboration] publication encode failed',
            error
          )
    }

    request.frames = [...frames]
    request.frameCount = frames.length
    request.state = 'queued'
    emitDiagnosticCounter(
      'collaboration:outbound-encoded-byte-length',
      frames.reduce((total, frame) => total + frame.byteLength, 0)
    )
    const synchronousFailure = this.pumpOutboundPublicationFrame()
    if (synchronousFailure) throw synchronousFailure
  }

  private acquireOutboundPublicationCapacity(
    generation: number
  ): Promise<void> {
    this.requireConnectedGeneration(generation)
    if (!this.outboundPublicationCapacityReserved) {
      this.outboundPublicationCapacityReserved = true
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      this.outboundPublicationCapacityWaiters.push({
        generation,
        resolve,
        reject
      })
    })
  }

  private releaseOutboundPublicationCapacity(): void {
    if (!this.outboundPublicationCapacityReserved) return
    this.outboundPublicationCapacityReserved = false
    while (this.outboundPublicationCapacityWaiters.length > 0) {
      const waiter = this.outboundPublicationCapacityWaiters.shift()
      if (!waiter) return
      if (
        waiter.generation !== this.connectionGeneration ||
        this.status !== 'connected' ||
        this.socket?.readyState !== WebSocket.OPEN
      ) {
        waiter.reject(
          new ProviderFailure(
            'not-connected',
            '[collaboration] provider disconnected before publication acceptance'
          )
        )
        continue
      }
      this.outboundPublicationCapacityReserved = true
      waiter.resolve()
      return
    }
  }

  private validateOutboundPublicationFrames(
    request: OutboundPublicationRequest,
    frames: readonly ArrayBuffer[]
  ): void {
    if (frames.length === 0) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] publication codec returned no frames'
      )
    }
    const headers = frames.map((frame) => inspectPublicationFrameHeader(frame))
    const first = headers[0]
    if (
      !first ||
      first.messageType !== CollaborationMessageTypes.SEND_PUBLICATION ||
      first.requestId !== request.requestId ||
      first.publicationCount !== 1 ||
      first.publicationIndex !== 0 ||
      first.chunkCount !== headers.length
    ) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] encoded publication frame identity is invalid'
      )
    }
    const frameIds = new Set<string>()
    headers.forEach((header, index) => {
      if (
        header.messageType !== first.messageType ||
        header.requestId !== first.requestId ||
        header.publicationId !== first.publicationId ||
        header.publicationCount !== 1 ||
        header.publicationIndex !== 0 ||
        header.chunkCount !== first.chunkCount ||
        header.chunkIndex !== index ||
        frameIds.has(header.frameId)
      ) {
        throw new ProviderFailure(
          'transport-failed',
          '[collaboration] encoded publication frames are not one ordered request'
        )
      }
      frameIds.add(header.frameId)
    })
  }

  private pumpOutboundPublicationFrame(): ProviderFailure | undefined {
    if (this.outboundPublicationFrameInFlight) return

    const request = this.activeOutboundPublicationRequest
    if (!request) return
    if (
      request.state === 'encoding' ||
      request.state === 'awaiting-frame-admission'
    ) {
      return
    }

    const frame = request.frames?.[request.nextFrameIndex]
    if (!frame) {
      const failure = new ProviderFailure(
        'transport-failed',
        '[collaboration] publication frame lane is incomplete'
      )
      this.failOutboundPublicationRequest(request, failure)
      return failure
    }

    let header: PublicationFrameHeader
    try {
      header = inspectPublicationFrameHeader(frame)
    } catch (error) {
      const failure = new ProviderFailure(
        'transport-failed',
        '[collaboration] encoded publication frame is invalid',
        error
      )
      this.failOutboundPublicationRequest(request, failure)
      return failure
    }
    if (header.requestId !== request.requestId) {
      const failure = new ProviderFailure(
        'transport-failed',
        '[collaboration] encoded publication frame request does not match'
      )
      this.failOutboundPublicationRequest(request, failure)
      return failure
    }

    const socket = this.socket
    if (
      request.generation !== this.connectionGeneration ||
      this.status !== 'connected' ||
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      const failure = new ProviderFailure(
        'not-connected',
        '[collaboration] provider disconnected before publication send'
      )
      this.failOutboundPublicationRequest(request, failure)
      return failure
    }

    request.state = 'awaiting-frame-admission'
    this.outboundPublicationFrameInFlight = { request, header }
    try {
      measureBrowserDragPhase('collaboration:outbound-wire-send', () => {
        socket.send(frame)
      })
    } catch (error) {
      this.outboundPublicationFrameInFlight = null
      const failure = new ProviderFailure(
        'transport-failed',
        '[collaboration] publication frame send failed',
        error
      )
      this.failOutboundPublicationRequest(request, failure)
      return failure
    }
    return undefined
  }

  private handleSourceFrameAdmitted(message: SourceFrameAdmittedMessage): void {
    const inFlight = this.outboundPublicationFrameInFlight
    if (
      !inFlight ||
      message.requestId !== inFlight.header.requestId ||
      message.frameId !== inFlight.header.frameId ||
      message.publicationId !== inFlight.header.publicationId ||
      message.frameByteLength !== inFlight.header.frameByteLength
    ) {
      this.failSourceFrameAdmission(
        '[collaboration] source frame admission credit does not match'
      )
      return
    }

    const request = inFlight.request
    this.outboundPublicationFrameInFlight = null
    if (request.frames) {
      request.frames[request.nextFrameIndex] = undefined
    }
    request.nextFrameIndex += 1
    if (request.nextFrameIndex === request.frameCount) {
      this.removeOutboundPublicationRequest(request)
      return
    }
    request.state = 'queued'
    this.pumpOutboundPublicationFrame()
  }

  private failSourceFrameAdmission(message: string): void {
    const failure = new ProviderFailure('acknowledgement-failed', message)
    this.rejectPending(failure)
    if (
      this.status !== 'disposed' &&
      this.status !== 'disconnected' &&
      this.status !== 'failed'
    ) {
      this.setStatus('failed')
      this.emit(this.failureSubscribers, failure)
    }
    const socket = this.socket
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close(1002, 'source frame admission failed')
    }
  }

  private failOutboundPublicationRequest(
    request: OutboundPublicationRequest,
    failure: ProviderFailure
  ): void {
    this.removeOutboundPublicationRequest(request)
    if (
      this.status !== 'disposed' &&
      this.status !== 'disconnected' &&
      this.status !== 'failed'
    ) {
      this.setStatus('failed')
      this.emit(this.failureSubscribers, failure)
    }
    const socket = this.socket
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close(1011, 'publication delivery failed')
    }
  }

  private removeOutboundPublicationRequest(
    request: OutboundPublicationRequest
  ): void {
    this.outboundPublicationRequests.delete(request.requestId)
    if (this.activeOutboundPublicationRequest === request) {
      this.activeOutboundPublicationRequest = null
    }
    if (this.outboundPublicationFrameInFlight?.request === request) {
      this.outboundPublicationFrameInFlight = null
    }
    this.releaseOutboundPublicationCapacity()
  }

  private clearOutboundPublicationRequests(): void {
    this.outboundPublicationRequests.clear()
    this.activeOutboundPublicationRequest = null
    this.outboundPublicationFrameInFlight = null
    this.outboundPublicationCapacityReserved = false
  }

  private startCodecWorker(generation: number): void {
    if (this.codecWorker) {
      throw new Error('[collaboration] publication codec worker is active')
    }
    const worker = this.codecWorkerFactory()
    this.codecWorker = worker
    this.codecWorkerGeneration = generation
    const onMessage: PublicationCodecWorkerListener = (event) => {
      if (
        this.codecWorker !== worker ||
        this.codecWorkerGeneration !== generation ||
        !event.data
      ) {
        return
      }
      this.handleCodecWorkerResponse(event.data)
    }
    const onFailure: PublicationCodecWorkerListener = (event) => {
      if (
        this.codecWorker !== worker ||
        this.codecWorkerGeneration !== generation
      ) {
        return
      }
      this.failCodecWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] publication codec worker failed',
          event.error
        )
      )
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onFailure)
    worker.addEventListener('messageerror', onFailure)
  }

  private stopCodecWorker(failure: ProviderFailure): void {
    const worker = this.codecWorker
    this.codecWorker = null
    this.codecWorkerGeneration = 0
    this.pendingInboundCodecJobs.clear()
    this.inboundFrameIngressBytes = 0
    this.workerInboundReservedBytes = 0
    this.workerInboundAssemblyBytes.clear()
    this.workerInboundOversizedAssemblyKey = null
    this.pendingInboundSettlementJobId = null
    this.activeInboundPublicationDelivery = null
    this.inboundFrames.length = 0
    this.pendingCodecEncodes.forEach(({ reject }) => reject(failure))
    this.pendingCodecEncodes.clear()
    worker?.terminate()
  }

  private encodePublicationRequest(
    message: Extract<
      CollaborationRequestMessage,
      {
        type:
          | typeof CollaborationMessageTypes.SEND_PUBLICATION
          | typeof CollaborationMessageTypes.SEND_PUBLICATIONS
      }
    >
  ): Promise<readonly ArrayBuffer[]> {
    const worker = this.codecWorker
    if (!worker) {
      return Promise.reject(
        new ProviderFailure(
          'not-connected',
          '[collaboration] publication codec worker is unavailable'
        )
      )
    }
    const jobId = `${this.identity.actorId}:codec:${++this.codecSequence}`
    return new Promise((resolve, reject) => {
      this.pendingCodecEncodes.set(jobId, {
        kind: 'encode',
        resolve,
        reject
      })
      try {
        worker.postMessage({
          type: 'encode-publications',
          jobId,
          message: message as PublicationFrameMessage
        })
      } catch (error) {
        this.pendingCodecEncodes.delete(jobId)
        reject(
          new ProviderFailure(
            'transport-failed',
            '[collaboration] publication codec worker send failed',
            error
          )
        )
      }
    })
  }

  private enqueueInboundFrame(value: ArrayBuffer | ArrayBufferView): void {
    const frame = toTransferableArrayBuffer(value)
    let assemblyKey: string | undefined
    try {
      assemblyKey = inboundPublicationAssemblyKey(
        inspectPublicationFrameHeader(frame)
      )
    } catch {
      // The worker remains the frame-validation owner.
    }
    const nextIngressBytes = this.inboundFrameIngressBytes + frame.byteLength
    const isOnlyOversizedFrame =
      this.inboundFrameIngressBytes === 0 &&
      frame.byteLength > PUBLICATION_FRAME_INBOUND_WINDOW_BYTES
    if (
      nextIngressBytes > PUBLICATION_FRAME_INBOUND_WINDOW_BYTES &&
      !isOnlyOversizedFrame
    ) {
      this.failCodecWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] inbound publication frame window exceeded'
        )
      )
      return
    }
    this.inboundFrameIngressBytes = nextIngressBytes
    this.inboundFrames.push({
      frame,
      ...(assemblyKey ? { assemblyKey } : {})
    })
    this.pumpInboundFrames()
  }

  private pumpInboundFrames(): void {
    const worker = this.codecWorker
    if (!worker) {
      this.failCodecWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] publication codec worker is unavailable'
        )
      )
      return
    }
    while (this.inboundFrames.length > 0) {
      const queued = this.inboundFrames[0]
      if (!queued || !this.canReserveWorkerInboundFrame(queued)) return
      this.inboundFrames.shift()
      const { frame, assemblyKey } = queued
      const jobId = `${this.identity.actorId}:decode:${++this.codecSequence}`
      this.reserveWorkerInboundFrame(queued)
      this.pendingInboundCodecJobs.set(jobId, {
        frameByteLength: frame.byteLength,
        ...(assemblyKey ? { assemblyKey } : {}),
        consumed: false
      })
      try {
        worker.postMessage(
          {
            type: 'decode-publication-frame',
            jobId,
            frame
          },
          [frame]
        )
      } catch (error) {
        this.pendingInboundCodecJobs.delete(jobId)
        this.failCodecWorker(
          new ProviderFailure(
            'transport-failed',
            '[collaboration] publication frame transfer failed',
            error
          )
        )
        return
      }
    }
  }

  private canReserveWorkerInboundFrame(queued: QueuedInboundFrame): boolean {
    const nextReservedBytes =
      this.workerInboundReservedBytes + queued.frame.byteLength
    if (nextReservedBytes <= PUBLICATION_FRAME_INBOUND_WINDOW_BYTES) {
      return true
    }
    if (
      queued.assemblyKey &&
      this.workerInboundOversizedAssemblyKey === queued.assemblyKey
    ) {
      return true
    }
    if (this.workerInboundOversizedAssemblyKey) return false
    if (
      this.workerInboundReservedBytes === 0 &&
      queued.frame.byteLength > PUBLICATION_FRAME_INBOUND_WINDOW_BYTES
    ) {
      return true
    }
    const assemblyBytes = queued.assemblyKey
      ? (this.workerInboundAssemblyBytes.get(queued.assemblyKey) ?? 0)
      : 0
    return (
      assemblyBytes > 0 && this.workerInboundReservedBytes === assemblyBytes
    )
  }

  private reserveWorkerInboundFrame(queued: QueuedInboundFrame): void {
    this.workerInboundReservedBytes += queued.frame.byteLength
    if (queued.assemblyKey) {
      this.workerInboundAssemblyBytes.set(
        queued.assemblyKey,
        (this.workerInboundAssemblyBytes.get(queued.assemblyKey) ?? 0) +
          queued.frame.byteLength
      )
    }
    if (
      this.workerInboundReservedBytes >
        PUBLICATION_FRAME_INBOUND_WINDOW_BYTES &&
      !this.workerInboundOversizedAssemblyKey
    ) {
      this.workerInboundOversizedAssemblyKey =
        queued.assemblyKey ?? 'unidentified-oversized-frame'
    }
  }

  private releaseWorkerInboundAssembly(assemblyKey: string): void {
    const byteLength = this.workerInboundAssemblyBytes.get(assemblyKey) ?? 0
    this.workerInboundAssemblyBytes.delete(assemblyKey)
    this.workerInboundReservedBytes = Math.max(
      0,
      this.workerInboundReservedBytes - byteLength
    )
    if (this.workerInboundOversizedAssemblyKey === assemblyKey) {
      this.workerInboundOversizedAssemblyKey = null
    }
  }

  private settleDecodedPublicationDelivery(): void {
    if (this.pendingInboundSettlementJobId) return
    const worker = this.codecWorker
    if (!worker) {
      this.failCodecWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] publication codec worker is unavailable'
        )
      )
      return
    }
    const jobId = `${this.identity.actorId}:decode:${++this.codecSequence}`
    this.pendingInboundSettlementJobId = jobId
    try {
      worker.postMessage({
        type: 'settle-decoded-publication-delivery',
        jobId
      })
    } catch (error) {
      this.pendingInboundSettlementJobId = null
      this.failCodecWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] decoded publication settlement failed',
          error
        )
      )
    }
  }

  private handleCodecWorkerResponse(
    response: PublicationCodecWorkerResponse
  ): void {
    if (response.type === 'encoded-publication-frames') {
      const pending = this.pendingCodecEncodes.get(response.jobId)
      if (!pending) return
      this.pendingCodecEncodes.delete(response.jobId)
      if (
        response.frames.length === 0 ||
        !response.frames.every((frame) => isArrayBufferValue(frame))
      ) {
        pending.reject(
          new ProviderFailure(
            'transport-failed',
            '[collaboration] publication codec worker returned invalid frames'
          )
        )
        return
      }
      recordCodecWorkerTiming('encode', response.durationMs)
      pending.resolve(
        response.frames.map((frame) => toTransferableArrayBuffer(frame))
      )
      return
    }
    if (response.type === 'publication-codec-failure') {
      const pending = this.pendingCodecEncodes.get(response.jobId)
      const failure = new ProviderFailure(
        'transport-failed',
        response.message,
        undefined,
        response.publicationId
      )
      if (pending) {
        this.pendingCodecEncodes.delete(response.jobId)
        pending.reject(failure)
        return
      }
      if (
        !this.pendingInboundCodecJobs.has(response.jobId) &&
        response.jobId !== this.pendingInboundSettlementJobId
      ) {
        return
      }
      this.pendingInboundCodecJobs.delete(response.jobId)
      if (response.jobId === this.pendingInboundSettlementJobId) {
        this.pendingInboundSettlementJobId = null
      }
      this.failCodecWorker(failure)
      return
    }
    if (response.type === 'publication-frame-consumed') {
      const pending = this.pendingInboundCodecJobs.get(response.jobId)
      if (!pending || pending.consumed) return
      if (pending.frameByteLength !== response.header.frameByteLength) {
        this.failCodecWorker(
          new ProviderFailure(
            'transport-failed',
            '[collaboration] inbound publication frame credit mismatch',
            undefined,
            response.header.publicationId
          )
        )
        return
      }
      try {
        this.sendFrameConsumedCredit(response.header)
        pending.consumed = true
        this.inboundFrameIngressBytes = Math.max(
          0,
          this.inboundFrameIngressBytes - pending.frameByteLength
        )
      } catch (error) {
        this.failCodecWorker(
          error instanceof ProviderFailure
            ? error
            : new ProviderFailure(
                'transport-failed',
                '[collaboration] frame-consumed credit failed',
                error
              )
        )
      }
      return
    }
    if (response.type === 'decoded-publication-delivery-settled') {
      if (response.jobId !== this.pendingInboundSettlementJobId) return
      this.pendingInboundSettlementJobId = null
      return
    }
    const pendingFrame = this.pendingInboundCodecJobs.get(response.jobId)
    if (!pendingFrame && response.type !== 'decoded-publication') return
    if (pendingFrame && !pendingFrame.consumed) {
      this.failCodecWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] codec completed a frame before consumption credit'
        )
      )
      return
    }
    this.pendingInboundCodecJobs.delete(response.jobId)
    if (response.durationMs !== undefined) {
      recordCodecWorkerTiming('decode', response.durationMs)
    }
    if (response.type === 'decoded-publication') {
      this.handleDecodedPublication(response)
    }
  }

  private handleDecodedPublication(
    response: Extract<
      PublicationCodecWorkerResponse,
      { type: 'decoded-publication' }
    >
  ): void {
    if (this.activeInboundPublicationDelivery) {
      this.failCodecWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] codec released overlapping publication deliveries',
          undefined,
          response.publication.publicationId
        )
      )
      return
    }
    const assemblyKey = inboundPublicationAssemblyKey(response.header)
    const publication = deepFreezePublication(response.publication)
    this.activeInboundPublicationDelivery = {
      token: {},
      publicationId: publication.publicationId,
      assemblyKey,
      publication,
      ...(response.fromActorId ? { fromActorId: response.fromActorId } : {}),
      generation: this.connectionGeneration,
      state: 'awaiting-consumer'
    }
    this.releaseWorkerInboundAssembly(assemblyKey)
    this.pumpInboundFrames()
    this.consumeActiveInboundPublication()
  }

  private consumeActiveInboundPublication(): void {
    const delivery = this.activeInboundPublicationDelivery
    const consume = this.publicationConsumer
    if (!delivery || delivery.state !== 'awaiting-consumer' || !consume) return
    delivery.state = 'applying'
    void Promise.resolve()
      .then(() => consume(delivery.publication))
      .then(
        () => this.settleInboundPublicationDelivery(delivery),
        (error: unknown) =>
          this.abortInboundPublicationDelivery(delivery, error)
      )
  }

  private abortInboundPublicationDelivery(
    delivery: ActiveInboundPublicationDelivery,
    error: unknown
  ): void {
    if (this.activeInboundPublicationDelivery?.token !== delivery.token) return
    delivery.state = 'failed'
    const failure = new ProviderFailure(
      'transport-failed',
      '[collaboration] remote publication apply failed',
      error,
      delivery.publicationId
    )
    this.rejectPending(failure)
    this.stopCodecWorker(failure)
    if (this.status !== 'disposed' && this.status !== 'disconnected') {
      this.setStatus('failed')
    }
    const socket = this.socket
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close(1011, 'remote publication apply failed')
    }
  }

  private settleInboundPublicationDelivery(
    delivery: ActiveInboundPublicationDelivery
  ): void {
    if (
      this.activeInboundPublicationDelivery?.token !== delivery.token ||
      delivery.generation !== this.connectionGeneration
    ) {
      return
    }
    this.activeInboundPublicationDelivery = null
    if (delivery.fromActorId) {
      this.sendPeerAppliedReceipt(
        delivery.publicationId,
        delivery.fromActorId,
        delivery.generation
      )
    }
    this.settleDecodedPublicationDelivery()
    this.pumpInboundFrames()
  }

  private sendFrameConsumedCredit(
    header: Extract<
      PublicationCodecWorkerResponse,
      { type: 'publication-frame-consumed' }
    >['header']
  ): void {
    this.requireConnected()
    const socket = this.socket as WebSocket
    const credit: FrameConsumedRequest = {
      type: CollaborationMessageTypes.FRAME_CONSUMED,
      requestId: `${this.identity.actorId}:credit:${++this.creditSequence}`,
      frameId: header.frameId,
      publicationId: header.publicationId,
      frameByteLength: header.frameByteLength
    }
    socket.send(encodeCollaborationControlMessage(credit))
  }

  private sendPeerAppliedReceipt(
    publicationId: string,
    fromActorId: string,
    generation: number
  ): void {
    try {
      this.requireConnectedGeneration(generation)
      const socket = this.socket as WebSocket
      const receipt: CollaborationRequestMessage = {
        type: CollaborationMessageTypes.PEER_APPLIED,
        requestId: `${this.identity.actorId}:credit:${++this.creditSequence}`,
        publicationId,
        fromActorId
      }
      socket.send(encodeCollaborationControlMessage(receipt))
    } catch (error) {
      const failure =
        error instanceof ProviderFailure
          ? error
          : new ProviderFailure(
              'transport-failed',
              '[collaboration] peer-applied receipt failed',
              error,
              publicationId
            )
      this.failCodecWorker(failure)
    }
  }

  private failCodecWorker(failure: ProviderFailure): void {
    this.stopCodecWorker(failure)
    this.rejectPending(failure)
    if (this.status === 'connecting' && this.cancelConnect) {
      this.cancelConnect(failure)
    } else if (
      this.status !== 'disposed' &&
      this.status !== 'disconnected' &&
      this.status !== 'failed'
    ) {
      this.setStatus('failed')
      this.emit(this.failureSubscribers, failure)
    }
    const socket = this.socket
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close(1002, 'publication codec failure')
    }
  }

  private handleMessage(
    message: Exclude<
      CollaborationServerMessage,
      { type: typeof CollaborationMessageTypes.READY }
    >
  ): void {
    if (message.type === CollaborationMessageTypes.SOURCE_FRAME_ADMITTED) {
      this.handleSourceFrameAdmitted(message)
      return
    }
    if (message.type === CollaborationMessageTypes.RESPONSE) {
      const publicationRequest = this.outboundPublicationRequests.get(
        message.requestId
      )
      if (publicationRequest) {
        if (message.ok) {
          this.failSourceFrameAdmission(
            '[collaboration] publication response arrived before source frame admission'
          )
          return
        }
        this.failOutboundPublicationRequest(
          publicationRequest,
          toFailure(message.error?.code, message.error?.message)
        )
        return
      }
      const pending = this.pendingRequests.get(message.requestId)
      if (!pending) return
      this.pendingRequests.delete(message.requestId)
      if (message.ok) {
        pending.resolve(undefined)
      } else {
        pending.reject(toFailure(message.error?.code, message.error?.message))
      }
      return
    }
    if (message.type === CollaborationMessageTypes.AWARENESS) {
      this.emit(this.awarenessSubscribers, {
        actorId: message.actorId,
        clock: message.clock,
        state: message.state
      })
      return
    }
    if (message.type === CollaborationMessageTypes.AWARENESS_DISCONNECT) {
      this.emit(this.awarenessDisconnectSubscribers, {
        actorId: message.actorId,
        reason: 'disconnect'
      })
      return
    }
    if (message.type === CollaborationMessageTypes.FAILURE) {
      this.emit(
        this.failureSubscribers,
        toFailure(message.code, message.message, message.publicationId)
      )
    }
  }

  private parseMessage(value: unknown): CollaborationServerMessage | undefined {
    let message: CollaborationServerMessage | undefined
    try {
      if (typeof value !== 'string') return
      const decoded = measureBrowserDragPhase(
        'collaboration:inbound-wire-decode',
        () => decodeCollaborationControlMessage(value)
      )
      message = measureBrowserDragPhase(
        'collaboration:inbound-protocol-validate',
        () => parseCollaborationServerMessage(decoded)
      )
      if (
        message?.type === CollaborationMessageTypes.PUBLICATION ||
        message?.type === CollaborationMessageTypes.PUBLICATIONS
      ) {
        return
      }
    } catch {
      // Report the same protocol failure for invalid JSON and invalid payloads.
    }
    return message
  }

  private requireUsable(): void {
    if (this.status === 'disposed') {
      throw new ProviderFailure(
        'disposed',
        '[collaboration] provider is disposed'
      )
    }
  }

  private requireConnected(): void {
    this.requireUsable()
    if (
      this.status === 'connected' &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      return
    }
    const failure = new ProviderFailure(
      'not-connected',
      '[collaboration] provider is not connected'
    )
    this.emit(this.failureSubscribers, failure)
    throw failure
  }

  private requireConnectedGeneration(generation: number): void {
    if (generation !== this.connectionGeneration) {
      throw new ProviderFailure(
        'not-connected',
        '[collaboration] provider connection generation changed'
      )
    }
    this.requireConnected()
  }

  private rejectPending(error: ProviderFailure): void {
    const capacityWaiters = this.outboundPublicationCapacityWaiters.splice(0)
    this.clearOutboundPublicationRequests()
    capacityWaiters.forEach(({ reject }) => reject(error))
    this.pendingRequests.forEach(({ reject }) => reject(error))
    this.pendingRequests.clear()
  }

  private setStatus(status: ProviderStatus): void {
    if (this.status === status) return
    this.status = status
    this.emit(this.statusSubscribers, status)
  }

  private subscribe<T>(
    subscribers: Set<Subscriber<T>>,
    subscriber: Subscriber<T>
  ): () => void {
    this.requireUsable()
    subscribers.add(subscriber)
    return () => subscribers.delete(subscriber)
  }

  private emit<T>(subscribers: Set<Subscriber<T>>, value: T): void {
    ;[...subscribers].forEach((subscriber) => {
      try {
        subscriber(value)
      } catch {
        // Transport observers cannot alter provider settlement.
      }
    })
  }
}
