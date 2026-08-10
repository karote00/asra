import { describe, expect, it } from 'vitest'

import {
  exampleDefinition,
  runPreset2DMinimalExample
} from '../../../../docs/examples/preset-2d-minimal.mjs'
import { PresetDefaults, PresetProfiles } from '../index.js'

describe('public Preset 2D example', () => {
  it('applies the complete official default baseline', () => {
    const result = runPreset2DMinimalExample()

    expect(exampleDefinition.id).toBe('preset-2d-minimal')
    expect(result.profile).toBe(PresetProfiles['2D'])
    expect(result.presetEngineId).toBe('@asyra/render-engine-pixi')
    expect(result.selectedDefaults).toEqual(Object.values(PresetDefaults))
    expect(result.appliedDefaults).toEqual(Object.values(PresetDefaults))
  })
})
