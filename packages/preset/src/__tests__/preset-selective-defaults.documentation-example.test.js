import { describe, expect, it } from 'vitest'
import { PresetDefaults } from '@asyra/preset'

import {
  exampleDefinition,
  runPresetSelectiveDefaultsExample
} from '../../../../docs/examples/preset-selective-defaults.mjs'

describe('public selective Preset example', () => {
  it('expands Vector Editing to the exact ordered dependency closure', () => {
    const result = runPresetSelectiveDefaultsExample()

    expect(exampleDefinition.id).toBe('preset-selective-defaults')
    expect(result.selectedDefaults).toEqual([PresetDefaults.VECTOR_EDITING])
    expect(result.appliedDefaults).toEqual([
      PresetDefaults.VECTOR,
      PresetDefaults.SELECTION,
      PresetDefaults.VECTOR_EDITING
    ])
  })
})
