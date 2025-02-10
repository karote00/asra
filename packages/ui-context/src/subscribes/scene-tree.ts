import type { ElementRawData } from '@asra/utils'
import type { ChangeDataType } from '@asra/factory'
import { SCENE_TREE_ACTIONS } from '@asra/utils'
import Factory from '@asra/factory'
import sceneTree from '@asra/scene-tree'
import SceneTreeStore from '../stores/scene-tree'

export const sceneTreeStore = new SceneTreeStore(sceneTree)

type HandlerType = Record<
  string,
  (parentId: string, data: ElementRawData, number: number) => void
>

const Handlers: HandlerType = {
  [SCENE_TREE_ACTIONS.ADD_ELEMENT]:
    sceneTreeStore.addElement.bind(sceneTreeStore),
  [SCENE_TREE_ACTIONS.REMOVE_ELEMENT]:
    sceneTreeStore.removeElement.bind(sceneTreeStore)
}

const updateUISceneTree = (change: ChangeDataType['payload']) => {
  const { action, parentId, data, index } = change

  const handler = Handlers[action as SCENE_TREE_ACTIONS]
  if (handler) {
    handler(parentId, data, index)
  }
}

const checkIfNeedUpdateFlattenedElementIds = (action: SCENE_TREE_ACTIONS) =>
  action === SCENE_TREE_ACTIONS.ADD_ELEMENT ||
  action === SCENE_TREE_ACTIONS.REMOVE_ELEMENT

// @ts-expect-error: It's YJS event
export const collectSceneTreeChange = (event) => {
  let shouldUpdateFlattenedElementIds = false

  const processChanges = (
    items: typeof event.changes.added | typeof event.changes.deleted
  ) => {
    // @ts-expect-error: It's YJS event
    items.forEach((item) => {
      // @ts-expect-error: It's YJS event
      item.content.getContent().forEach((change) => {
        if (!shouldUpdateFlattenedElementIds) {
          shouldUpdateFlattenedElementIds =
            checkIfNeedUpdateFlattenedElementIds(change.action)
        }

        updateUISceneTree(change)
      })
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
