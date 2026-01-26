import { SystemContextSnapshot } from '@asyra/utils'
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
      target: deps.targetState.current
    }
  }
})
