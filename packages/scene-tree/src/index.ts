import { initSceneTreeSubscribes } from './subscribes.js'

initSceneTreeSubscribes()

export * from './components/index.js'
export * from './element-mutation.js'
export { default, SceneTree } from './sceneTree.js'
export type {
  CanonicalElementRemoval,
  LocalComputedDataPatchUpdate,
  LocalComputedDataUpdate
} from './sceneTree.js'
export { componentRegistry } from './component-registry.js'
export { createDynamicComponent } from './create-dynamic-component.js'
export { createDynamicPropsClass } from './create-dynamic-props.js'
export { createElement } from './entity-data.js'
export type { ComponentRegistration } from './component-registry.js'
