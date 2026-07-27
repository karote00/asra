import type { SharedPublication } from '@asyra/factory'

import { deepFreeze } from './deep-freeze'

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

export type InboundPublicationLeaseSettlement =
  | Readonly<{ outcome: 'success' }>
  | Readonly<{ outcome: 'terminal-failure'; error: unknown }>

export interface InboundPublicationLease extends InboundPublication {
  /**
   * The first settlement wins. Later calls are safe no-ops.
   */
  readonly settle: (settlement: InboundPublicationLeaseSettlement) => void
}

export const createInboundPublicationLease = (
  inbound: InboundPublication,
  onSettle: (settlement: InboundPublicationLeaseSettlement) => void
): InboundPublicationLease => {
  let settled = false
  const publication = deepFreeze(inbound.publication)
  const settle = (settlement: InboundPublicationLeaseSettlement): void => {
    if (settled) return
    settled = true
    onSettle(Object.freeze({ ...settlement }))
  }
  return Object.freeze({
    publication,
    ...(inbound.fromActorId ? { fromActorId: inbound.fromActorId } : {}),
    settle
  })
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
  /**
   * Optional exclusive processing feed for providers that already own an
   * isolated inbound snapshot. The provider deep-freezes that snapshot before
   * delivery, and the processing subscriber must settle every lease exactly
   * once after App processing succeeds or fails. Snapshot feeds remain
   * available for ordinary providers and read-only observers.
   */
  onInboundPublicationLease?(
    subscriber: (lease: InboundPublicationLease) => void
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
