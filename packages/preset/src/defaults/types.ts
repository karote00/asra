import type { PresetCoreAPIs, PresetDependencies } from '../types'

export type RegisterPresetCleanup = (key: string, dispose: () => void) => void

export interface PrivatePrerequisiteManager {
  acquire(key: string, install: () => void | (() => void)): void
}

export interface PresetDefaultInstallContext {
  readonly core: PresetCoreAPIs
  readonly dependencies: PresetDependencies
  readonly privatePrerequisites: PrivatePrerequisiteManager
}
