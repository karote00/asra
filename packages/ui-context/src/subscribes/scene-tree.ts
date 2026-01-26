import type {
  SceneTreeYjsChange,
  AddRemoveElementChange,
  UpdateElementChange,
  ComputedAttrs
} from '@asyra/utils'
import { SCENE_TREE_ACTIONS } from '@asyra/utils'
import factory from '@asyra/factory'
import sceneTree from '@asyra/scene-tree'
import {
  requestElementSelection,
  subscribeToEndTransaction,
  subscribeToSceneTreeLoadComplete
} from '@asyra/reactive-events'
import SceneTreeStore from '../stores/scene-tree'
import uiContext from '../ui-context'

export const sceneTreeStore = new SceneTreeStore(sceneTree)

const updateUISceneTree = (change: SceneTreeYjsChange['payload']) => {
  switch (change.action) {
    case SCENE_TREE_ACTIONS.ADD_ELEMENT: {
      const { data } = change as AddRemoveElementChange
      sceneTreeStore.addElement(data)
      break
    }
    case SCENE_TREE_ACTIONS.REMOVE_ELEMENT: {
      const { parentId, data } = change as AddRemoveElementChange
      sceneTreeStore.removeElement(data, parentId as string)
      break
    }
    case SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA: {
      const { id, key, after } = change as UpdateElementChange
      sceneTreeStore.updateElement(id, key, after)
      break
    }
  }
}

// @ts-expect-error: It's YJS event
export const collectSceneTreeChange = (event) => {
  const updatedComputedDataKeys = new Set() as Set<keyof ComputedAttrs>

  const processChanges = (
    items: typeof event.changes.added | typeof event.changes.deleted
  ) => {
    // @ts-expect-error: It's YJS event
    items.forEach((item) => {
      item.content
        .getContent()
        .forEach((change: SceneTreeYjsChange['payload']) => {
          if (
            change.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA &&
            'key' in change
          ) {
            updatedComputedDataKeys.add(change.key as keyof ComputedAttrs)
          }
          updateUISceneTree(change)
        })
    })
  }

  processChanges(event.changes.added)
  processChanges(event.changes.deleted)

  updatedComputedDataKeys.forEach(async (key) => {
    const elementSelection = await requestElementSelection()
    const propertyData = [...elementSelection].map((elementId) => {
      const elementData = sceneTreeStore.getElementGeneralData(elementId)
      return elementData?.[key]
    }) as ComputedAttrs[keyof ComputedAttrs][]
    uiContext.updateComputedProperty(key, propertyData)
  })
}

let hasInit = false

export const initSceneTreeDataSubscribe = () => {
  if (hasInit) {
    return
  }

  const sceneTreeArray = factory.sceneTreeMap
  sceneTreeArray.observe(collectSceneTreeChange)

  subscribeToSceneTreeLoadComplete(() => {
    sceneTreeStore.reload()
    sceneTreeStore.fireChange()
  })

  subscribeToEndTransaction(() => {
    sceneTreeStore.fireChange()
  })

  hasInit = true
}
