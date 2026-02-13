import { HandlerDeps, TargetStateAPIs } from '../types'

export const createTargetStateAPIs = (
  deps: HandlerDeps
): TargetStateAPIs => ({
  updateHoveredElementId(elementId: string | null) {
    deps.targetState.updateHoveredElementId(elementId)
    deps.managedPropertyState.setIfRegistered('targetState', deps.targetState.current)
    deps.managedPropertyState.setIfRegistered('hoveredElementId', elementId)
  },
  getTargetState() {
    return deps.targetState.current
  }
})
