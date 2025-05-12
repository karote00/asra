import { ToolType } from '@asra/utils'

export interface ToolAPIs {
  getCurrentTool: () => ToolType
  switchTool: (tool: ToolType) => void
}
