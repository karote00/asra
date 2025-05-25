import {
  type SceneTreeLoadCompleteEvent,
  type AddElementEvent,
  type RemoveElementEvent,
  type UpdateComputedDataEvent,
  type ChangeComputedDataEvent,
  type FinishAddElementEvent,
  SceneTreeInitEvent,
  SceneTreeLoadDataEvent,
  SceneTreeSaveDataEvent,
  FinishSceneTreeSaveDataEvent
} from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToSceneTreeInit =
  createSubscribeEvent<SceneTreeInitEvent>(EventTypes.SCENE_TREE_INIT)

export const subscribeToSceneTreeLoadData =
  createSubscribeEvent<SceneTreeLoadDataEvent>(EventTypes.SCENE_TREE_LOAD_DATA)

export const subscribeToSceneTreeLoadComplete =
  createSubscribeEvent<SceneTreeLoadCompleteEvent>(
    EventTypes.SCENE_TREE_LOAD_COMPLETE
  )

export const subscribeToSceneTreeSaveData =
  createSubscribeEvent<SceneTreeSaveDataEvent>(EventTypes.SCENE_TREE_SAVE_DATA)

export const subscribeToFinishSceneTreeSaveData =
  createSubscribeEvent<FinishSceneTreeSaveDataEvent>(
    EventTypes.FINISH_SCENE_TREE_SAVE_DATA
  )

export const subscribeToAddElement = createSubscribeEvent<AddElementEvent>(
  EventTypes.ADD_ELEMENT
)

export const subscribeToFinishAddElement =
  createSubscribeEvent<FinishAddElementEvent>(EventTypes.FINISH_ADD_ELEMENT)

export const subscribeToRemoveElement =
  createSubscribeEvent<RemoveElementEvent>(EventTypes.REMOVE_ELEMENT)

export const subscribeToUpdateComputedData =
  createSubscribeEvent<UpdateComputedDataEvent>(EventTypes.UPDATE_COMPUTED_DATA)

export const subscribeToChangeComputedData =
  createSubscribeEvent<ChangeComputedDataEvent>(EventTypes.CHANGE_COMPUTED_DATA)
