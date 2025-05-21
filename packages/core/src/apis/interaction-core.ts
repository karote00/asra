import { SystemSnapshot } from '@asra/utils'
import { InteractionCoreAPIs } from '../types'
import { decideAction } from '@asra/reactive-events'

export const createInteractionCoreAPIs = (): InteractionCoreAPIs => {
  return {
    async decideAction() {
      //   const systemSnapshot = await requestSystemSnapshot()
      //   decideAction(systemSnapshot)
    }
  }
}
