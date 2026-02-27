import type { AppEvent } from './app'
import type { SceneTreeEvents } from './scene-tree'
import type { SelectionEvents } from './selection'
import type { PropEvents } from './props-manager'
import type { RenderEvents } from './render'
import type { InputSystemEvents } from './input-system'
import type { KeyStateEvents } from './system-context'

export type AllEvent =
  | AppEvent
  | SceneTreeEvents
  | SelectionEvents
  | PropEvents
  | RenderEvents
  | InputSystemEvents
  | KeyStateEvents
