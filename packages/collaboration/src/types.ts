import type { Factory } from '@asyra/factory'

export type CollaborationResourceOwnership = 'owned' | 'borrowed'

export interface CollaborationResourceOwnershipMap {
  provider: CollaborationResourceOwnership
  yDoc: CollaborationResourceOwnership
  awareness: CollaborationResourceOwnership
  persistence: CollaborationResourceOwnership
}

export type CollaborationPermissionPolicy = (
  operation: unknown
) => boolean | Promise<boolean>

export type CollaborationFactory = Pick<Factory, 'subscribeToSharedDelivery'>

export interface CollaborationCompositionInput<
  TOperationDefinition = unknown,
  TPermissionPolicy extends CollaborationPermissionPolicy = CollaborationPermissionPolicy,
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
  connectionMetadata?: Readonly<Record<string, unknown>>
  resourceOwnership?: Partial<CollaborationResourceOwnershipMap>
}

export interface CollaborationComposition<
  TOperationDefinition = unknown,
  TPermissionPolicy extends CollaborationPermissionPolicy = CollaborationPermissionPolicy,
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
  readonly connectionMetadata?: Readonly<Record<string, unknown>>
  readonly resourceOwnership: Readonly<CollaborationResourceOwnershipMap>
}
