declare const objectHandleBrand: unique symbol
declare const resourceHandleBrand: unique symbol

export type RenderEngineObjectHandle = Readonly<{
  [objectHandleBrand]: 'render-engine-object'
}>

export type RenderEngineResourceHandle = Readonly<{
  [resourceHandleBrand]: 'render-engine-resource'
}>

export type RenderEngineCapability = string

export type RenderEnginePoint = Readonly<{
  x: number
  y: number
}>

export type RenderEngineBounds = RenderEnginePoint &
  Readonly<{
    width: number
    height: number
  }>

export type RenderEngineObjectType = 'container' | 'graphics' | 'mesh'

export type RenderEngineObjectProperties = Readonly<Record<string, unknown>>

export type RenderEngineResourceDescriptor = Readonly<{
  kind: string
  data: unknown
}>

export type RenderEnginePaint = Readonly<{
  color?: number | string
  alpha?: number
  resource?: RenderEngineResourceHandle
}>

export type RenderEngineClearOperation = Readonly<{ type: 'clear' }>

export type RenderEngineRectOperation = Readonly<{
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
}>

export type RenderEngineEllipseOperation = Readonly<{
  type: 'ellipse'
  x: number
  y: number
  radiusX: number
  radiusY: number
}>

export type RenderEngineCircleOperation = Readonly<{
  type: 'circle'
  x: number
  y: number
  radius: number
}>

export type RenderEngineMoveToOperation = Readonly<{
  type: 'move-to'
  x: number
  y: number
}>

export type RenderEngineLineToOperation = Readonly<{
  type: 'line-to'
  x: number
  y: number
}>

export type RenderEngineBezierCurveToOperation = Readonly<{
  type: 'bezier-curve-to'
  controlPoint1: RenderEnginePoint
  controlPoint2: RenderEnginePoint
  destination: RenderEnginePoint
}>

export type RenderEngineClosePathOperation = Readonly<{ type: 'close-path' }>

export type RenderEngineFillOperation = Readonly<{
  type: 'fill'
  paint: RenderEnginePaint
}>

export type RenderEngineStrokeOperation = Readonly<{
  type: 'stroke'
  paint: RenderEnginePaint
  width: number
}>

export type RenderEngineDrawOperation =
  | RenderEngineClearOperation
  | RenderEngineRectOperation
  | RenderEngineEllipseOperation
  | RenderEngineCircleOperation
  | RenderEngineMoveToOperation
  | RenderEngineLineToOperation
  | RenderEngineBezierCurveToOperation
  | RenderEngineClosePathOperation
  | RenderEngineFillOperation
  | RenderEngineStrokeOperation

export type RenderEngineCreateObjectCommand = Readonly<{
  type: 'create-object'
  requestId: string
  objectType: RenderEngineObjectType
  properties?: RenderEngineObjectProperties
}>

export type RenderEngineUpdateObjectCommand = Readonly<{
  type: 'update-object'
  object: RenderEngineObjectHandle
  properties: RenderEngineObjectProperties
}>

export type RenderEngineDestroyObjectCommand = Readonly<{
  type: 'destroy-object'
  object: RenderEngineObjectHandle
}>

export type RenderEngineAppendChildCommand = Readonly<{
  type: 'append-child'
  parent: RenderEngineObjectHandle
  child: RenderEngineObjectHandle
}>

export type RenderEngineRemoveChildCommand = Readonly<{
  type: 'remove-child'
  parent: RenderEngineObjectHandle
  child: RenderEngineObjectHandle
}>

export type RenderEngineSetChildIndexCommand = Readonly<{
  type: 'set-child-index'
  parent: RenderEngineObjectHandle
  child: RenderEngineObjectHandle
  index: number
}>

export type RenderEngineDrawCommand = Readonly<{
  type: 'draw'
  object: RenderEngineObjectHandle
  operations: readonly RenderEngineDrawOperation[]
}>

export type RenderEngineCreateResourceCommand = Readonly<{
  type: 'create-resource'
  requestId: string
  descriptor: RenderEngineResourceDescriptor
}>

export type RenderEngineDestroyResourceCommand = Readonly<{
  type: 'destroy-resource'
  resource: RenderEngineResourceHandle
}>

export type RenderEngineResizeCommand = Readonly<{
  type: 'resize'
  width: number
  height: number
}>

export type RenderEngineSetViewportCommand = Readonly<{
  type: 'set-viewport'
  position: RenderEnginePoint
  scale: RenderEnginePoint
}>

export type RenderEngineFlushCommand = Readonly<{ type: 'flush' }>

export type RenderEngineCommand =
  | RenderEngineCreateObjectCommand
  | RenderEngineUpdateObjectCommand
  | RenderEngineDestroyObjectCommand
  | RenderEngineAppendChildCommand
  | RenderEngineRemoveChildCommand
  | RenderEngineSetChildIndexCommand
  | RenderEngineDrawCommand
  | RenderEngineCreateResourceCommand
  | RenderEngineDestroyResourceCommand
  | RenderEngineResizeCommand
  | RenderEngineSetViewportCommand
  | RenderEngineFlushCommand

export type RenderEngineCommandResult = Readonly<{
  commandType: RenderEngineCommand['type']
  status: 'applied' | 'noop'
  object?: RenderEngineObjectHandle
  resource?: RenderEngineResourceHandle
}>

export type RenderEngineGetBoundsQuery = Readonly<{
  type: 'get-bounds'
  object: RenderEngineObjectHandle
}>

export type RenderEngineToLocalQuery = Readonly<{
  type: 'to-local'
  object: RenderEngineObjectHandle
  point: RenderEnginePoint
}>

export type RenderEngineToGlobalQuery = Readonly<{
  type: 'to-global'
  object: RenderEngineObjectHandle
  point: RenderEnginePoint
}>

export type RenderEngineHitTestQuery = Readonly<{
  type: 'hit-test'
  point: RenderEnginePoint
}>

export type RenderEngineQuery =
  | RenderEngineGetBoundsQuery
  | RenderEngineToLocalQuery
  | RenderEngineToGlobalQuery
  | RenderEngineHitTestQuery

export type RenderEngineBoundsQueryResult = Readonly<{
  type: 'bounds'
  bounds: RenderEngineBounds
}>

export type RenderEnginePointQueryResult = Readonly<{
  type: 'point'
  point: RenderEnginePoint
}>

export type RenderEngineHitQueryResult = Readonly<{
  type: 'hit'
  target: RenderEngineObjectHandle | null
  point: RenderEnginePoint
}>

export type RenderEngineQueryResult =
  | RenderEngineBoundsQueryResult
  | RenderEnginePointQueryResult
  | RenderEngineHitQueryResult

export type RenderEngineInteractionType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointercancel'
  | 'pointerover'
  | 'pointerout'

export type RenderEngineInteractionModifiers = Readonly<{
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}>

export type RenderEngineInteractionEvent = Readonly<{
  type: RenderEngineInteractionType
  pointerId: number
  button: number
  buttons: number
  position: RenderEnginePoint
  modifiers: RenderEngineInteractionModifiers
  target: RenderEngineObjectHandle | null
  timestamp: number
}>

export type RenderEngineInitializeOptions = Readonly<{
  host: unknown
  width: number
  height: number
  backgroundColor?: number | string
  backgroundAlpha?: number
  antialias?: boolean
  resolution?: number
  autoDensity?: boolean
  options?: Readonly<Record<string, unknown>>
}>

export type RenderEngineInitializeResult = Readonly<{
  surface: unknown
  inputTarget?: unknown
  runtime: unknown
  root: RenderEngineObjectHandle
}>

export type RenderEngineDestroyResult = Readonly<{
  destroyedObjects: number
  destroyedResources: number
  alreadyDestroyed: boolean
}>

export type RenderEngineFrameCallback = (timestamp: number) => void

export type RenderEngineInteractionListener = (
  event: RenderEngineInteractionEvent
) => void

export interface RenderEngine {
  readonly name: string
  readonly capabilities: ReadonlySet<RenderEngineCapability>

  initialize(
    options: RenderEngineInitializeOptions
  ): RenderEngineInitializeResult | Promise<RenderEngineInitializeResult>
  execute(command: RenderEngineCommand): RenderEngineCommandResult
  query(query: RenderEngineQuery): RenderEngineQueryResult
  subscribeToInteraction(listener: RenderEngineInteractionListener): () => void
  startFrameLoop(callback: RenderEngineFrameCallback): void
  stopFrameLoop(): void
  destroy(): RenderEngineDestroyResult
}

export type RenderEngineProvider = () => RenderEngine
