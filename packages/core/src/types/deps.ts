import type { Factory } from '@asra/factory'
import type { InputSystem } from '@asra/input-system'
import type { Render } from '@asra/render'

export interface HandlerDeps {
  inputSystem: InputSystem
  render: Render
  factory: Factory
}
