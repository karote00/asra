/**
 * Property Registrations
 *
 * Central place to register all UI properties.
 * Import and call these functions during app initialization.
 */

import { registerAggregateProperties } from './aggregate-properties'
import { registerSystemProperties } from './system-properties'
import { registerBaseUIProperties } from './ui-properties'

export { registerAggregateProperties } from './aggregate-properties'
export { registerSystemProperties } from './system-properties'
export { registerBaseUIProperties } from './ui-properties'

/**
 * Initialize all property registrations
 * Call this during app startup
 */
export const initPropertyRegistrations = () => {
  // Register base UI state (selection, flattened ids)
  registerBaseUIProperties()

  // Register aggregate properties (x, y, width, height, rotation)
  registerAggregateProperties()

  // Register system properties (zoom, primaryTool)
  registerSystemProperties()
}
