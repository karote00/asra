import { createViewportAPIs } from './viewport'
import { createUndoAPIs } from './undo'
import { CoreAPIs } from '../types'
import { createRenderAPIs } from './render'
import { createSceneTreeAPIs } from './scene-tree'
import { createElementSelectionAPIs } from './element-selection'
import { createInputSystemAPIs } from './input-system'
import { createPropsAPIs } from './props'
import { createSystemContextAPIs } from './system-context'
import { createInteractionCoreAPIs } from './interaction-core'

export const createAPIs = (): CoreAPIs => {
  return {
    ...createInputSystemAPIs(),
    ...createViewportAPIs(),
    ...createUndoAPIs(),
    ...createRenderAPIs(),
    ...createSceneTreeAPIs(),
    ...createPropsAPIs(),
    ...createElementSelectionAPIs(),
    ...createSystemContextAPIs(),
    ...createInteractionCoreAPIs()
  }
}
