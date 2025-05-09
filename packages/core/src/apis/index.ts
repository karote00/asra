import { createViewportAPIs } from './viewport'
import { createUndoAPIs } from './undo'
import { CoreAPIs } from '../types/core-apis'
import { createRenderAPIs } from './render'
import { createSceneTreeAPIs } from './scene-tree'
import { createElementSelectionAPIs } from './element-selection'

export const createAPIs = (): CoreAPIs => {
  return {
    ...createViewportAPIs(),
    ...createUndoAPIs(),
    ...createRenderAPIs(),
    ...createSceneTreeAPIs(),
    ...createElementSelectionAPIs()
  }
}
