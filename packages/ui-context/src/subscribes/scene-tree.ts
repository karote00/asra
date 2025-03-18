import type {
  SceneTreeYjsChange,
  AddRemoveElementChange,
  UpdateElementChange
} from '@asra/utils'
import { SCENE_TREE_ACTIONS } from '@asra/utils'
import factory from '@asra/factory'
import sceneTree from '@asra/scene-tree'
import SceneTreeStore from '../stores/scene-tree'
import {
  subscribeToEndTransaction,
  subscribeToSceneTreeLoadComplete
} from '@asra/reactive-events'

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
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT: {
      const { id, key, after } = change as UpdateElementChange
      sceneTreeStore.updateElement(id, key, after)
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

let hasInit = false

export const initSceneTreeDataContext = () => {
  if (hasInit) {
    return
  }

  const sceneTreeArray = factory.sceneTreeMap
  sceneTreeArray.observe(collectSceneTreeChange)

  subscribeToSceneTreeLoadComplete(() => {
    sceneTreeStore.reload()
    sceneTreeStore.fireChange()
  })

  subscribeToEndTransaction(() => {
    sceneTreeStore.fireChange()
  })

  hasInit = true
}
