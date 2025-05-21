import { decideAction, requestSystemSnapshot } from '@asra/reactive-events'
import { InteractionCoreAPIs } from '../types'

export const createInteractionCoreAPIs = (): InteractionCoreAPIs => {
  return {
    async decideAction() {
      const systemSnapshot = await requestSystemSnapshot()
      decideAction(systemSnapshot)
    }
  }
}
