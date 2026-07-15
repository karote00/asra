import { describe, expect, it } from 'vitest'
import {
  RenderEngineCapabilities,
  UnsupportedRenderEngineCapabilityError,
  assertRenderEngineCapabilities,
  type RenderEngine,
  type RenderEngineCommand,
  type RenderEngineInteractionEvent
} from '../index'
import { RecordingRenderEngine, runRenderEngineContract } from '../testing'

describe('@asyra/render-engine contract', () => {
  it('records the current lifecycle and semantic command surface', async () => {
    const engine = new RecordingRenderEngine({
      name: 'recording-engine',
      capabilities: [
        RenderEngineCapabilities.OBJECTS,
        RenderEngineCapabilities.GRAPHICS,
        RenderEngineCapabilities.INTERACTION,
        RenderEngineCapabilities.RESOURCES
      ]
    })

    const report = await runRenderEngineContract({
      createEngine: () => engine,
      emitInteraction: (targetEngine, event) => {
        targetEngine.emitInteraction(event)
      },
      getOperationTypes: (targetEngine) =>
        targetEngine.getOperations().map((operation) => operation.type)
    })

    expect(report.engine).toBe(engine)
    expect(report.operationTypes).toEqual([
      'initialize',
      'create-resource',
      'create-object',
      'create-object',
      'append-child',
      'append-child',
      'draw',
      'update-object',
      'resize',
      'flush',
      'destroy-resource',
      'destroy'
    ])
    expect(report.initializationResult.root).toBeTruthy()
    expect(report.interactions).toHaveLength(1)
    expect(report.destroyResult).toEqual({
      destroyedObjects: 2,
      destroyedResources: 0,
      alreadyDestroyed: false
    })
    expect(engine.getOwnedObjectCount()).toBe(0)
    expect(engine.getOwnedResourceCount()).toBe(0)
  })

  it('runs through an adapter without recording-only engine methods', async () => {
    const recording = new RecordingRenderEngine({ name: 'facade-recording' })
    const facade: RenderEngine = {
      name: recording.name,
      capabilities: recording.capabilities,
      initialize: (options) => recording.initialize(options),
      execute: (command) => recording.execute(command),
      query: (query) => recording.query(query),
      subscribeToInteraction: (listener) =>
        recording.subscribeToInteraction(listener),
      startFrameLoop: (callback) => recording.startFrameLoop(callback),
      stopFrameLoop: () => recording.stopFrameLoop(),
      destroy: () => recording.destroy()
    }

    const report = await runRenderEngineContract({
      createEngine: () => facade,
      emitInteraction: (_engine, event) => recording.emitInteraction(event),
      getOperationTypes: () =>
        recording.getOperations().map((operation) => operation.type)
    })

    expect(report.engine).toBe(facade)
    expect(report.operationTypes.at(-1)).toBe('destroy')
  })

  it('keeps recording engine instances isolated', async () => {
    const first = new RecordingRenderEngine({ name: 'first' })
    const second = new RecordingRenderEngine({ name: 'second' })

    await first.initialize({ host: {}, width: 100, height: 100 })
    await second.initialize({ host: {}, width: 200, height: 200 })

    const command: RenderEngineCommand = {
      type: 'create-object',
      requestId: 'first-object',
      objectType: 'graphics',
      properties: { label: 'first-object' }
    }
    first.execute(command)

    expect(first.getOwnedObjectCount()).toBe(1)
    expect(second.getOwnedObjectCount()).toBe(0)
    expect(second.getOperations()).toEqual([
      expect.objectContaining({ type: 'initialize' })
    ])
  })

  it('fails unsupported capabilities without engine introspection', () => {
    const engine = new RecordingRenderEngine({
      name: 'limited',
      capabilities: [RenderEngineCapabilities.OBJECTS]
    })

    expect(() =>
      assertRenderEngineCapabilities(engine, [
        RenderEngineCapabilities.GRAPHICS,
        RenderEngineCapabilities.INTERACTION
      ])
    ).toThrowError(UnsupportedRenderEngineCapabilityError)

    expect(() =>
      assertRenderEngineCapabilities(engine, [
        RenderEngineCapabilities.GRAPHICS
      ])
    ).toThrow(
      'Render engine "limited" does not support required capabilities: graphics'
    )
  })

  it('normalizes interaction events without a concrete SDK type', () => {
    const event: RenderEngineInteractionEvent = {
      type: 'pointerdown',
      pointerId: 3,
      button: 0,
      buttons: 1,
      position: { x: 12, y: 24 },
      modifiers: {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: true
      },
      target: null,
      timestamp: 42
    }

    expect(event).toEqual(
      expect.objectContaining({ type: 'pointerdown', target: null })
    )
  })
})
