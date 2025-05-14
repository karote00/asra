import { PrimaryToolType } from '@asra/utils'

export interface PrimaryToolAPIs {
  getCurrentPrimaryTool: () => PrimaryToolType
  switchPrimaryTool: (tool: PrimaryToolType) => void
}
