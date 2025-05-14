import { PrimaryToolType } from '@asra/utils'

export interface PrimaryToolRawAPIs {
  getCurrentPrimaryTool: () => PrimaryToolType
}

export interface PrimaryToolActionAPIs {
  switchPrimaryTool: (tool: PrimaryToolType) => void
}

export type PrimaryToolAPIs = PrimaryToolRawAPIs & PrimaryToolActionAPIs
