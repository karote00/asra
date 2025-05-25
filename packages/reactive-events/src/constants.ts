import type { AppEvent } from './app'
import type { CoreEvents } from './core'
import type { SceneTreeEvents } from './scene-tree'
import type { SelectionEvents } from './selection'
import type { PropEvents } from './props-manager'
import type { UIContextEvents } from './ui-context'
import type { RenderEvents } from './render'
import type { InputSystemEvents } from './input-system'
import type { InteractionCoreEvents } from './interaction-core'
import type { KeyStateEvents } from './system-context'

export type AllEvent =
  | AppEvent
  | CoreEvents
  | SceneTreeEvents
  | SelectionEvents
  | PropEvents
  | UIContextEvents
  | RenderEvents
  | InputSystemEvents
  | InteractionCoreEvents
  | KeyStateEvents
