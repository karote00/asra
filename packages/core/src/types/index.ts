import {
  ElementSelectionAPIs,
  ElementSelectionActionAPIs
} from './element-selection'
import { InputSystemAPIs, InputSystemRawAPIs } from './input-system'
import { RenderAPIs, RenderRawAPIs } from './render'
import { SceneTreeAPIs, SceneTreeHandlerAPIs } from './scene-tree'
import { UndoAPIs, UndoActionAPIs } from './undo'
import { ViewportAPIs } from './viewport'
import { PropsAPIs, PropsRawAPIs } from './props'
import { SystemContextAPIs, ToolAPIs } from './system-context'

export { APIDeps, HandlerDeps } from './deps'

export {
  InputSystemRawAPIs,
  InputSystemAPIs,
  UndoActionAPIs,
  UndoAPIs,
  ViewportAPIs,
  RenderRawAPIs,
  RenderAPIs,
  SceneTreeAPIs,
  SceneTreeHandlerAPIs,
  ElementSelectionActionAPIs,
  ElementSelectionAPIs,
  PropsRawAPIs,
  PropsAPIs,
  ToolAPIs,
  SystemContextAPIs
}

export type CoreAPIs = InputSystemAPIs &
  UndoAPIs &
  ViewportAPIs &
  RenderAPIs &
  SceneTreeAPIs &
  ElementSelectionAPIs &
  PropsAPIs &
  SystemContextAPIs
