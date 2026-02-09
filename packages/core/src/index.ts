import core, { Core } from './core'
export type { SystemContextAPIs, InteractionCoreActionAPIs } from './types'
export {
  initFeatureSystem,
  getFeatureRegistry,
  getSessionManager
} from './feature-integration'

export { Core }
export default core
