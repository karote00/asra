import core, { Core } from './core'
import './components'
export {
  initFeatureSystem,
  getFeatureRegistry,
  getSessionManager
} from './feature-integration'

export { defineComponent, unregisterComponent } from './define-component'
export type { ComponentDefinition } from './define-component'

export { Core }
export default core
