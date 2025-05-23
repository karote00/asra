import { SystemContextSnapshot } from '@asra/utils'
import { decideInteraction } from './decider'

class InteractionCore {
  decide(systemContextSnapshot: SystemContextSnapshot) {
    // console.log(systemContextSnapshot)
    const action = decideInteraction(systemContextSnapshot)
    // console.log('decidee action')
    // console.log(action)
  }
}

export { InteractionCore }

const interactionCore = new InteractionCore()
export default interactionCore
