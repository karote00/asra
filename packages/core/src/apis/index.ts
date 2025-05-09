import { createViewportAPIs } from './viewport'
import { createUndoAPIs } from './undo'
import { APIDeps, CoreAPIs } from '../types/core-apis'
import { createRenderAPIs } from './render'
import { createSceneTreeAPIs } from './scene-tree'
import { createElementSelectionAPIs } from './element-selection'
import { createInputSystemAPIs } from './input-system'

export const createAPIs = (deps: APIDeps): CoreAPIs => {
  return {
    ...createInputSystemAPIs(deps.inputSystem),
    ...createViewportAPIs(),
    ...createUndoAPIs(),
    ...createRenderAPIs(),
    ...createSceneTreeAPIs(),
    ...createElementSelectionAPIs()
  }
}
