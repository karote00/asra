import { PrimaryToolType, MouseSnapshot } from '@asra/utils'
import { SystemContextAPIs } from '../types'
import {
  emitSwitchPrimaryTool,
  requestCurrentPrimaryTool,
  switchPrimaryTool,
  updateMouseStata
} from '@asra/reactive-events'

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
    }
  }
}
