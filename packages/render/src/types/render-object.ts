import type {
  RenderEngine,
  RenderEngineCommand,
  RenderEngineCommandResult,
  RenderEngineDrawOperation,
  RenderEngineObjectHandle,
  RenderEngineObjectProperties,
  RenderEngineObjectType,
  RenderEnginePaint,
  RenderEnginePoint,
  RenderEngineQueryResult,
  RenderEngineResourceDescriptor,
  RenderEngineResourceHandle
} from '@asyra/render-engine'

export interface RenderBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface RenderResourceStyle {
  readonly __asyraRenderResourceDescriptor: RenderEngineResourceDescriptor
  readonly __asyraSubscribeRenderResourceRelease?: (
    listener: () => void
  ) => () => void
  readonly __asyraIsRenderResourceReleased?: () => boolean
}

export const createRenderResourceStyle = (
  descriptor: RenderEngineResourceDescriptor
): { style: RenderResourceStyle; dispose: () => void } => {
  const listeners = new Set<() => void>()
  let released = false
  const style = {
    __asyraRenderResourceDescriptor: descriptor
  } as RenderResourceStyle

  Object.defineProperties(style, {
    __asyraSubscribeRenderResourceRelease: {
      enumerable: false,
      value: (listener: () => void) => {
        if (released) {
          listener()
          return () => undefined
        }
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
    },
    __asyraIsRenderResourceReleased: {
      enumerable: false,
      value: () => released
    }
  })

  return {
    style,
    dispose: () => {
      if (released) {
        return
      }
      released = true
      listeners.forEach((listener) => listener())
      listeners.clear()
    }
  }
}

export class RenderMatrix {
  constructor(
    readonly a = 1,
    readonly b = 0,
    readonly c = 0,
    readonly d = 1,
    readonly tx = 0,
    readonly ty = 0
  ) {}

  clone(): RenderMatrix {
    return new RenderMatrix(this.a, this.b, this.c, this.d, this.tx, this.ty)
  }

  apply(point: RenderEnginePoint): RenderEnginePoint {
    return {
      x: this.a * point.x + this.c * point.y + this.tx,
      y: this.b * point.x + this.d * point.y + this.ty
    }
  }

  applyInverse(point: RenderEnginePoint): RenderEnginePoint {
    const determinant = this.a * this.d - this.b * this.c
    if (Math.abs(determinant) <= Number.EPSILON) {
      return { x: 0, y: 0 }
    }
    const x = point.x - this.tx
    const y = point.y - this.ty
    return {
      x: (this.d * x - this.c * y) / determinant,
      y: (-this.b * x + this.a * y) / determinant
    }
  }
}

const multiplyMatrices = (parent: RenderMatrix, local: RenderMatrix) =>
  new RenderMatrix(
    parent.a * local.a + parent.c * local.b,
    parent.b * local.a + parent.d * local.b,
    parent.a * local.c + parent.c * local.d,
    parent.b * local.c + parent.d * local.d,
    parent.a * local.tx + parent.c * local.ty + parent.tx,
    parent.b * local.tx + parent.d * local.ty + parent.ty
  )

export class RenderPoint {
  constructor(
    private readonly onChange: (x: number, y: number) => void,
    public x = 0,
    public y = 0
  ) {}

  set(x: number, y = x): void {
    this.x = x
    this.y = y
    this.onChange(x, y)
  }
}

const normalizePaint = (value: unknown): RenderEnginePaint => {
  if (typeof value === 'number' || typeof value === 'string') {
    return { color: value }
  }
  if (typeof value === 'object' && value !== null) {
    const style = value as { color?: unknown; alpha?: unknown; fill?: unknown }
    if (style.fill !== undefined) {
      return normalizePaint(style.fill)
    }
    return {
      color:
        typeof style.color === 'number' || typeof style.color === 'string'
          ? style.color
          : undefined,
      alpha: typeof style.alpha === 'number' ? style.alpha : undefined
    }
  }
  return {}
}

interface RenderRuntimeResourceRecord {
  handle: RenderEngineResourceHandle
  owners: Set<RenderGraphics>
  unsubscribe?: () => void
}

export class RenderObjectRuntime {
  private readonly objectByHandle = new Map<
    RenderEngineObjectHandle,
    RenderNode
  >()
  private readonly dirtyGraphics = new Set<RenderGraphics>()
  private readonly resourceByStyle = new WeakMap<
    object,
    RenderRuntimeResourceRecord
  >()
  private readonly resourceStylesByGraphics = new Map<
    RenderGraphics,
    Set<object>
  >()
  private readonly resourceReleaseSubscriptions = new Set<() => void>()

  constructor(
    readonly engine: RenderEngine,
    private readonly root: RenderEngineObjectHandle,
    private readonly beforeExecute?: (
      command: RenderEngineCommand,
      node?: RenderNode,
      relatedNode?: RenderNode
    ) => void
  ) {}

  private execute(
    command: RenderEngineCommand,
    node?: RenderNode,
    relatedNode?: RenderNode
  ): RenderEngineCommandResult {
    this.beforeExecute?.(command, node, relatedNode)
    return this.engine.execute(command)
  }

  attachRoot(node: RenderNode): void {
    const handle = this.attachNode(node)
    this.execute(
      {
        type: 'append-child',
        parent: this.root,
        child: handle
      },
      node
    )
  }

  detachRoot(node: RenderNode): void {
    const handle = node.getEngineHandle()
    if (handle) {
      this.execute(
        {
          type: 'remove-child',
          parent: this.root,
          child: handle
        },
        node
      )
    }
  }

  attachNode(node: RenderNode): RenderEngineObjectHandle {
    const existingHandle = node.getEngineHandle()
    if (existingHandle) {
      return existingHandle
    }
    const result = this.execute(
      {
        type: 'create-object',
        requestId: node.label || node.objectType,
        objectType: node.objectType,
        properties: node.getEngineProperties()
      },
      node
    )
    if (!result.object) {
      throw new Error('Render engine did not return an object handle')
    }
    node.bindRuntime(this, result.object)
    this.objectByHandle.set(result.object, node)
    node.children.forEach((child) => {
      const childHandle = this.attachNode(child)
      this.execute(
        {
          type: 'append-child',
          parent: result.object as RenderEngineObjectHandle,
          child: childHandle
        },
        child,
        node
      )
    })
    if (node instanceof RenderGraphics) {
      this.dirtyGraphics.add(node)
    }
    return result.object
  }

  appendChild(parent: RenderNode, child: RenderNode, index?: number): void {
    const parentHandle = parent.getEngineHandle()
    if (!parentHandle) {
      return
    }
    const childHandle = this.attachNode(child)
    this.execute(
      {
        type: 'append-child',
        parent: parentHandle,
        child: childHandle
      },
      child,
      parent
    )
    if (index !== undefined) {
      this.execute(
        {
          type: 'set-child-index',
          parent: parentHandle,
          child: childHandle,
          index
        },
        child,
        parent
      )
    }
  }

  removeChild(parent: RenderNode, child: RenderNode): void {
    const parentHandle = parent.getEngineHandle()
    const childHandle = child.getEngineHandle()
    if (parentHandle && childHandle) {
      this.execute(
        {
          type: 'remove-child',
          parent: parentHandle,
          child: childHandle
        },
        child,
        parent
      )
    }
  }

  setChildIndex(parent: RenderNode, child: RenderNode, index: number): void {
    const parentHandle = parent.getEngineHandle()
    const childHandle = child.getEngineHandle()
    if (parentHandle && childHandle) {
      this.execute(
        {
          type: 'set-child-index',
          parent: parentHandle,
          child: childHandle,
          index
        },
        child,
        parent
      )
    }
  }

  updateObject(
    node: RenderNode,
    properties: RenderEngineObjectProperties
  ): void {
    const handle = node.getEngineHandle()
    if (handle) {
      this.execute({ type: 'update-object', object: handle, properties }, node)
    }
  }

  destroyObject(node: RenderNode): void {
    const handle = node.getEngineHandle()
    if (!handle) {
      return
    }
    this.execute({ type: 'destroy-object', object: handle }, node)
    this.objectByHandle.delete(handle)
    node.unbindRuntime()
  }

  markDrawDirty(graphics: RenderGraphics): void {
    if (graphics.getEngineHandle()) {
      this.dirtyGraphics.add(graphics)
    }
  }

  flushDraws(): boolean {
    if (this.dirtyGraphics.size === 0) {
      return false
    }
    for (const graphics of this.dirtyGraphics) {
      const handle = graphics.getEngineHandle()
      if (handle) {
        this.execute(
          {
            type: 'draw',
            object: handle,
            operations: graphics.getDrawOperations()
          },
          graphics
        )
        graphics.markDrawClean()
      }
    }
    this.dirtyGraphics.clear()
    return true
  }

  createPaint(style: unknown, owner?: RenderGraphics): RenderEnginePaint {
    const resourceCandidate =
      typeof style === 'object' && style !== null && 'fill' in style
        ? (style as { fill: unknown }).fill
        : style
    if (
      typeof resourceCandidate === 'object' &&
      resourceCandidate !== null &&
      '__asyraRenderResourceDescriptor' in resourceCandidate
    ) {
      const resourceStyle = resourceCandidate as RenderResourceStyle
      if (resourceStyle.__asyraIsRenderResourceReleased?.()) {
        throw new Error('Cannot use a disposed render resource style')
      }
      let record = this.resourceByStyle.get(resourceCandidate)
      if (!record) {
        const result = this.execute(
          {
            type: 'create-resource',
            requestId: resourceStyle.__asyraRenderResourceDescriptor.kind,
            descriptor: resourceStyle.__asyraRenderResourceDescriptor
          },
          owner
        )
        if (!result.resource) {
          throw new Error('Render engine did not return a resource handle')
        }
        const createdRecord: RenderRuntimeResourceRecord = {
          handle: result.resource,
          owners: new Set()
        }
        record = createdRecord
        this.resourceByStyle.set(resourceCandidate, createdRecord)
        const unsubscribe =
          resourceStyle.__asyraSubscribeRenderResourceRelease?.(() => {
            this.destroyResourceRecord(resourceCandidate, createdRecord)
          })
        if (unsubscribe) {
          createdRecord.unsubscribe = unsubscribe
          this.resourceReleaseSubscriptions.add(unsubscribe)
        }
      }
      if (owner) {
        record.owners.add(owner)
        const styles = this.resourceStylesByGraphics.get(owner) ?? new Set()
        styles.add(resourceCandidate)
        this.resourceStylesByGraphics.set(owner, styles)
      }
      return { resource: record.handle }
    }
    return normalizePaint(style)
  }

  releaseGraphicResources(graphics: RenderGraphics): void {
    const styles = this.resourceStylesByGraphics.get(graphics)
    if (!styles) {
      return
    }
    styles.forEach((style) => {
      const record = this.resourceByStyle.get(style)
      if (!record) {
        return
      }
      record.owners.delete(graphics)
      if (record.owners.size === 0) {
        this.destroyResourceRecord(style, record)
      }
    })
    this.resourceStylesByGraphics.delete(graphics)
  }

  getObject(handle: RenderEngineObjectHandle | null): RenderNode | null {
    return handle ? (this.objectByHandle.get(handle) ?? null) : null
  }

  detachResourceLifecycles(): void {
    this.resourceReleaseSubscriptions.forEach((unsubscribe) => unsubscribe())
    this.resourceReleaseSubscriptions.clear()
  }

  private destroyResourceRecord(
    style: object,
    record: RenderRuntimeResourceRecord
  ): void {
    if (this.resourceByStyle.get(style) !== record) {
      return
    }
    this.execute({
      type: 'destroy-resource',
      resource: record.handle
    })
    this.resourceByStyle.delete(style)
    record.owners.forEach((owner) => {
      const styles = this.resourceStylesByGraphics.get(owner)
      styles?.delete(style)
      if (styles?.size === 0) {
        this.resourceStylesByGraphics.delete(owner)
      }
    })
    record.owners.clear()
    if (record.unsubscribe) {
      record.unsubscribe()
      this.resourceReleaseSubscriptions.delete(record.unsubscribe)
    }
  }

  queryPoint(
    type: 'to-local' | 'to-global',
    node: RenderNode,
    point: RenderEnginePoint
  ): RenderEnginePoint | null {
    const handle = node.getEngineHandle()
    if (!handle) {
      return null
    }
    const result: RenderEngineQueryResult = this.engine.query({
      type,
      object: handle,
      point
    })
    return result.type === 'point' ? result.point : null
  }
}

export class RenderNode {
  readonly children: RenderNode[] = []
  parent: RenderContainer | null = null
  hitArea: unknown = null
  readonly context = { batchMode: 'auto' }
  readonly geometry = { clear: () => undefined }
  readonly _transform = { updateLocalTransform: () => undefined }
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>()
  private _x = 0
  private _y = 0
  private _width = 0
  private _height = 0
  private _visible = true
  private _renderable = true
  private _label = ''
  private _eventMode = 'auto'
  private _cursor = 'default'
  private _alpha = 1
  private _angle = 0
  private _rotation = 0
  private _zIndex = 0
  private _batched = false
  private handle: RenderEngineObjectHandle | null = null
  protected runtime: RenderObjectRuntime | null = null
  readonly position = new RenderPoint((x, y) => {
    this._x = x
    this._y = y
    this.updateEngineProperties({ x, y })
  })
  readonly scale = new RenderPoint(
    (scaleX, scaleY) => {
      this.updateEngineProperties({ scaleX, scaleY })
    },
    1,
    1
  )

  constructor(readonly objectType: RenderEngineObjectType) {}

  get x(): number {
    return this._x
  }

  set x(value: number) {
    this._x = value
    this.position.x = value
    this.updateEngineProperties({ x: value })
  }

  get y(): number {
    return this._y
  }

  set y(value: number) {
    this._y = value
    this.position.y = value
    this.updateEngineProperties({ y: value })
  }

  get width(): number {
    return this._width || this.getLocalBounds().width
  }

  set width(value: number) {
    this._width = value
    this.updateEngineProperties({ width: value })
  }

  get height(): number {
    return this._height || this.getLocalBounds().height
  }

  set height(value: number) {
    this._height = value
    this.updateEngineProperties({ height: value })
  }

  get visible(): boolean {
    return this._visible
  }

  set visible(value: boolean) {
    this._visible = value
    this.updateEngineProperties({ visible: value })
  }

  get renderable(): boolean {
    return this._renderable
  }

  set renderable(value: boolean) {
    this._renderable = value
    this.updateEngineProperties({ renderable: value })
  }

  get label(): string {
    return this._label
  }

  set label(value: string) {
    this._label = value
    this.updateEngineProperties({ label: value })
  }

  get eventMode(): string {
    return this._eventMode
  }

  set eventMode(value: string) {
    this._eventMode = value
    this.updateEngineProperties({ eventMode: value })
  }

  get cursor(): string {
    return this._cursor
  }

  set cursor(value: string) {
    this._cursor = value
    this.updateEngineProperties({ cursor: value })
  }

  get alpha(): number {
    return this._alpha
  }

  set alpha(value: number) {
    this._alpha = value
    this.updateEngineProperties({ alpha: value })
  }

  get angle(): number {
    return this._angle
  }

  set angle(value: number) {
    this._angle = value
    this.updateEngineProperties({ angle: value })
  }

  get rotation(): number {
    return this._rotation
  }

  set rotation(value: number) {
    this._rotation = value
    this.updateEngineProperties({ rotation: value })
  }

  get zIndex(): number {
    return this._zIndex
  }

  set zIndex(value: number) {
    this._zIndex = value
    this.updateEngineProperties({ zIndex: value })
  }

  get batched(): boolean {
    return this._batched
  }

  set batched(value: boolean) {
    this._batched = value
    this.updateEngineProperties({ batched: value })
  }

  get worldTransform(): RenderMatrix {
    const cosine = Math.cos(this.rotation)
    const sine = Math.sin(this.rotation)
    const local = new RenderMatrix(
      cosine * this.scale.x,
      sine * this.scale.x,
      -sine * this.scale.y,
      cosine * this.scale.y,
      this.x,
      this.y
    )
    return this.parent
      ? multiplyMatrices(this.parent.worldTransform, local)
      : local
  }

  getEngineProperties(): RenderEngineObjectProperties {
    return {
      x: this.x,
      y: this.y,
      width: this._width,
      height: this._height,
      scaleX: this.scale.x,
      scaleY: this.scale.y,
      visible: this.visible,
      renderable: this.renderable,
      label: this.label,
      alpha: this.alpha,
      angle: this.angle,
      rotation: this.rotation,
      zIndex: this.zIndex,
      eventMode: this.eventMode,
      cursor: this.cursor,
      batched: this.batched
    }
  }

  bindRuntime(
    runtime: RenderObjectRuntime,
    handle: RenderEngineObjectHandle
  ): void {
    this.runtime = runtime
    this.handle = handle
  }

  unbindRuntime(): void {
    this.runtime = null
    this.handle = null
  }

  releaseRuntime(): void {
    this.children.forEach((child) => child.releaseRuntime())
    this.unbindRuntime()
  }

  getEngineHandle(): RenderEngineObjectHandle | null {
    return this.handle
  }

  addChild<T extends RenderNode>(child: T): T {
    return this.addChildAt(child, this.children.length)
  }

  addChildAt<T extends RenderNode>(child: T, index: number): T {
    if (child.parent === this) {
      this.setChildIndex(child, index)
      return child
    }

    const previousParent = child.parent
    const previousIndex = previousParent?.children.indexOf(child) ?? -1
    const boundedIndex = Math.max(0, Math.min(index, this.children.length))
    if (previousParent && previousIndex >= 0) {
      previousParent.runtime?.removeChild(previousParent, child)
    }
    try {
      this.runtime?.appendChild(this, child, boundedIndex)
    } catch (error) {
      if (previousParent && previousIndex >= 0) {
        try {
          this.runtime?.removeChild(this, child)
        } catch {
          // The target append may have failed before attaching the child.
        }
        try {
          previousParent.runtime?.appendChild(
            previousParent,
            child,
            previousIndex
          )
        } catch {
          // Preserve the target handoff failure after rollback effort.
        }
      }
      throw error
    }
    if (previousParent && previousIndex >= 0) {
      previousParent.children.splice(previousIndex, 1)
    }
    this.children.splice(boundedIndex, 0, child)
    child.parent = this as unknown as RenderContainer
    return child
  }

  removeChild<T extends RenderNode>(child: T): T {
    const index = this.children.indexOf(child)
    if (index >= 0) {
      this.runtime?.removeChild(this, child)
      this.children.splice(index, 1)
      child.parent = null
    }
    return child
  }

  removeChildren(): RenderNode[] {
    const removed = [...this.children]
    removed.forEach((child) => this.removeChild(child))
    return removed
  }

  setChildIndex(child: RenderNode, index: number): void {
    const currentIndex = this.children.indexOf(child)
    if (currentIndex < 0) {
      return
    }
    const boundedIndex = Math.max(0, Math.min(index, this.children.length - 1))
    this.runtime?.setChildIndex(this, child, boundedIndex)
    this.children.splice(currentIndex, 1)
    this.children.splice(boundedIndex, 0, child)
  }

  toGlobal(point: RenderEnginePoint): RenderEnginePoint {
    return this.worldTransform.apply(point)
  }

  toLocal(point: RenderEnginePoint): RenderEnginePoint {
    return this.worldTransform.applyInverse(point)
  }

  getLocalBounds(): RenderBounds {
    if (this.children.length === 0) {
      return { x: 0, y: 0, width: this._width, height: this._height }
    }
    const childBounds = this.children.map((child) => child.getBounds())
    const minX = Math.min(...childBounds.map((bounds) => bounds.x))
    const minY = Math.min(...childBounds.map((bounds) => bounds.y))
    const maxX = Math.max(
      ...childBounds.map((bounds) => bounds.x + bounds.width)
    )
    const maxY = Math.max(
      ...childBounds.map((bounds) => bounds.y + bounds.height)
    )
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  getBounds(): RenderBounds {
    const local = this.getLocalBounds()
    const corners = [
      this.toGlobal({ x: local.x, y: local.y }),
      this.toGlobal({ x: local.x + local.width, y: local.y }),
      this.toGlobal({ x: local.x + local.width, y: local.y + local.height }),
      this.toGlobal({ x: local.x, y: local.y + local.height })
    ]
    const minX = Math.min(...corners.map((point) => point.x))
    const minY = Math.min(...corners.map((point) => point.y))
    const maxX = Math.max(...corners.map((point) => point.x))
    const maxY = Math.max(...corners.map((point) => point.y))
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  setTransform(matrix: RenderMatrix): void {
    this.x = matrix.tx
    this.y = matrix.ty
    this.rotation = Math.atan2(matrix.b, matrix.a)
    this.scale.set(
      Math.hypot(matrix.a, matrix.b),
      Math.hypot(matrix.c, matrix.d)
    )
    this.updateEngineProperties({
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      scaleX: this.scale.x,
      scaleY: this.scale.y
    })
  }

  on(type: string, listener: (event: unknown) => void): this {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
    return this
  }

  off(type: string, listener: (event: unknown) => void): this {
    this.listeners.get(type)?.delete(listener)
    return this
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }

  emit(type: string, event: unknown): void {
    this.listeners.get(type)?.forEach((listener) => listener(event))
  }

  destroy(options?: { children?: boolean }): void {
    if (options?.children !== false) {
      ;[...this.children].reverse().forEach((child) => child.destroy(options))
    }
    this.parent?.removeChild(this)
    this.runtime?.destroyObject(this)
    this.removeAllListeners()
  }

  protected updateEngineProperties(
    properties: RenderEngineObjectProperties
  ): void {
    this.runtime?.updateObject(this, properties)
  }
}

export class RenderContainer extends RenderNode {
  constructor(
    properties: RenderEngineObjectProperties = {},
    objectType: RenderEngineObjectType = 'container'
  ) {
    super(objectType)
    if (typeof properties.label === 'string') this.label = properties.label
    if (typeof properties.x === 'number') this.x = properties.x
    if (typeof properties.y === 'number') this.y = properties.y
  }
}

export class RenderGraphics extends RenderContainer {
  private drawOperations: RenderEngineDrawOperation[] = []
  private paintStyles = new Map<number, unknown>()
  private drawDirty = false
  private bounds: RenderBounds = { x: 0, y: 0, width: 0, height: 0 }
  private lineStyleValue: {
    width: number
    color: number | string
    alpha: number
  } | null = null

  constructor() {
    super({}, 'graphics')
  }

  clear(): this {
    this.runtime?.releaseGraphicResources(this)
    this.drawOperations = [{ type: 'clear' }]
    this.paintStyles.clear()
    this.bounds = { x: 0, y: 0, width: 0, height: 0 }
    return this.markDrawDirty()
  }

  rect(x: number, y: number, width: number, height: number): this {
    this.drawOperations.push({ type: 'rect', x, y, width, height })
    this.includeBounds(x, y, width, height)
    return this.markDrawDirty()
  }

  drawRect(x: number, y: number, width: number, height: number): this {
    this.rect(x, y, width, height)
    if (this.lineStyleValue) {
      this.stroke(this.lineStyleValue)
    }
    return this
  }

  ellipse(x: number, y: number, radiusX: number, radiusY: number): this {
    this.drawOperations.push({ type: 'ellipse', x, y, radiusX, radiusY })
    this.includeBounds(x - radiusX, y - radiusY, radiusX * 2, radiusY * 2)
    return this.markDrawDirty()
  }

  circle(x: number, y: number, radius: number): this {
    this.drawOperations.push({ type: 'circle', x, y, radius })
    this.includeBounds(x - radius, y - radius, radius * 2, radius * 2)
    return this.markDrawDirty()
  }

  moveTo(x: number, y: number): this {
    this.drawOperations.push({ type: 'move-to', x, y })
    this.includePoint(x, y)
    return this.markDrawDirty()
  }

  lineTo(x: number, y: number): this {
    this.drawOperations.push({ type: 'line-to', x, y })
    this.includePoint(x, y)
    return this.markDrawDirty()
  }

  bezierCurveTo(
    controlPoint1X: number,
    controlPoint1Y: number,
    controlPoint2X: number,
    controlPoint2Y: number,
    destinationX: number,
    destinationY: number
  ): this {
    this.drawOperations.push({
      type: 'bezier-curve-to',
      controlPoint1: { x: controlPoint1X, y: controlPoint1Y },
      controlPoint2: { x: controlPoint2X, y: controlPoint2Y },
      destination: { x: destinationX, y: destinationY }
    })
    this.includePoint(controlPoint1X, controlPoint1Y)
    this.includePoint(controlPoint2X, controlPoint2Y)
    this.includePoint(destinationX, destinationY)
    return this.markDrawDirty()
  }

  closePath(): this {
    this.drawOperations.push({ type: 'close-path' })
    return this.markDrawDirty()
  }

  fill(style: unknown): this {
    const operationIndex = this.drawOperations.length
    this.drawOperations.push({
      type: 'fill',
      paint: normalizePaint(style)
    })
    this.paintStyles.set(operationIndex, style)
    return this.markDrawDirty()
  }

  stroke(style: unknown): this {
    const value =
      typeof style === 'object' && style !== null
        ? (style as { width?: unknown; color?: unknown; alpha?: unknown })
        : {}
    const width = typeof value.width === 'number' ? value.width : 1
    const operationIndex = this.drawOperations.length
    this.drawOperations.push({
      type: 'stroke',
      paint: normalizePaint(value),
      width
    })
    this.paintStyles.set(operationIndex, value)
    return this.markDrawDirty()
  }

  lineStyle(width: number, color: number | string, alpha = 1): this {
    this.lineStyleValue = { width, color, alpha }
    return this
  }

  override getLocalBounds(): RenderBounds {
    return { ...this.bounds }
  }

  getDrawOperations(): readonly RenderEngineDrawOperation[] {
    return this.drawOperations.map((operation, index) => {
      if (!this.paintStyles.has(index)) {
        return operation
      }
      const style = this.paintStyles.get(index)
      const paint =
        this.runtime?.createPaint(style, this) ?? normalizePaint(style)
      if (operation.type === 'fill' || operation.type === 'stroke') {
        return { ...operation, paint }
      }
      return operation
    })
  }

  isDrawDirty(): boolean {
    return this.drawDirty
  }

  markDrawClean(): void {
    this.drawDirty = false
  }

  override destroy(options?: { children?: boolean }): void {
    this.runtime?.releaseGraphicResources(this)
    super.destroy(options)
  }

  private markDrawDirty(): this {
    this.drawDirty = true
    this.runtime?.markDrawDirty(this)
    return this
  }

  private includePoint(x: number, y: number): void {
    this.includeBounds(x, y, 0, 0)
  }

  private includeBounds(
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (this.bounds.width === 0 && this.bounds.height === 0) {
      this.bounds = { x, y, width, height }
      return
    }
    const minX = Math.min(this.bounds.x, x)
    const minY = Math.min(this.bounds.y, y)
    const maxX = Math.max(this.bounds.x + this.bounds.width, x + width)
    const maxY = Math.max(this.bounds.y + this.bounds.height, y + height)
    this.bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
}

export class RenderMesh extends RenderContainer {
  private meshProperties: RenderEngineObjectProperties

  constructor(properties: RenderEngineObjectProperties = {}) {
    super(properties, 'mesh')
    this.meshProperties = { ...properties }
  }

  override getEngineProperties(): RenderEngineObjectProperties {
    return {
      ...super.getEngineProperties(),
      ...this.meshProperties
    }
  }

  update(properties: RenderEngineObjectProperties): void {
    this.meshProperties = {
      ...this.meshProperties,
      ...properties
    }
    this.updateEngineProperties(properties)
  }
}
