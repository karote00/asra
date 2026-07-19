import type {
  CollaborationComposition,
  CollaborationCompositionInput,
  CollaborationInstanceCompositionInput,
  CollaborationPermissionPolicy,
  CollaborationResourceOwnership,
  CollaborationResourceOwnershipMap
} from './types'
import {
  CollaborationInstance,
  createCollaboration as createCollaborationInstance
} from './collaboration-instance'

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
  TPermissionPolicy extends
    CollaborationPermissionPolicy = CollaborationPermissionPolicy,
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
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    ...(input.frameworkInvariants !== undefined
      ? { frameworkInvariants: input.frameworkInvariants }
      : {}),
    ...(input.conflictPolicies !== undefined
      ? { conflictPolicies: Object.freeze([...input.conflictPolicies]) }
      : {}),
    ...(input.connectionMetadata !== undefined
      ? { connectionMetadata: input.connectionMetadata }
      : {}),
    resourceOwnership
  })
}

export const createCollaboration = (
  input: CollaborationInstanceCompositionInput
): CollaborationInstance =>
  createCollaborationInstance(input, defineCollaborationComposition)

export { AwarenessRuntime, AwarenessValidationError } from './awareness'
export type {
  AwarenessObservation,
  AwarenessRemovalReason,
  AwarenessRuntimeOptions,
  AwarenessState,
  AwarenessStateInput,
  AwarenessValidationErrorCode,
  AwarenessValue,
  RemoteAwarenessSnapshot
} from './awareness'
export {
  CollaborationDisposalError,
  CollaborationInstance
} from './collaboration-instance'
export type { CollaborationOperationOutcome } from './collaboration-instance'
export {
  createConflictPolicyPipeline,
  ConflictPolicyPipeline
} from './conflict-policy'
export type {
  AppConflictPolicy,
  ConflictAcceptedOperation,
  ConflictPipelineOutcome,
  ConflictPolicyContext,
  ConflictPolicyDecision,
  ConflictRejectedOperation,
  CreateConflictPolicyPipelineInput,
  EntityInvariantDescriptor,
  FrameworkInvariantConfiguration
} from './conflict-policy'
export {
  OperationOutcomeRegistry,
  runRemoteCanonicalApply,
  validateRemoteOperation
} from './inbound-pipeline'
export type {
  DuplicateOperationOutcome,
  RecordedOperationOutcome,
  RemoteCanonicalApplyOutcome,
  RemoteValidationRejection,
  RemoteValidationResult,
  ValidatedRemoteOperation,
  ValidationRejectionCode
} from './inbound-pipeline'
export {
  COLLABORATION_PROTOCOL_VERSION,
  createOperationIdentitySource,
  createSharedOperationEnvelope,
  LocalOperationRejection
} from './operation-envelope'
export type {
  CreateSharedOperationEnvelopeInput,
  LocalOperationRejectionCode,
  OperationIdentitySource,
  SharedOperationEnvelope,
  SharedOperationOrigin
} from './operation-envelope'
export {
  defineCanonicalOperationApply,
  OperationRegistry
} from './operation-registry'
export type {
  CanonicalOperationApply,
  OperationDefinition
} from './operation-registry'
export {
  CollaborationDurabilityRuntime,
  MemoryCollaborationUpdatePersistence
} from './persistence'
export type {
  CollaborationDurabilityEvent,
  CollaborationDurabilityOutcome,
  CollaborationDurabilityPhase,
  CollaborationDurabilityRuntimeOptions,
  CollaborationUpdatePersistence,
  MemoryCollaborationUpdatePersistenceOptions,
  PersistedCollaborationUpdate
} from './persistence'
export { ProviderFailure, providerStatus } from './provider'
export type {
  CollaborationProvider,
  CollaborationProviderIdentity,
  CollaborationProviderStatus,
  InboundBinaryUpdate,
  ProviderAcknowledgement,
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage,
  ProviderFailureCode,
  ProviderStateVectorExchange
} from './provider'
export {
  MemoryCollaborationHub,
  MemoryCollaborationProvider
} from './providers/memory-provider'
export type { MemoryCollaborationHubOptions } from './providers/memory-provider'
export type { InboundYjsUpdateSource, YjsBinaryUpdate } from './yjs-document'

export type {
  CollaborationComposition,
  CollaborationCompositionInput,
  CollaborationFactory,
  CollaborationInstanceCompositionInput,
  CollaborationLifecycleResource,
  CollaborationOperationDefinition,
  CollaborationPermissionPolicy,
  CollaborationResourceOwnership,
  CollaborationResourceOwnershipMap
} from './types'
