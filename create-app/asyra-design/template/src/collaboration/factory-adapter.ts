import type { CollaborationFactory } from '@asyra/collaboration'
import type { Factory, SharedPublication } from '@asyra/factory'
import { SharedDataChannelNames } from '@asyra/utils'

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
      subscriber({ ...publication, deliveries })
    })
})
