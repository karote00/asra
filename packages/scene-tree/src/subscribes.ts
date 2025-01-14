import {
  EventTypes,
  subscribeToAddRectangle,
  startTransaction,
  updateTransaction,
  endTransaction
} from '@asra/reactive-events'
import { OWNER, SCENE_TREE_ACTIONS } from '@asra/utils'
import { createElement } from './utils'
import sceneTree from './sceneTree'

export const initSceneTreeSubscribes = () => {
  subscribeToAddRectangle(({ type, payload }) => {
    const { elementData, parent, index } = payload
    const newRectangle = createElement(elementData)

    startTransaction()

    if (newRectangle && sceneTree.addNewElement(newRectangle, parent, index)) {
      updateTransaction(EventTypes.ADD_ELEMENT, {
        data: newRectangle.save(),
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
        owner: OWNER.SCENE_TREE
      })
    }

    endTransaction()
  })
}
