import {
  decideAction,
  requestSystemContextSnapshot
} from '@asra/reactive-events'
import { InputSystemEvents, DetailType } from '@asra/utils'
import { InteractionCoreAPIs } from '../types'

export const createInteractionCoreAPIs = (): InteractionCoreAPIs => {
  return {
    async decideAction(eventName: InputSystemEvents, detail?: DetailType) {
      const systemContextSnapshot = await requestSystemContextSnapshot()
      decideAction(eventName, systemContextSnapshot, detail)
    }
  }
}
