import { createExampleCoreComposition } from './create-core-composition.mjs'
import {
  assertExampleResult,
  definePublicExample
} from './example-contract.mjs'

const STATUS_KEY = 'example:information-model-status'

export const exampleDefinition = definePublicExample({
  id: 'core-information-model',
  title: 'Model information before choosing an output',
  objective:
    'Define and update canonical app information while Render, Collaboration, and AI remain uncomposed.',
  publicPackages: [
    '@asyra/core',
    '@asyra/factory',
    '@asyra/input-system',
    '@asyra/props-manager',
    '@asyra/render',
    '@asyra/scene-tree',
    '@asyra/selection',
    '@asyra/system-context'
  ],
  environment:
    'Supported browser/Core composition with Node.js artifact verification',
  runCommand: 'yarn examples:run core-information-model',
  sourceRegion: 'example',
  expectedResult:
    'The managed model reaches verified revision 1 without an engine provider or optional service.',
  ownership: {
    framework: 'Owns managed-property registration and deterministic updates.',
    preset: 'Not composed in this example.',
    app: 'Owns the status schema and its meaning.'
  }
})

// #region example
export const runCoreInformationModelExample = () => {
  const { core } = createExampleCoreComposition()
  core.defineSystemProperty(STATUS_KEY, {
    revision: 0,
    status: 'draft'
  })

  try {
    core.setSystemProperty(STATUS_KEY, {
      revision: 1,
      status: 'verified'
    })
    const model = core.getSystemContextSnapshot()[STATUS_KEY]
    const result = {
      model,
      optionalSystems: {
        ai: 'not-composed',
        collaboration: 'not-composed',
        renderEngine: core.hasRenderEngineProvider()
      }
    }

    assertExampleResult(model.status === 'verified', 'status is verified')
    assertExampleResult(model.revision === 1, 'revision is one')
    assertExampleResult(
      result.optionalSystems.renderEngine === false,
      'Render remains optional'
    )
    return Object.freeze(result)
  } finally {
    core.unregisterSystemProperty(STATUS_KEY)
  }
}
// #endregion example

export const runExample = runCoreInformationModelExample
