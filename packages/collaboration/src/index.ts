export { Collaboration, DisposalError, createCollaboration } from './process.js'
export type { CollaborationPublicationOutcome } from './process.js'

export { Awareness, AwarenessValidationError } from './awareness.js'
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
} from './awareness.js'

export {
  PROVIDER_FAILURE_CODES,
  ProviderFailure,
  createProviderIdentitySnapshot,
  isProviderFailureCode
} from './provider.js'
export type {
  Provider,
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage,
  ProviderFailureCode,
  ProviderIdentity,
  ProviderStatus
} from './provider.js'

export { MemoryHub, MemoryProvider } from './providers/memory/index.js'
export type { MemoryHubOptions } from './providers/memory/index.js'

export type {
  CollaborationFactory,
  CollaborationResourceOwnership,
  CollaborationResourceOwnershipMap,
  CreateCollaborationInput,
  ProcessRemotePublication
} from './composition.js'
