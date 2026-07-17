import type { CorePresetDependencies, CorePresetInstallAPIs } from '@asyra/core'
import type {
  PRESET_APPLY_ERROR_CODES,
  PresetDefaults,
  PresetProfiles
} from './constants'

export type PresetProfile = (typeof PresetProfiles)[keyof typeof PresetProfiles]

export type PresetDefaultId =
  (typeof PresetDefaults)[keyof typeof PresetDefaults]

export type PresetApplyErrorCode =
  (typeof PRESET_APPLY_ERROR_CODES)[keyof typeof PRESET_APPLY_ERROR_CODES]

export interface ApplyPresetOptions {
  profile?: PresetProfile
  defaults?: readonly PresetDefaultId[]
}

export interface PresetApplyResult {
  readonly profile: PresetProfile
  readonly presetEngineId: string | null
  readonly selectedDefaults: readonly PresetDefaultId[]
  readonly appliedDefaults: readonly PresetDefaultId[]
}

export interface PresetProfileCatalogEntry {
  readonly id: PresetProfile
  readonly available: boolean
  readonly presetEngineId: string | null
}

export interface PresetDefaultCatalogEntry {
  readonly id: PresetDefaultId
  readonly available: boolean
  readonly requires: readonly PresetDefaultId[]
}

export interface PresetCatalogContract {
  readonly profiles: readonly PresetProfileCatalogEntry[]
  readonly defaults: readonly PresetDefaultCatalogEntry[]
}

export type PresetCoreAPIs = CorePresetInstallAPIs
export type PresetDependencies = CorePresetDependencies
