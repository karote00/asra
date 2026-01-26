import { PrimaryToolType, MouseSnapshot, KeySnapshot } from '@asyra/utils'
import {
  emitSwitchPrimaryTool,
  switchPrimaryTool,
  updateKeyState,
  updateMouseState
} from '@asyra/reactive-events'
import { SystemContextAPIs } from '../types'

export const createSystemContextAPIs = (): SystemContextAPIs => {
  return {
    switchPrimaryTool(tool: PrimaryToolType) {
      switchPrimaryTool(tool)
      emitSwitchPrimaryTool()
    },
    updateMouseState(mouseSnapshot: MouseSnapshot) {
      updateMouseState(mouseSnapshot)
    },
    updateKeyState(keySnapshot: KeySnapshot) {
      updateKeyState(keySnapshot)
    }
  }
}
