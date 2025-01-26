import { UNDO, SCENE_TREE_ACTIONS } from '@asra/utils'
import type { ElementRawData, SceneTreeYjsChange } from '@asra/utils'
import type { ChangeDataType } from '@asra/factory'
import {
  addElement,
  removeElement,
  updateFlattenedElementIds
} from '../states/scene-tree'

type HandlerType = Record<
  string,
  Record<
    string,
    (parentId: string, data: ElementRawData, number: number) => void
  >
>

const Handlers: HandlerType = {
  [UNDO.REDO]: {
    [SCENE_TREE_ACTIONS.ADD_ELEMENT]: addElement,
    [SCENE_TREE_ACTIONS.REMOVE_ELEMENT]: removeElement
  },
  [UNDO.UNDO]: {
    [SCENE_TREE_ACTIONS.ADD_ELEMENT]: removeElement,
    [SCENE_TREE_ACTIONS.REMOVE_ELEMENT]: addElement
  }
}

const updateUISceneTree = (change: ChangeDataType['payload'], origin: UNDO) => {
  const { action, parentId, data, index } = change

  const handler = Handlers[origin][action as SCENE_TREE_ACTIONS]
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
    items: typeof event.changes.added | typeof event.changes.deleted,
    origin: UNDO
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
        updateUISceneTree(change, origin)
      })
    })
  }

  processChanges(event.changes.added, UNDO.REDO)
  processChanges(event.changes.deleted, UNDO.UNDO)
}

export const completeSceneTreeChange = () => {
  updateFlattenedElementIds()
}
