import { SystemSnapshot } from '@asra/utils'
import { RootAPIs } from '../types'
import { HandlerDeps } from '../types'

export const createRootAPIs = (deps: HandlerDeps): RootAPIs => ({
  getSystemSnapshot(): SystemSnapshot {
    return {
      primaryTool: deps.primaryToolState.current,
      mouse: deps.mouseState.current,
      system: {
        mode: deps.systemState.mode,
        featureFlags: {},
        permissions: {}
      },
      // TODO: Need to add system, target and key state and get current state here
      target: {
        hoveredElementId: null,
        selectedElementIds: [],
        activeElementId: null
      },
      key: {
        alt: false,
        ctrl: false,
        shift: false,
        meta: false,
        pressedKeys: []
      }
    }
  }
})
