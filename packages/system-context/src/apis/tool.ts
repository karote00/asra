import { ToolType } from '@asra/utils'
import { toolState } from '../states'
import { ToolAPIs } from '../types/tool'

export const createToolAPIs = (): ToolAPIs => ({
  getCurrentTool(): ToolType {
    return toolState.current
  },
  switchTool(tool: ToolType) {
    toolState.set(tool)
  }
})
