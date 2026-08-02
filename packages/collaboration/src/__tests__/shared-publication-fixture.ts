import type { SharedPublication } from '@asyra/factory'

interface SharedPublicationFixtureDelivery {
  readonly channel: string
  readonly deliveryId: string
  readonly eventName: string
  readonly orderedIds: readonly string[]
  readonly payload: object
}

interface SharedPublicationFixtureInput {
  readonly delivery?: SharedPublicationFixtureDelivery
  readonly mode: SharedPublication['mode']
  readonly publicationId: string
  readonly transactionId: number
}

export const createSharedPublicationFixture = ({
  delivery,
  mode,
  publicationId,
  transactionId
}: SharedPublicationFixtureInput): SharedPublication => {
  const artifactId = `${publicationId}:artifact`
  if (!delivery) {
    return {
      artifactId,
      mode,
      origin: 'action',
      publicationId,
      slices: [],
      transactionId
    }
  }

  const batchId = `${artifactId}:batch`
  const sliceId = `${artifactId}:slice`
  const exactDelivery = {
    deliveryId: delivery.deliveryId,
    eventName: delivery.eventName,
    orderedIds: delivery.orderedIds,
    payload: delivery.payload
  }

  return {
    artifactId,
    mode,
    origin: 'action',
    publicationId,
    slices: [
      {
        sliceId,
        orderedIds: delivery.orderedIds,
        batches: [
          {
            batchId,
            channel: delivery.channel,
            deliveries: [exactDelivery]
          }
        ]
      }
    ],
    transactionId
  }
}
