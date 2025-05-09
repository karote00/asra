import { ElementSelectionActionAPIs } from './element-selection'
import { InputSystemRawAPIs } from './input-system'
import { RenderRawAPIs } from './render'
import { SceneTreeAPIs, SceneTreeHandlerAPIs } from './scene-tree'
import { UndoActionAPIs } from './undo'
import { ViewportAPIs } from './viewport'
import { RenderPropsAPIs } from './props'

export { APIDeps, HandlerDeps } from './deps'

export {
  InputSystemRawAPIs,
  UndoActionAPIs,
  ViewportAPIs,
  RenderRawAPIs,
  SceneTreeAPIs,
  SceneTreeHandlerAPIs,
  ElementSelectionActionAPIs,
  RenderPropsAPIs
}

export type CoreAPIs = InputSystemRawAPIs &
  UndoActionAPIs &
  ViewportAPIs &
  RenderRawAPIs &
  SceneTreeAPIs &
  ElementSelectionActionAPIs &
  RenderPropsAPIs
