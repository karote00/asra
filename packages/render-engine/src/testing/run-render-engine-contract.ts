import {
  RenderEngineCapabilities,
  assertRenderEngineCapabilities
} from '../capabilities'
import type {
  RenderEngine,
  RenderEngineDestroyResult,
  RenderEngineInitializeResult,
  RenderEngineInteractionEvent
} from '../types'

export type RenderEngineContractOptions<Engine extends RenderEngine> =
  Readonly<{
    createEngine: () => Engine
    emitInteraction: (
      engine: Engine,
      event: RenderEngineInteractionEvent
    ) => void
    getOperationTypes: (engine: Engine) => readonly string[]
  }>

export type RenderEngineContractReport<Engine extends RenderEngine> = Readonly<{
  engine: Engine
  initializationResult: RenderEngineInitializeResult
  operationTypes: readonly string[]
  interactions: readonly RenderEngineInteractionEvent[]
  destroyResult: RenderEngineDestroyResult
}>

export async function runRenderEngineContract<Engine extends RenderEngine>(
  options: RenderEngineContractOptions<Engine>
): Promise<RenderEngineContractReport<Engine>> {
  const engine = options.createEngine()
  const interactions: RenderEngineInteractionEvent[] = []
  const unsubscribe = engine.subscribeToInteraction((event) => {
    interactions.push(event)
  })

  assertRenderEngineCapabilities(engine, [
    RenderEngineCapabilities.OBJECTS,
    RenderEngineCapabilities.GRAPHICS,
    RenderEngineCapabilities.INTERACTION,
    RenderEngineCapabilities.RESOURCES
  ])

  const initializationResult = await engine.initialize({
    host: {},
    width: 640,
    height: 480
  })

  const resourceResult = await engine.execute({
    type: 'create-resource',
    requestId: 'contract-resource',
    descriptor: { kind: 'paint', data: { color: 0x336699 } }
  })
  const containerResult = await engine.execute({
    type: 'create-object',
    requestId: 'contract-container',
    objectType: 'container'
  })
  const graphicsResult = await engine.execute({
    type: 'create-object',
    requestId: 'contract-graphics',
    objectType: 'graphics'
  })

  if (
    !resourceResult.resource ||
    !containerResult.object ||
    !graphicsResult.object
  ) {
    throw new Error('Render engine contract did not create required handles')
  }

  await engine.execute({
    type: 'append-child',
    parent: initializationResult.root,
    child: containerResult.object
  })
  await engine.execute({
    type: 'append-child',
    parent: containerResult.object,
    child: graphicsResult.object
  })
  await engine.execute({
    type: 'draw',
    object: graphicsResult.object,
    operations: [
      { type: 'rect', x: 0, y: 0, width: 20, height: 10 },
      {
        type: 'fill',
        paint: { resource: resourceResult.resource, alpha: 1 }
      }
    ]
  })
  await engine.execute({
    type: 'update-object',
    object: graphicsResult.object,
    properties: { x: 12, y: 24, visible: true }
  })
  await engine.execute({ type: 'resize', width: 800, height: 600 })
  await engine.execute({ type: 'flush' })

  options.emitInteraction(engine, {
    type: 'pointerdown',
    pointerId: 1,
    button: 0,
    buttons: 1,
    position: { x: 12, y: 24 },
    modifiers: {
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false
    },
    target: graphicsResult.object,
    timestamp: 1
  })

  await engine.execute({
    type: 'destroy-resource',
    resource: resourceResult.resource
  })
  unsubscribe()
  const destroyResult = await engine.destroy()

  return {
    engine,
    initializationResult,
    operationTypes: options.getOperationTypes(engine),
    interactions,
    destroyResult
  }
}
