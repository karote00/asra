import { applyPreset, PresetDefaults, PresetProfiles } from '@asyra/preset'

import { createExampleCoreComposition } from './create-core-composition.mjs'
import {
  assertExampleResult,
  definePublicExample
} from './example-contract.mjs'

export const exampleDefinition = definePublicExample({
  id: 'preset-2d-minimal',
  title: 'Apply the complete official 2D baseline',
  objective:
    'Compose the optional official design-tool defaults and Pixi provider policy in one pre-start operation.',
  publicPackages: ['@asyra/core', '@asyra/preset'],
  environment:
    'Supported browser/Core 2D composition with Node.js artifact verification',
  runCommand: 'yarn examples:run preset-2d-minimal',
  sourceRegion: 'example',
  expectedResult:
    'Preset reports profile 2D, the Pixi provider id, and all official defaults exactly once.',
  ownership: {
    framework: 'Owns deterministic registration and provider boundaries.',
    preset: 'Selects the official 2D provider and complete default catalog.',
    app: 'Chooses whether this baseline belongs in its product.'
  }
})

// #region example
export const runPreset2DMinimalExample = () => {
  const { core } = createExampleCoreComposition()
  const result = applyPreset(core)

  assertExampleResult(result.profile === PresetProfiles['2D'], 'profile is 2D')
  assertExampleResult(
    result.presetEngineId === '@asyra/render-engine-pixi',
    'the official Pixi provider is selected'
  )
  assertExampleResult(
    result.appliedDefaults.length === Object.values(PresetDefaults).length,
    'all official defaults are applied'
  )
  return result
}
// #endregion example
