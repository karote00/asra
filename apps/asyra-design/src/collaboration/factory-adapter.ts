import type { CollaborationFactory } from '@asyra/collaboration'
import type { Factory, SharedPublication } from '@asyra/factory'
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
      const hasBatchEvidence = Array.isArray(publication.batches)
      const batches = hasBatchEvidence
        ? publication.batches.filter((batch) =>
            documentChannels.has(batch.channel)
          )
        : []
      const deliveries = hasBatchEvidence
        ? batches.flatMap((batch) => batch.deliveries)
        : publication.deliveries.filter((delivery) =>
            documentChannels.has(delivery.channel)
          )
      if (deliveries.length === 0) return
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
      if (!hasBatchEvidence) {
        subscriber({ ...publication, deliveries })
        return
      }
      const retainedSliceIds = new Set(batches.map(({ sliceId }) => sliceId))
      subscriber({
        ...publication,
        deliveries,
        batches,
        deliveryPlan: {
          ...publication.deliveryPlan,
          slices: publication.deliveryPlan.slices.filter(({ sliceId }) =>
            retainedSliceIds.has(sliceId)
          )
        }
      })
    })
})
