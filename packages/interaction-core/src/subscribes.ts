import { subscribeToExecuteAction } from '@asra/reactive-events'
import interactionCore from './interaction-core'

export const initInteractionCoreSubscribes = () => {
  subscribeToExecuteAction(({ payload }) => {
    const { eventName, systemContextSnapshot, detail } = payload
    interactionCore.executeAction(eventName, systemContextSnapshot, detail)
  })
}
