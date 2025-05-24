import { SystemContextSnapshot, InputSystemEvents } from '@asra/utils'
import { decideInteraction } from './decider'

class InteractionCore {
  decide(
    eventName: InputSystemEvents,
    systemContextSnapshot: SystemContextSnapshot
  ) {
    console.log(eventName, systemContextSnapshot)
    const action = decideInteraction(eventName, systemContextSnapshot)
    console.log('decidee action')
    console.log(action)
  }
}

export { InteractionCore }

const interactionCore = new InteractionCore()
export default interactionCore
