import sceneTree, { SceneTree } from '@asyra/scene-tree'
import render, { Render } from '@asyra/render'
import { Bounds, EntityTypes } from '@asyra/utils'

import { createRenderAPIs } from './render'
import { createSceneTreeAPIs } from './scene-tree'
import { createElementSelectionAPIs } from './element-selection'
import { createInputSystemAPIs } from './input-system'
import { createFeatureSystemAPIs } from './feature-system'
import { createUIContextAPIs } from './ui-context'
import { createSystemPropertyAPIs } from './system-properties'
import { CoreAPIs } from '../types'

export const createAPIs = (sceneTree: SceneTree, render: Render): CoreAPIs => {
  const sceneTreeRequests = {
    sceneTreeSaveData: () => sceneTree.save(),
    getAllElementsBounds: () => {
      const bounds: Bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      }
      let hasElement = false

      sceneTree.getAllElements().forEach((element) => {
        if (element.get('type') === EntityTypes.WORKSPACE) {
          return
        }

        const computed = element.getAllComputedData?.()
        if (!computed) {
          return
        }

        const x = computed.x as number | undefined
        const y = computed.y as number | undefined
        const width = computed.width as number | undefined
        const height = computed.height as number | undefined

        if (
          x === undefined ||
          y === undefined ||
          width === undefined ||
          height === undefined
        ) {
          return
        }

        const minX = Math.min(x, x + width)
        const minY = Math.min(y, y + height)
        const maxX = Math.max(x, x + width)
        const maxY = Math.max(y, y + height)

        bounds.minX = Math.min(bounds.minX, minX)
        bounds.minY = Math.min(bounds.minY, minY)
        bounds.maxX = Math.max(bounds.maxX, maxX)
        bounds.maxY = Math.max(bounds.maxY, maxY)
        hasElement = true
      })

      return hasElement ? bounds : null
    }
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
    ...createElementSelectionAPIs(),
    ...createUIContextAPIs(),
    ...createSystemPropertyAPIs()
  }
}
