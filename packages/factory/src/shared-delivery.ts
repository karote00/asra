import type { SharedDeliveryMode, TransactionOrigin } from '@asyra/utils'
import { cloneValue } from './value-clone'

export type SharedDeliveryOrigin = TransactionOrigin | 'rollback-compensation'

export interface SharedDelivery<TPayload = unknown> {
  deliveryId: string
  transactionId: number
  origin: SharedDeliveryOrigin
  kind: 'forward' | 'compensation'
  channel: string
  eventName: string
  payload: TPayload
  sharedDelivery: SharedDeliveryMode
  compensatesDeliveryId?: string
}

export type SharedDeliverySubscriber = (delivery: SharedDelivery) => void

export interface SharedPublication {
  publicationId: string
  transactionId: number
  origin: SharedDeliveryOrigin
  deliveries: readonly SharedDelivery[]
}

export type SharedPublicationSubscriber = (
  publication: SharedPublication
) => void

export const cloneSharedDelivery = (delivery: SharedDelivery): SharedDelivery =>
  cloneValue(delivery)

export const cloneSharedPublication = (
  publication: SharedPublication
): SharedPublication => cloneValue(publication)
