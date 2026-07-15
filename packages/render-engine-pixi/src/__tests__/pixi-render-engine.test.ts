import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runRenderEngineContract } from '@asyra/render-engine/testing'
import type { RenderEngineInteractionEvent } from '@asyra/render-engine'

type MockFunction = ReturnType<typeof vi.fn>

interface MockStageRecord {
  emit: (type: string, event: unknown) => void
  position: { set: MockFunction }
}

interface MockApplicationRecord {
  stage: MockStageRecord
  canvas: unknown
  renderer: { resize: MockFunction }
  ticker: {
    add: MockFunction
    remove: MockFunction
  }
  init: MockFunction
  render: MockFunction
  destroy: MockFunction
}

interface MockGraphicsRecord {
  drawOperations: { type: string; args: unknown[] }[]
  scale: { set: MockFunction }
  x: number
  y: number
  visible: boolean
}

interface MockTextureRecord {
  destroy: MockFunction
}

interface MockGradientRecord {
  options: Record<string, unknown>
  transform?: MockMatrixRecord
  buildGradient: MockFunction
  destroy: MockFunction
}

interface MockPatternRecord {
  texture: MockTextureRecord
  repeat: string
  transform?: MockMatrixRecord
  setTransform: MockFunction
}

interface MockMatrixRecord {
  operations: { type: string; args: number[] }[]
}

interface MockMeshGeometryRecord {
  positions: Float32Array
  indices: Uint32Array
  uvs: Float32Array
  positionUpdate: MockFunction
  uvUpdate: MockFunction
  indexUpdate: MockFunction
}

interface MockMeshRecord {
  geometry: MockMeshGeometryRecord
  cursor: string
  width: number
  height: number
  batched: boolean
}

const pixiState = vi.hoisted(() => ({
  applications: [] as MockApplicationRecord[],
  graphics: [] as MockGraphicsRecord[],
  textures: [] as MockTextureRecord[],
  gradients: [] as MockGradientRecord[],
  patterns: [] as MockPatternRecord[],
  matrices: [] as MockMatrixRecord[],
  meshes: [] as MockMeshRecord[],
  operationTypes: [] as string[],
  nextInitError: null as Error | null
}))

vi.mock('pixi.js', () => {
  class MockContainer {
    readonly children: MockContainer[] = []
    readonly listeners = new Map<string, Set<(event: unknown) => void>>()
    readonly position = {
      set: vi.fn((x: number, y: number) => {
        this.x = x
        this.y = y
      })
    }
    readonly scale = {
      x: 1,
      y: 1,
      set: vi.fn((x: number, y = x) => {
        this.scale.x = x
        this.scale.y = y
      })
    }
    parent: MockContainer | null = null
    x = 0
    y = 0
    width = 0
    height = 0
    alpha = 1
    angle = 0
    rotation = 0
    zIndex = 0
    label = ''
    visible = true
    renderable = true
    eventMode = 'auto'
    cursor = 'default'
    batched = true
    destroyed = false

    addChild(child: MockContainer) {
      child.parent = this
      this.children.push(child)
      pixiState.operationTypes.push('append-child')
      return child
    }

    removeChild(child: MockContainer) {
      const index = this.children.indexOf(child)
      if (index >= 0) {
        this.children.splice(index, 1)
      }
      child.parent = null
      return child
    }

    setChildIndex(child: MockContainer, index: number) {
      this.removeChild(child)
      this.children.splice(index, 0, child)
      child.parent = this
    }

    on(type: string, listener: (event: unknown) => void) {
      const listeners = this.listeners.get(type) ?? new Set()
      listeners.add(listener)
      this.listeners.set(type, listeners)
      return this
    }

    off(type: string, listener: (event: unknown) => void) {
      this.listeners.get(type)?.delete(listener)
      return this
    }

    emit(type: string, event: unknown) {
      this.listeners.get(type)?.forEach((listener) => listener(event))
    }

    getBounds() {
      return { x: this.x, y: this.y, width: this.width, height: this.height }
    }

    toLocal(point: { x: number; y: number }) {
      return { x: point.x - this.x, y: point.y - this.y }
    }

    toGlobal(point: { x: number; y: number }) {
      return { x: point.x + this.x, y: point.y + this.y }
    }

    destroy() {
      this.destroyed = true
    }
  }

  class MockGraphics extends MockContainer {
    readonly drawOperations: { type: string; args: unknown[] }[] = []

    constructor() {
      super()
      pixiState.graphics.push(this)
    }

    private record(type: string, ...args: unknown[]) {
      this.drawOperations.push({ type, args })
      return this
    }

    clear() {
      return this.record('clear')
    }

    rect(...args: unknown[]) {
      return this.record('rect', ...args)
    }

    ellipse(...args: unknown[]) {
      return this.record('ellipse', ...args)
    }

    circle(...args: unknown[]) {
      return this.record('circle', ...args)
    }

    moveTo(...args: unknown[]) {
      return this.record('move-to', ...args)
    }

    lineTo(...args: unknown[]) {
      return this.record('line-to', ...args)
    }

    bezierCurveTo(...args: unknown[]) {
      return this.record('bezier-curve-to', ...args)
    }

    closePath() {
      return this.record('close-path')
    }

    fill(...args: unknown[]) {
      ;(
        args[0] as { buildGradient?: () => void } | undefined
      )?.buildGradient?.()
      return this.record('fill', ...args)
    }

    stroke(...args: unknown[]) {
      return this.record('stroke', ...args)
    }
  }

  class MockMeshGeometry {
    positions: Float32Array
    indices: Uint32Array
    uvs: Float32Array
    readonly positionUpdate = vi.fn()
    readonly uvUpdate = vi.fn()
    readonly indexUpdate = vi.fn()

    constructor(readonly options: Record<string, unknown>) {
      this.positions = options.positions as Float32Array
      this.indices = options.indices as Uint32Array
      this.uvs = options.uvs as Float32Array
    }

    getBuffer(name: string) {
      return name === 'aPosition'
        ? { update: this.positionUpdate }
        : { update: this.uvUpdate }
    }

    getIndex() {
      return { update: this.indexUpdate }
    }
  }

  class MockTexture {
    static readonly WHITE = new MockTexture('white')
    readonly destroy = vi.fn()
    readonly width = 256
    readonly height = 256

    constructor(readonly source: unknown) {
      pixiState.textures.push(this)
    }

    static from(source: unknown) {
      return new MockTexture(source)
    }
  }

  class MockMesh extends MockContainer {
    tint = 0xffffff
    readonly geometry: MockMeshGeometry

    constructor(readonly options: Record<string, unknown>) {
      super()
      this.geometry = options.geometry as MockMeshGeometry
      pixiState.meshes.push(this)
    }
  }

  class MockMatrix {
    readonly operations: { type: string; args: number[] }[] = []

    constructor() {
      pixiState.matrices.push(this)
    }

    scale(...args: number[]) {
      this.operations.push({ type: 'scale', args })
      return this
    }

    rotate(...args: number[]) {
      this.operations.push({ type: 'rotate', args })
      return this
    }

    translate(...args: number[]) {
      this.operations.push({ type: 'translate', args })
      return this
    }
  }

  class MockCanvasSource {
    constructor(readonly options: Record<string, unknown>) {}
  }

  class MockFillGradient {
    transform?: MockMatrix
    readonly buildGradient = vi.fn()
    readonly destroy = vi.fn()

    constructor(readonly options: Record<string, unknown>) {
      pixiState.gradients.push(this)
    }
  }

  class MockFillPattern {
    transform?: MockMatrix
    readonly setTransform = vi.fn((transform: MockMatrix) => {
      this.transform = transform
    })

    constructor(
      readonly texture: MockTexture,
      readonly repeat: string
    ) {
      pixiState.patterns.push(this)
    }
  }

  class MockApplication {
    readonly stage = new MockContainer()
    readonly canvas = {
      parentNode: null,
      getBoundingClientRect: () => ({ left: 0, top: 0 })
    }
    readonly renderer = {
      resize: vi.fn(),
      render: vi.fn(),
      events: {
        rootBoundary: {
          hitTest: vi.fn()
        }
      }
    }
    readonly ticker = {
      add: vi.fn(),
      remove: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }
    readonly render = vi.fn(() => {
      pixiState.operationTypes.push('flush')
    })
    readonly destroy = vi.fn()
    readonly init = vi.fn(async () => {
      pixiState.operationTypes.push('initialize')
      if (pixiState.nextInitError) {
        const error = pixiState.nextInitError
        pixiState.nextInitError = null
        throw error
      }
    })

    constructor() {
      pixiState.applications.push(this)
    }
  }

  return {
    Application: MockApplication,
    CanvasSource: MockCanvasSource,
    Container: MockContainer,
    FillGradient: MockFillGradient,
    FillPattern: MockFillPattern,
    Graphics: MockGraphics,
    Matrix: MockMatrix,
    Mesh: MockMesh,
    MeshGeometry: MockMeshGeometry,
    Texture: MockTexture
  }
})

import { PixiRenderEngine } from '../index'

const getLastApplication = (): MockApplicationRecord => {
  const application = pixiState.applications.at(-1)
  if (!application) {
    throw new Error('Expected a Pixi application test instance')
  }
  return application
}

describe('PixiRenderEngine', () => {
  beforeEach(() => {
    pixiState.applications.length = 0
    pixiState.graphics.length = 0
    pixiState.textures.length = 0
    pixiState.gradients.length = 0
    pixiState.patterns.length = 0
    pixiState.matrices.length = 0
    pixiState.meshes.length = 0
    pixiState.operationTypes.length = 0
    pixiState.nextInitError = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves the current bounded device resolution and resize target', async () => {
    const runtimeWindow = { devicePixelRatio: 3 }
    vi.stubGlobal('window', runtimeWindow)
    const engine = new PixiRenderEngine()

    await engine.initialize({ host: {}, width: 100, height: 80 })

    expect(getLastApplication().init).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: 2,
        resizeTo: runtimeWindow
      })
    )
    await engine.destroy()
  })

  it('executes the abstract contract through a Pixi-specific test adapter', async () => {
    const engine = new PixiRenderEngine()

    const report = await runRenderEngineContract({
      createEngine: () => engine,
      emitInteraction: (_targetEngine, event) => {
        getLastApplication().stage.emit(event.type, {
          ...event,
          global: event.position,
          target: pixiState.graphics.at(-1)
        })
      },
      getOperationTypes: () => [...pixiState.operationTypes]
    })

    expect(report.engine).toBe(engine)
    expect(report.interactions).toEqual([
      expect.objectContaining({
        type: 'pointerdown',
        target: expect.any(Object)
      })
    ])
    expect(report.destroyResult).toEqual({
      destroyedObjects: 2,
      destroyedResources: 0,
      alreadyDestroyed: false
    })
    expect(getLastApplication().destroy).toHaveBeenCalledOnce()
  })

  it('maps object, draw, viewport, query, resize, frame, and flush commands', async () => {
    const appendChild = vi.fn()
    const engine = new PixiRenderEngine()
    const initialized = await engine.initialize({
      host: { appendChild },
      width: 320,
      height: 240,
      backgroundColor: 0x112233,
      resolution: 2
    })
    const app = getLastApplication()

    expect(appendChild).toHaveBeenCalledWith(app.canvas)
    expect(initialized.surface).toBe(app.canvas)

    const container = await engine.execute({
      type: 'create-object',
      requestId: 'container',
      objectType: 'container',
      properties: { label: 'container', x: 3, y: 4 }
    })
    const graphics = await engine.execute({
      type: 'create-object',
      requestId: 'graphics',
      objectType: 'graphics'
    })
    const resource = await engine.execute({
      type: 'create-resource',
      requestId: 'paint',
      descriptor: { kind: 'paint', data: { color: 0xff0000 } }
    })
    const containerHandle = container.object
    const graphicsHandle = graphics.object
    if (!containerHandle || !graphicsHandle) {
      throw new Error('Expected Pixi object handles')
    }

    await engine.execute({
      type: 'append-child',
      parent: initialized.root,
      child: containerHandle
    })
    await engine.execute({
      type: 'append-child',
      parent: containerHandle,
      child: graphicsHandle
    })
    await engine.execute({
      type: 'draw',
      object: graphicsHandle,
      operations: [
        { type: 'clear' },
        { type: 'rect', x: 1, y: 2, width: 20, height: 10 },
        { type: 'move-to', x: 1, y: 2 },
        { type: 'line-to', x: 3, y: 4 },
        {
          type: 'bezier-curve-to',
          controlPoint1: { x: 1, y: 2 },
          controlPoint2: { x: 3, y: 4 },
          destination: { x: 5, y: 6 }
        },
        { type: 'close-path' },
        { type: 'fill', paint: { resource: resource.resource } },
        { type: 'stroke', paint: { color: '#000000' }, width: 2 }
      ]
    })
    await engine.execute({
      type: 'update-object',
      object: graphicsHandle,
      properties: { x: 12, y: 24, visible: false, scaleX: 2, scaleY: 3 }
    })
    await engine.execute({
      type: 'set-viewport',
      position: { x: 30, y: 40 },
      scale: { x: 1.5, y: 1.5 }
    })
    await engine.execute({ type: 'resize', width: 640, height: 480 })
    await engine.execute({ type: 'flush' })

    const graphic = pixiState.graphics[0]
    expect(graphic.drawOperations.map((item) => item.type)).toEqual([
      'clear',
      'rect',
      'move-to',
      'line-to',
      'bezier-curve-to',
      'close-path',
      'fill',
      'stroke'
    ])
    expect(graphic).toMatchObject({ x: 12, y: 24, visible: false })
    expect(graphic.scale.set).toHaveBeenCalledWith(2, 3)
    expect(app.stage.position.set).toHaveBeenCalledWith(30, 40)
    expect(app.renderer.resize).toHaveBeenCalledWith(640, 480)
    expect(app.render).toHaveBeenCalledOnce()

    const local = await engine.query({
      type: 'to-local',
      object: graphicsHandle,
      point: { x: 20, y: 30 }
    })
    expect(local).toEqual({ type: 'point', point: { x: 8, y: 6 } })

    const frame = vi.fn()
    engine.startFrameLoop(frame)
    expect(app.ticker.add).toHaveBeenCalledWith(expect.any(Function))
    engine.stopFrameLoop()
    expect(app.ticker.remove).toHaveBeenCalledWith(expect.any(Function))
  })

  it('normalizes Pixi pointer events to opaque handles', async () => {
    const engine = new PixiRenderEngine()
    await engine.initialize({ host: {}, width: 10, height: 10 })
    const graphics = await engine.execute({
      type: 'create-object',
      requestId: 'event-target',
      objectType: 'graphics'
    })
    const events: RenderEngineInteractionEvent[] = []
    engine.subscribeToInteraction((event) => events.push(event))
    const graphicsHandle = graphics.object
    if (!graphicsHandle) {
      throw new Error('Expected a Pixi interaction object handle')
    }

    getLastApplication().stage.emit('pointerdown', {
      type: 'pointerdown',
      pointerId: 9,
      button: 1,
      buttons: 2,
      global: { x: 14, y: 28 },
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      target: pixiState.graphics[0],
      timeStamp: 99
    })

    expect(events).toEqual([
      {
        type: 'pointerdown',
        pointerId: 9,
        button: 1,
        buttons: 2,
        position: { x: 14, y: 28 },
        modifiers: {
          altKey: true,
          ctrlKey: false,
          metaKey: false,
          shiftKey: true
        },
        target: graphicsHandle,
        timestamp: 99
      }
    ])
  })

  it('translates abstract gradient and raster descriptors into Pixi fill resources', async () => {
    const engine = new PixiRenderEngine()
    await engine.initialize({ host: {}, width: 10, height: 10 })
    const graphics = await engine.execute({
      type: 'create-object',
      requestId: 'resource-graphics',
      objectType: 'graphics'
    })
    const gradient = await engine.execute({
      type: 'create-resource',
      requestId: 'gradient',
      descriptor: {
        kind: 'gradient',
        data: {
          type: 'linear',
          start: { x: 0.2, y: 0.3 },
          end: { x: 0.8, y: 0.9 },
          colorStops: [
            { offset: 0, color: '#ffffff' },
            { offset: 1, color: '#000000' }
          ],
          textureSpace: 'local'
        }
      }
    })
    const rasterSource = { kind: 'offscreen-canvas' }
    const raster = await engine.execute({
      type: 'create-resource',
      requestId: 'raster-pattern',
      descriptor: {
        kind: 'raster-pattern',
        data: {
          source: rasterSource,
          width: 4,
          height: 8,
          repeat: 'no-repeat',
          scale: { x: 0.25, y: 0.125 }
        }
      }
    })
    if (!graphics.object || !gradient.resource || !raster.resource) {
      throw new Error('Expected Pixi resource handles')
    }

    await engine.execute({
      type: 'draw',
      object: graphics.object,
      operations: [
        { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
        { type: 'fill', paint: { resource: gradient.resource } },
        { type: 'fill', paint: { resource: raster.resource } }
      ]
    })

    expect(pixiState.gradients).toHaveLength(1)
    expect(pixiState.gradients[0].options).toMatchObject({
      type: 'linear',
      colorStops: [
        { offset: 0, color: '#ffffff' },
        { offset: 1, color: '#000000' }
      ],
      textureSpace: 'local'
    })
    expect(pixiState.gradients[0].transform).toBeDefined()
    expect(pixiState.patterns).toHaveLength(1)
    expect(pixiState.patterns[0].repeat).toBe('no-repeat')
    expect(pixiState.patterns[0].transform?.operations).toContainEqual({
      type: 'scale',
      args: [0.25, 0.125]
    })
    expect(pixiState.graphics[0].drawOperations.at(-2)?.args[0]).toBe(
      pixiState.gradients[0]
    )
    expect(pixiState.graphics[0].drawOperations.at(-1)?.args[0]).toBe(
      pixiState.patterns[0]
    )

    await engine.execute({
      type: 'destroy-resource',
      resource: raster.resource
    })
    expect(pixiState.textures.at(-1)?.destroy).toHaveBeenCalledOnce()
    await engine.execute({
      type: 'destroy-resource',
      resource: gradient.resource
    })
    expect(pixiState.gradients[0].destroy).toHaveBeenCalledOnce()
  })

  it('updates Pixi mesh geometry and engine-facing object properties', async () => {
    const engine = new PixiRenderEngine()
    await engine.initialize({ host: {}, width: 10, height: 10 })
    const mesh = await engine.execute({
      type: 'create-object',
      requestId: 'mesh',
      objectType: 'mesh',
      properties: {
        geometry: {
          positions: new Float32Array([0, 0, 1, 0, 1, 1]),
          indices: new Uint32Array([0, 1, 2]),
          uvs: new Float32Array([0, 0, 1, 0, 1, 1])
        }
      }
    })
    if (!mesh.object) {
      throw new Error('Expected Pixi mesh handle')
    }
    const positions = new Float32Array([0, 0, 2, 0, 2, 2, 0, 2])
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3])
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])

    await engine.execute({
      type: 'update-object',
      object: mesh.object,
      properties: {
        geometry: { positions, indices, uvs },
        cursor: 'pointer',
        width: 20,
        height: 30,
        batched: false
      }
    })

    const pixiMesh = pixiState.meshes[0]
    expect(pixiMesh.geometry.positions).toEqual(positions)
    expect(pixiMesh.geometry.indices).toEqual(indices)
    expect(pixiMesh.geometry.uvs).toEqual(uvs)
    expect(pixiMesh.geometry.positionUpdate).toHaveBeenCalledOnce()
    expect(pixiMesh.geometry.uvUpdate).toHaveBeenCalledOnce()
    expect(pixiMesh.geometry.indexUpdate).toHaveBeenCalledOnce()
    expect(pixiMesh).toMatchObject({
      cursor: 'pointer',
      width: 20,
      height: 30,
      batched: false
    })
  })

  it('creates procedural Pixi resources for radial, angular, and diamond gradients', async () => {
    class TestOffscreenCanvas {
      readonly context = {
        clearRect: () => undefined,
        fillRect: () => undefined,
        fillStyle: '',
        getImageData: () => ({ data: new Uint8ClampedArray([255, 0, 0, 255]) }),
        createImageData: (width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4)
        }),
        putImageData: () => undefined
      }

      constructor(
        readonly width: number,
        readonly height: number
      ) {}

      getContext(): typeof this.context {
        return this.context
      }
    }
    vi.stubGlobal('OffscreenCanvas', TestOffscreenCanvas)
    const engine = new PixiRenderEngine()
    await engine.initialize({ host: {}, width: 10, height: 10 })
    const resources = []

    for (const type of ['radial', 'angular', 'diamond'] as const) {
      const resource = await engine.execute({
        type: 'create-resource',
        requestId: type,
        descriptor: {
          kind: 'gradient',
          data: {
            type,
            start: { x: 0.5, y: 0.5 },
            end: { x: 1, y: 0.5 },
            colorStops: [
              { offset: 0, color: '#ff0000' },
              { offset: 1, color: '#0000ff' }
            ]
          }
        }
      })
      if (!resource.resource) {
        throw new Error(`Expected ${type} Pixi resource handle`)
      }
      resources.push(resource.resource)
    }

    expect(pixiState.patterns).toHaveLength(3)
    resources.forEach((resource) => {
      engine.execute({ type: 'destroy-resource', resource })
    })
    expect(
      pixiState.textures
        .slice(-3)
        .every((texture) =>
          vi.mocked(texture.destroy).mock.calls.some((call) => call[0] === true)
        )
    ).toBe(true)
  })

  it('isolates instances and cleans partial initialization deterministically', async () => {
    const first = new PixiRenderEngine()
    const second = new PixiRenderEngine()
    await first.initialize({ host: {}, width: 10, height: 10 })
    await second.initialize({ host: {}, width: 20, height: 20 })
    await first.execute({
      type: 'create-object',
      requestId: 'first',
      objectType: 'container'
    })
    await second.execute({
      type: 'create-object',
      requestId: 'second',
      objectType: 'container'
    })
    await second.execute({
      type: 'create-resource',
      requestId: 'second-texture',
      descriptor: { kind: 'texture', data: { source: 'texture-source' } }
    })

    expect(await first.destroy()).toEqual({
      destroyedObjects: 1,
      destroyedResources: 0,
      alreadyDestroyed: false
    })
    expect(pixiState.applications[0].destroy).toHaveBeenCalledOnce()
    expect(pixiState.applications[1].destroy).not.toHaveBeenCalled()
    expect(await second.destroy()).toEqual({
      destroyedObjects: 1,
      destroyedResources: 1,
      alreadyDestroyed: false
    })
    expect(pixiState.textures[0].destroy).toHaveBeenCalledOnce()

    pixiState.nextInitError = new Error('pixi init failed')
    const partial = new PixiRenderEngine()
    await expect(
      partial.initialize({ host: {}, width: 30, height: 30 })
    ).rejects.toThrow('pixi init failed')
    const partialApp = getLastApplication()
    expect(partialApp.destroy).toHaveBeenCalledOnce()
    expect(await partial.destroy()).toEqual({
      destroyedObjects: 0,
      destroyedResources: 0,
      alreadyDestroyed: false
    })
    expect(await partial.destroy()).toEqual({
      destroyedObjects: 0,
      destroyedResources: 0,
      alreadyDestroyed: true
    })
  })
})
