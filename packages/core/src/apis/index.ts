import { Factory } from '@asra/factory'
import { Render } from '@asra/render'
import { createViewportAPIs } from './viewport'
import { createUndoAPIs } from './undo'
import { CoreAPIs } from '../types/core-apis'

export const createAPIs = (deps: {
  render: Render
  factory: Factory
}): CoreAPIs => {
  return {
    ...createViewportAPIs(deps.render),
    ...createUndoAPIs(deps.factory)
  }
}

export type APIMap = ReturnType<typeof createAPIs>
