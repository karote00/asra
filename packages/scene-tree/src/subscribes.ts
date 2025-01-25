import {
  EventTypes,
  subscribeToAddRectangle,
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
import { access } from 'fs'

export const initSceneTreeSubscribes = () => {
  subscribeToAddRectangle(({ payload }) => {
    const { data, parent, index, undoredo } = payload
    const newRectangle = sceneTree.createElement(data)

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
        undoEvent: EventTypes.REMOVE_ELEMENT,
        undoAction: 'removeElement',
        undoredo: undoredo ?? UNDO.REDO
      })
    }

    endTransaction()
  })

  subscribeToRemoveElement(({ payload }) => {
    const { data, parent, index, undoredo } = payload
    const removedElement = sceneTree.removeElement(data, index, parent)

    startTransaction()

    const successRemoveElement = sceneTree.addNewElement(
      removedElement as ElementInstanceTypes,
      parent,
      index
    )

    if (removedElement && successRemoveElement) {
      updateTransaction(EventTypes.REMOVE_ELEMENT, {
        data: removedElement.save(),
        action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
        owner: OWNER.SCENE_TREE,
        parentId: parent?.get('id'),
        index,
        undoEvent: EventTypes.ADD_ELEMENT,
        undoAction: 'addElement',
        undoredo: undoredo ?? UNDO.REDO
      })
    }

    endTransaction()
  })
}
