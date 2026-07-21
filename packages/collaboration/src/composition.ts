import type { Factory } from '@asyra/factory'
import type { Awareness } from './awareness'
import type { AppConflictPolicy } from './operations/conflict'
import type {
  CanonicalOperationApply,
  OperationDefinition
} from './operations/registry'
import type { SharedOperationEnvelope } from './operations/envelope'
import type { UpdatePersistence } from './persistence'
import type { Provider } from './provider'

export type CollaborationResourceOwnership = 'owned' | 'borrowed'

export interface CollaborationResourceOwnershipMap {
  provider: CollaborationResourceOwnership
  yDoc: CollaborationResourceOwnership
  awareness: CollaborationResourceOwnership
  persistence: CollaborationResourceOwnership
}

export type CollaborationPermissionPolicy = (
  operation: SharedOperationEnvelope
) => boolean | Promise<boolean>

export type CollaborationFactory = Pick<
  Factory,
  'subscribeToSharedPublication'
> &
  Partial<Pick<Factory, 'runRemoteTransaction' | 'isRemoteAsyncHandlerError'>>

export type CollaborationOperationDefinition<TPayload = unknown> = Omit<
  OperationDefinition<TPayload>,
  'apply'
> &
  Readonly<{
    apply: CanonicalOperationApply<TPayload>
  }>

export interface CreateCollaborationInput {
  documentId: string
  roomId: string
  actorId: string
  factory: CollaborationFactory
  operationDefinitions: readonly CollaborationOperationDefinition[]
  permissionPolicy: CollaborationPermissionPolicy
  provider?: Provider
  yDoc?: import('yjs').Doc
  awareness?: Awareness
  persistence?: UpdatePersistence
  sessionId?: string
  conflictPolicies?: readonly AppConflictPolicy[]
  resourceOwnership?: Partial<CollaborationResourceOwnershipMap>
}
