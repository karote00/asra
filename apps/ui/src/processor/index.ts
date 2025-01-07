import Factory from '@asra/factory'
import { ACTIONS, ChangeDataType } from '@asra/factory'
import {
  addElement,
  removeElement,
  updateFlattenedElementIds
} from '../states/scene-tree'

enum ORIGIN {
  UNDO = 'UNDO',
  REDO = 'REDO'
}

const Handlers = {
  [ORIGIN.REDO]: {
    [ACTIONS.ADD_ELEMENT]: addElement,
    [ACTIONS.REMOVE_ELEMENT]: removeElement,
    [ACTIONS.UPDATE_ELEMENT]: null
  },
  [ORIGIN.UNDO]: {
    [ACTIONS.ADD_ELEMENT]: removeElement,
    [ACTIONS.REMOVE_ELEMENT]: addElement,
    [ACTIONS.UPDATE_ELEMENT]: null
  }
}

const updateUISceneTree = (change: ChangeDataType, origin: ORIGIN) => {
  const { action, parentId, data, index } = change
  const handler = Handlers[origin][action as ACTIONS]
  if (handler) {
    handler(parentId, data, index)
  }
}

const checkIfNeedUpdateFlattenedElementIds = (action: ACTIONS) =>
  action === ACTIONS.ADD_ELEMENT || action === ACTIONS.REMOVE_ELEMENT

Factory.sceneTreeMap.observe((event) => {
  let shouldUpdateFlattenedElementIds = false

  const processChanges = (
    items: typeof event.changes.added,
    origin: ORIGIN
  ) => {
    items.forEach((item) => {
      item.content.getContent().forEach((change) => {
        if (!shouldUpdateFlattenedElementIds) {
          shouldUpdateFlattenedElementIds =
            checkIfNeedUpdateFlattenedElementIds(change.action)
        }
        updateUISceneTree(change, origin)
      })
    })
  }

  processChanges(event.changes.added, ORIGIN.REDO)
  processChanges(event.changes.deleted, ORIGIN.UNDO)

  // Only update flattened element ids once
  if (shouldUpdateFlattenedElementIds) {
    updateFlattenedElementIds()
  }
})
