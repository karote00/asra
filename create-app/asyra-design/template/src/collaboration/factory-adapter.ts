import type { CollaborationFactory } from '@asyra/collaboration'
import type {
  Factory,
  SharedPublication,
  SharedPublicationSlice
} from '@asyra/factory'
import { EventTypes } from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import {
  getActiveAiDrawingPerformanceProfile,
  recordAiDrawingPerformancePublication
} from '../init/performance/ai-drawing-performance-profile'

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
      const firstSlice = slices[0]
      if (!firstSlice) return
      const requiresAtomicCollapse =
        publication.mode === 'atomic' && slices.length > 1
      const transportSlices: readonly SharedPublicationSlice[] =
        requiresAtomicCollapse
          ? Object.freeze([
              Object.freeze({
                sliceId: firstSlice.sliceId,
                orderedIds: Object.freeze(
                  slices.flatMap(({ orderedIds }) => orderedIds)
                ),
                batches: Object.freeze(slices.flatMap(({ batches }) => batches))
              })
            ])
          : Object.freeze(slices)
      if (
        deliveries.some(
          ({ eventName }) =>
            eventName === EventTypes.UPDATE_COMPUTED_DATA ||
            eventName === EventTypes.UPDATE_COMPUTED_DATA_PATCH
        )
      ) {
        throw new Error(
          '[collaboration] local-only computed projection cannot enter a shared publication'
        )
      }
      const performanceProfile = getActiveAiDrawingPerformanceProfile()
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
        publicationIsDocumentOnly && !requiresAtomicCollapse
          ? publication
          : Object.freeze({
              ...publication,
              slices: transportSlices
            })
      )
    })
})
