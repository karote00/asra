import { describe, expect, it } from 'vitest'
import {
  RenderEngineCapabilities,
  UnsupportedRenderEngineCapabilityError,
  assertRenderEngineCapabilities,
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
      }
    })

    expect(report.engine).toBe(engine)
    expect(report.operationTypes).toEqual([
      'initialize',
      'create-resource',
      'create-object',
      'create-object',
      'append-child',
      'draw',
      'update-object',
      'resize',
      'flush',
      'destroy-resource',
      'destroy'
    ])
    expect(report.interactions).toHaveLength(1)
    expect(report.destroyResult).toEqual({
      destroyedObjects: 2,
      destroyedResources: 0,
      alreadyDestroyed: false
    })
    expect(engine.getOwnedObjectCount()).toBe(0)
    expect(engine.getOwnedResourceCount()).toBe(0)
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
