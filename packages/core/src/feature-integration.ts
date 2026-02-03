import { getSessionManager, getFeatureRegistry } from '@asyra/feature-system'

// Type imports - will be connected properly after core integration
type CoreDeps = any
type SystemContextSnapshot = any

/**
 * Integrate feature-system with core
 * Connects session manager to input-system events
 */
export function initFeatureSystem(coreDeps: {
  inputSystem: any
  systemContext: any
}): void {
  const sessionManager = getSessionManager()

  // Connect session manager to input-system events
  const inputSystem = coreDeps.inputSystem
  const systemContext = coreDeps.systemContext

  // Track input.drag.start
  if (inputSystem.on) {
    inputSystem.on('input.drag.start', async (raw: any) => {
      const snapshot = systemContext.getSystemContextSnapshot?.() || raw
      await sessionManager.handleStart('input.drag', snapshot)
    })

    // Track input.drag.update
    inputSystem.on('input.drag.update', async (raw: any) => {
      const snapshot = systemContext.getSystemContextSnapshot?.() || raw
      await sessionManager.handleUpdate('input.drag', snapshot)
    })

    // Track input.drag.end
    inputSystem.on('input.drag.end', async (raw: any) => {
      const snapshot = systemContext.getSystemContextSnapshot?.() || raw
      await sessionManager.handleEnd('input.drag', snapshot)
    })

    // TODO: Add other session types (click, hover, scroll, etc.)
  }
}

/**
 * Get feature registry instance
 */
export { getFeatureRegistry }

/**
 * Get session manager instance
 */
export { getSessionManager }
