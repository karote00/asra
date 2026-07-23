import { SceneTree, componentRegistry } from '@asyra/scene-tree'
import {
  Render,
  createRenderGradientFillStyle,
  createEvenOddFillStyle,
  createMeshProjection
} from '@asyra/render'
import type { PropsManager } from '@asyra/props-manager'
import type { SelectionManager } from '@asyra/selection'
import type { Factory } from '@asyra/factory'
import {
  type Bounds,
  type ComputedAttrs,
  type EVENT_OPTIONS,
  type MoveHierarchyRequest,
  type PropertyComponentInstanceDataTypes,
  type PropsComponentRawData,
  EntityTypes
} from '@asyra/utils'

import { createPropsAPIs, type PropsRequests } from './props'
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
  selection: SelectionManager,
  props: PropsManager,
  factory: Factory
): CoreAPIs => {
  const sceneTreeRequests = {
    sceneTreeSaveData: () => sceneTree.save(),
    moveElements: (request: MoveHierarchyRequest, options?: EVENT_OPTIONS) =>
      sceneTree.moveElements(request, options),
    removeSubtree: (elementId: string, options?: EVENT_OPTIONS) =>
      sceneTree.removeSubtree(elementId, options),
    refreshComputedDataFromProperty: (
      elementId: string,
      propertyName: string,
      options?: EVENT_OPTIONS
    ) => {
      sceneTree.refreshComputedDataFromProperty(
        elementId,
        propertyName,
        options
      )
      props.commitChanges(options)
      sceneTree.commitSceneTreeTransaction(options)
    },
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
    unregisterRenderLayer: (name: string) => render.unregisterLayer(name),
    createRenderGradientFillStyle,
    createEvenOddFillStyle,
    createMeshProjection,
    registerRenderInteractionTargets: (targets, options) =>
      render.registerInteractionTargets(targets, options),
    updateRenderInteractionTarget: (targetId, patch) =>
      render.updateInteractionTarget(targetId, patch),
    unregisterRenderInteractionTarget: (targetId) =>
      render.unregisterInteractionTarget(targetId),
    clearRenderInteractionTargets: () => render.clearInteractionTargets(),
    registerRenderInteractionHandler: (targetId, registration) =>
      render.registerInteractionHandler(targetId, registration),
    unregisterRenderInteractionHandler: (targetId, eventType) =>
      render.unregisterInteractionHandler(targetId, eventType)
  }

  const propsRequests: PropsRequests = {
    updatePropertyById: (propertyId, key, data, owner, options) =>
      props.updatePropertyById(
        propertyId,
        key as keyof PropertyComponentInstanceDataTypes,
        data as never,
        owner,
        options
      ),
    commitPropertyChanges: (options) => props.commitChanges(options),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propsLoadData: (data: unknown) => props.load(data as any),
    propsSaveData: () => props.save() as PropsComponentRawData
  }

  return {
    ...createInputSystemAPIs(),
    ...createFeatureSystemAPIs(),
    ...createPropsAPIs(propsRequests),
    ...createRenderAPIs(renderRequests),
    ...createSceneTreeAPIs(sceneTreeRequests),
    ...createElementSelectionAPIs(selection, factory),
    ...createUIContextAPIs(),
    ...createSystemPropertyAPIs()
  }
}
