import { PrimaryToolType, MouseSnapshot, KeySnapshot } from '@asra/utils'
import {
  emitSwitchPrimaryTool,
  requestCurrentPrimaryTool,
  switchPrimaryTool,
  updateKeyState,
  updateMouseStata
} from '@asra/reactive-events'
import { SystemContextAPIs } from '../types'

export const createSystemContextAPIs = (): SystemContextAPIs => {
  return {
    async getCurrentPrimaryTool() {
      return await requestCurrentPrimaryTool()
    },
    switchPrimaryTool(tool: PrimaryToolType) {
      switchPrimaryTool(tool)
      emitSwitchPrimaryTool()
    },
    updateMouseState(mouseSnapshot: MouseSnapshot) {
      updateMouseStata(mouseSnapshot)
    },
    updateKeyState(keySnapshot: KeySnapshot) {
      updateKeyState(keySnapshot)
    }
  }
}
