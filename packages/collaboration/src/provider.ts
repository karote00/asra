import type { YjsBinaryUpdate } from './yjs-document'

export type CollaborationProviderStatus =
  | 'offline'
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'disposed'

export interface CollaborationProviderIdentity {
  readonly documentId: string
  readonly roomId: string
  readonly actorId: string
  readonly connectionMetadata?: Readonly<Record<string, unknown>>
}

export interface InboundBinaryUpdate extends YjsBinaryUpdate {
  readonly fromActorId: string
}

export interface ProviderAcknowledgement {
  readonly operationId: string
  readonly durability: 'durable'
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

export type ProviderFailureCode =
  | 'connection-rejected'
  | 'connection-failed'
  | 'not-connected'
  | 'invalid-awareness-actor'
  | 'transport-failed'
  | 'disposed'

export class ProviderFailure extends Error {
  readonly code: ProviderFailureCode
  readonly cause?: unknown

  constructor(code: ProviderFailureCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'ProviderFailure'
    this.code = code
    this.cause = cause
  }
}

export interface CollaborationProvider {
  readonly identity: CollaborationProviderIdentity
  connect(): Promise<void>
  disconnect(): Promise<void>
  reconnect(): Promise<void>
  destroy(): Promise<void>
  getStatus(): CollaborationProviderStatus
  onStatusChange(
    subscriber: (status: CollaborationProviderStatus) => void
  ): () => void
  sendUpdate(update: YjsBinaryUpdate): Promise<void>
  onUpdate(subscriber: (update: InboundBinaryUpdate) => void): () => void
  requestSync(stateVector: Uint8Array): Promise<Uint8Array>
  onAcknowledgement(
    subscriber: (acknowledgement: ProviderAcknowledgement) => void
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

export const providerStatus = (
  provider: CollaborationProvider | undefined
): CollaborationProviderStatus => provider?.getStatus() ?? 'offline'
