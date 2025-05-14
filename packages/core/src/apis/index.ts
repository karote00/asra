import { createViewportAPIs } from './viewport'
import { createUndoAPIs } from './undo'
import { APIDeps, CoreAPIs } from '../types'
import { createRenderAPIs } from './render'
import { createSceneTreeAPIs } from './scene-tree'
import { createElementSelectionAPIs } from './element-selection'
import { createInputSystemAPIs } from './input-system'
import { createPropsAPIs } from './props'
import { createSystemContextAPIs } from './system-context'

export const createAPIs = (deps: APIDeps): CoreAPIs => {
  return {
    ...createInputSystemAPIs(deps.inputSystem),
    ...createViewportAPIs(),
    ...createUndoAPIs(),
    ...createRenderAPIs(),
    ...createSceneTreeAPIs(deps.sceneTree),
    ...createPropsAPIs(deps.props),
    ...createElementSelectionAPIs(),
    ...createSystemContextAPIs()
  }
}
