import type { ChangeDataType } from '@asra/factory'
import Factory from '@asra/factory'
import {
  AddRemoveElementPayload,
  SCENE_TREE_ACTIONS,
  UpdateElementPayload
} from '@asra/utils'
import { subscribeToSceneTreeLoadComplete } from '@asra/reactive-events'
import { renderSceneTree } from '../stores/scene-tree'

const updateRenderSceneTree = (change: ChangeDataType['payload']) => {
  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT: {
      renderSceneTree.addElement((change as AddRemoveElementPayload).data)
      break
    }
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      const { parentId, data, index } = change as AddRemoveElementPayload
      renderSceneTree.removeElement(parentId, data, index)
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT: {
      const { elementId, key, before, after } = change as UpdateElementPayload
      renderSceneTree.updateElement(elementId, key, before, after)
      break
    }
  }
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

let hasInit = false

let sceneTreeLoadCompleteSubscription = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unsubscribe: () => {}
}

export const initSceneTreeDataContext = () => {
  if (hasInit) {
    return
  }

  sceneTreeLoadCompleteSubscription = subscribeToSceneTreeLoadComplete(() => {
    renderSceneTree.reload()
  })

  const sceneTreeArray = Factory.sceneTreeMap
  sceneTreeArray.observe(handleSceneTreeChange)

  hasInit = true
}

export const renderSceneTreeClear = () => {
  sceneTreeLoadCompleteSubscription.unsubscribe()
}
