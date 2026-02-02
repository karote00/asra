import { HandlerDeps, PrimaryToolStateAPIs } from '../types'

export const createPrimaryToolStateAPIs = (
  primaryToolState: HandlerDeps['primaryToolState']
): PrimaryToolStateAPIs => ({
  getCurrentPrimaryTool(): string {
    return primaryToolState.current
  },
  switchPrimaryTool(tool: string) {
    primaryToolState.set(tool)
  }
})
