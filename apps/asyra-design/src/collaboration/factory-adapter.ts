import type { CollaborationFactory } from '@asyra/collaboration'
import type { Factory, SharedPublication } from '@asyra/factory'
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
      const batches = publication.batches.filter((batch) =>
        documentChannels.has(batch.channel)
      )
      const deliveries = batches.flatMap((batch) => batch.deliveries)
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
      const retainedSliceIds = new Set(batches.map(({ sliceId }) => sliceId))
      subscriber({
        ...publication,
        deliveries,
        batches,
        deliverySequence: {
          ...publication.deliverySequence,
          slices: publication.deliverySequence.slices.filter(({ sliceId }) =>
            retainedSliceIds.has(sliceId)
          )
        }
      })
    })
})
