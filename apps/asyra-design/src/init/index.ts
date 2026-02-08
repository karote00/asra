/**
 * App initialization exports
 *
 * This folder contains all initialization logic for the Asyra framework.
 * The main entry point is `initApp()` which sets up all framework components.
 *
 * Usage:
 * ```typescript
 * import { initApp } from './init'
 * initApp()
 * ```
 */

export { initApp } from './init-app'
// Also export as 'bootstrap' for users who prefer that naming
export { initApp as bootstrap } from './init-app'

// Export individual init functions for advanced use cases
export { initInputSystem } from './init-input-system'
