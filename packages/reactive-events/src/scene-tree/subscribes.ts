import {
  type SceneTreeLoadCompleteEvent,
  type RemoveElementEvent,
  type AddElementsEvent,
  type RemoveElementsEvent,
  type UpdateElementDataEvent,
  type UpdateComputedDataEvent,
  type UpdateComputedDataPatchEvent,
  SceneTreeInitEvent,
  SceneTreeLoadDataEvent,
  AddElementEvent,
  MoveElementsEvent,
  ChangeSubtreeEvent
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

export const subscribeToAddElements = createSubscribeEvent<AddElementsEvent>(
  EventTypes.ADD_ELEMENTS
)

export const subscribeToRemoveElements =
  createSubscribeEvent<RemoveElementsEvent>(EventTypes.REMOVE_ELEMENTS)

export const subscribeToMoveElements = createSubscribeEvent<MoveElementsEvent>(
  EventTypes.MOVE_ELEMENTS
)

export const subscribeToChangeSubtree =
  createSubscribeEvent<ChangeSubtreeEvent>(EventTypes.CHANGE_SUBTREE)

export const subscribeToUpdateElementData =
  createSubscribeEvent<UpdateElementDataEvent>(EventTypes.UPDATE_ELEMENT_DATA)

export const subscribeToUpdateComputedData =
  createSubscribeEvent<UpdateComputedDataEvent>(EventTypes.UPDATE_COMPUTED_DATA)

export const subscribeToUpdateComputedDataPatch =
  createSubscribeEvent<UpdateComputedDataPatchEvent>(
    EventTypes.UPDATE_COMPUTED_DATA_PATCH
  )
