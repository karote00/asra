import type { CollaborationFactory } from '@asyra/collaboration'
import type {
  Factory,
  SharedPublication,
  SharedPublicationSlice
} from '@asyra/factory'
import { EventTypes } from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import { recordAiDrawingPerformancePublication } from '../init/performance/ai-drawing-performance-profile'

const documentChannels = new Set<string>([
  SharedDataChannelNames.SCENE_TREE,
  SharedDataChannelNames.PROPS
])

export const createDocumentCollaborationFactory = (
  factory: Factory
): CollaborationFactory => ({
  subscribeToSharedPublication: (subscriber) =>
    factory.subscribeToSharedPublication((publication: SharedPublication) => {
      let publicationIsDocumentOnly = true
      const slices = publication.slices.flatMap((slice) => {
        const batches = slice.batches.filter(({ channel }) =>
          documentChannels.has(channel)
        )
        if (batches.length !== slice.batches.length) {
          publicationIsDocumentOnly = false
        }
        if (batches.length === 0) return []
        if (batches.length === slice.batches.length) return [slice]

        const retainedIds = new Set(
          batches.flatMap(({ deliveries }) =>
            deliveries.flatMap(({ deliveryId, orderedIds }) => [
              deliveryId,
              ...orderedIds
            ])
          )
        )
        return [
          Object.freeze({
            sliceId: slice.sliceId,
            orderedIds: Object.freeze(
              slice.orderedIds.filter((orderedId) => retainedIds.has(orderedId))
            ),
            batches: Object.freeze(batches)
          } satisfies SharedPublicationSlice)
        ]
      })
      const deliveries = slices.flatMap(({ batches }) =>
        batches.flatMap(({ deliveries: batchDeliveries }) => batchDeliveries)
      )
      if (deliveries.length === 0) return
      if (
        deliveries.some(
          ({ eventName }) =>
            eventName === EventTypes.UPDATE_COMPUTED_DATA ||
            eventName === EventTypes.UPDATE_COMPUTED_DATA_PATCH
        )
      ) {
        throw new Error(
          '[asyra-design collaboration] local-only computed projection cannot enter a shared publication'
        )
      }
      const performanceProfile = window.__AsyraAiDrawingPerformance__
      if (performanceProfile) {
        try {
          recordAiDrawingPerformancePublication(performanceProfile, {
            deliveryCount: deliveries.length,
            publicationId: publication.publicationId
          })
        } catch {
          // Detached profiling cannot alter the canonical transport route.
        }
      }
      subscriber(
        publicationIsDocumentOnly
          ? publication
          : Object.freeze({
              ...publication,
              slices: Object.freeze(slices)
            })
      )
    })
})
