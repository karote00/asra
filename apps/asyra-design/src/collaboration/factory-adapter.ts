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
      const deliveries = publication.deliveries.filter((delivery) =>
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
      subscriber({ ...publication, deliveries })
    })
})
