import type {
  CollaborationComposition,
  CollaborationCompositionInput,
  CollaborationPermissionPolicy,
  CollaborationResourceOwnership,
  CollaborationResourceOwnershipMap
} from './types'

const requireIdentity = (name: string, value: string): string => {
  if (!value.trim()) {
    throw new Error(`[collaboration] ${name} is required`)
  }
  return value
}

const resolveOwnership = (
  name: keyof CollaborationResourceOwnershipMap,
  injected: boolean,
  requested?: CollaborationResourceOwnership
): CollaborationResourceOwnership => {
  if (requested && requested !== 'owned' && requested !== 'borrowed') {
    throw new Error(
      `[collaboration] resourceOwnership.${name} must be owned or borrowed`
    )
  }
  if (requested) return requested
  if (name === 'yDoc' || name === 'awareness') {
    return injected ? 'borrowed' : 'owned'
  }
  return 'borrowed'
}

export const defineCollaborationComposition = <
  TOperationDefinition = unknown,
  TPermissionPolicy extends CollaborationPermissionPolicy = CollaborationPermissionPolicy,
  TProvider = unknown,
  TYDoc = unknown,
  TAwareness = unknown,
  TPersistence = unknown
>(
  input: CollaborationCompositionInput<
    TOperationDefinition,
    TPermissionPolicy,
    TProvider,
    TYDoc,
    TAwareness,
    TPersistence
  >
): CollaborationComposition<
  TOperationDefinition,
  TPermissionPolicy,
  TProvider,
  TYDoc,
  TAwareness,
  TPersistence
> => {
  const documentId = requireIdentity('documentId', input.documentId)
  const roomId = requireIdentity('roomId', input.roomId)
  const actorId = requireIdentity('actorId', input.actorId)
  if (typeof input.factory?.subscribeToSharedDelivery !== 'function') {
    throw new Error(
      '[collaboration] factory.subscribeToSharedDelivery is required'
    )
  }
  if (!Array.isArray(input.operationDefinitions)) {
    throw new Error('[collaboration] operationDefinitions must be an array')
  }
  if (typeof input.permissionPolicy !== 'function') {
    throw new Error('[collaboration] permissionPolicy is required')
  }

  const resourceOwnership = Object.freeze({
    provider: resolveOwnership(
      'provider',
      input.provider !== undefined,
      input.resourceOwnership?.provider
    ),
    yDoc: resolveOwnership(
      'yDoc',
      input.yDoc !== undefined,
      input.resourceOwnership?.yDoc
    ),
    awareness: resolveOwnership(
      'awareness',
      input.awareness !== undefined,
      input.resourceOwnership?.awareness
    ),
    persistence: resolveOwnership(
      'persistence',
      input.persistence !== undefined,
      input.resourceOwnership?.persistence
    )
  })

  return Object.freeze({
    documentId,
    roomId,
    actorId,
    factory: input.factory,
    operationDefinitions: Object.freeze([...input.operationDefinitions]),
    permissionPolicy: input.permissionPolicy,
    ...(input.provider !== undefined ? { provider: input.provider } : {}),
    ...(input.yDoc !== undefined ? { yDoc: input.yDoc } : {}),
    ...(input.awareness !== undefined ? { awareness: input.awareness } : {}),
    ...(input.persistence !== undefined
      ? { persistence: input.persistence }
      : {}),
    ...(input.connectionMetadata !== undefined
      ? { connectionMetadata: input.connectionMetadata }
      : {}),
    resourceOwnership
  })
}

export type {
  CollaborationComposition,
  CollaborationCompositionInput,
  CollaborationFactory,
  CollaborationPermissionPolicy,
  CollaborationResourceOwnership,
  CollaborationResourceOwnershipMap
} from './types'
