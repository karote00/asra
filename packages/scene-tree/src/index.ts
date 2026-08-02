import { initSceneTreeSubscribes } from './subscribes'

initSceneTreeSubscribes()

export * from './components'
export * from './element-mutation'
export { default, SceneTree } from './sceneTree'
export type {
  CanonicalElementRemoval,
  LocalComputedDataPatchUpdate,
  LocalComputedDataUpdate
} from './sceneTree'
export { componentRegistry } from './component-registry'
export { createDynamicComponent } from './create-dynamic-component'
export { createDynamicPropsClass } from './create-dynamic-props'
export { createElement } from './entity-data'
export type { ComponentRegistration } from './component-registry'
