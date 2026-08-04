import type { PresetCoreAPIs, PresetDependencies } from '../types.js'

export type RegisterPresetCleanup = (key: string, dispose: () => void) => void

export type PrivatePrerequisiteInstaller = () => (() => void) | undefined

export interface PrivatePrerequisiteManager {
  acquire(key: string, install: PrivatePrerequisiteInstaller): void
}

export interface PresetDefaultInstallContext {
  readonly core: PresetCoreAPIs
  readonly dependencies: PresetDependencies
  readonly privatePrerequisites: PrivatePrerequisiteManager
}
