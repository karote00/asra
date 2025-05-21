import { SystemSnapshot } from '@asra/utils'
import { decideInteraction } from './decider'

class InteractionCore {
  decide(systemSnapshot: SystemSnapshot) {
    const action = decideInteraction(systemSnapshot)
    console.log('decidee action')
    console.log(action)
  }
}

export { InteractionCore }

const interactionCore = new InteractionCore()
export default interactionCore
