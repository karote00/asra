import { MouseSnapshot } from '@asyra/utils'
import { HandlerDeps, MouseStateAPIs } from '../types'

export const createMouseStateAPIs = (deps: HandlerDeps): MouseStateAPIs => ({
  updateMouseState(mouseSnapshot: MouseSnapshot) {
    deps.mouseState.set(mouseSnapshot)
    deps.managedPropertyState.setIfRegistered('mouseState', mouseSnapshot)
  },
  getMouseState() {
    return deps.mouseState.current
  }
})
