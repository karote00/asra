import {
  EventTypes,
  subscribeUndoRedoStatus,
  subscribeToAddElement,
  subscribeToRemoveElement,
  startTransaction,
  updateTransaction,
  endTransaction
} from '@asra/reactive-events'
import {
  ElementInstanceTypes,
  OWNER,
  SCENE_TREE_ACTIONS,
  UNDO
} from '@asra/utils'
import sceneTree from './sceneTree'

export const initSceneTreeSubscribes = () => {
  let inUndoRedo = false
  subscribeUndoRedoStatus(({ status }) => {
    inUndoRedo = status !== UNDO.NONE
  })

  subscribeToAddElement(({ payload }) => {
    const { data, parent, index } = payload

    let newRectangle
    if (inUndoRedo) {
      newRectangle = sceneTree.getRestoreElementById(data.id as string)
    } else {
      newRectangle = sceneTree.createElement(data)
    }

    startTransaction()

    const successAddRectangle = sceneTree.addNewElement(
      newRectangle as ElementInstanceTypes,
      parent,
      index
    )

    if (newRectangle && successAddRectangle) {
      updateTransaction(EventTypes.ADD_ELEMENT, {
        data: newRectangle.save(),
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        owner: OWNER.SCENE_TREE,
        parentId: parent?.get('id'),
        index,
        undoAction: 'removeElement'
      })
    }

    endTransaction()
  })

  subscribeToRemoveElement(({ payload }) => {
    const { data, parent, index } = payload
    const removedElement = sceneTree.removeElement(data, index, parent)

    startTransaction()

    if (removedElement) {
      updateTransaction(EventTypes.REMOVE_ELEMENT, {
        data: removedElement.save(),
        action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
        owner: OWNER.SCENE_TREE,
        parentId: parent?.get('id'),
        index,
        undoAction: 'addElement'
      })
    }

    endTransaction()
  })
}
