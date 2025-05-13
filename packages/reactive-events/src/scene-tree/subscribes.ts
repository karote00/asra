import { Subscription } from 'rxjs'
import type {
  SceneTreeLoadCompleteEvent,
  AddElementEvent,
  RemoveElementEvent,
  UpdateComputedDataEvent,
  ChangeComputedDataEvent,
  FinishAddElementEvent
} from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToSceneTreeLoadComplete =
  createSubscribeEvent<SceneTreeLoadCompleteEvent>(
    EventTypes.SCENE_TREE_LOAD_COMPLETE
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
