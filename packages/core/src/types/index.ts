import { TransactionAPIs, TransactionActionAPIs } from './transaction'
import {
  ElementSelectionAPIs,
  ElementSelectionActionAPIs
} from './element-selection'
import { InputSystemAPIs, InputSystemRawAPIs } from './input-system'
import { RenderAPIs, RenderRawAPIs } from './render'
import {
  SceneTreeAPIs,
  SceneTreeActionAPIs,
  SceneTreeHandlerAPIs
} from './scene-tree'
import { UndoAPIs, UndoActionAPIs } from './undo'
import { ViewportAPIs } from './viewport'
import { PropsAPIs, PropsRawAPIs } from './props'
import {
  SystemContextAPIs,
  PrimaryToolActionAPIs,
  PrimaryToolAPIs,
  MouseStateAPIs,
  KeyStateAPIs
} from './system-context'
import {
  InteractionCoreAPIs,
  InteractionCoreSessionAPIs,
  InteractionCoreActionAPIs
} from './interaction-core'
import {
  Requests,
  RequestsDeps,
  SystemContextRequests,
  SystemContextRequestsDeps
} from './requests'

export { HandlerDeps } from './deps'

export {
  TransactionAPIs,
  TransactionActionAPIs,
  InputSystemRawAPIs,
  InputSystemAPIs,
  UndoActionAPIs,
  UndoAPIs,
  ViewportAPIs,
  RenderRawAPIs,
  RenderAPIs,
  SceneTreeAPIs,
  SceneTreeActionAPIs,
  SceneTreeHandlerAPIs,
  ElementSelectionActionAPIs,
  ElementSelectionAPIs,
  PropsRawAPIs,
  PropsAPIs,
  PrimaryToolActionAPIs,
  PrimaryToolAPIs,
  MouseStateAPIs,
  SystemContextAPIs,
  InteractionCoreActionAPIs,
  InteractionCoreSessionAPIs,
  InteractionCoreAPIs,
  KeyStateAPIs,
  Requests,
  RequestsDeps,
  SystemContextRequests,
  SystemContextRequestsDeps
}

export type CoreAPIs = TransactionAPIs &
  InputSystemAPIs &
  UndoAPIs &
  ViewportAPIs &
  RenderAPIs &
  SceneTreeAPIs &
  ElementSelectionAPIs &
  PropsAPIs &
  SystemContextAPIs &
  InteractionCoreAPIs
