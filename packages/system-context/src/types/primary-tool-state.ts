import { PrimaryToolType } from '@asra/utils'

export interface PrimaryToolStateRawAPIs {
  getCurrentPrimaryTool: () => PrimaryToolType
}

export interface PrimaryToolStateActionAPIs {
  switchPrimaryTool: (tool: PrimaryToolType) => void
}

export type PrimaryToolStateAPIs = PrimaryToolStateRawAPIs &
  PrimaryToolStateActionAPIs
