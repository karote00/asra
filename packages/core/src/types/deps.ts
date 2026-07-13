import type { Factory } from '@asyra/factory'
import type { InputSystem } from '@asyra/input-system'
import type { Render } from '@asyra/render'

export interface HandlerDeps {
  inputSystem: InputSystem
  render: Render
  factory: Factory
}
