import type { Factory, SharedPublication } from '@asyra/factory'
import type { Awareness } from './awareness'
import type { InboundPublication, Provider } from './provider'

export type CollaborationResourceOwnership = 'owned' | 'borrowed'

export interface CollaborationResourceOwnershipMap {
  provider: CollaborationResourceOwnership
  awareness: CollaborationResourceOwnership
}

export type CollaborationFactory = Pick<Factory, 'subscribeToSharedPublication'>

export type ProcessRemotePublication = (
  publication: SharedPublication,
  context: Readonly<Omit<InboundPublication, 'publication'>>
) => void

export interface CreateCollaborationInput {
  documentId: string
  roomId: string
  actorId: string
  factory: CollaborationFactory
  processRemotePublication: ProcessRemotePublication
  provider?: Provider
  awareness?: Awareness
  resourceOwnership?: Partial<CollaborationResourceOwnershipMap>
}
