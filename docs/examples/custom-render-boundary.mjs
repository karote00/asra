import {
  RecordingRenderEngine,
  runRenderEngineContract
} from '@asyra/render-engine/testing'

import {
  assertExampleResult,
  definePublicExample
} from './example-contract.mjs'

export const exampleDefinition = definePublicExample({
  id: 'custom-render-boundary',
  title: 'Prove an app-owned render-engine adapter',
  objective:
    'Wrap an app engine behind the public engine-neutral contract and run the official conformance oracle.',
  publicPackages: ['@asyra/render-engine'],
  environment:
    'Supported CUSTOM browser composition with Node.js artifact verification',
  runCommand: 'yarn examples:run custom-render-boundary',
  sourceRegion: 'example',
  expectedResult:
    'The adapter completes initialize, object, resource, draw, resize, interaction, frame, and destroy contracts.',
  ownership: {
    framework: 'Owns the engine-neutral command and conformance contracts.',
    preset: 'CUSTOM leaves engine ownership to the app.',
    app: 'Owns the adapter and its concrete rendering behavior.'
  }
})

// #region example
export const runCustomRenderBoundaryExample = async () => {
  const concreteEngine = new RecordingRenderEngine({
    name: 'example-concrete-engine'
  })
  const appOwnedAdapter = {
    name: 'example-app-adapter',
    capabilities: concreteEngine.capabilities,
    initialize: (options) => concreteEngine.initialize(options),
    execute: (command) => concreteEngine.execute(command),
    query: (query) => concreteEngine.query(query),
    subscribeToInteraction: (listener) =>
      concreteEngine.subscribeToInteraction(listener),
    requestFrame: (callback) => concreteEngine.requestFrame(callback),
    cancelFrame: () => concreteEngine.cancelFrame(),
    destroy: () => concreteEngine.destroy()
  }
  const report = await runRenderEngineContract({
    createEngine: () => appOwnedAdapter,
    emitInteraction: (_engine, event) => concreteEngine.emitInteraction(event),
    getOperationTypes: () =>
      concreteEngine.getOperations().map(({ type }) => type)
  })

  assertExampleResult(
    report.engine === appOwnedAdapter,
    'the app adapter remains the runtime boundary'
  )
  assertExampleResult(
    report.operationTypes.at(-1) === 'destroy',
    'the complete lifecycle reaches destroy'
  )
  return Object.freeze({
    engineName: report.engine.name,
    interactionCount: report.interactions.length,
    operationTypes: report.operationTypes
  })
}
// #endregion example
