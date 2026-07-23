import { initSceneTreeSubscribes } from './subscribes'

initSceneTreeSubscribes()

export * from './components'
export { default, SceneTree } from './sceneTree'
export { componentRegistry } from './component-registry'
export { createDynamicComponent } from './create-dynamic-component'
export { createDynamicPropsClass } from './create-dynamic-props'
export { createElement } from './entity-data'
export type { ComponentRegistration } from './component-registry'
