import { applyPreset, PresetDefaults } from '@asyra/preset'

import { createExampleCoreComposition } from './create-core-composition.mjs'
import {
  assertExampleResult,
  definePublicExample
} from './example-contract.mjs'

export const exampleDefinition = definePublicExample({
  id: 'preset-selective-defaults',
  title: 'Select one default and receive its exact closure',
  objective:
    'Request Vector Editing alone and inspect deterministic dependency expansion before Core starts.',
  publicPackages: ['@asyra/core', '@asyra/preset'],
  environment:
    'Supported browser/Core composition with Node.js artifact verification',
  runCommand: 'yarn examples:run preset-selective-defaults',
  sourceRegion: 'example',
  expectedResult:
    'Vector Editing expands only to Vector, Selection, and Vector Editing in dependency order.',
  ownership: {
    framework: 'Owns registration and startup closure.',
    preset: 'Owns the official dependency graph between selectable defaults.',
    app: 'Chooses the one requested default and may replace other capabilities.'
  }
})

// #region example
export const runPresetSelectiveDefaultsExample = () => {
  const { core } = createExampleCoreComposition()
  const result = applyPreset(core, {
    defaults: [PresetDefaults.VECTOR_EDITING]
  })
  const expected = [
    PresetDefaults.VECTOR,
    PresetDefaults.SELECTION,
    PresetDefaults.VECTOR_EDITING
  ]

  assertExampleResult(
    JSON.stringify(result.selectedDefaults) ===
      JSON.stringify([PresetDefaults.VECTOR_EDITING]),
    'only Vector Editing is selected'
  )
  assertExampleResult(
    JSON.stringify(result.appliedDefaults) === JSON.stringify(expected),
    'dependency expansion is exact and ordered'
  )
  return result
}
// #endregion example
