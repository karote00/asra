import type { SharedPublication } from '@asyra/factory'
import type { Awareness } from './awareness.js'
import type { Provider } from './provider.js'

export type CollaborationResourceOwnership = 'owned' | 'borrowed'

export interface CollaborationResourceOwnershipMap {
  provider: CollaborationResourceOwnership
  awareness: CollaborationResourceOwnership
}

export interface CollaborationPublicationSource {
  subscribe(subscriber: (publication: SharedPublication) => void): () => void
}

/**
 * @deprecated Pass `publicationSource` instead. Collaboration no longer
 * requires a Factory-shaped runtime dependency.
 */
export interface CollaborationFactory {
  subscribeToSharedPublication(
    subscriber: (publication: SharedPublication) => void
  ): () => void
}

export type ProcessRemotePublication = (
  publication: SharedPublication
) => void | Promise<void>

export interface CreateCollaborationInput {
  documentId: string
  roomId: string
  actorId: string
  publicationSource?: CollaborationPublicationSource
  /**
   * @deprecated Pass `publicationSource` instead.
   */
  factory?: CollaborationFactory
  processRemotePublication: ProcessRemotePublication
  provider?: Provider
  awareness?: Awareness
  resourceOwnership?: Partial<CollaborationResourceOwnershipMap>
}
