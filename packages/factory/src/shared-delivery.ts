import type { SharedDeliveryMode, TransactionOrigin } from '@asyra/utils'
import type { FactoryMutationSharedRecordEvidence } from './mutation-batch'
import { cloneValue } from './value-clone'

export type SharedDeliveryOrigin = TransactionOrigin | 'rollback-compensation'

export type FactoryMutationDeliveryMode = 'atomic' | 'progressive'

export interface FactoryMutationSliceBoundary {
  readonly sliceId: string
  readonly orderedIds: readonly string[]
}

export interface FactoryMutationDeliveryPlan {
  readonly mode: FactoryMutationDeliveryMode
  readonly slices: readonly FactoryMutationSliceBoundary[]
}

export interface SharedDelivery<TPayload = unknown> {
  readonly deliveryId: string
  readonly artifactId: string
  readonly batchId: string
  readonly transactionId: number
  readonly origin: SharedDeliveryOrigin
  readonly kind: 'forward' | 'compensation'
  readonly channel: string
  readonly eventName: string
  readonly payload: TPayload
  readonly recordId: string
  readonly record: FactoryMutationSharedRecordEvidence
  readonly sharedDelivery: SharedDeliveryMode
  readonly compensatesDeliveryId?: string
}

export type SharedDeliverySubscriber = (delivery: SharedDelivery) => void

export interface SharedDeliveryBatch<TPayload = unknown> {
  readonly batchId: string
  readonly sliceId: string
  readonly artifactId: string
  readonly transactionId: number
  readonly origin: SharedDeliveryOrigin
  readonly kind: SharedDelivery<TPayload>['kind']
  readonly channel: string
  readonly sharedDelivery: SharedDeliveryMode
  readonly deliveries: readonly SharedDelivery<TPayload>[]
  readonly records: readonly FactoryMutationSharedRecordEvidence[]
  readonly changes: readonly TPayload[]
  readonly compensatesBatchId?: string
}

export type SharedDeliveryBatchSubscriber = (batch: SharedDeliveryBatch) => void

export interface SharedPublication {
  readonly publicationId: string
  readonly artifactId: string
  readonly transactionId: number
  readonly origin: SharedDeliveryOrigin
  readonly deliveries: readonly SharedDelivery[]
  readonly batches: readonly SharedDeliveryBatch[]
  readonly deliveryPlan: FactoryMutationDeliveryPlan
}

export type SharedPublicationSubscriber = (
  publication: SharedPublication
) => void

export const cloneSharedDelivery = (delivery: SharedDelivery): SharedDelivery =>
  cloneValue(delivery)

export const cloneSharedPublication = (
  publication: SharedPublication
): SharedPublication => cloneValue(publication)
