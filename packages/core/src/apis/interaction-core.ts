import {
  decideAction,
  requestSystemContextSnapshot
} from '@asra/reactive-events'
import { InputSystemEvents } from '@asra/utils'
import { InteractionCoreAPIs } from '../types'

export const createInteractionCoreAPIs = (): InteractionCoreAPIs => {
  return {
    async decideAction(eventName: InputSystemEvents) {
      const systemContextSnapshot = await requestSystemContextSnapshot()
      decideAction(eventName, systemContextSnapshot)
    }
  }
}
