import { subscribeToDecideAction } from '@asra/reactive-events'
import interactionCore from './interaction-core'

export const initInteractionCoreSubscribes = () => {
  subscribeToDecideAction(({ payload }) => {
    const { eventName, systemContextSnapshot } = payload
    interactionCore.decide(eventName, systemContextSnapshot)
  })
}
