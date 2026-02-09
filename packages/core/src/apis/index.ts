import sceneTree, { SceneTree } from '@asyra/scene-tree'
import render, { Render } from '@asyra/render'

import { createRenderAPIs } from './render'
import { createSceneTreeAPIs } from './scene-tree'
import { createElementSelectionAPIs } from './element-selection'
import { createInputSystemAPIs } from './input-system'
import { createFeatureSystemAPIs } from './feature-system'
import { CoreAPIs } from '../types'

export const createAPIs = (sceneTree: SceneTree, render: Render): CoreAPIs => {
  const sceneTreeRequests = {
    sceneTreeSaveData: () => sceneTree.save()
  }

  const renderRequests = {
    initRender: (width: number, height: number, color: number) =>
      render.init(width, height, color),
    getViewportPosition: () => render.getViewportPosition(),
    getViewportScale: () => render.getViewportScale()
  }

  return {
    ...createInputSystemAPIs(),
    ...createFeatureSystemAPIs(),
    ...createRenderAPIs(renderRequests),
    ...createSceneTreeAPIs(sceneTreeRequests),
    ...createElementSelectionAPIs()
  }
}
