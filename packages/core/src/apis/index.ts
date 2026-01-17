import { createTransactionAPIs } from './transaction'
import { createViewportAPIs } from './viewport'
import { createUndoAPIs } from './undo'
import { createRenderAPIs } from './render'
import { createSceneTreeAPIs } from './scene-tree'
import { createElementSelectionAPIs } from './element-selection'
import { createInputSystemAPIs } from './input-system'
import { createPropsAPIs } from './props'
import { createSystemContextAPIs } from './system-context'
import { createInteractionCoreAPIs } from './interaction-core'
import { CoreAPIs, RequestAPIs } from '../types'

export const createAPIs = (requestAPIs: RequestAPIs): CoreAPIs => {
  return {
    ...createTransactionAPIs(),
    ...createInputSystemAPIs(),
    ...createViewportAPIs(),
    ...createUndoAPIs(),
    ...createRenderAPIs(),
    ...createSceneTreeAPIs(),
    ...createPropsAPIs(),
    ...createElementSelectionAPIs(),
    ...createSystemContextAPIs(),
    ...createInteractionCoreAPIs(requestAPIs)
  }
}
