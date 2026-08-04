import { createEventStream } from '../event-bus.js'
import { EventTypes } from '../types.js'

export const sceneTreeLoadComplete$ = (reloadAction?: () => void) =>
  createEventStream(EventTypes.SCENE_TREE_LOAD_COMPLETE, reloadAction)
