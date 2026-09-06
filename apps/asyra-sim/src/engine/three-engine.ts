import * as THREE from 'three'
import { RenderEngineCapabilities } from '@asyra/render-engine'
import type {
  RenderEngine,
  RenderEngineCommand,
  RenderEngineCommandResult,
  RenderEngineInitializeOptions,
  RenderEngineInitializeResult,
  RenderEngineDestroyResult,
  RenderEngineObjectHandle,
  RenderEngineResourceHandle,
  RenderEngineObjectProperties,
  RenderEngineQuery,
  RenderEngineQueryResult,
  RenderEngineInteractionEvent,
  RenderEngineInteractionListener,
  RenderEngineFrameCallback,
  RenderEnginePaint,
  RenderEnginePoint
} from '@asyra/render-engine'
import {
  readSpatialDescriptor,
  sameSpatialShape,
  SPATIAL_CAPABILITY,
  SPATIAL_PROPERTY,
  type SpatialDescriptor,
  type SpatialShape
} from './spatial-contract'
import { disposeObject, drawGraphics } from './graphics'

export interface GraphicsDriver {
  domElement: HTMLCanvasElement
  autoClear: boolean
  setSize(width: number, height: number, updateStyle?: boolean): void
  setPixelRatio(ratio: number): void
  setClearColor(color: number | string, alpha?: number): void
  clear(): void
  clearDepth(): void
  render(scene: THREE.Scene, camera: THREE.Camera): void
  dispose(): void
}

interface EnginePlatform {
  createDriver?: () => GraphicsDriver
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (id: number) => void
}

const createDefaultDriver = (): GraphicsDriver => {
  const driver = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  driver.toneMapping = THREE.ACESFilmicToneMapping
  driver.shadowMap.enabled = true
  driver.shadowMap.type = THREE.PCFSoftShadowMap
  return driver
}

interface ObjectRecord {
  handle: RenderEngineObjectHandle
  type: 'container' | 'graphics' | 'mesh'
  properties: RenderEngineObjectProperties
  spatial?: SpatialDescriptor
  visual: THREE.Group
  content: THREE.Object3D | null
  parent: ObjectRecord | null
  children: ObjectRecord[]
}

const makeGeometry = (shape: SpatialShape): THREE.BufferGeometry => {
  switch (shape.kind) {
    case 'box':
      return new THREE.BoxGeometry(...shape.size)
    case 'sphere':
      return new THREE.SphereGeometry(shape.radius, 32, 20)
    case 'capsule':
      return new THREE.CapsuleGeometry(shape.radius, shape.length, 8, 24)
    case 'triangles': {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(shape.positions, 3)
      )
      geometry.setIndex([...shape.indices])
      geometry.computeVertexNormals()
      return geometry
    }
  }
}

const numberProperty = (
  properties: RenderEngineObjectProperties,
  key: string,
  fallback: number
) => {
  const value = properties[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`Invalid render property: ${key}`)
  return value
}

const SCREEN_PROPERTIES = new Set([
  'x',
  'y',
  'width',
  'height',
  'scaleX',
  'scaleY',
  'skewX',
  'skewY',
  'visible',
  'renderable',
  'label',
  'alpha',
  'angle',
  'rotation',
  'zIndex',
  'eventMode',
  'cursor',
  'batched',
  SPATIAL_PROPERTY
])

/** A CUSTOM visual engine. It owns no editable state or analysis semantics. */
export class ThreeEngine implements RenderEngine {
  readonly name = 'Asyra Sim CUSTOM Three.js 0.185.1'
  readonly capabilities = new Set([
    ...Object.values(RenderEngineCapabilities),
    SPATIAL_CAPABILITY
  ])
  private readonly objects = new Map<RenderEngineObjectHandle, ObjectRecord>()
  private readonly resources = new Map<
    RenderEngineResourceHandle,
    { color: number | string; alpha: number }
  >()
  private readonly listeners = new Set<RenderEngineInteractionListener>()
  private readonly scene = new THREE.Scene()
  private readonly screen = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000)
  private readonly screenCamera = new THREE.OrthographicCamera(
    0,
    1,
    0,
    1,
    -10000,
    10000
  )
  private driver: GraphicsDriver | null = null
  private root: ObjectRecord | null = null
  private width = 1
  private height = 1
  private frame: number | null = null
  private frameGeneration = 0
  private destroyed = false
  private readonly pointerDisposers: (() => void)[] = []

  constructor(private readonly platform: EnginePlatform = {}) {
    this.camera.position.set(3, 2, 3)
    this.camera.lookAt(0, 0, 0)
    this.screenCamera.position.z = 100
  }

  initialize(
    options: RenderEngineInitializeOptions
  ): RenderEngineInitializeResult {
    if (this.destroyed || this.driver)
      throw new Error('Engine is not available for initialization')
    this.validateSize(options.width, options.height)
    try {
      this.driver = this.platform.createDriver?.() ?? createDefaultDriver()
      this.driver.autoClear = false
      this.driver.setPixelRatio(
        Math.min(options.resolution ?? globalThis.devicePixelRatio ?? 1, 2)
      )
      this.driver.setClearColor(options.backgroundColor ?? 0x101b29, 1)
      this.resize(options.width, options.height)
      this.root = this.create('container', {})
      this.scene.add(new THREE.HemisphereLight(0xd7eaff, 0x4b5366, 1.3))
      const key = new THREE.DirectionalLight(0xfff3e5, 2.6)
      key.position.set(3, 6, 4)
      key.castShadow = true
      key.shadow.mapSize.set(1024, 1024)
      Object.assign(key.shadow.camera, {
        left: -4,
        right: 4,
        top: 4,
        bottom: -4,
        near: 0.1,
        far: 20
      })
      key.shadow.normalBias = 0.005
      this.scene.add(key)
      const fill = new THREE.DirectionalLight(0xb6d5f5, 1.2)
      fill.position.set(-3, 3, -4)
      this.scene.add(fill)
      this.attachPointerListeners(this.driver.domElement)
      return {
        surface: this.driver.domElement,
        inputTarget: this.driver.domElement,
        runtime: Object.freeze({ name: this.name }),
        root: this.root.handle
      }
    } catch (error) {
      this.destroy()
      throw error
    }
  }

  execute(command: RenderEngineCommand): RenderEngineCommandResult {
    this.assertActive()
    let object: RenderEngineObjectHandle | undefined
    let resource: RenderEngineResourceHandle | undefined
    let status: 'applied' | 'noop' = 'applied'
    switch (command.type) {
      case 'create-object':
        object = this.create(
          command.objectType,
          command.properties ?? {}
        ).handle
        break
      case 'update-object':
        this.update(this.owned(command.object), command.properties)
        break
      case 'destroy-object':
        this.remove(this.owned(command.object))
        break
      case 'append-child': {
        const parent = this.owned(command.parent),
          child = this.owned(command.child)
        for (
          let current: ObjectRecord | null = parent;
          current;
          current = current.parent
        ) {
          if (current === child) throw new Error('Render hierarchy cycle')
        }
        if (child === this.root)
          throw new Error('Cannot reparent the engine root')
        this.detach(child)
        child.parent = parent
        parent.children.push(child)
        break
      }
      case 'remove-child': {
        const parent = this.owned(command.parent),
          child = this.owned(command.child)
        if (child.parent === parent) this.detach(child)
        else status = 'noop'
        break
      }
      case 'set-child-index': {
        const parent = this.owned(command.parent),
          child = this.owned(command.child)
        if (
          child.parent !== parent ||
          !Number.isInteger(command.index) ||
          command.index < 0 ||
          command.index >= parent.children.length
        )
          throw new Error('Invalid child index')
        parent.children.splice(parent.children.indexOf(child), 1)
        parent.children.splice(command.index, 0, child)
        break
      }
      case 'draw': {
        const record = this.owned(command.object)
        if (record.type !== 'graphics')
          throw new Error('Draw requires a graphics object')
        const content = drawGraphics(command.operations, (paint) =>
          this.paint(paint)
        )
        this.replaceContent(record, content)
        break
      }
      case 'create-resource': {
        if (command.descriptor.kind !== 'paint')
          throw new Error('Unsupported resource descriptor')
        const value = command.descriptor.data as RenderEnginePaint
        const paint = this.paint(value)
        resource = Object.freeze({}) as RenderEngineResourceHandle
        this.resources.set(resource, paint)
        break
      }
      case 'destroy-resource':
        if (!this.resources.delete(command.resource))
          throw new Error('Foreign or destroyed resource handle')
        break
      case 'resize':
        this.resize(command.width, command.height)
        break
      case 'set-viewport':
        if (
          ![
            command.position.x,
            command.position.y,
            command.scale.x,
            command.scale.y
          ].every(Number.isFinite)
        )
          throw new Error('Invalid screen viewport')
        this.screen.position.set(command.position.x, command.position.y, 0)
        this.screen.scale.set(command.scale.x, command.scale.y, 1)
        break
      case 'flush':
        this.syncProjection()
        this.requireDriver().clear()
        this.requireDriver().render(this.scene, this.camera)
        this.requireDriver().clearDepth()
        this.requireDriver().render(this.screen, this.screenCamera)
        break
    }
    return { commandType: command.type, status, object, resource }
  }

  query(query: RenderEngineQuery): RenderEngineQueryResult {
    this.assertActive()
    this.syncProjection()
    if (query.type === 'hit-test')
      return { type: 'hit', target: this.pick(query.point), point: query.point }
    const record = this.owned(query.object)
    if (query.type === 'get-bounds') {
      const bounds = new THREE.Box3().setFromObject(record.visual)
      if (bounds.isEmpty())
        return { type: 'bounds', bounds: { x: 0, y: 0, width: 0, height: 0 } }
      const points: THREE.Vector3[] = []
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            points.push(new THREE.Vector3(x, y, z))
      if (record.spatial)
        points.forEach((p) => {
          p.project(this.camera)
          p.set(((p.x + 1) * this.width) / 2, ((1 - p.y) * this.height) / 2, 0)
        })
      const minX = Math.min(...points.map((p) => p.x)),
        minY = Math.min(...points.map((p) => p.y))
      return {
        type: 'bounds',
        bounds: {
          x: minX,
          y: minY,
          width: Math.max(...points.map((p) => p.x)) - minX,
          height: Math.max(...points.map((p) => p.y)) - minY
        }
      }
    }
    if (record.spatial)
      throw new Error(
        'Spatial local/global conversion requires an explicit 3D contract; screen queries are not 3D poses'
      )
    const point = new THREE.Vector3(query.point.x, query.point.y, 0)
    if (query.type === 'to-local') record.visual.worldToLocal(point)
    else record.visual.localToWorld(point)
    return { type: 'point', point: { x: point.x, y: point.y } }
  }

  subscribeToInteraction(
    listener: RenderEngineInteractionListener
  ): () => void {
    if (this.destroyed) throw new Error('Engine is not active')
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispatchInteraction(event: RenderEngineInteractionEvent): void {
    this.assertActive()
    if (event.target) this.owned(event.target)
    for (const listener of [...this.listeners]) listener(event)
  }

  requestFrame(callback: RenderEngineFrameCallback): void {
    this.assertActive()
    this.cancelFrame()
    const request =
      this.platform.requestFrame ??
      globalThis.requestAnimationFrame.bind(globalThis)
    const generation = ++this.frameGeneration
    this.frame = request((time) => {
      if (this.destroyed || generation !== this.frameGeneration) return
      this.frame = null
      this.frameGeneration++
      callback(time)
    })
  }

  cancelFrame(): void {
    this.frameGeneration++
    if (this.frame === null) return
    const cancel =
      this.platform.cancelFrame ??
      globalThis.cancelAnimationFrame.bind(globalThis)
    cancel(this.frame)
    this.frame = null
  }

  destroy(): RenderEngineDestroyResult {
    if (this.destroyed)
      return {
        destroyedObjects: 0,
        destroyedResources: 0,
        alreadyDestroyed: true
      }
    this.cancelFrame()
    const result = {
      destroyedObjects: this.objects.size,
      destroyedResources: this.resources.size,
      alreadyDestroyed: false
    }
    this.destroyed = true
    this.pointerDisposers.splice(0).forEach((dispose) => dispose())
    this.listeners.clear()
    for (const record of this.objects.values()) disposeObject(record.visual)
    this.objects.clear()
    this.resources.clear()
    this.scene.traverse((object) => {
      if (object instanceof THREE.Light) object.dispose()
    })
    this.scene.clear()
    this.screen.clear()
    this.driver?.dispose()
    this.driver = null
    this.root = null
    return result
  }

  private assertActive(): void {
    if (this.destroyed || !this.driver) throw new Error('Engine is not active')
  }
  private requireDriver(): GraphicsDriver {
    this.assertActive()
    if (!this.driver) throw new Error('Engine driver is unavailable')
    return this.driver
  }
  private owned(handle: RenderEngineObjectHandle): ObjectRecord {
    const record = this.objects.get(handle)
    if (!record) throw new Error('Foreign or destroyed object handle')
    return record
  }
  private create(
    type: ObjectRecord['type'],
    properties: RenderEngineObjectProperties
  ): ObjectRecord {
    const record: ObjectRecord = {
      handle: Object.freeze({}) as RenderEngineObjectHandle,
      type,
      properties: {},
      visual: new THREE.Group(),
      content: null,
      parent: null,
      children: []
    }
    try {
      this.update(record, properties)
    } catch (error) {
      disposeObject(record.visual)
      throw error
    }
    this.objects.set(record.handle, record)
    return record
  }
  private update(
    record: ObjectRecord,
    patch: RenderEngineObjectProperties
  ): void {
    const properties = { ...record.properties, ...patch }
    for (const key of Object.keys(properties))
      if (!SCREEN_PROPERTIES.has(key))
        throw new Error(`Unsupported screen property: ${key}`)
    if (
      numberProperty(properties, 'skewX', 0) !== 0 ||
      numberProperty(properties, 'skewY', 0) !== 0 ||
      numberProperty(properties, 'alpha', 1) !== 1
    )
      throw new Error(
        'Unsupported screen skew or alpha; use spatial appearance for 3D meshes'
      )
    const spatial =
      properties[SPATIAL_PROPERTY] === undefined
        ? undefined
        : readSpatialDescriptor(properties[SPATIAL_PROPERTY])
    if (spatial?.kind === 'camera' && record.type !== 'container')
      throw new Error('Camera requires a spatial container')
    if (spatial?.kind === 'mesh' && record.type !== 'mesh')
      throw new Error('Spatial geometry requires a mesh')
    if (record.type === 'mesh' && spatial?.kind !== 'mesh')
      throw new Error('CUSTOM meshes require an explicit spatial descriptor')
    const x = numberProperty(properties, 'x', 0),
      y = numberProperty(properties, 'y', 0)
    const sx = numberProperty(properties, 'scaleX', 1),
      sy = numberProperty(properties, 'scaleY', 1)
    const rotation = numberProperty(properties, 'rotation', 0)
    const order = numberProperty(properties, 'zIndex', 0)
    let content: THREE.Object3D | null = null
    if (
      spatial?.kind === 'mesh' &&
      Object.hasOwn(patch, SPATIAL_PROPERTY) &&
      !(
        record.spatial?.kind === 'mesh' &&
        record.content instanceof THREE.Mesh &&
        sameSpatialShape(record.spatial.shape, spatial.shape)
      )
    ) {
      content = new THREE.Mesh(
        makeGeometry(spatial.shape),
        new THREE.MeshStandardMaterial({
          color: spatial.color,
          opacity: spatial.opacity,
          transparent: spatial.opacity < 1,
          wireframe: spatial.wireframe,
          side: THREE.DoubleSide,
          roughness: 0.65,
          metalness: 0.12,
          depthWrite: spatial.opacity >= 1
        })
      )
    }
    record.properties = properties
    record.spatial = spatial
    if (content) this.replaceContent(record, content)
    if (spatial?.kind === 'mesh') {
      if (record.content instanceof THREE.Mesh) {
        record.content.castShadow =
          spatial.selectable && spatial.opacity === 1 && !spatial.wireframe
        record.content.receiveShadow = !spatial.wireframe
        const material = record.content.material as THREE.MeshStandardMaterial
        const transparent = spatial.opacity < 1
        if (
          material.transparent !== transparent ||
          material.wireframe !== spatial.wireframe
        )
          material.needsUpdate = true
        material.color.setHex(spatial.color)
        material.opacity = spatial.opacity
        material.transparent = transparent
        material.depthWrite = !transparent
        material.wireframe = spatial.wireframe
      }
      record.visual.position.fromArray(spatial.position)
      record.visual.quaternion.fromArray(spatial.rotation)
      record.visual.scale.set(1, 1, 1)
    } else {
      record.visual.position.set(x, y, 0)
      record.visual.rotation.set(0, 0, rotation)
      record.visual.scale.set(sx, sy, 1)
    }
    record.visual.renderOrder = order
  }
  private replaceContent(record: ObjectRecord, content: THREE.Object3D): void {
    if (record.content) disposeObject(record.content)
    record.content = content
    record.visual.add(content)
  }
  private detach(record: ObjectRecord): void {
    if (record.parent)
      record.parent.children.splice(record.parent.children.indexOf(record), 1)
    record.parent = null
    record.visual.removeFromParent()
  }
  private remove(record: ObjectRecord): void {
    if (record === this.root)
      throw new Error('Use destroy to release the engine root')
    this.detach(record)
    for (const child of [...record.children]) this.detach(child)
    disposeObject(record.visual)
    this.objects.delete(record.handle)
  }
  private validateSize(width: number, height: number): void {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      width > 16384 ||
      height > 16384
    )
      throw new Error('Invalid surface size')
  }
  private resize(width: number, height: number): void {
    this.validateSize(width, height)
    this.width = width
    this.height = height
    this.requireDriver().setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.screenCamera.right = width
    this.screenCamera.bottom = height
    this.screenCamera.updateProjectionMatrix()
  }
  private syncProjection(): void {
    let cameraCount = 0
    const walk = (
      record: ObjectRecord,
      visible: boolean,
      screenParent: THREE.Object3D
    ) => {
      const shown =
        visible &&
        record.properties.visible !== false &&
        record.properties.renderable !== false
      record.visual.visible = shown
      if (record.spatial) {
        this.scene.add(record.visual)
        if (record.spatial.kind === 'camera' && shown) {
          if (++cameraCount > 1)
            throw new Error('Only one active spatial camera is supported')
          const camera = record.spatial
          this.camera.position.fromArray(camera.position)
          this.camera.lookAt(...camera.target)
          this.camera.fov = camera.fov
          this.camera.near = camera.near
          this.camera.far = camera.far
          this.camera.updateProjectionMatrix()
        }
      } else screenParent.add(record.visual)
      record.children.forEach((child) =>
        walk(child, shown, record.spatial ? screenParent : record.visual)
      )
    }
    for (const record of this.objects.values()) record.visual.removeFromParent()
    if (this.root) walk(this.root, true, this.screen)
    this.scene.updateMatrixWorld(true)
    this.screen.updateMatrixWorld(true)
    this.camera.updateMatrixWorld(true)
    this.screenCamera.updateMatrixWorld(true)
  }
  private pick(point: RenderEnginePoint): RenderEngineObjectHandle | null {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
      throw new Error('Invalid screen point')
    const ray = new THREE.Raycaster()
    const screenPoint = new THREE.Vector2(
      (point.x / this.width) * 2 - 1,
      1 - (point.y / this.height) * 2
    )
    ray.setFromCamera(screenPoint, this.screenCamera)
    const screenRecords = [...this.objects.values()].filter(
      (record) =>
        !record.spatial &&
        record.type === 'graphics' &&
        record.visual.visible &&
        record.visual.parent !== null &&
        record.properties.eventMode !== 'none'
    )
    const screenHits = ray.intersectObjects(
      screenRecords.map((record) => record.visual),
      true
    )
    for (const intersection of screenHits) {
      for (
        let visual: THREE.Object3D | null = intersection.object;
        visual;
        visual = visual.parent
      ) {
        const record = screenRecords.find((item) => item.visual === visual)
        if (record) return record.handle
      }
    }
    ray.setFromCamera(screenPoint, this.camera)
    const eligible = [...this.objects.values()].filter(
      (record) =>
        record.spatial?.kind === 'mesh' &&
        record.spatial.selectable &&
        record.visual.visible &&
        record.visual.parent === this.scene
    )
    const hits = ray.intersectObjects(
      eligible.map((record) => record.visual),
      true
    )
    for (const hit of hits) {
      const record = eligible.find((item) => item.visual === hit.object.parent)
      if (record) return record.handle
    }
    return null
  }
  private paint(paint: RenderEnginePaint): {
    color: number | string
    alpha: number
  } {
    if (!paint || typeof paint !== 'object') throw new Error('Invalid paint')
    let base = { color: paint.color ?? 0xffffff, alpha: paint.alpha ?? 1 }
    if (paint.resource) {
      const stored = this.resources.get(paint.resource)
      if (!stored) throw new Error('Foreign or destroyed resource handle')
      base = { color: stored.color, alpha: paint.alpha ?? stored.alpha }
    }
    if (!Number.isFinite(base.alpha) || base.alpha < 0 || base.alpha > 1)
      throw new Error('Invalid paint opacity')
    return base
  }
  private attachPointerListeners(canvas: HTMLCanvasElement): void {
    const types = [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'pointerover',
      'pointerout'
    ] as const
    for (const type of types) {
      const handler = (event: Event) => {
        if (this.destroyed) return
        const pointer = event as PointerEvent,
          rect = canvas.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        const position = {
          x: ((pointer.clientX - rect.left) * this.width) / rect.width,
          y: ((pointer.clientY - rect.top) * this.height) / rect.height
        }
        const result = this.query({ type: 'hit-test', point: position })
        this.dispatchInteraction({
          type,
          pointerId: pointer.pointerId ?? 0,
          button: pointer.button,
          buttons: pointer.buttons,
          position,
          modifiers: {
            altKey: pointer.altKey,
            ctrlKey: pointer.ctrlKey,
            metaKey: pointer.metaKey,
            shiftKey: pointer.shiftKey
          },
          target: result.type === 'hit' ? result.target : null,
          timestamp: event.timeStamp
        })
      }
      canvas.addEventListener(type, handler)
      this.pointerDisposers.push(() =>
        canvas.removeEventListener(type, handler)
      )
    }
  }
}
