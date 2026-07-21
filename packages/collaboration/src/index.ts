export { Collaboration, DisposalError, createCollaboration } from './process'

export { Awareness, AwarenessValidationError } from './awareness'
export type {
  AwarenessObservation,
  AwarenessOptions,
  AwarenessRecord,
  AwarenessRemovedObservation,
  AwarenessRemovalReason,
  AwarenessState,
  AwarenessStateInput,
  AwarenessUpdatedObservation,
  AwarenessValidationErrorCode,
  AwarenessValue,
  RemoteAwarenessSnapshot
} from './awareness'
export type {
  CollaborationOperationOutcome,
  LocalPublishedOperationOutcome,
  LocalRejectedOperationOutcome,
  RemoteFailedOperationOutcome,
  RemoteProcessedOperationOutcome
} from './process'
export type {
  AcceptConflictDecision,
  AppConflictPolicy,
  ConflictPolicyContext,
  ConflictPolicyDecision,
  NotApplicableConflictDecision,
  RejectConflictDecision,
  RepairConflictDecision
} from './operations/conflict'
export type {
  SharedOperationEnvelope,
  SharedOperationOrigin
} from './operations/envelope'
export { defineCanonicalOperationApply } from './operations/registry'
export type { CanonicalOperationApply } from './operations/registry'
export type {
  DurabilityEvent,
  DurabilityOutcome,
  DurabilityPhase
} from './durability'
export { MemoryPersistence } from './persistence'
export type {
  MemoryPersistenceOptions,
  PersistedUpdate,
  UpdatePersistence
} from './persistence'
export {
  PROVIDER_FAILURE_CODES,
  ProviderFailure,
  createProviderIdentitySnapshot,
  isProviderFailureCode
} from './provider'
export type {
  Provider,
  ProviderIdentity,
  ProviderStatus,
  InboundBinaryUpdate,
  ProviderAcknowledgement,
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage,
  ProviderFailureCode,
  ProviderStateVectorExchange
} from './provider'
export { MemoryHub, MemoryProvider } from './providers/memory'
export type { MemoryHubOptions } from './providers/memory'
export type { InboundYjsUpdateSource, YjsBinaryUpdate } from './yjs-document'

export type {
  CollaborationFactory,
  CreateCollaborationInput,
  CollaborationOperationDefinition,
  CollaborationPermissionPolicy,
  CollaborationResourceOwnership,
  CollaborationResourceOwnershipMap
} from './composition'
