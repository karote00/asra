import { PrimaryToolType } from '@asra/utils'
import { PrimaryToolAPIs } from '../types'
import { HandlerDeps } from '../types'

export const createPrimaryToolAPIs = (
  primaryToolState: HandlerDeps['primaryToolState']
): PrimaryToolAPIs => ({
  getCurrentPrimaryTool(): PrimaryToolType {
    return primaryToolState.current
  },
  switchPrimaryTool(tool: PrimaryToolType) {
    primaryToolState.set(tool)
  }
})
