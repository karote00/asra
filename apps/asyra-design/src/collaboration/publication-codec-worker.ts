import type { SharedPublication } from '@asyra/factory'
import {
  CollaborationMessageTypes,
  decodePublicationFramePublication,
  encodePublicationMessageFrames,
  inspectPublicationFrameHeader,
  type EncodePublicationMessageFramesOptions,
  type PublicationFrameHeader,
  type PublicationFrameMessage
} from './protocol'

export interface EncodePublicationsWorkerRequest {
  readonly type: 'encode-publications'
  readonly jobId: string
  readonly message: PublicationFrameMessage
  readonly options?: EncodePublicationMessageFramesOptions
}

export interface DecodePublicationFrameWorkerRequest {
  readonly type: 'decode-publication-frame'
  readonly jobId: string
  readonly frame: ArrayBuffer
}

export interface ReleaseDecodedPublicationWorkerRequest {
  readonly type: 'release-decoded-publication'
  readonly jobId: string
}

export type PublicationCodecWorkerRequest =
  | EncodePublicationsWorkerRequest
  | DecodePublicationFrameWorkerRequest
  | ReleaseDecodedPublicationWorkerRequest

export interface EncodedPublicationFramesWorkerResponse {
  readonly type: 'encoded-publication-frames'
  readonly jobId: string
  readonly frames: readonly ArrayBuffer[]
  readonly durationMs: number
}

export interface PublicationFrameConsumedWorkerResponse {
  readonly type: 'publication-frame-consumed'
  readonly jobId: string
  readonly header: PublicationFrameHeader
}

export interface PublicationFrameAcceptedWorkerResponse {
  readonly type: 'publication-frame-accepted'
  readonly jobId: string
  readonly header: PublicationFrameHeader
  readonly durationMs: number
}

export interface DecodedPublicationWorkerResponse {
  readonly type: 'decoded-publication'
  readonly jobId: string
  readonly header: PublicationFrameHeader
  readonly publication: SharedPublication
  readonly fromActorId?: string
  readonly durationMs?: number
  readonly hasPendingPublication: boolean
}

export interface PublicationCodecFailureWorkerResponse {
  readonly type: 'publication-codec-failure'
  readonly jobId: string
  readonly message: string
  readonly publicationId?: string
}

export type PublicationCodecWorkerResponse =
  | EncodedPublicationFramesWorkerResponse
  | PublicationFrameConsumedWorkerResponse
  | PublicationFrameAcceptedWorkerResponse
  | DecodedPublicationWorkerResponse
  | PublicationCodecFailureWorkerResponse

export type PublicationCodecWorkerPost = (
  response: PublicationCodecWorkerResponse,
  transfer?: readonly Transferable[]
) => void

interface InboundPublicationAssembly {
  readonly header: PublicationFrameHeader
  readonly frames: (ArrayBuffer | undefined)[]
  receivedCount: number
  decoded?: Omit<
    DecodedPublicationWorkerResponse,
    'hasPendingPublication' | 'jobId' | 'type'
  >
}

const elapsed = (startedAt: number): number => performance.now() - startedAt

const failureMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : '[collaboration] publication codec worker failed'

const inboundAssemblyKey = (header: PublicationFrameHeader): string =>
  JSON.stringify([
    header.messageType,
    header.fromActorId ?? '',
    header.publicationId,
    header.publicationIndex,
    header.publicationCount
  ])

const isInboundPublicationFrame = (header: PublicationFrameHeader): boolean =>
  header.messageType === CollaborationMessageTypes.PUBLICATION ||
  header.messageType === CollaborationMessageTypes.PUBLICATIONS

const isArrayBufferValue = (value: unknown): value is ArrayBuffer =>
  value instanceof ArrayBuffer ||
  Object.prototype.toString.call(value) === '[object ArrayBuffer]'

export class PublicationCodecWorkerRuntime {
  private readonly inboundAssemblies = new Map<
    string,
    InboundPublicationAssembly
  >()
  private readonly inboundAssemblyOrder: string[] = []
  private destroyed = false

  handle(
    request: PublicationCodecWorkerRequest,
    post: PublicationCodecWorkerPost
  ): void {
    if (this.destroyed) {
      post({
        type: 'publication-codec-failure',
        jobId: request.jobId,
        message: '[collaboration] publication codec worker is disposed'
      })
      return
    }
    if (request.type === 'encode-publications') {
      this.encode(request, post)
      return
    }
    if (request.type === 'release-decoded-publication') {
      this.release(request, post)
      return
    }
    this.decode(request, post)
  }

  destroy(): void {
    this.destroyed = true
    this.inboundAssemblies.clear()
    this.inboundAssemblyOrder.length = 0
  }

  private encode(
    request: EncodePublicationsWorkerRequest,
    post: PublicationCodecWorkerPost
  ): void {
    const startedAt = performance.now()
    try {
      const frames = encodePublicationMessageFrames(
        request.message,
        request.options
      )
      post(
        {
          type: 'encoded-publication-frames',
          jobId: request.jobId,
          frames,
          durationMs: elapsed(startedAt)
        },
        frames
      )
    } catch (error) {
      post({
        type: 'publication-codec-failure',
        jobId: request.jobId,
        message: failureMessage(error)
      })
    }
  }

  private decode(
    request: DecodePublicationFrameWorkerRequest,
    post: PublicationCodecWorkerPost
  ): void {
    const startedAt = performance.now()
    let header: PublicationFrameHeader | undefined
    try {
      header = inspectPublicationFrameHeader(request.frame)
      if (!isInboundPublicationFrame(header)) {
        throw new TypeError(
          '[collaboration] invalid inbound publication frame direction'
        )
      }
      post({
        type: 'publication-frame-consumed',
        jobId: request.jobId,
        header
      })
      const key = inboundAssemblyKey(header)
      let assembly = this.inboundAssemblies.get(key)
      if (!assembly) {
        assembly = {
          header,
          frames: new Array<ArrayBuffer | undefined>(header.chunkCount),
          receivedCount: 0
        }
        this.inboundAssemblies.set(key, assembly)
        this.inboundAssemblyOrder.push(key)
      } else if (
        assembly.header.chunkCount !== header.chunkCount ||
        assembly.header.messageType !== header.messageType ||
        assembly.header.fromActorId !== header.fromActorId
      ) {
        throw new TypeError(
          '[collaboration] inconsistent inbound publication frames'
        )
      }
      if (assembly.frames[header.chunkIndex]) {
        throw new TypeError(
          '[collaboration] duplicate inbound publication frame'
        )
      }
      assembly.frames[header.chunkIndex] = request.frame
      assembly.receivedCount += 1
      if (assembly.receivedCount < header.chunkCount) {
        post({
          type: 'publication-frame-accepted',
          jobId: request.jobId,
          header,
          durationMs: elapsed(startedAt)
        })
        return
      }
      const frames = assembly.frames.filter((frame): frame is ArrayBuffer =>
        isArrayBufferValue(frame)
      )
      const decoded = decodePublicationFramePublication(frames)
      assembly.decoded = {
        header: decoded.header,
        publication: decoded.publication,
        ...(decoded.header.fromActorId
          ? { fromActorId: decoded.header.fromActorId }
          : {}),
        durationMs: elapsed(startedAt)
      }
      if (!this.releaseReadyPublication(request.jobId, post)) {
        const { durationMs, ...pendingDecodedPublication } = assembly.decoded
        assembly.decoded = pendingDecodedPublication
        post({
          type: 'publication-frame-accepted',
          jobId: request.jobId,
          header,
          durationMs: durationMs ?? elapsed(startedAt)
        })
      }
    } catch (error) {
      if (header) {
        const key = inboundAssemblyKey(header)
        this.inboundAssemblies.delete(key)
        const orderIndex = this.inboundAssemblyOrder.indexOf(key)
        if (orderIndex >= 0) this.inboundAssemblyOrder.splice(orderIndex, 1)
      }
      post({
        type: 'publication-codec-failure',
        jobId: request.jobId,
        message: failureMessage(error),
        ...(header?.publicationId
          ? { publicationId: header.publicationId }
          : {})
      })
    }
  }

  private release(
    request: ReleaseDecodedPublicationWorkerRequest,
    post: PublicationCodecWorkerPost
  ): void {
    if (this.releaseReadyPublication(request.jobId, post)) return
    post({
      type: 'publication-codec-failure',
      jobId: request.jobId,
      message: '[collaboration] no decoded publication is ready'
    })
  }

  private releaseReadyPublication(
    jobId: string,
    post: PublicationCodecWorkerPost
  ): boolean {
    const key = this.inboundAssemblyOrder[0]
    if (!key) return false
    const assembly = this.inboundAssemblies.get(key)
    if (!assembly?.decoded) return false
    this.inboundAssemblyOrder.shift()
    this.inboundAssemblies.delete(key)
    const nextKey = this.inboundAssemblyOrder[0]
    const hasPendingPublication = nextKey
      ? this.inboundAssemblies.get(nextKey)?.decoded !== undefined
      : false
    post({
      type: 'decoded-publication',
      jobId,
      ...assembly.decoded,
      hasPendingPublication
    })
    return true
  }
}

interface PublicationCodecWorkerScope {
  readonly document?: unknown
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<PublicationCodecWorkerRequest>) => void
  ): void
  postMessage(
    response: PublicationCodecWorkerResponse,
    transfer?: readonly Transferable[]
  ): void
}

const workerScope = globalThis as unknown as PublicationCodecWorkerScope

if (
  workerScope.document === undefined &&
  typeof workerScope.addEventListener === 'function' &&
  typeof workerScope.postMessage === 'function'
) {
  const runtime = new PublicationCodecWorkerRuntime()
  workerScope.addEventListener('message', (event) => {
    runtime.handle(event.data, (response, transfer = []) =>
      workerScope.postMessage(response, transfer)
    )
  })
}
