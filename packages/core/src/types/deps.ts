import type { Factory } from '@asra/factory'
import type { InputSystem } from '@asra/input-system'
import type { InteractionCore } from '@asra/interaction-core'
import type { PropsManager } from '@asra/props-manager'
import type { Render } from '@asra/render'
import type { SceneTree } from '@asra/scene-tree'
import type { SystemContext } from '@asra/system-context'

export interface APIDeps {
  inputSystem: InputSystem
  sceneTree: SceneTree
  props: PropsManager
  systemContext: SystemContext
  interactionCore: InteractionCore
}

export interface HandlerDeps {
  inputSystem: InputSystem
  render: Render
  factory: Factory
}
