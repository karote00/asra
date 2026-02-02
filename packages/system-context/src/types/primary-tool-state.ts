export interface PrimaryToolStateRawAPIs {
  getCurrentPrimaryTool: () => string
}

export interface PrimaryToolStateActionAPIs {
  switchPrimaryTool: (tool: string) => void
}

export type PrimaryToolStateAPIs = PrimaryToolStateRawAPIs &
  PrimaryToolStateActionAPIs
