import type { PresetApplyResult } from '../types'

export const createPresetApplyResult = ({
  profile,
  presetEngineId,
  selectedDefaults,
  appliedDefaults
}: PresetApplyResult): PresetApplyResult =>
  Object.freeze({
    profile,
    presetEngineId,
    selectedDefaults: Object.freeze([...selectedDefaults]),
    appliedDefaults: Object.freeze([...appliedDefaults])
  })
