import {
  defineDataChannelObserver,
  propertyRegistry,
  renderSceneTreeStore,
  renderSelectionStore,
  uiContext,
  subscribeToEndTransaction,
  subscribeToFileLoadComplete
} from '@asyra/core'
import {
  EntityTypes,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type AddRemoveElementChange,
  type ComputedAttrs,
  type GroupRawData,
  type SceneTreeChange,
  type SelectionChange,
  type UpdateElementChange,
  type WorkspaceRawData
} from '@asyra/utils'
import type { PresetCoreAPIs, PresetDependencies } from '../types'
import {
  SelectionActions,
  SelectionChannels,
  type SelectionChannel
} from '../selection/channels'

// Render observers keep render-internal stores in sync with shared channel changes.
const updateRenderSceneTree = (change: SceneTreeChange) => {
  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT: {
      renderSceneTreeStore.addElementById(
        (change as AddRemoveElementChange).data.id
      )
      break
    }
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      const { parentId, data } = change as AddRemoveElementChange
      renderSceneTreeStore.removeElement(data, parentId)
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA: {
      const { id, key, before, after } = change as UpdateElementChange
      renderSceneTreeStore.updateElement(id, key, before, after)
      break
    }
  }
}

// Render selection mirror used by overlay/render behavior.
const updateRenderSelection = (change: SelectionChange) => {
  switch (change.action) {
    case SelectionActions.SELECT_ELEMENTS:
    case SelectionActions.DESELECT_ELEMENTS:
      renderSelectionStore.updateSelection(SelectionChannels.ELEMENT)
      break
    case SelectionActions.SELECT_VECTOR_POINTS:
    case SelectionActions.DESELECT_VECTOR_POINTS:
      renderSelectionStore.updateSelection(SelectionChannels.VECTOR_POINT)
      break
    case SelectionActions.SELECT_VECTOR_SEGMENTS:
    case SelectionActions.DESELECT_VECTOR_SEGMENTS:
      renderSelectionStore.updateSelection(SelectionChannels.VECTOR_SEGMENT)
      break
  }
}

// Data-channel observer definitions for render defaults.
const renderSceneTreeDataChannelObserver = defineDataChannelObserver({
  name: 'preset.render.sceneTree',
  channel: SharedDataChannelNames.SCENE_TREE,
  onChange: updateRenderSceneTree
})

const renderSelectionDataChannelObserver = defineDataChannelObserver({
  name: 'preset.render.selection',
  channel: SharedDataChannelNames.SELECTION,
  onChange: updateRenderSelection
})

// Read current selected IDs from selection runtime (single source of truth).
const getSelectedIds = (
  core: PresetCoreAPIs,
  type: SelectionChannel
): Set<string> => {
  const selection = core.getSelection(type)
  return selection ? selection.getSelectedIds() : new Set<string>()
}

// Build ui-context aggregate compute input from current selection + scene-tree data.
const buildSelectionContext = (
  deps: PresetDependencies,
  selectedIds: Set<string>
) => {
  const elements = [...selectedIds].reduce((acc, elementId) => {
    const element = deps.sceneTree.getElementById(elementId)
    if (!element) {
      return acc
    }

    const elementData = element.getAllComputedData() as ComputedAttrs
    acc.push(elementData)
    return acc
  }, [] as ComputedAttrs[])

  return {
    selectedIds,
    elements
  }
}

// Sync selection-related ui-context properties and run aggregate recompute (x/y/width/...).
const syncElementSelectionAndDerived = (
  core: PresetCoreAPIs,
  deps: PresetDependencies
) => {
  const selectedIds = getSelectedIds(core, SelectionChannels.ELEMENT)
  uiContext.set('elementSelection', selectedIds)
  uiContext.recomputeSelectionProperties(
    buildSelectionContext(deps, selectedIds)
  )
}

const syncSelectionOnElementRemoval = (
  core: PresetCoreAPIs,
  removedId: string
) => {
  const selection = core.getSelection(SelectionChannels.ELEMENT)
  if (!selection) {
    return
  }

  const current = Array.from(selection.getSelectedIds())
  if (!current.includes(removedId)) {
    return
  }

  selection.select(current.filter((id) => id !== removedId))
  selection.cleanChanges()
  renderSelectionStore.updateSelection(SelectionChannels.ELEMENT)
}

// Sync vector point/segment selection mirrors for UI consumers.
const syncVectorSelections = (core: PresetCoreAPIs) => {
  uiContext.set(
    'vectorPointSelection',
    getSelectedIds(core, SelectionChannels.VECTOR_POINT)
  )
  uiContext.set(
    'vectorSegmentSelection',
    getSelectedIds(core, SelectionChannels.VECTOR_SEGMENT)
  )
}

// Build a depth-first flattened element id index from the scene-tree.
const collectChildrenIds = (
  deps: PresetDependencies,
  elementId: string,
  ids: string[]
) => {
  const element = deps.sceneTree.getElementById(elementId)
  if (!element) {
    return
  }

  ids.push(elementId)
  const elementData = element.save() as GroupRawData

  if (elementData.type === EntityTypes.GROUP) {
    const children = elementData.children ?? []
    children.forEach((childId: string) => {
      collectChildrenIds(deps, childId, ids)
    })
  }
}

const getFlattenedElementIds = (deps: PresetDependencies): string[] => {
  const ids: string[] = []
  const workspace = deps.sceneTree.currentWorkspace
  if (!workspace) {
    return ids
  }

  const workspaceData = workspace.save() as WorkspaceRawData
  const workspaceChildren = workspaceData.children ?? []
  workspaceChildren.forEach((childId: string) => {
    collectChildrenIds(deps, childId, ids)
  })

  return ids
}

// Publish flattened ids so UI can do fast filtering/lookup without tree traversal.
const syncFlattenedElementIds = (deps: PresetDependencies): void => {
  uiContext.set('flattenedElementIds', getFlattenedElementIds(deps))
}

// Published UI lookup map keyed by element id (used by element row rendering).
const getElementDataMap = (
  deps: PresetDependencies
): Record<string, Record<string, unknown>> => {
  const dataMap: Record<string, Record<string, unknown>> = {}
  deps.sceneTree.getAllElements().forEach((element, elementId) => {
    if (element.get('type') === EntityTypes.WORKSPACE) {
      return
    }
    dataMap[elementId] = element.save() as unknown as Record<string, unknown>
  })
  return dataMap
}

const syncElementDataMap = (deps: PresetDependencies): void => {
  uiContext.set('elementDataMap', getElementDataMap(deps))
}

// Selection channel updates only affect selection-derived UI properties.
const updateUIContextSelection = (
  change: SelectionChange,
  core: PresetCoreAPIs,
  deps: PresetDependencies
) => {
  switch (change.action) {
    case SelectionActions.SELECT_ELEMENTS:
    case SelectionActions.DESELECT_ELEMENTS:
      syncElementSelectionAndDerived(core, deps)
      break
    case SelectionActions.SELECT_VECTOR_POINTS:
    case SelectionActions.DESELECT_VECTOR_POINTS:
      uiContext.set(
        'vectorPointSelection',
        getSelectedIds(core, SelectionChannels.VECTOR_POINT)
      )
      break
    case SelectionActions.SELECT_VECTOR_SEGMENTS:
    case SelectionActions.DESELECT_VECTOR_SEGMENTS:
      uiContext.set(
        'vectorSegmentSelection',
        getSelectedIds(core, SelectionChannels.VECTOR_SEGMENT)
      )
      break
  }
}

// Scene-tree channel updates affect list/map mirrors, and may trigger aggregate recompute.
const handleUIContextSceneTreeChange = (
  change: SceneTreeChange,
  core: PresetCoreAPIs,
  deps: PresetDependencies
) => {
  const updatedPropertyKeys = propertyRegistry.getMatchingProperties(change)

  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT:
      syncFlattenedElementIds(deps)
      syncElementDataMap(deps)
      break
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      const removedId = (change as AddRemoveElementChange).data.id
      if (typeof removedId === 'string' && removedId.length > 0) {
        syncSelectionOnElementRemoval(core, removedId)
      }
      syncFlattenedElementIds(deps)
      syncElementDataMap(deps)
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA: {
      syncElementDataMap(deps)
      const { key } = change as UpdateElementChange
      if (key === 'children') {
        syncFlattenedElementIds(deps)
      }
      break
    }
  }

  if (updatedPropertyKeys.length > 0) {
    // Recompute only properties whose trigger matches this scene-tree change.
    const selectedIds = getSelectedIds(core, SelectionChannels.ELEMENT)
    uiContext.recomputeProperties(
      updatedPropertyKeys,
      buildSelectionContext(deps, selectedIds)
    )
  }
}

const applySelectionChangeToRuntime = (
  core: PresetCoreAPIs,
  change: SelectionChange
) => {
  const selection = core.getSelection(change.selectionType)
  if (!selection) {
    return
  }

  selection.select(change.after, change.options)
  selection.cleanChanges()
}

let hasRegistered = false

// Register preset default shared-channel observers once.
export const registerDefaultDataChannelObservers = (
  core: PresetCoreAPIs,
  deps: PresetDependencies
): void => {
  if (hasRegistered) {
    return
  }

  const uiContextSceneTreeDataChannelObserver = defineDataChannelObserver({
    name: 'preset.uiContext.sceneTree',
    channel: SharedDataChannelNames.SCENE_TREE,
    onChange: (change: SceneTreeChange) =>
      handleUIContextSceneTreeChange(change, core, deps)
  })

  const uiContextSelectionDataChannelObserver = defineDataChannelObserver({
    name: 'preset.uiContext.selection',
    channel: SharedDataChannelNames.SELECTION,
    onChange: (change: SelectionChange) =>
      updateUIContextSelection(change, core, deps)
  })

  const selectionRuntimeDataChannelObserver = defineDataChannelObserver({
    name: 'preset.selection.runtime',
    channel: SharedDataChannelNames.SELECTION,
    onChange: (change: SelectionChange) =>
      applySelectionChangeToRuntime(core, change)
  })

  subscribeToFileLoadComplete(() => {
    renderSceneTreeStore.reload()
    syncFlattenedElementIds(deps)
    syncElementDataMap(deps)
    syncElementSelectionAndDerived(core, deps)
    syncVectorSelections(core)
  })

  subscribeToEndTransaction(() => {
    syncFlattenedElementIds(deps)
    syncElementDataMap(deps)
    syncElementSelectionAndDerived(core, deps)
    syncVectorSelections(core)
  })

  core.registerDataChannelObserver(renderSceneTreeDataChannelObserver)
  core.registerDataChannelObserver(selectionRuntimeDataChannelObserver)
  core.registerDataChannelObserver(renderSelectionDataChannelObserver)
  core.registerDataChannelObserver(uiContextSceneTreeDataChannelObserver)
  core.registerDataChannelObserver(uiContextSelectionDataChannelObserver)
  hasRegistered = true
}
