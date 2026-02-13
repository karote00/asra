import { KeySnapshot } from '@asyra/utils'
import { HandlerDeps, KeyStateAPIs } from '../types'

export const createKeyStateAPIs = (
  deps: HandlerDeps
): KeyStateAPIs => ({
  updateKeyState(keySnapshot: KeySnapshot) {
    deps.keyState.set(keySnapshot)
    deps.managedPropertyState.setIfRegistered('keyState', keySnapshot)
  },
  getKeyState() {
    return deps.keyState.current
  }
})
