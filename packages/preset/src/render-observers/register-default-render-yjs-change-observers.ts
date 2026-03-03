import {
  defineRenderYjsChangeObserver,
  renderSceneTreeStore,
  renderSelectionStore,
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
      renderSceneTreeStore.addElementById((change as AddRemoveElementChange).data.id)
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

const sceneTreeYjsChangeObserver = defineRenderYjsChangeObserver({
  name: 'preset.sceneTree',
  channel: SharedDataChannelNames.SCENE_TREE,
  onChange: updateRenderSceneTree
})

const selectionYjsChangeObserver = defineRenderYjsChangeObserver({
  name: 'preset.selection',
  channel: SharedDataChannelNames.SELECTION,
  onChange: updateRenderSelection
})

let hasRegistered = false

export const registerDefaultRenderYjsChangeObservers = (
  core: PresetCoreAPIs
): void => {
  if (hasRegistered) {
    return
  }

  if (!core.registerRenderYjsChangeObserver) {
    return
  }

  subscribeToFileLoadComplete(() => {
    renderSceneTreeStore.reload()
  })

  core.registerRenderYjsChangeObserver(sceneTreeYjsChangeObserver)
  core.registerRenderYjsChangeObserver(selectionYjsChangeObserver)
  hasRegistered = true
}
