import type { SharedDelivery, SharedPublication } from '@asyra/factory'

interface SharedPublicationFixtureDelivery {
  readonly channel: string
  readonly deliveryId: string
  readonly eventName: string
  readonly payload: object
  readonly sharedDelivery: SharedDelivery['sharedDelivery']
}

interface SharedPublicationFixtureInput {
  readonly delivery?: SharedPublicationFixtureDelivery
  readonly publicationId: string
  readonly transactionId: number
}

export const createSharedPublicationFixture = ({
  delivery,
  publicationId,
  transactionId
}: SharedPublicationFixtureInput): SharedPublication => {
  const artifactId = `${publicationId}:artifact`
  if (!delivery) {
    return {
      artifactId,
      batches: [],
      deliveries: [],
      deliverySequence: { mode: 'atomic', slices: [] },
      origin: 'action',
      publicationId,
      transactionId
    }
  }

  const batchId = `${artifactId}:batch`
  const recordId = `${delivery.deliveryId}:record`
  const sliceId = `${artifactId}:slice`
  const record = {
    deliveryId: delivery.deliveryId,
    inverseEvents: [],
    occurrence: 0,
    orderedIds: [],
    payload: delivery.payload,
    recordId
  }
  const exactDelivery: SharedDelivery = {
    artifactId,
    batchId,
    channel: delivery.channel,
    deliveryId: delivery.deliveryId,
    eventName: delivery.eventName,
    kind: 'forward',
    origin: 'action',
    payload: delivery.payload,
    record,
    recordId,
    sharedDelivery: delivery.sharedDelivery,
    transactionId
  }

  return {
    artifactId,
    batches: [
      {
        artifactId,
        batchId,
        changes: [delivery.payload],
        channel: delivery.channel,
        deliveries: [exactDelivery],
        kind: 'forward',
        origin: 'action',
        records: [record],
        sharedDelivery: delivery.sharedDelivery,
        sliceId,
        transactionId
      }
    ],
    deliveries: [exactDelivery],
    deliverySequence: {
      mode: delivery.sharedDelivery === 'immediate' ? 'progressive' : 'atomic',
      slices: [{ orderedIds: [delivery.deliveryId], sliceId }]
    },
    origin: 'action',
    publicationId,
    transactionId
  }
}
