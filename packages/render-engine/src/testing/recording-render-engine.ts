import {
  RenderEngineCapabilities,
  assertRenderEngineCapabilities
} from '../capabilities'
import type {
  RenderEngine,
  RenderEngineCapability,
  RenderEngineCommand,
  RenderEngineCommandResult,
  RenderEngineDestroyResult,
  RenderEngineFrameCallback,
  RenderEngineInitializeOptions,
  RenderEngineInitializeResult,
  RenderEngineInteractionEvent,
  RenderEngineInteractionListener,
  RenderEngineObjectHandle,
  RenderEnginePoint,
  RenderEngineQuery,
  RenderEngineQueryResult,
  RenderEngineResourceHandle
} from '../types'

type StoredObjectHandle = RenderEngineObjectHandle &
  Readonly<{ kind: 'object'; id: string }>

type StoredResourceHandle = RenderEngineResourceHandle &
  Readonly<{ kind: 'resource'; id: string }>

export type RecordingRenderEngineOperation =
  | Readonly<{ type: 'initialize'; options: RenderEngineInitializeOptions }>
  | Readonly<{
      type: RenderEngineCommand['type']
      command: RenderEngineCommand
    }>
  | Readonly<{ type: 'destroy'; result: RenderEngineDestroyResult }>

export type RecordingRenderEngineOptions = Readonly<{
  name: string
  capabilities?: readonly RenderEngineCapability[]
}>

export class RecordingRenderEngine implements RenderEngine {
  readonly name: string
  readonly capabilities: ReadonlySet<RenderEngineCapability>

  private readonly operations: RecordingRenderEngineOperation[] = []
  private readonly objects = new Map<
    RenderEngineObjectHandle,
    StoredObjectHandle
  >()
  private readonly resources = new Map<
    RenderEngineResourceHandle,
    StoredResourceHandle
  >()
  private readonly interactionListeners =
    new Set<RenderEngineInteractionListener>()
  private frameCallback: RenderEngineFrameCallback | null = null
  private initialized = false
  private destroyed = false
  private nextHandleId = 1

  constructor(options: RecordingRenderEngineOptions) {
    this.name = options.name
    this.capabilities = new Set(
      options.capabilities ?? Object.values(RenderEngineCapabilities)
    )
  }

  initialize(
    options: RenderEngineInitializeOptions
  ): RenderEngineInitializeResult {
    this.assertActive()
    this.initialized = true
    this.operations.push({ type: 'initialize', options })

    return {
      surface: Object.freeze({ engineName: this.name }),
      inputTarget: Object.freeze({ engineName: this.name })
    }
  }

  execute(command: RenderEngineCommand): RenderEngineCommandResult {
    this.assertReady()
    const result = this.applyCommand(command)
    this.operations.push({ type: command.type, command })
    return result
  }

  query(query: RenderEngineQuery): RenderEngineQueryResult {
    this.assertReady()

    switch (query.type) {
      case 'get-bounds':
        this.assertOwnedObject(query.object)
        return {
          type: 'bounds',
          bounds: { x: 0, y: 0, width: 0, height: 0 }
        }
      case 'to-local':
      case 'to-global':
        this.assertOwnedObject(query.object)
        return { type: 'point', point: query.point }
      case 'hit-test':
        return { type: 'hit', target: null, point: query.point }
    }
  }

  subscribeToInteraction(
    listener: RenderEngineInteractionListener
  ): () => void {
    this.assertActive()
    this.interactionListeners.add(listener)
    return () => {
      this.interactionListeners.delete(listener)
    }
  }

  startFrameLoop(callback: RenderEngineFrameCallback): void {
    this.assertReady()
    this.frameCallback = callback
  }

  stopFrameLoop(): void {
    this.frameCallback = null
  }

  emitInteraction(event: RenderEngineInteractionEvent): void {
    this.assertReady()
    for (const listener of this.interactionListeners) {
      listener(event)
    }
  }

  emitFrame(timestamp: number): void {
    this.assertReady()
    this.frameCallback?.(timestamp)
  }

  destroy(): RenderEngineDestroyResult {
    if (this.destroyed) {
      return {
        destroyedObjects: 0,
        destroyedResources: 0,
        alreadyDestroyed: true
      }
    }

    const result: RenderEngineDestroyResult = {
      destroyedObjects: this.objects.size,
      destroyedResources: this.resources.size,
      alreadyDestroyed: false
    }
    this.objects.clear()
    this.resources.clear()
    this.interactionListeners.clear()
    this.frameCallback = null
    this.destroyed = true
    this.operations.push({ type: 'destroy', result })
    return result
  }

  getOperations(): readonly RecordingRenderEngineOperation[] {
    return this.operations
  }

  getOwnedObjectCount(): number {
    return this.objects.size
  }

  getOwnedResourceCount(): number {
    return this.resources.size
  }

  private applyCommand(
    command: RenderEngineCommand
  ): RenderEngineCommandResult {
    switch (command.type) {
      case 'create-object': {
        assertRenderEngineCapabilities(this, [RenderEngineCapabilities.OBJECTS])
        if (command.objectType === 'graphics') {
          assertRenderEngineCapabilities(this, [
            RenderEngineCapabilities.GRAPHICS
          ])
        }
        const object = this.createObjectHandle(command.requestId)
        this.objects.set(object, object)
        return { commandType: command.type, status: 'applied', object }
      }
      case 'update-object':
      case 'destroy-object':
        this.assertOwnedObject(command.object)
        if (command.type === 'destroy-object') {
          this.objects.delete(command.object)
        }
        return { commandType: command.type, status: 'applied' }
      case 'append-child':
      case 'remove-child':
      case 'set-child-index':
        this.assertOwnedObject(command.parent)
        this.assertOwnedObject(command.child)
        return { commandType: command.type, status: 'applied' }
      case 'draw':
        assertRenderEngineCapabilities(this, [
          RenderEngineCapabilities.GRAPHICS
        ])
        this.assertOwnedObject(command.object)
        return { commandType: command.type, status: 'applied' }
      case 'create-resource': {
        assertRenderEngineCapabilities(this, [
          RenderEngineCapabilities.RESOURCES
        ])
        const resource = this.createResourceHandle(command.requestId)
        this.resources.set(resource, resource)
        return { commandType: command.type, status: 'applied', resource }
      }
      case 'destroy-resource':
        this.assertOwnedResource(command.resource)
        this.resources.delete(command.resource)
        return { commandType: command.type, status: 'applied' }
      case 'resize':
      case 'set-viewport':
      case 'flush':
        return { commandType: command.type, status: 'applied' }
    }
  }

  private createObjectHandle(requestId: string): StoredObjectHandle {
    return Object.freeze({
      kind: 'object',
      id: `${requestId}:${this.nextHandleId++}`
    }) as StoredObjectHandle
  }

  private createResourceHandle(requestId: string): StoredResourceHandle {
    return Object.freeze({
      kind: 'resource',
      id: `${requestId}:${this.nextHandleId++}`
    }) as StoredResourceHandle
  }

  private assertOwnedObject(handle: RenderEngineObjectHandle): void {
    if (!this.objects.has(handle)) {
      throw new Error(`Render engine "${this.name}" does not own object handle`)
    }
  }

  private assertOwnedResource(handle: RenderEngineResourceHandle): void {
    if (!this.resources.has(handle)) {
      throw new Error(
        `Render engine "${this.name}" does not own resource handle`
      )
    }
  }

  private assertReady(): void {
    this.assertActive()
    if (!this.initialized) {
      throw new Error(`Render engine "${this.name}" is not initialized`)
    }
  }

  private assertActive(): void {
    if (this.destroyed) {
      throw new Error(`Render engine "${this.name}" is destroyed`)
    }
  }
}
