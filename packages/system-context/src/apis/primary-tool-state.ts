import { HandlerDeps, PrimaryToolStateAPIs } from '../types'

export const createPrimaryToolStateAPIs = (
  deps: HandlerDeps
): PrimaryToolStateAPIs => ({
  getCurrentPrimaryTool(): string {
    return deps.primaryToolState.current
  },
  switchPrimaryTool(tool: string) {
    deps.primaryToolState.set(tool)
    deps.managedPropertyState.setIfRegistered('primaryTool', tool)
  }
})
