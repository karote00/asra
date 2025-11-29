import { TargetSnapshot } from '@asra/utils'

export interface TargetStateRawAPIs {
  getTargetState: () => TargetSnapshot
}

export interface TargetStateActionAPIs {
  updateHoveredElementId: (elementId: string | null) => void
}

export type TargetStateAPIs = TargetStateActionAPIs & TargetStateRawAPIs
