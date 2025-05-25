import { PrimaryToolType } from '@asra/utils'
import { HandlerDeps, PrimaryToolStateAPIs } from '../types'

export const createPrimaryToolStateAPIs = (
  primaryToolState: HandlerDeps['primaryToolState']
): PrimaryToolStateAPIs => ({
  getCurrentPrimaryTool(): PrimaryToolType {
    return primaryToolState.current
  },
  switchPrimaryTool(tool: PrimaryToolType) {
    primaryToolState.set(tool)
  }
})
