import core from '@asyra/core'
import { initInputSystem } from './init-input-system'
import { initInteractions } from './init-interactions'
import { initWorkflows } from './init-workflows'
import { initSubscribers } from './subscribers'

/**
 * Initializes all framework components and configurations.
 *
 * This is the single entry point for setting up the Asyra framework in your app.
 * Users can extend this function to add custom initialization logic, runtime scripts,
 * or redefine behaviors.
 *
 * Example extension:
 * ```typescript
 * import { initApp as baseInitApp } from './init'
 *
 * export const initApp = () => {
 *   // Initialize base framework
 *   baseInitApp()
 *
 *   // Add custom initialization
 *   customInputHandlers()
 *   customBehaviors()
 * }
 * ```
 */
export const initApp = (): void => {
  initInputSystem()
  initWorkflows()
  initInteractions()
  initSubscribers()

  core.initEventHandlers()

  // Future: More framework initialization can be added here
  // initRender()
  // initCustomPlugins()
  // initUserConfigurations()
}
