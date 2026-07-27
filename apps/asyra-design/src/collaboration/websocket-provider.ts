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
  type InboundPublication,
  type ProviderAwarenessDisconnect,
  type ProviderAwarenessMessage
} from '@asyra/collaboration'
import {
  CollaborationMessageTypes,
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
  {
    type:
      | typeof CollaborationMessageTypes.SEND_PUBLICATION
      | typeof CollaborationMessageTypes.SEND_PUBLICATIONS
  }
>

interface OutboundPublicationRequest {
  readonly requestId: string
  readonly generation: number
  frames?: (ArrayBuffer | undefined)[]
  frameCount: number
  nextFrameIndex: number
  state:
    | 'encoding'
    | 'queued'
    | 'awaiting-frame-admission'
    | 'awaiting-final-response'
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

export class CollaborationWebSocketProvider implements Provider {
  readonly identity: ProviderIdentity
  readonly maxConcurrentPublicationSends = 1
  readonly maxPublicationsPerSend = 4

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
  private readonly inboundFrames: ArrayBuffer[] = []
  private activeInboundCodecJobId: string | null = null
  private readonly pendingRequests = new Map<string, PendingRequest>()
  private readonly outboundPublicationRequests = new Map<
    string,
    OutboundPublicationRequest
  >()
  private readonly outboundPublicationQueue: OutboundPublicationRequest[] = []
  private activeOutboundPublicationRequest: OutboundPublicationRequest | null =
    null
  private outboundPublicationFrameInFlight: OutboundPublicationFrameInFlight | null =
    null
  private readonly statusSubscribers = new Set<Subscriber<ProviderStatus>>()
  private readonly publicationSubscribers = new Set<
    Subscriber<InboundPublication>
  >()
  private readonly publicationBatchSubscribers = new Set<
    Subscriber<readonly InboundPublication[]>
  >()
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
        rejectConnection(
          new ProviderFailure(
            'connection-failed',
            '[collaboration] WebSocket connection failed'
          )
        )
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
        this.rejectPending(closeFailure)
        this.stopCodecWorker(closeFailure)
        if (!settled) {
          rejectConnection(
            new ProviderFailure(
              'connection-failed',
              '[collaboration] WebSocket closed before ready'
            )
          )
          return
        }
        if (this.status !== 'disposed' && this.status !== 'failed') {
          this.setStatus('disconnected')
        }
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
    this.publicationSubscribers.clear()
    this.publicationBatchSubscribers.clear()
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
      'collaboration:outbound-send-to-ack',
      () =>
        this.request({
          type: CollaborationMessageTypes.SEND_PUBLICATION,
          publication
        })
    )
  }

  async sendPublications(
    publications: readonly SharedPublication[]
  ): Promise<void> {
    if (publications.length === 0) return
    emitDiagnosticCounter('collaboration:outbound-batch-request-count')
    emitDiagnosticCounter(
      'collaboration:outbound-batch-publication-count',
      publications.length
    )
    await measureBrowserDragAsyncPhase(
      'collaboration:outbound-batch-send-to-ack',
      () =>
        this.request({
          type: CollaborationMessageTypes.SEND_PUBLICATIONS,
          publications
        })
    )
  }

  onPublication(subscriber: Subscriber<InboundPublication>): () => void {
    return this.subscribe(this.publicationSubscribers, subscriber)
  }

  onPublications(
    subscriber: Subscriber<readonly InboundPublication[]>
  ): () => void {
    return this.subscribe(this.publicationBatchSubscribers, subscriber)
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

  async sendPeerApplied(
    publicationId: string,
    fromActorId: string
  ): Promise<void> {
    await this.request({
      type: CollaborationMessageTypes.PEER_APPLIED,
      publicationId,
      fromActorId
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
    if (
      message.type === CollaborationMessageTypes.SEND_PUBLICATION ||
      message.type === CollaborationMessageTypes.SEND_PUBLICATIONS
    ) {
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

  private requestPublication(
    message: OutboundPublicationRequestMessage
  ): Promise<unknown> {
    const request: OutboundPublicationRequest = {
      requestId: message.requestId,
      generation: this.connectionGeneration,
      frameCount: 0,
      nextFrameIndex: 0,
      state: 'encoding'
    }
    this.outboundPublicationRequests.set(request.requestId, request)
    this.outboundPublicationQueue.push(request)

    const settlement = new Promise((resolve, reject) => {
      this.pendingRequests.set(request.requestId, { resolve, reject })
    })

    void measureBrowserDragAsyncPhase('collaboration:outbound-encode', () =>
      this.encodePublicationRequest(message)
    ).then(
      (frames) => {
        if (
          request.generation !== this.connectionGeneration ||
          !this.outboundPublicationRequests.has(request.requestId)
        ) {
          return
        }
        request.frames = [...frames]
        request.frameCount = frames.length
        request.state = 'queued'
        emitDiagnosticCounter(
          'collaboration:outbound-encoded-byte-length',
          frames.reduce((total, frame) => total + frame.byteLength, 0)
        )
        this.pumpOutboundPublicationFrame()
      },
      (error: unknown) => {
        if (!this.outboundPublicationRequests.has(request.requestId)) return
        const failure =
          error instanceof ProviderFailure
            ? error
            : new ProviderFailure(
                'transport-failed',
                '[collaboration] publication encode failed',
                error
              )
        this.rejectOutboundPublicationRequest(request, failure)
      }
    )

    return settlement
  }

  private pumpOutboundPublicationFrame(): void {
    if (this.outboundPublicationFrameInFlight) return

    let request = this.activeOutboundPublicationRequest
    if (!request) {
      request = this.outboundPublicationQueue[0] ?? null
      if (!request || request.state === 'encoding') return
      this.activeOutboundPublicationRequest = request
    }
    if (
      request.state === 'encoding' ||
      request.state === 'awaiting-frame-admission' ||
      request.state === 'awaiting-final-response'
    ) {
      return
    }

    const frame = request.frames?.[request.nextFrameIndex]
    if (!frame) {
      this.failSourceFrameAdmission(
        '[collaboration] publication frame lane is incomplete'
      )
      return
    }

    let header: PublicationFrameHeader
    try {
      header = inspectPublicationFrameHeader(frame)
    } catch (error) {
      this.rejectOutboundPublicationRequest(
        request,
        new ProviderFailure(
          'transport-failed',
          '[collaboration] encoded publication frame is invalid',
          error
        )
      )
      return
    }
    if (header.requestId !== request.requestId) {
      this.rejectOutboundPublicationRequest(
        request,
        new ProviderFailure(
          'transport-failed',
          '[collaboration] encoded publication frame request does not match'
        )
      )
      return
    }

    const socket = this.socket
    if (
      request.generation !== this.connectionGeneration ||
      this.status !== 'connected' ||
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      this.rejectOutboundPublicationRequest(
        request,
        new ProviderFailure(
          'not-connected',
          '[collaboration] provider disconnected before publication send'
        )
      )
      return
    }

    request.state = 'awaiting-frame-admission'
    this.outboundPublicationFrameInFlight = { request, header }
    try {
      measureBrowserDragPhase('collaboration:outbound-wire-send', () => {
        socket.send(frame)
      })
    } catch (error) {
      this.outboundPublicationFrameInFlight = null
      this.rejectOutboundPublicationRequest(
        request,
        new ProviderFailure(
          'transport-failed',
          '[collaboration] publication frame send failed',
          error
        )
      )
    }
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
      request.state = 'awaiting-final-response'
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

  private rejectOutboundPublicationRequest(
    request: OutboundPublicationRequest,
    failure: ProviderFailure
  ): void {
    const pending = this.pendingRequests.get(request.requestId)
    this.pendingRequests.delete(request.requestId)
    this.removeOutboundPublicationRequest(request)
    pending?.reject(failure)
    this.pumpOutboundPublicationFrame()
  }

  private removeOutboundPublicationRequest(
    request: OutboundPublicationRequest
  ): void {
    this.outboundPublicationRequests.delete(request.requestId)
    const queueIndex = this.outboundPublicationQueue.indexOf(request)
    if (queueIndex >= 0) this.outboundPublicationQueue.splice(queueIndex, 1)
    if (this.activeOutboundPublicationRequest === request) {
      this.activeOutboundPublicationRequest = null
    }
    if (this.outboundPublicationFrameInFlight?.request === request) {
      this.outboundPublicationFrameInFlight = null
    }
  }

  private clearOutboundPublicationRequests(): void {
    this.outboundPublicationRequests.clear()
    this.outboundPublicationQueue.length = 0
    this.activeOutboundPublicationRequest = null
    this.outboundPublicationFrameInFlight = null
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
    this.activeInboundCodecJobId = null
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
    this.inboundFrames.push(toTransferableArrayBuffer(value))
    this.pumpInboundFrame()
  }

  private pumpInboundFrame(): void {
    if (this.activeInboundCodecJobId || this.inboundFrames.length === 0) return
    const worker = this.codecWorker
    const frame = this.inboundFrames.shift()
    if (!worker || !frame) {
      this.failCodecWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] publication codec worker is unavailable'
        )
      )
      return
    }
    const jobId = `${this.identity.actorId}:decode:${++this.codecSequence}`
    this.activeInboundCodecJobId = jobId
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
      this.activeInboundCodecJobId = null
      this.failCodecWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] publication frame transfer failed',
          error
        )
      )
    }
  }

  private releaseNextDecodedPublication(): void {
    if (this.activeInboundCodecJobId) return
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
    this.activeInboundCodecJobId = jobId
    try {
      worker.postMessage({
        type: 'release-decoded-publication',
        jobId
      })
    } catch (error) {
      this.activeInboundCodecJobId = null
      this.failCodecWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] decoded publication release failed',
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
      if (response.jobId !== this.activeInboundCodecJobId) return
      this.activeInboundCodecJobId = null
      this.failCodecWorker(failure)
      return
    }
    if (response.jobId !== this.activeInboundCodecJobId) return
    if (response.type === 'publication-frame-consumed') {
      try {
        this.sendFrameConsumedCredit(response.header)
      } catch (error) {
        this.activeInboundCodecJobId = null
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
    if (response.durationMs !== undefined) {
      recordCodecWorkerTiming('decode', response.durationMs)
    }
    if (response.type === 'decoded-publication') {
      this.emitInboundPublications([response.publication], response.fromActorId)
    }
    this.activeInboundCodecJobId = null
    if (
      response.type === 'decoded-publication' &&
      response.hasPendingPublication
    ) {
      this.releaseNextDecodedPublication()
      return
    }
    this.pumpInboundFrame()
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
      const pending = this.pendingRequests.get(message.requestId)
      if (!pending) return
      const publicationRequest = this.outboundPublicationRequests.get(
        message.requestId
      )
      if (
        message.ok &&
        publicationRequest &&
        publicationRequest.state !== 'awaiting-final-response'
      ) {
        this.failSourceFrameAdmission(
          '[collaboration] publication response arrived before source frame admission'
        )
        return
      }
      this.pendingRequests.delete(message.requestId)
      if (publicationRequest) {
        this.removeOutboundPublicationRequest(publicationRequest)
      }
      if (message.ok) {
        pending.resolve(undefined)
      } else {
        pending.reject(toFailure(message.error?.code, message.error?.message))
      }
      this.pumpOutboundPublicationFrame()
      return
    }
    if (message.type === CollaborationMessageTypes.PUBLICATION) {
      this.emitInboundPublications([message.publication], message.fromActorId)
      return
    }
    if (message.type === CollaborationMessageTypes.PUBLICATIONS) {
      this.emitInboundPublications(message.publications, message.fromActorId)
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

  private emitInboundPublications(
    publications: readonly SharedPublication[],
    fromActorId?: string
  ): void {
    const detached = measureBrowserDragPhase(
      'collaboration:inbound-provider-clone',
      () => structuredClone(publications)
    )
    const inbound = detached.map((publication) =>
      Object.freeze({
        publication,
        ...(fromActorId ? { fromActorId } : {})
      })
    )
    const batchSubscribers = [...this.publicationBatchSubscribers]
    const batchSnapshots = batchSubscribers.map((_, index) =>
      index === 0 ? inbound : structuredClone(inbound)
    )
    const singleSubscribers = [...this.publicationSubscribers]
    const singlePublicationSnapshots = singleSubscribers.map(() =>
      structuredClone(inbound)
    )
    batchSubscribers.forEach((subscriber, index) => {
      const snapshot = batchSnapshots[index]
      if (!snapshot) return
      try {
        subscriber(snapshot)
      } catch {
        // Transport observers cannot alter provider settlement.
      }
    })
    singleSubscribers.forEach((subscriber, subscriberIndex) => {
      const snapshots = singlePublicationSnapshots[subscriberIndex]
      if (!snapshots) return
      for (const publication of snapshots) {
        try {
          subscriber(publication)
        } catch {
          // Transport observers cannot alter provider settlement.
        }
      }
    })
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

  private rejectPending(error: ProviderFailure): void {
    this.clearOutboundPublicationRequests()
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
