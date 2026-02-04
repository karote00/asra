// Import features to register them via defineFeature()
import './switch-primary-tool'
import './create-element'
import './selection'
import './transaction'

export function registerAllFeatures() {
  console.log('Features registered via defineFeature')
}

export default {
  registerAllFeatures
}
