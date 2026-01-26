import { PrimaryToolType } from '@asyra/utils'

export interface PrimaryToolRawAPIs {}

export interface PrimaryToolActionAPIs {
  switchPrimaryTool: (tool: PrimaryToolType) => void
}

export type PrimaryToolAPIs = PrimaryToolRawAPIs & PrimaryToolActionAPIs
