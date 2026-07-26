import type { SharedPublication } from '@asyra/factory'

export type ProviderStatus =
  | 'offline'
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'disposed'

export interface ProviderIdentity {
  readonly documentId: string
  readonly roomId: string
  readonly actorId: string
  readonly connectionMetadata?: Readonly<Record<string, unknown>>
}

export const createProviderIdentitySnapshot = (
  identity: ProviderIdentity
): ProviderIdentity =>
  Object.freeze({
    documentId: identity.documentId,
    roomId: identity.roomId,
    actorId: identity.actorId,
    ...(identity.connectionMetadata
      ? {
          connectionMetadata: Object.freeze({ ...identity.connectionMetadata })
        }
      : {})
  })

export interface InboundPublication {
  readonly publication: SharedPublication
  readonly fromActorId?: string
}

export interface ProviderAwarenessMessage {
  readonly actorId: string
  readonly clock: number
  readonly state: unknown
}

export interface ProviderAwarenessDisconnect {
  readonly actorId: string
  readonly reason: 'disconnect'
}

export const PROVIDER_FAILURE_CODES = Object.freeze([
  'connection-rejected',
  'connection-failed',
  'not-connected',
  'invalid-awareness-actor',
  'acknowledgement-failed',
  'transport-failed',
  'disposed'
] as const)

export type ProviderFailureCode = (typeof PROVIDER_FAILURE_CODES)[number]

export const isProviderFailureCode = (
  value: unknown
): value is ProviderFailureCode =>
  typeof value === 'string' &&
  PROVIDER_FAILURE_CODES.some((failureCode) => failureCode === value)

export class ProviderFailure extends Error {
  readonly code: ProviderFailureCode
  readonly cause?: unknown
  readonly publicationId?: string

  constructor(
    code: ProviderFailureCode,
    message: string,
    cause?: unknown,
    publicationId?: string
  ) {
    super(message)
    this.name = 'ProviderFailure'
    this.code = code
    this.cause = cause
    this.publicationId = publicationId
  }
}

export interface Provider {
  readonly identity: ProviderIdentity
  readonly maxConcurrentPublicationSends?: number
  readonly maxPublicationsPerSend?: number
  connect(): Promise<void>
  disconnect(): Promise<void>
  reconnect(): Promise<void>
  destroy(): Promise<void>
  getStatus(): ProviderStatus
  onStatusChange(subscriber: (status: ProviderStatus) => void): () => void
  sendPublication(publication: SharedPublication): Promise<void>
  sendPublications?(publications: readonly SharedPublication[]): Promise<void>
  onPublication(
    subscriber: (publication: InboundPublication) => void
  ): () => void
  onPublications?(
    subscriber: (publications: readonly InboundPublication[]) => void
  ): () => void
  sendAwareness(message: ProviderAwarenessMessage): Promise<void>
  onAwareness(
    subscriber: (message: ProviderAwarenessMessage) => void
  ): () => void
  onAwarenessDisconnect(
    subscriber: (event: ProviderAwarenessDisconnect) => void
  ): () => void
  onFailure(subscriber: (failure: ProviderFailure) => void): () => void
}
