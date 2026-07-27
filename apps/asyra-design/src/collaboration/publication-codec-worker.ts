import type { SharedPublication } from '@asyra/factory'
import {
  CollaborationMessageTypes,
  PUBLICATION_FRAME_INBOUND_WINDOW_BYTES,
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

export interface DecodedPublicationReleaseAcceptedWorkerResponse {
  readonly type: 'decoded-publication-release-accepted'
  readonly jobId: string
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
  | DecodedPublicationReleaseAcceptedWorkerResponse
  | PublicationCodecFailureWorkerResponse

export type PublicationCodecWorkerPost = (
  response: PublicationCodecWorkerResponse,
  transfer?: readonly Transferable[]
) => void

interface InboundPublicationAssembly {
  readonly header: PublicationFrameHeader
  readonly frames: (ArrayBuffer | undefined)[]
  readonly frameIds: string[]
  readonly acceptedChunkIndexes: Set<number>
  receivedCount: number
  acceptedByteLength: number
  decoded?: Omit<
    DecodedPublicationWorkerResponse,
    'hasPendingPublication' | 'jobId' | 'type'
  >
}

interface InboundFrameToAccept {
  readonly request: DecodePublicationFrameWorkerRequest
  readonly post: PublicationCodecWorkerPost
  readonly header: PublicationFrameHeader
  readonly assemblyKey: string
}

interface ActiveDecodedPublicationLease {
  readonly assemblyKey: string
  readonly acceptedByteLength: number
  readonly frameIds: readonly string[]
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

const inboundBurstKey = (header: PublicationFrameHeader): string =>
  JSON.stringify([
    header.messageType,
    header.fromActorId ?? '',
    header.requestId ?? '',
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
  private readonly inboundFrameIds = new Set<string>()
  private readonly inboundBurstNextPublicationIndex = new Map<string, number>()
  private activeDecodedPublicationLease:
    | ActiveDecodedPublicationLease
    | undefined
  private inboundReservedBytes = 0
  private oversizedAssemblyKey: string | undefined
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
    this.inboundFrameIds.clear()
    this.inboundBurstNextPublicationIndex.clear()
    this.activeDecodedPublicationLease = undefined
    this.inboundReservedBytes = 0
    this.oversizedAssemblyKey = undefined
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
    let header: PublicationFrameHeader | undefined
    try {
      header = inspectPublicationFrameHeader(request.frame)
      if (!isInboundPublicationFrame(header)) {
        throw new TypeError(
          '[collaboration] invalid inbound publication frame direction'
        )
      }
      if (this.inboundFrameIds.has(header.frameId)) {
        throw new TypeError(
          '[collaboration] duplicate inbound publication frame'
        )
      }
      const assemblyKey = inboundAssemblyKey(header)
      this.validateInboundFrameOrder(header, assemblyKey)
      if (!this.canAcceptInboundFrame(header, assemblyKey)) {
        throw new TypeError(
          '[collaboration] inbound publication frame window exceeded'
        )
      }
      this.inboundFrameIds.add(header.frameId)
      this.acceptInboundFrame({
        request,
        post,
        header,
        assemblyKey
      })
    } catch (error) {
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
    const activeLease = this.activeDecodedPublicationLease
    if (!activeLease) {
      post({
        type: 'publication-codec-failure',
        jobId: request.jobId,
        message: '[collaboration] no decoded publication lease is active'
      })
      return
    }
    this.activeDecodedPublicationLease = undefined
    this.inboundReservedBytes = Math.max(
      0,
      this.inboundReservedBytes - activeLease.acceptedByteLength
    )
    activeLease.frameIds.forEach((frameId) =>
      this.inboundFrameIds.delete(frameId)
    )
    if (this.oversizedAssemblyKey === activeLease.assemblyKey) {
      this.oversizedAssemblyKey = undefined
    }
    if (!this.releaseReadyPublication(request.jobId, post)) {
      post({
        type: 'decoded-publication-release-accepted',
        jobId: request.jobId
      })
    }
  }

  private validateInboundFrameOrder(
    header: PublicationFrameHeader,
    assemblyKey: string
  ): void {
    const assembly = this.inboundAssemblies.get(assemblyKey)
    if (assembly) {
      if (header.chunkIndex !== assembly.receivedCount) {
        throw new TypeError(
          '[collaboration] out-of-order inbound publication chunk'
        )
      }
      return
    }
    const burstKey = inboundBurstKey(header)
    const nextPublicationIndex =
      this.inboundBurstNextPublicationIndex.get(burstKey) ?? 0
    if (
      header.chunkIndex !== 0 ||
      header.publicationIndex !== nextPublicationIndex
    ) {
      throw new TypeError(
        '[collaboration] out-of-order inbound publication frame'
      )
    }
  }

  private canAcceptInboundFrame(
    header: PublicationFrameHeader,
    assemblyKey: string
  ): boolean {
    const nextReservedBytes = this.inboundReservedBytes + header.frameByteLength
    if (nextReservedBytes <= PUBLICATION_FRAME_INBOUND_WINDOW_BYTES) return true
    if (this.oversizedAssemblyKey === assemblyKey) return true
    if (this.oversizedAssemblyKey) return false
    const assembly = this.inboundAssemblies.get(assemblyKey)
    return (
      (this.inboundReservedBytes === 0 &&
        header.frameByteLength > PUBLICATION_FRAME_INBOUND_WINDOW_BYTES) ||
      Boolean(assembly && assembly.acceptedByteLength > 0)
    )
  }

  private acceptInboundFrame(pending: InboundFrameToAccept): boolean {
    const startedAt = performance.now()
    const { request, post, header, assemblyKey } = pending
    try {
      let assembly = this.inboundAssemblies.get(assemblyKey)
      if (!assembly) {
        assembly = {
          header,
          frames: new Array<ArrayBuffer | undefined>(header.chunkCount),
          frameIds: [],
          acceptedChunkIndexes: new Set<number>(),
          receivedCount: 0,
          acceptedByteLength: 0
        }
        this.inboundAssemblies.set(assemblyKey, assembly)
        this.inboundAssemblyOrder.push(assemblyKey)
      } else if (
        assembly.header.chunkCount !== header.chunkCount ||
        assembly.header.messageType !== header.messageType ||
        assembly.header.fromActorId !== header.fromActorId
      ) {
        throw new TypeError(
          '[collaboration] inconsistent inbound publication frames'
        )
      }
      if (assembly.acceptedChunkIndexes.has(header.chunkIndex)) {
        throw new TypeError(
          '[collaboration] duplicate inbound publication frame'
        )
      }
      assembly.frames[header.chunkIndex] = request.frame
      assembly.frameIds.push(header.frameId)
      assembly.acceptedChunkIndexes.add(header.chunkIndex)
      assembly.receivedCount += 1
      assembly.acceptedByteLength += header.frameByteLength
      this.inboundReservedBytes += header.frameByteLength
      if (
        this.inboundReservedBytes > PUBLICATION_FRAME_INBOUND_WINDOW_BYTES &&
        !this.oversizedAssemblyKey
      ) {
        this.oversizedAssemblyKey = assemblyKey
      }
      post({
        type: 'publication-frame-consumed',
        jobId: request.jobId,
        header
      })
      if (assembly.receivedCount < header.chunkCount) {
        post({
          type: 'publication-frame-accepted',
          jobId: request.jobId,
          header,
          durationMs: elapsed(startedAt)
        })
        return true
      }
      const frames = assembly.frames.filter((frame): frame is ArrayBuffer =>
        isArrayBufferValue(frame)
      )
      const decoded = decodePublicationFramePublication(frames)
      assembly.frames.fill(undefined)
      assembly.decoded = {
        header: decoded.header,
        publication: decoded.publication,
        ...(decoded.header.fromActorId
          ? { fromActorId: decoded.header.fromActorId }
          : {}),
        durationMs: elapsed(startedAt)
      }
      const burstKey = inboundBurstKey(header)
      const nextPublicationIndex = header.publicationIndex + 1
      if (nextPublicationIndex < header.publicationCount) {
        this.inboundBurstNextPublicationIndex.set(
          burstKey,
          nextPublicationIndex
        )
      } else {
        this.inboundBurstNextPublicationIndex.delete(burstKey)
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
      return true
    } catch (error) {
      post({
        type: 'publication-codec-failure',
        jobId: request.jobId,
        message: failureMessage(error),
        publicationId: header.publicationId
      })
      return false
    }
  }

  private releaseReadyPublication(
    jobId: string,
    post: PublicationCodecWorkerPost
  ): boolean {
    if (this.activeDecodedPublicationLease) return false
    const key = this.inboundAssemblyOrder[0]
    if (!key) return false
    const assembly = this.inboundAssemblies.get(key)
    if (!assembly?.decoded) return false
    this.inboundAssemblyOrder.shift()
    this.inboundAssemblies.delete(key)
    this.activeDecodedPublicationLease = {
      assemblyKey: key,
      acceptedByteLength: assembly.acceptedByteLength,
      frameIds: assembly.frameIds
    }
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
