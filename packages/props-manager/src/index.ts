import { initPropXSubscribes } from './subscribes'
import propsManager, { PropsManager } from './props-manager'
import uiPropertyRegistry from './ui-property-registry'
import stateRegistry from './state-registry'
import { propertyRegistry } from './registry'

initPropXSubscribes()

export default propsManager
export { PropsManager, uiPropertyRegistry, stateRegistry, propertyRegistry }
export type { PropertyDefinition } from './ui-property-registry'
