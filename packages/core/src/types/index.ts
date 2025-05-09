import { ElementSelectionActionAPIs } from './element-selection'
import { InputSystemRawAPIs } from './input-system'
import { RenderRawAPIs } from './render'
import { SceneTreeAPIs, SceneTreeHandlerAPIs } from './scene-tree'
import { UndoActionAPIs } from './undo'
import { ViewportAPIs } from './viewport'

export { APIDeps, HandlerDeps } from './deps'

export {
  InputSystemRawAPIs,
  UndoActionAPIs,
  ViewportAPIs,
  RenderRawAPIs,
  SceneTreeAPIs,
  SceneTreeHandlerAPIs,
  ElementSelectionActionAPIs
}

export type CoreAPIs = InputSystemRawAPIs &
  UndoActionAPIs &
  ViewportAPIs &
  RenderRawAPIs &
  SceneTreeAPIs &
  ElementSelectionActionAPIs
