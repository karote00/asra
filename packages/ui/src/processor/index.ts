import Factory from '@asra/factory'
import { ACTIONS } from '@asra/factory'
import { addElement, removeElement } from '../states/scene-tree'

Factory.sceneTreeMap.observe((event) => {
  event.delta.forEach((delta) => {
    if (delta.insert && Array.isArray(delta.insert)) {
      delta.insert.forEach((change) => {
        const { action, parentId, data, index } = change
        switch (action) {
          case ACTIONS.ADD_ELEMENT:
            addElement(parentId, data, index)
            break
          case ACTIONS.REMOVE_ELEMENT:
            removeElement(parentId, data)
            break
          case ACTIONS.UPDATE_ELEMENT:
            break
        }
      })
    }
  })
})
