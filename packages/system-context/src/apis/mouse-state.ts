import { MouseSnapshot } from '@asra/utils'
import { MouseStateAPIs } from '../types'
import { HandlerDeps } from '../types'

export const createMouseStateAPIs = (
  mouseState: HandlerDeps['mouseState']
): MouseStateAPIs => ({
  updateMouseState(mouseSnapshot: MouseSnapshot) {
    mouseState.set(mouseSnapshot)
  },
  getMouseState() {
    return mouseState.current
  }
})
