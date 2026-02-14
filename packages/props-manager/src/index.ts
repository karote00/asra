import { initPropXSubscribes } from './subscribes'
import propsManager, { PropsManager } from './props-manager'
import propertyRegistry from './property-registry'

initPropXSubscribes()

export default propsManager
export { PropsManager, propertyRegistry }
export type { PropertyDefinition } from './property-registry'
