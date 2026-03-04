import {
  defineDataChannelObserver,
  propertyRegistry,
  renderSceneTreeStore,
  renderSelectionStore,
  uiContext,
  uiContextSceneTreeStore,
  uiContextSelectionStore,
  subscribeToEndTransaction,
  subscribeToFileLoadComplete
} from '@asyra/core'
import {
  SCENE_TREE_ACTIONS,
  SELECTION_ACTIONS,
  SELECTION_TYPES,
  SharedDataChannelNames,
  type AddRemoveElementChange,
  type SceneTreeChange,
  type SelectionChange,
  type UpdateElementChange
} from '@asyra/utils'
import type { PresetCoreAPIs } from '../types'

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

const updateRenderSelection = (change: SelectionChange) => {
  switch (change.action) {
    case SELECTION_ACTIONS.SELECT_ELEMENTS:
    case SELECTION_ACTIONS.DESELECT_ELEMENTS:
      renderSelectionStore.updateSelection(SELECTION_TYPES.ELEMENT)
      break
    case SELECTION_ACTIONS.SELECT_VECTOR_POINTS:
    case SELECTION_ACTIONS.DESELECT_VECTOR_POINTS:
      renderSelectionStore.updateSelection(SELECTION_TYPES.VECTOR_POINT)
      break
    case SELECTION_ACTIONS.SELECT_VECTOR_SEGMENTS:
    case SELECTION_ACTIONS.DESELECT_VECTOR_SEGMENTS:
      renderSelectionStore.updateSelection(SELECTION_TYPES.VECTOR_SEGMENT)
      break
  }
}

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

const updateUIContextSceneTree = (change: SceneTreeChange) => {
  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT: {
      const { data } = change as AddRemoveElementChange
      uiContextSceneTreeStore.addElement(data)
      break
    }
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      const { parentId, data } = change as AddRemoveElementChange
      uiContextSceneTreeStore.removeElement(data, parentId as string)
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA: {
      const { id, key, after } = change as UpdateElementChange
      uiContextSceneTreeStore.updateElement(id, key, after)
      break
    }
  }
}

const updateUIContextSelection = (change: SelectionChange) => {
  switch (change.action) {
    case SELECTION_ACTIONS.SELECT_ELEMENTS:
    case SELECTION_ACTIONS.DESELECT_ELEMENTS:
      uiContextSelectionStore.updateSelection(SELECTION_TYPES.ELEMENT)
      break
    case SELECTION_ACTIONS.SELECT_VECTOR_POINTS:
    case SELECTION_ACTIONS.DESELECT_VECTOR_POINTS:
      uiContextSelectionStore.updateSelection(SELECTION_TYPES.VECTOR_POINT)
      break
    case SELECTION_ACTIONS.SELECT_VECTOR_SEGMENTS:
    case SELECTION_ACTIONS.DESELECT_VECTOR_SEGMENTS:
      uiContextSelectionStore.updateSelection(SELECTION_TYPES.VECTOR_SEGMENT)
      break
  }
}

const uiContextSceneTreeDataChannelObserver = defineDataChannelObserver({
  name: 'preset.uiContext.sceneTree',
  channel: SharedDataChannelNames.SCENE_TREE,
  onChange: (change: SceneTreeChange) => {
    const updatedPropertyKeys = propertyRegistry.getMatchingProperties(change)
    updateUIContextSceneTree(change)

    if (updatedPropertyKeys.length > 0) {
      const selectionContext =
        uiContextSelectionStore.getCurrentSelectionContext()
      uiContext.recomputeProperties(updatedPropertyKeys, selectionContext)
    }

    uiContextSceneTreeStore.fireChange()
  }
})

const uiContextSelectionDataChannelObserver = defineDataChannelObserver({
  name: 'preset.uiContext.selection',
  channel: SharedDataChannelNames.SELECTION,
  onChange: updateUIContextSelection
})

let hasRegistered = false

export const registerDefaultDataChannelObservers = (
  core: PresetCoreAPIs
): void => {
  if (hasRegistered) {
    return
  }

  if (!core.registerDataChannelObserver) {
    return
  }

  subscribeToFileLoadComplete(() => {
    renderSceneTreeStore.reload()
    uiContextSceneTreeStore.reload()
    uiContextSceneTreeStore.fireChange()
  })

  subscribeToEndTransaction(() => {
    uiContextSceneTreeStore.fireChange()
    uiContextSelectionStore.recomputeSelectionProperties()
  })

  core.registerDataChannelObserver(renderSceneTreeDataChannelObserver)
  core.registerDataChannelObserver(renderSelectionDataChannelObserver)
  core.registerDataChannelObserver(uiContextSceneTreeDataChannelObserver)
  core.registerDataChannelObserver(uiContextSelectionDataChannelObserver)
  hasRegistered = true
}
