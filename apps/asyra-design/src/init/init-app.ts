import { initInputSystem } from './init-input-system'
import { initFeatures } from './init-features'
import { initLoadDiagnostics } from './init-load-diagnostics'
import { applyPreset } from '@asyra/preset'
import core from '../contexts'

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
  applyPreset(core)

  // Subscribe once to core load diagnostics and route reports to app-level handlers.
  initLoadDiagnostics()

  initInputSystem()
  // Initialize feature-system for application-level features
  initFeatures()

  // Future: More framework initialization can be added here
  // initRender()
  // initCustomPlugins()
  // initUserConfigurations()
}
