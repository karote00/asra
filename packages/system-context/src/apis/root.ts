import { SystemContextSnapshot } from '@asra/utils'
import { HandlerDeps, RootAPIs } from '../types'

export const createRootAPIs = (deps: HandlerDeps): RootAPIs => ({
  getSystemContextSnapshot(): SystemContextSnapshot {
    return {
      primaryTool: deps.primaryToolState.current,
      mouse: deps.mouseState.current,
      system: {
        mode: deps.systemState.mode,
        featureFlags: {},
        permissions: {}
      },
      key: deps.keyState.current,
      // TODO: Need to add system, target and key state and get current state here
      target: {
        hoveredElementId: null,
        selectedElementIds: [],
        activeElementId: null
      }
    }
  }
})
