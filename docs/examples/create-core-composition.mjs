import { Core } from '@asyra/core'
import { Factory } from '@asyra/factory'
import { InputSystem } from '@asyra/input-system'
import { PropsManager } from '@asyra/props-manager'
import { Render } from '@asyra/render'
import { SceneTree } from '@asyra/scene-tree'
import { SelectionManager } from '@asyra/selection'
import systemContext from '@asyra/system-context'

/**
 * Create an isolated, engine-neutral Core composition from public package
 * roots. Examples still target the supported browser/Core product composition;
 * the Node.js gate is artifact verification, not a Headless Core lifecycle.
 */
export const createExampleCoreComposition = () => {
  const factory = new Factory()
  const props = new PropsManager()
  const render = new Render()
  const sceneTree = new SceneTree(props)
  const selection = new SelectionManager()
  const inputSystem = new InputSystem()
  const core = new Core({
    factory,
    inputSystem,
    props,
    render,
    sceneTree,
    selection,
    systemContext
  })

  return Object.freeze({
    core,
    factory,
    inputSystem,
    props,
    render,
    sceneTree,
    selection
  })
}
