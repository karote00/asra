import { HandlerDeps, SystemStateAPIs } from '../types'

export const createSystemAPIs = (
  systemState: HandlerDeps['systemState']
): SystemStateAPIs => ({
  getSystemMode() {
    return systemState.mode
  }
})
