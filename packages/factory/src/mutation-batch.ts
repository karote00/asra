import type { AllEvent } from '@asyra/reactive-events'
import type { SharedDeliveryMode, TransactionOrigin } from '@asyra/utils'
import type {
  FactoryMutationDeliveryPlan,
  SharedDeliveryBatch
} from './shared-delivery'

export interface FactoryMutationSharedRecordInput {
  readonly orderedIds: readonly string[]
  readonly payload: object
}

export interface FactoryMutationEventDeliveryEvidence {
  readonly orderedIds: readonly string[]
  readonly sharedRecords?: readonly FactoryMutationSharedRecordInput[]
}

export type FactoryMutationBatchDeliveryEvidence = readonly (
  | FactoryMutationEventDeliveryEvidence
  | undefined
)[]

export interface FactoryMutationBatchDeliveryHandle {
  readonly artifactId: string
  readonly transactionId: number
  readonly artifact: FactoryMutationBatchArtifact | null
  setDeliveryPlan(plan: FactoryMutationDeliveryPlan): void
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
  readonly deliveryIds: readonly string[]
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
  readonly deliveryPlan: FactoryMutationDeliveryPlan
  readonly batches: readonly SharedDeliveryBatch[]
}

export type FactoryMutationBatchArtifactSubscriber = (
  artifact: FactoryMutationBatchArtifact
) => void
