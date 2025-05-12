import { ToolType } from '@asra/utils'
import { APIDeps, SystemContextAPIs } from '../types'

export const createSystemContextAPIs = (
  systemContext: APIDeps['systemContext']
): SystemContextAPIs => {
  return {
    getCurrentTool() {
      return systemContext.getCurrentTool()
    },
    switchTool(tool: ToolType) {
      systemContext.switchTool(tool)
    }
  }
}
