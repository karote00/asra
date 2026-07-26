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
  type EVENT_OPTIONS,
  type MoveHierarchyRequest,
  type GroupInstanceTypes,
  type PropertyComponentInstanceDataTypes,
  type PropsComponentRawData,
  EntityTypes
} from '@asyra/utils'

import { createPropsAPIs, type PropsRequests } from './props'
import { createRenderAPIs, type RenderRequests } from './render'
import { createSceneTreeAPIs, type SceneTreeRequests } from './scene-tree'
import { createElementSelectionAPIs } from './element-selection'
import { createInputSystemAPIs } from './input-system'
import { createFeatureSystemAPIs } from './feature-system'
import { createUIContextAPIs } from './ui-context'
import { createSystemPropertyAPIs } from './system-properties'
import { getAllElementsWorldBounds } from './scene-bounds'
import { CoreAPIs } from '../types'

export const createAPIs = (
  sceneTree: SceneTree,
  render: Render,
  selection: SelectionManager,
  props: PropsManager,
  factory: Factory
): CoreAPIs => {
  const requireContainerParent = (parentId: string): GroupInstanceTypes => {
    const parent = sceneTree.getElementById(parentId)
    const parentType = parent?.get('type')
    const parentIsContainer =
      parentType === EntityTypes.WORKSPACE ||
      parentType === EntityTypes.FRAME ||
      parentType === EntityTypes.GROUP ||
      (typeof parentType === 'string' &&
        componentRegistry.get(parentType)?.isContainer === true)
    if (!parent || !parentIsContainer) {
      throw new Error(
        `[Core] Cannot create element batch: parent "${parentId}" is unavailable`
      )
    }
    return parent as GroupInstanceTypes
  }

  const sceneTreeRequests: SceneTreeRequests = {
    sceneTreeSaveData: () => sceneTree.save(),
    getElementComputedData: (elementId: string) =>
      sceneTree.getElementById(elementId)?.getAllComputedData() as
        | Record<string, unknown>
        | undefined,
    moveElements: (request: MoveHierarchyRequest, options?: EVENT_OPTIONS) =>
      sceneTree.moveElements(request, options),
    removeSubtree: (elementId: string, options?: EVENT_OPTIONS) =>
      sceneTree.removeSubtree(elementId, options),
    preflightRestoreSubtree: (snapshot) =>
      sceneTree.preflightRestoreSubtree(snapshot),
    applyRestoreSubtree: (plan, options) =>
      sceneTree.applyRestoreSubtree(plan, options),
    createElementsInParent: (data, parentId, index, options) => {
      return sceneTree.addNewElements(
        data,
        requireContainerParent(parentId),
        index,
        options
      )
    },
    createElementsInParentFromCanonicalData: (
      elements,
      properties,
      parentId,
      index,
      options
    ) => {
      return sceneTree.addNewElementsFromCanonicalData(
        elements,
        properties,
        requireContainerParent(parentId),
        index,
        options
      )
    },
    createElementsInParentFromCanonicalDataUsingActiveProperties: (
      elements,
      properties,
      parentId,
      index,
      options
    ) => {
      return sceneTree.addNewElementsFromCanonicalDataUsingActiveProperties(
        elements,
        properties,
        requireContainerParent(parentId),
        index,
        options
      )
    },
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
    getAllElementsBounds: () => getAllElementsWorldBounds(sceneTree)
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
    propsSaveData: () => props.save() as PropsComponentRawData,
    preflightRestoreProperties: (snapshot, ownerRelations) =>
      props.preflightRestoreProperties(snapshot, ownerRelations),
    applyRestoreProperties: (plan, options) =>
      props.applyRestoreProperties(plan, options)
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
