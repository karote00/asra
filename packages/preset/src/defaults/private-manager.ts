import type {
  PrivatePrerequisiteManager,
  RegisterPresetCleanup
} from './types.js'

export const createPrivatePrerequisiteManager = (
  registerCleanup: RegisterPresetCleanup
): PrivatePrerequisiteManager => {
  const acquired = new Set<string>()

  return {
    acquire(key, install): void {
      if (acquired.has(key)) return
      const cleanup = install()
      acquired.add(key)
      if (typeof cleanup === 'function') {
        registerCleanup(`private:${key}`, cleanup)
      }
    }
  }
}
