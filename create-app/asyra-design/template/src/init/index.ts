/**
 * App initialization exports
 *
 * This folder contains all initialization logic for the Asyra framework,
 * grouped by foundation, capability, derived-state, and diagnostics concerns.
 * The main entry point is `initApp()` which sets up all framework components.
 *
 * Usage:
 * ```typescript
 * import { initApp } from './init'
 * initApp({ serverResponse })
 * ```
 */

export { initApp } from './init-app'
// Also export as 'bootstrap' for users who prefer that naming
export { initApp as bootstrap } from './init-app'

// Export individual init functions for advanced use cases
export { initInputSystem } from './foundation/init-input-system'
export { initVectorIconData } from './capabilities/init-vector-icon-data'
export {
  initLoadDiagnostics,
  subscribeLoadDiagnostics,
  destroyLoadDiagnostics,
  formatLoadDiagnostics
} from './diagnostics/init-load-diagnostics'
export {
  initCanvasPipelineDebugger,
  destroyCanvasPipelineDebugger
} from './diagnostics/init-canvas-pipeline-debugger'
