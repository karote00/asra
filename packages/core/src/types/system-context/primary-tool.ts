import { PrimaryToolType } from '@asra/utils'

export interface PrimaryToolRawAPIs {
  getCurrentPrimaryTool: () => Promise<PrimaryToolType>
}

export interface PrimaryToolActionAPIs {
  switchPrimaryTool: (tool: PrimaryToolType) => void
}

export type PrimaryToolAPIs = PrimaryToolRawAPIs & PrimaryToolActionAPIs
