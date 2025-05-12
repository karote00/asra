import { ToolType } from '@asra/utils'

export interface ToolRawAPIs {
  getCurrentTool: () => ToolType
}

export interface ToolActionAPIs {
  switchTool: (tool: ToolType) => void
}

export type ToolAPIs = ToolRawAPIs & ToolActionAPIs

export type SystemContextAPIs = ToolAPIs
