import type { AllEvent } from '@asyra/reactive-events'
import type { SharedDeliveryMode, TransactionOrigin } from '@asyra/utils'
import type {
  FactoryMutationDeliverySequence,
  SharedDeliveryBatch
} from './shared-delivery'

export class FactoryMutationBatchAcceptanceError extends Error {
  readonly batchAccepted: boolean
  readonly batchCause: unknown

  constructor(batchAccepted: boolean, batchCause: unknown) {
    super(
      batchCause instanceof Error
        ? batchCause.message
        : 'Factory mutation batch failed'
    )
    this.name = 'FactoryMutationBatchAcceptanceError'
    this.batchAccepted = batchAccepted
    this.batchCause = batchCause
  }
}

export interface FactoryStagedArtifactController {
  readonly artifactId: string
  readonly transactionId: number
  setDeliverySequence(sequence: FactoryMutationDeliverySequence): void
  stageSlice(sliceId: string): void
}

export interface FactoryMutationBatchDeliveryHandle {
  readonly artifactId: string
  readonly transactionId: number
  readonly artifact: FactoryMutationBatchArtifact | null
  setDeliverySequence(sequence: FactoryMutationDeliverySequence): void
  deliverSlice(sliceId: string): void
}

export interface FactoryMutationChangeOptions {
  readonly undoable: boolean
  readonly rollbackable: boolean
  readonly shared?: string
  readonly sharedDelivery: SharedDeliveryMode
}

export interface FactoryMutationSharedEvidence {
  readonly channel: string
  readonly payload: unknown
  readonly inverseEvents: readonly AllEvent[]
  readonly records: readonly FactoryMutationSharedRecordEvidence[]
}

export interface FactoryMutationSharedRecordEvidence {
  readonly recordId: string
  readonly deliveryId: string
  readonly occurrence: number
  readonly orderedIds: readonly string[]
  readonly payload: object
  readonly inverseEvents: readonly AllEvent[]
}

export interface FactoryMutationBatchChange {
  readonly changeId: string
  readonly index: number
  readonly event: AllEvent
  readonly orderedIds: readonly string[]
  readonly inverseEvents: readonly AllEvent[]
  readonly options: FactoryMutationChangeOptions
  readonly shared?: FactoryMutationSharedEvidence
}

export interface FactoryMutationBatchArtifact {
  readonly artifactId: string
  readonly transactionId: number
  readonly origin: TransactionOrigin
  readonly orderedChangeIds: readonly string[]
  readonly changes: readonly FactoryMutationBatchChange[]
  readonly inverses: readonly AllEvent[]
  readonly deliverySequence: FactoryMutationDeliverySequence
  readonly batches: readonly SharedDeliveryBatch[]
}

export interface FactoryMutationBatchAppliedResult {
  readonly artifactId: string
  readonly transactionId: number
  readonly deliveryIds: readonly string[]
}

export type FactoryMutationBatchArtifactSubscriber = (
  artifact: FactoryMutationBatchArtifact
) => void

export type FactoryMutationBatchArtifactStatusName =
  | 'staged'
  | 'committed'
  | 'rolled-back'
  | 'rollback-failed'

interface FactoryMutationBatchArtifactStatusBase {
  readonly statusId: string
  readonly artifactId: string
  readonly transactionId: number
  readonly origin: TransactionOrigin
}

export interface FactoryMutationBatchStagedStatus
  extends FactoryMutationBatchArtifactStatusBase {
  readonly status: 'staged'
  readonly sliceId: string
  readonly orderedIds: readonly string[]
  readonly batches: readonly SharedDeliveryBatch[]
}

export interface FactoryMutationBatchSettledStatus
  extends FactoryMutationBatchArtifactStatusBase {
  readonly status: Exclude<FactoryMutationBatchArtifactStatusName, 'staged'>
  readonly artifact: FactoryMutationBatchArtifact
  readonly appliedResult: FactoryMutationBatchAppliedResult
}

export type FactoryMutationBatchArtifactStatus =
  | FactoryMutationBatchStagedStatus
  | FactoryMutationBatchSettledStatus

export type FactoryMutationBatchArtifactStatusSubscriber = (
  status: FactoryMutationBatchArtifactStatus
) => void
