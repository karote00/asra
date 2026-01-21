// Request API Types
// Domain-specific type definitions for request layer

import {
  SystemContextRequests,
  SystemContextRequestsDeps
} from './system-context'
import { PropsRequests, PropsRequestDeps } from './props'
import { SceneTreeRequestDeps, SceneTreeRequests } from './scene-tree'
import { FactoryRequests, FactoryRequestDeps } from './factory'
import { RenderRequestDeps, RenderRequests } from './render'
import { SelectionRequestDeps, SelectionRequests } from './selection'

export {
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

export type RequestsDeps = SystemContextRequestsDeps &
  PropsRequestDeps &
  SceneTreeRequestDeps &
  FactoryRequestDeps &
  RenderRequestDeps &
  SelectionRequestDeps

export interface Requests {
  systemContextRequests: SystemContextRequests
  propsRequests: PropsRequests
  sceneTreeRequests: SceneTreeRequests
  factoryRequests: FactoryRequests
  renderRequests: RenderRequests
  selectionRequests: SelectionRequests
}
