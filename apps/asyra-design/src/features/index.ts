/**
 * Feature Registry and Initialization
 * Central place to register all application features
 */

import { transactionFeature } from '../transaction'
import { selectionFeature } from '../selection'

/**
 * Register all application features
 * Called during app initialization
 */
export function registerAllFeatures() {
  // Features are auto-registered via defineFeature()
  // This function is for explicit initialization order if needed

  console.log('Features registered:', ['transaction', 'selection'])
}

// Export features for use in app
export { transactionFeature, selectionFeature }

// Export default for easy import
export default {
  transaction: transactionFeature,
  selection: selectionFeature
}
