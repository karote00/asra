import {
  decideAction,
  requestSystemContextSnapshot
} from '@asra/reactive-events'
import { InteractionCoreAPIs } from '../types'

export const createInteractionCoreAPIs = (): InteractionCoreAPIs => {
  return {
    async decideAction() {
      const systemContextSnapshot = await requestSystemContextSnapshot()
      decideAction(systemContextSnapshot)
    }
  }
}
