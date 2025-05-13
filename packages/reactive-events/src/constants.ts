import type { AppEvent } from './app'
import type { CoreEvents } from './core'
import type { SceneTreeEvents } from './scene-tree'
import type { SelectionEvents } from './selection'
import type { PropEvents } from './props-manager'
import type { UIContextEvents } from './ui-context'
import type { RenderEvents } from './render'

export type AllEvent =
  | AppEvent
  | CoreEvents
  | SceneTreeEvents
  | SelectionEvents
  | PropEvents
  | UIContextEvents
  | RenderEvents
