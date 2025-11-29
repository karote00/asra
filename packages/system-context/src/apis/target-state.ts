import { HandlerDeps, TargetStateAPIs } from '../types'

export const createTargetStateAPIs = (
  targetState: HandlerDeps['targetState']
): TargetStateAPIs => ({
  updateHoveredElementId(elementId: string | null) {
    targetState.updateHoveredElementId(elementId)
  },
  getTargetState() {
    return targetState.current
  }
})
