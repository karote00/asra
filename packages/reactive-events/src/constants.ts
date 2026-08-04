import type { AppEvent } from './app/index.js'
import type { SceneTreeEvents } from './scene-tree/index.js'
import type { SelectionEvents } from './selection/index.js'
import type { PropEvents } from './props-manager/index.js'
import type { RenderEvents } from './render/index.js'
import type { InputSystemEvents } from './input-system/index.js'

export type AllEvent =
  | AppEvent
  | SceneTreeEvents
  | SelectionEvents
  | PropEvents
  | RenderEvents
  | InputSystemEvents
