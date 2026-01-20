// Request API Layer - Pure data access functions
// This layer provides synchronous access to system data without business logic

import { createSystemContextRequests } from './system-context'
import { createPropsRequests } from './props'
import { createSceneTreeRequests } from './scene-tree'
import { Requests, RequestsDeps } from '../types'
import { createFactoryRequests } from './factory'
import { createRenderRequests } from './render'
import { createSelectionRequests } from './selection'

export const createRequests = (deps: RequestsDeps): Requests => {
  return {
    systemContextRequests: createSystemContextRequests({
      systemContext: deps.systemContext
    }),
    propsRequests: createPropsRequests({ props: deps.props }),
    sceneTreeRequests: createSceneTreeRequests({ sceneTree: deps.sceneTree }),
    factoryRequests: createFactoryRequests({ factory: deps.factory }),
    renderRequests: createRenderRequests({ render: deps.render }),
    selectionRequests: createSelectionRequests({ selection: deps.selection })
  }
}
