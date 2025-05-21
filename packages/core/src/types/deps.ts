import type { Factory } from '@asra/factory'
import type { InputSystem } from '@asra/input-system'
import type { InteractionCore } from '@asra/interaction-core'
import type { Render } from '@asra/render'

export interface APIDeps {
  interactionCore: InteractionCore
}

export interface HandlerDeps {
  inputSystem: InputSystem
  render: Render
  factory: Factory
}
