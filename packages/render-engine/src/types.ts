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

export type RenderEngineDrawOperation =
  | Readonly<{ type: 'clear' }>
  | Readonly<{
      type: 'rect'
      x: number
      y: number
      width: number
      height: number
    }>
  | Readonly<{
      type: 'ellipse'
      x: number
      y: number
      radiusX: number
      radiusY: number
    }>
  | Readonly<{ type: 'circle'; x: number; y: number; radius: number }>
  | Readonly<{ type: 'move-to'; x: number; y: number }>
  | Readonly<{ type: 'line-to'; x: number; y: number }>
  | Readonly<{
      type: 'bezier-curve-to'
      controlPoint1: RenderEnginePoint
      controlPoint2: RenderEnginePoint
      destination: RenderEnginePoint
    }>
  | Readonly<{ type: 'close-path' }>
  | Readonly<{ type: 'fill'; paint: RenderEnginePaint }>
  | Readonly<{
      type: 'stroke'
      paint: RenderEnginePaint
      width: number
    }>

export type RenderEngineCommand =
  | Readonly<{
      type: 'create-object'
      requestId: string
      objectType: RenderEngineObjectType
      properties?: RenderEngineObjectProperties
    }>
  | Readonly<{
      type: 'update-object'
      object: RenderEngineObjectHandle
      properties: RenderEngineObjectProperties
    }>
  | Readonly<{
      type: 'destroy-object'
      object: RenderEngineObjectHandle
    }>
  | Readonly<{
      type: 'append-child'
      parent: RenderEngineObjectHandle
      child: RenderEngineObjectHandle
    }>
  | Readonly<{
      type: 'remove-child'
      parent: RenderEngineObjectHandle
      child: RenderEngineObjectHandle
    }>
  | Readonly<{
      type: 'set-child-index'
      parent: RenderEngineObjectHandle
      child: RenderEngineObjectHandle
      index: number
    }>
  | Readonly<{
      type: 'draw'
      object: RenderEngineObjectHandle
      operations: readonly RenderEngineDrawOperation[]
    }>
  | Readonly<{
      type: 'create-resource'
      requestId: string
      descriptor: RenderEngineResourceDescriptor
    }>
  | Readonly<{
      type: 'destroy-resource'
      resource: RenderEngineResourceHandle
    }>
  | Readonly<{
      type: 'resize'
      width: number
      height: number
    }>
  | Readonly<{
      type: 'set-viewport'
      position: RenderEnginePoint
      scale: RenderEnginePoint
    }>
  | Readonly<{ type: 'flush' }>

export type RenderEngineCommandResult = Readonly<{
  commandType: RenderEngineCommand['type']
  status: 'applied' | 'noop'
  object?: RenderEngineObjectHandle
  resource?: RenderEngineResourceHandle
}>

export type RenderEngineQuery =
  | Readonly<{ type: 'get-bounds'; object: RenderEngineObjectHandle }>
  | Readonly<{
      type: 'to-local'
      object: RenderEngineObjectHandle
      point: RenderEnginePoint
    }>
  | Readonly<{
      type: 'to-global'
      object: RenderEngineObjectHandle
      point: RenderEnginePoint
    }>
  | Readonly<{ type: 'hit-test'; point: RenderEnginePoint }>

export type RenderEngineQueryResult =
  | Readonly<{ type: 'bounds'; bounds: RenderEngineBounds }>
  | Readonly<{ type: 'point'; point: RenderEnginePoint }>
  | Readonly<{
      type: 'hit'
      target: RenderEngineObjectHandle | null
      point: RenderEnginePoint
    }>

export type RenderEngineInteractionType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointercancel'
  | 'pointerover'
  | 'pointerout'

export type RenderEngineInteractionEvent = Readonly<{
  type: RenderEngineInteractionType
  pointerId: number
  button: number
  buttons: number
  position: RenderEnginePoint
  modifiers: Readonly<{
    altKey: boolean
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
  }>
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
