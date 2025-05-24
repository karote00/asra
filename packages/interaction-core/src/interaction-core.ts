import {
  SystemContextSnapshot,
  InputSystemEvents,
  DetailType
} from '@asra/utils'
import { decideInteraction } from './decider'

class InteractionCore {
  decide(
    eventName: InputSystemEvents,
    systemContextSnapshot: SystemContextSnapshot,
    detail?: DetailType
  ) {
    console.log(eventName, systemContextSnapshot, detail)
    const action = decideInteraction(eventName, systemContextSnapshot, detail)
    console.log('decidee action')
    console.log(action)
  }
}

export { InteractionCore }

const interactionCore = new InteractionCore()
export default interactionCore
