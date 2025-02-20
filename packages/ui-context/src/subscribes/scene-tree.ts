import type { ChangeDataType } from '@asra/factory'
import {
  AddRemoveElementPayload,
  SCENE_TREE_ACTIONS,
  UpdateElementPayload
} from '@asra/utils'
import Factory from '@asra/factory'
import sceneTree from '@asra/scene-tree'
import SceneTreeStore from '../stores/scene-tree'

export const sceneTreeStore = new SceneTreeStore(sceneTree)

const updateUISceneTree = (change: ChangeDataType['payload']) => {
  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT: {
      const { parentId, data, index } = change as AddRemoveElementPayload
      sceneTreeStore.addElement(parentId, data, index)
      break
    }
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      const { parentId, data, index } = change as AddRemoveElementPayload
      sceneTreeStore.removeElement(parentId, data, index)
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT: {
      const { elementId, key, after } = change as UpdateElementPayload
      sceneTreeStore.updateElement(elementId, key, after)
      break
    }
  }
}

// @ts-expect-error: It's YJS event
export const collectSceneTreeChange = (event) => {
  const processChanges = (
    items: typeof event.changes.added | typeof event.changes.deleted
  ) => {
    // @ts-expect-error: It's YJS event
    items.forEach((item) => {
      item.content.getContent().forEach(updateUISceneTree)
    })
  }

  processChanges(event.changes.added)
  processChanges(event.changes.deleted)
}

export const completeSceneTreeChange = () => {
  sceneTreeStore.updateFlattenedElementIds()
}

let hasInit = false

export const initSceneTreeDataContext = () => {
  if (hasInit) {
    return
  }

  const sceneTreeArray = Factory.sceneTreeMap
  sceneTreeArray.observe(collectSceneTreeChange)

  hasInit = true
}
