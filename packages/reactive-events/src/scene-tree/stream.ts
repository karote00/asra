import { createEventStream } from '../event-bus'
import { EventTypes } from '../types'

export const sceneTreeLoadComplete$ = (reloadAction?: () => void) =>
  createEventStream(EventTypes.SCENE_TREE_LOAD_COMPLETE, reloadAction)
