import type {
  PresetApplyResult,
  PresetDefaultId,
  PresetProfile
} from '../types'

export interface CreatePresetApplyResultInput {
  readonly profile: PresetProfile
  readonly presetEngineId: string | null
  readonly selectedDefaults: readonly PresetDefaultId[]
  readonly appliedDefaults: readonly PresetDefaultId[]
}

export const createPresetApplyResult = ({
  profile,
  presetEngineId,
  selectedDefaults,
  appliedDefaults
}: CreatePresetApplyResultInput): PresetApplyResult =>
  Object.freeze({
    profile,
    presetEngineId,
    selectedDefaults: Object.freeze([...selectedDefaults]),
    appliedDefaults: Object.freeze([...appliedDefaults])
  })
