import { MouseSnapshot, KeySnapshot } from '@asyra/utils'
import { updateKeyState, updateMouseState } from '@asyra/reactive-events'
import { SystemContextAPIs } from '../types'

export const createSystemContextAPIs = (): SystemContextAPIs => {
  return {
    updateMouseState(mouseSnapshot: MouseSnapshot) {
      updateMouseState(mouseSnapshot)
    },
    updateKeyState(keySnapshot: KeySnapshot) {
      updateKeyState(keySnapshot)
    }
  }
}
