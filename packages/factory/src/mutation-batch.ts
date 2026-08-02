import type { AllEvent } from '@asyra/reactive-events'
import type { FactoryMutationDeliverySequence } from './shared-delivery'

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

export interface FactoryStagedDeliveryController {
  readonly artifactId: string
  readonly transactionId: number
  setDeliverySequence(sequence: FactoryMutationDeliverySequence): void
  stageSlice(sliceId: string): void
}

export interface FactoryMutationBatchDeliveryHandle {
  readonly artifactId: string
  readonly transactionId: number
  setDeliverySequence(sequence: FactoryMutationDeliverySequence): void
  deliverSlice(sliceId: string): void
}

export interface FactoryMutationSharedRecordEvidence {
  readonly recordId: string
  readonly deliveryId: string
  readonly occurrence: number
  readonly orderedIds: readonly string[]
  readonly payload: object
  readonly inverseEvents: readonly AllEvent[]
}
