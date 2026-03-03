import type {
  SceneTreeYjsChange,
  AddRemoveElementChange,
  UpdateElementChange
} from '@asyra/utils'
import { SCENE_TREE_ACTIONS, SharedDataChannelNames } from '@asyra/utils'
import { getSharedDataChannel } from '@asyra/factory'
import sceneTree from '@asyra/scene-tree'
import {
  subscribeToEndTransaction,
  subscribeToFileLoadComplete
} from '@asyra/reactive-events'
import SceneTreeStore from '../stores/scene-tree'
import uiContext from '../ui-context'
import { propertyRegistry } from '../property-registry'
import { selectionStore } from './selection'

export const sceneTreeStore = new SceneTreeStore(sceneTree)

const updateUISceneTree = (change: SceneTreeYjsChange['payload']) => {
  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT: {
      const { data } = change as AddRemoveElementChange
      sceneTreeStore.addElement(data)
      break
    }
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      const { parentId, data } = change as AddRemoveElementChange
      sceneTreeStore.removeElement(data, parentId as string)
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA: {
      const { id, key, after } = change as UpdateElementChange
      sceneTreeStore.updateElement(id, key, after)
      break
    }
  }
}

// @ts-expect-error: It's YJS event
export const collectSceneTreeChange = (event) => {
  const updatedPropertyKeys = new Set<string>()

  const processChanges = (
    items: typeof event.changes.added | typeof event.changes.deleted
  ) => {
    // @ts-expect-error: It's YJS event
    items.forEach((item) => {
      item.content
        .getContent()
        .forEach((change: SceneTreeYjsChange['payload']) => {
          const matching = propertyRegistry.getMatchingProperties(change)
          matching.forEach((key) => updatedPropertyKeys.add(key))
          updateUISceneTree(change)
        })
    })
  }

  processChanges(event.changes.added)
  processChanges(event.changes.deleted)

  if (updatedPropertyKeys.size > 0) {
    const context = selectionStore.getCurrentSelectionContext()
    uiContext.recomputeProperties([...updatedPropertyKeys], context)
  }

  sceneTreeStore.fireChange()
}

let hasInit = false

export const initSceneTreeDataSubscribe = () => {
  if (hasInit) {
    return
  }

  const sceneTreeChanges = getSharedDataChannel(
    SharedDataChannelNames.SCENE_TREE
  )
  if (!sceneTreeChanges) {
    return
  }
  sceneTreeChanges.observe(collectSceneTreeChange)

  subscribeToFileLoadComplete(() => {
    sceneTreeStore.reload()
    sceneTreeStore.fireChange()
  })

  subscribeToEndTransaction(() => {
    sceneTreeStore.fireChange()
    selectionStore.recomputeSelectionProperties()
  })

  hasInit = true
}
