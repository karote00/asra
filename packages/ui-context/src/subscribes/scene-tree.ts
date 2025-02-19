import type { ChangeDataType } from '@asra/factory'
import { SCENE_TREE_ACTIONS } from '@asra/utils'
import Factory from '@asra/factory'
import sceneTree from '@asra/scene-tree'
import SceneTreeStore from '../stores/scene-tree'

export const sceneTreeStore = new SceneTreeStore(sceneTree)

const updateUISceneTree = (change: ChangeDataType['payload']) => {
  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT:
      sceneTreeStore.addElement(change.parentId, change.data, change.index)
      break
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT:
      sceneTreeStore.removeElement(change.parentId, change.data, change.index)
      break
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT:
      sceneTreeStore.updateElement(change.elementId, change.key, change.after)
      break
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
