export { Collaboration, DisposalError, createCollaboration } from './process'
export type { CollaborationPublicationOutcome } from './process'

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

export {
  PROVIDER_FAILURE_CODES,
  ProviderFailure,
  createInboundPublicationLease,
  createProviderIdentitySnapshot,
  isProviderFailureCode
} from './provider'
export type {
  InboundPublication,
  InboundPublicationLease,
  InboundPublicationLeaseSettlement,
  Provider,
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage,
  ProviderFailureCode,
  ProviderIdentity,
  ProviderStatus
} from './provider'

export { MemoryHub, MemoryProvider } from './providers/memory'
export type { MemoryHubOptions } from './providers/memory'

export type {
  CollaborationFactory,
  CollaborationResourceOwnership,
  CollaborationResourceOwnershipMap,
  CreateCollaborationInput,
  ProcessRemotePublication
} from './composition'
