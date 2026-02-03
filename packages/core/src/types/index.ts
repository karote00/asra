import { TransactionAPIs, TransactionActionAPIs } from './transaction'
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
  SystemContextRequestsDeps,
  PropsRequests,
  PropsRequestDeps,
  SceneTreeRequests,
  SceneTreeRequestDeps,
  FactoryRequests,
  FactoryRequestDeps,
  RenderRequests,
  RenderRequestDeps,
  SelectionRequests,
  SelectionRequestDeps
} from './requests'

export { HandlerDeps } from './deps'
export { Workflow, WorkflowRegistry } from './workflow'

export {
  // APIs
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
  PropsRawAPIs,
  PropsAPIs,
  MouseStateAPIs,
  SystemContextAPIs,
  InteractionCoreActionAPIs,
  InteractionCoreSessionAPIs,
  InteractionCoreAPIs,
  KeyStateAPIs,

  // Requests
  Requests,
  RequestsDeps,
  SystemContextRequests,
  SystemContextRequestsDeps,
  PropsRequests,
  PropsRequestDeps,
  SceneTreeRequests,
  SceneTreeRequestDeps,
  FactoryRequests,
  FactoryRequestDeps,
  RenderRequests,
  RenderRequestDeps,
  SelectionRequests,
  SelectionRequestDeps
}

export type CoreAPIs = TransactionAPIs &
  InputSystemAPIs &
  UndoAPIs &
  ViewportAPIs &
  RenderAPIs &
  SceneTreeAPIs &
  PropsAPIs &
  SystemContextAPIs &
  InteractionCoreAPIs
