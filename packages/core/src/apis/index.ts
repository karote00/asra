import { SceneTree, componentRegistry } from '@asyra/scene-tree'
import { Render } from '@asyra/render'
import type { SelectionManager } from '@asyra/selection'
import { Bounds, EntityTypes, ComputedAttrs } from '@asyra/utils'

import { createRenderAPIs, type RenderRequests } from './render'
import { createSceneTreeAPIs } from './scene-tree'
import { createElementSelectionAPIs } from './element-selection'
import { createInputSystemAPIs } from './input-system'
import { createFeatureSystemAPIs } from './feature-system'
import { createUIContextAPIs } from './ui-context'
import { createSystemPropertyAPIs } from './system-properties'
import { CoreAPIs } from '../types'

export const createAPIs = (
  sceneTree: SceneTree,
  render: Render,
  selection: SelectionManager
): CoreAPIs => {
  const sceneTreeRequests = {
    sceneTreeSaveData: () => sceneTree.save(),
    isContainerType: (type: string) => {
      if (
        type === EntityTypes.WORKSPACE ||
        type === EntityTypes.FRAME ||
        type === EntityTypes.GROUP
      ) {
        return true
      }

      return componentRegistry.get(type)?.isContainer ?? false
    },
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

        const computed = element.getAllComputedData?.() as
          | ComputedAttrs
          | undefined
        if (!computed || typeof computed.x !== 'number') {
          return
        }

        const x = computed.x
        const y = computed.y as number
        const width = computed.width as number
        const height = computed.height as number

        if (
          typeof y !== 'number' ||
          typeof width !== 'number' ||
          typeof height !== 'number'
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

  const renderRequests: RenderRequests = {
    initRender: (width: number, height: number, color: number) =>
      render.init(width, height, color),
    getViewportPosition: () => render.getViewportPosition(),
    getViewportScale: () => render.getViewportScale(),
    registerRenderLayer: (registration, options) =>
      render.registerLayer(registration, options),
    unregisterRenderLayer: (name: string) => render.unregisterLayer(name)
  }

  return {
    ...createInputSystemAPIs(),
    ...createFeatureSystemAPIs(),
    ...createRenderAPIs(renderRequests),
    ...createSceneTreeAPIs(sceneTreeRequests),
    ...createElementSelectionAPIs(selection),
    ...createUIContextAPIs(),
    ...createSystemPropertyAPIs()
  }
}
