import { PrimaryToolType } from '@asra/utils'
import { PrimaryToolStateAPIs } from '../types'
import { HandlerDeps } from '../types'

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
