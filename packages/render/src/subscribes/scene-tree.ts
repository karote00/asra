import type { ChangeDataType } from '@asra/factory'
import Factory from '@asra/factory'
import { SCENE_TREE_ACTIONS } from '@asra/utils'

let hasInit = false

export const initSceneTreeDataContext = () => {
  if (hasInit) {
    return
  }

  const sceneTreeArray = Factory.sceneTreeMap
  sceneTreeArray.observe(handleSceneTreeChange)

  hasInit = true
}

// @ts-expect-error: It's YJS event
export const handleSceneTreeChange = (event) => {
  const processChanges = (
    items: typeof event.changes.added | typeof event.changes.deleted
  ) => {
    // @ts-expect-error: It's YJS event
    items.forEach((item) => {
      // @ts-expect-error: It's YJS event
      item.content.getContent().forEach((change) => {
        updateRenderSceneTree(change)
      })
    })
  }

  processChanges(event.changes.added)
  processChanges(event.changes.deleted)
}

const updateRenderSceneTree = (change: ChangeDataType['payload']) => {
  const { action, parentId, data, index } = change

  switch (action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT: {
      break
    }
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      break
    }
  }
}
