import { PrimaryToolType } from '@asra/utils'
import { SystemContextAPIs } from '../types'
import {
  requestCurrentPrimaryTool,
  switchPrimaryTool
} from '@asra/reactive-events'

export const createSystemContextAPIs = (): SystemContextAPIs => {
  return {
    async getCurrentPrimaryTool() {
      return await requestCurrentPrimaryTool()
    },
    switchPrimaryTool(tool: PrimaryToolType) {
      switchPrimaryTool(tool)
    }
  }
}
