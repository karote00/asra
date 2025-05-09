import { createViewportAPIs } from './viewport'
import { createUndoAPIs } from './undo'
import { CoreAPIs, HandlerDeps } from '../types/core-apis'
import { createRenderAPIs } from './render'

export const createAPIs = (deps: {
  render: HandlerDeps['render']
  factory: HandlerDeps['factory']
}): CoreAPIs => {
  return {
    ...createViewportAPIs(deps.render),
    ...createUndoAPIs(),
    ...createRenderAPIs()
  }
}

export type APIMap = ReturnType<typeof createAPIs>
