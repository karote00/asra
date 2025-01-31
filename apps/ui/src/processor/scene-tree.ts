import { SCENE_TREE_ACTIONS } from '@asra/utils'
import type { ElementRawData, SceneTreeYjsChange } from '@asra/utils'
import type { ChangeDataType } from '@asra/factory'
import {
  addElement,
  removeElement,
  updateFlattenedElementIds
} from '../states/scene-tree'

type HandlerType = Record<
  string,
  (parentId: string, data: ElementRawData, number: number) => void
>

const Handlers: HandlerType = {
  [SCENE_TREE_ACTIONS.ADD_ELEMENT]: addElement,
  [SCENE_TREE_ACTIONS.REMOVE_ELEMENT]: removeElement
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
  const changes: SceneTreeYjsChange[] = []

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
        changes.push(change)
        updateUISceneTree(change)
      })
    })
  }

  processChanges(event.changes.added)
  processChanges(event.changes.deleted)
}

export const completeSceneTreeChange = () => {
  updateFlattenedElementIds()
}
