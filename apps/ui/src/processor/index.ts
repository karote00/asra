import Factory from '@asra/factory'
import { ACTIONS, ChangeDataType } from '@asra/factory'
import { addElement, removeElement } from '../states/scene-tree'

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

Factory.sceneTreeMap.observe((event) => {
  event.changes.added.forEach((item) => {
    const changes = item.content.getContent()
    changes.forEach((change) => {
      updateUISceneTree(change, ORIGIN.REDO)
    })
  })

  event.changes.deleted.forEach((item) => {
    const changes = item.content.getContent()
    changes.forEach((change) => {
      updateUISceneTree(change, ORIGIN.UNDO)
    })
  })
})
