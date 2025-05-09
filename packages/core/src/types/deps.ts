import type { Factory } from '@asra/factory'
import type InputSystem from '@asra/input-system'
import type { Render } from '@asra/render'
import type { SceneTree } from '@asra/scene-tree'

export interface APIDeps {
  inputSystem: InputSystem
  sceneTree: SceneTree
}

export interface HandlerDeps {
  inputSystem: InputSystem
  render: Render
  factory: Factory
}
