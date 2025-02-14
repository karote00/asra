import type { ChangeDataType } from '@asra/factory'
import Factory from '@asra/factory'
import { ElementRawData, SCENE_TREE_ACTIONS } from '@asra/utils'
import { subscribeToSceneTreeLoadComplete } from '@asra/reactive-events'
import { renderSceneTree } from '../stores/scene-tree'

type HandlerType = Record<
  string,
  (parentId: string, data: ElementRawData, number: number) => void
>

const Handlers: HandlerType = {
  [SCENE_TREE_ACTIONS.ADD_ELEMENT]:
    renderSceneTree.addElement.bind(renderSceneTree),
  [SCENE_TREE_ACTIONS.REMOVE_ELEMENT]:
    renderSceneTree.removeElement.bind(renderSceneTree)
}

const updateRenderSceneTree = (change: ChangeDataType['payload']) => {
  const { action, parentId, data, index } = change

  const handler = Handlers[action as SCENE_TREE_ACTIONS]
  if (handler) {
    handler(parentId, data, index)
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
