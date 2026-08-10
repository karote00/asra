import { createExampleCoreComposition } from './create-core-composition.mjs'
import {
  assertExampleResult,
  definePublicExample
} from './example-contract.mjs'

const COMPONENT_TYPE = 'example:work-item'
const PROPERTY_TYPE = 'example:review-state'

export const exampleDefinition = definePublicExample({
  id: 'custom-component-schema',
  title: 'Register an app-owned component and schema',
  objective:
    'Define a domain-neutral Framework component relation around an app-owned review-state schema.',
  publicPackages: ['@asyra/core', '@asyra/props-manager', '@asyra/scene-tree'],
  environment:
    'Supported browser/Core composition with Node.js artifact verification',
  runCommand: 'yarn examples:run custom-component-schema',
  sourceRegion: 'example',
  expectedResult:
    'The custom component resolves one review relation and creates validated default property data.',
  ownership: {
    framework: 'Owns registration, relation integrity, and schema lookup.',
    preset: 'Not composed; the example defines its own capability.',
    app: 'Owns work-item and review-state domain meaning.'
  }
})

// #region example
export const runCustomComponentSchemaExample = () => {
  const { core } = createExampleCoreComposition()
  const ReviewState = core.definePropertyComponent({
    type: PROPERTY_TYPE,
    defaults: { score: 0, status: 'draft' }
  })
  core.registerPropertySchema({
    type: PROPERTY_TYPE,
    fields: [
      { key: 'status', kind: 'string', defaultValue: 'draft' },
      { key: 'score', kind: 'number', defaultValue: 0 }
    ]
  })
  core.defineComponent({
    type: COMPONENT_TYPE,
    properties: [{ name: 'review', type: PROPERTY_TYPE }]
  })

  try {
    const review = new ReviewState({
      id: 'review-1',
      type: PROPERTY_TYPE,
      score: 92,
      status: 'approved'
    })
    const result = {
      componentType: COMPONENT_TYPE,
      relations: core.getComponentPropertyRelations(COMPONENT_TYPE),
      schema: core.getPropertySchema(PROPERTY_TYPE),
      value: {
        score: review.get('score'),
        status: review.get('status')
      }
    }

    assertExampleResult(result.relations.length === 1, 'one relation exists')
    assertExampleResult(result.value.score === 92, 'score is retained')
    assertExampleResult(
      result.value.status === 'approved',
      'status is retained'
    )
    return Object.freeze(result)
  } finally {
    core.unregisterComponent(COMPONENT_TYPE)
    core.unregisterPropertyRegistration(PROPERTY_TYPE)
  }
}
// #endregion example

export const runExample = runCustomComponentSchemaExample
