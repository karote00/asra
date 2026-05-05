import { applyPreset, enableDefaultExactGeometryBackend } from '@asyra/preset'
import core from '../contexts'
import { initAreaSelection } from './capabilities/init-area-selection'
import { initGradientFillEditing } from './capabilities/init-gradient-fill-editing'
import { initVectorIconData } from './capabilities/init-vector-icon-data'
import { initLoadDiagnostics } from './diagnostics/init-load-diagnostics'
import { initSelectionCompatibility } from './derived-state/init-selection-compatibility'
import { initPathEditingContinuation } from './derived-state/init-path-editing-continuation'
import { initFeatures } from './foundation/init-features'
import { initInputSystem } from './foundation/init-input-system'
import { elementApis } from '../common-apis/element'

let exactGeometryBackendReady: Promise<void> = Promise.resolve()

export const waitForExactGeometryBackend = (): Promise<void> =>
  exactGeometryBackendReady

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
  exactGeometryBackendReady = enableDefaultExactGeometryBackend().catch(
    (error) => {
      console.error('[Asyra] Failed to initialize exact stroke backend:', error)
    }
  )

  // Diagnostics: subscribe once to core load diagnostics and route reports to app-level handlers.
  initLoadDiagnostics()

  // Derived-state syncs.
  // Keep legacy selectedVectorPoint mirrored from SelectionManager-driven UI state.
  initSelectionCompatibility()
  initPathEditingContinuation()

  // Capability init.
  initAreaSelection()
  initGradientFillEditing()
  initVectorIconData()

  // Foundation init.
  initInputSystem()
  // Initialize feature-system for application-level features
  initFeatures()

  if (import.meta.env.DEV) {
    window.__AsyraE2E__ = {
      elementApis
    }
  }

  // Future: More framework initialization can be added here
  // initRender()
  // initCustomPlugins()
  // initUserConfigurations()
}
