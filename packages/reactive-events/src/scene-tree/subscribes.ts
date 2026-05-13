import {
  type SceneTreeLoadCompleteEvent,
  type RemoveElementEvent,
  type UpdateComputedDataEvent,
  type ChangeComputedDataEvent,
  type ChangeComputedDataBatchEvent,
  SceneTreeInitEvent,
  SceneTreeLoadDataEvent,
  AddElementEvent
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

export const subscribeToAddElement = createSubscribeEvent<AddElementEvent>(
  EventTypes.ADD_ELEMENT
)

export const subscribeToRemoveElement =
  createSubscribeEvent<RemoveElementEvent>(EventTypes.REMOVE_ELEMENT)

export const subscribeToUpdateComputedData =
  createSubscribeEvent<UpdateComputedDataEvent>(EventTypes.UPDATE_COMPUTED_DATA)

export const subscribeToChangeComputedData =
  createSubscribeEvent<ChangeComputedDataEvent>(EventTypes.CHANGE_COMPUTED_DATA)

export const subscribeToChangeComputedDataBatch =
  createSubscribeEvent<ChangeComputedDataBatchEvent>(
    EventTypes.CHANGE_COMPUTED_DATA_BATCH
  )
