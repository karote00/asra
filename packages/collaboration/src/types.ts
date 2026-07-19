import type { Factory } from '@asyra/factory'
import type { AwarenessRuntime } from './awareness'
import type {
  AppConflictPolicy,
  FrameworkInvariantConfiguration
} from './conflict-policy'
import type {
  CanonicalOperationApply,
  OperationDefinition
} from './operation-registry'
import type { SharedOperationEnvelope } from './operation-envelope'
import type { CollaborationUpdatePersistence } from './persistence'
import type { CollaborationProvider } from './provider'

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

export type CollaborationFactory = Pick<Factory, 'subscribeToSharedDelivery'> &
  Partial<Pick<Factory, 'runRemoteTransaction' | 'isRemoteAsyncHandlerError'>>

export type CollaborationOperationDefinition<TPayload = unknown> = Omit<
  OperationDefinition<TPayload>,
  'apply'
> &
  Readonly<{
    apply: CanonicalOperationApply<TPayload>
  }>

export interface CollaborationLifecycleResource {
  destroy?: () => void | Promise<void>
  dispose?: () => void | Promise<void>
}

export interface CollaborationCompositionInput<
  TOperationDefinition = unknown,
  TPermissionPolicy extends
    CollaborationPermissionPolicy = CollaborationPermissionPolicy,
  TProvider = unknown,
  TYDoc = unknown,
  TAwareness = unknown,
  TPersistence = unknown
> {
  documentId: string
  roomId: string
  actorId: string
  factory: CollaborationFactory
  operationDefinitions: readonly TOperationDefinition[]
  permissionPolicy: TPermissionPolicy
  provider?: TProvider
  yDoc?: TYDoc
  awareness?: TAwareness
  persistence?: TPersistence
  sessionId?: string
  frameworkInvariants?: FrameworkInvariantConfiguration
  conflictPolicies?: readonly AppConflictPolicy[]
  connectionMetadata?: Readonly<Record<string, unknown>>
  resourceOwnership?: Partial<CollaborationResourceOwnershipMap>
}

export interface CollaborationComposition<
  TOperationDefinition = unknown,
  TPermissionPolicy extends
    CollaborationPermissionPolicy = CollaborationPermissionPolicy,
  TProvider = unknown,
  TYDoc = unknown,
  TAwareness = unknown,
  TPersistence = unknown
> {
  readonly documentId: string
  readonly roomId: string
  readonly actorId: string
  readonly factory: CollaborationFactory
  readonly operationDefinitions: readonly TOperationDefinition[]
  readonly permissionPolicy: TPermissionPolicy
  readonly provider?: TProvider
  readonly yDoc?: TYDoc
  readonly awareness?: TAwareness
  readonly persistence?: TPersistence
  readonly sessionId?: string
  readonly frameworkInvariants?: FrameworkInvariantConfiguration
  readonly conflictPolicies?: readonly AppConflictPolicy[]
  readonly connectionMetadata?: Readonly<Record<string, unknown>>
  readonly resourceOwnership: Readonly<CollaborationResourceOwnershipMap>
}

export type CollaborationInstanceCompositionInput =
  CollaborationCompositionInput<
    CollaborationOperationDefinition,
    CollaborationPermissionPolicy,
    CollaborationProvider,
    import('yjs').Doc,
    AwarenessRuntime,
    CollaborationUpdatePersistence
  >
