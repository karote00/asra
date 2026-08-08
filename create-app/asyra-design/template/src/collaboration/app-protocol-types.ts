export type AppJsonPrimitive = boolean | null | number | string

export type AppJsonValue =
  | AppJsonPrimitive
  | readonly AppJsonValue[]
  | { readonly [key: string]: AppJsonValue }

export type SharedPublicationOrigin =
  | 'action'
  | 'automation'
  | 'undo'
  | 'redo'
  | 'load-migration'
  | 'rollback-compensation'

export interface SharedPublicationDelivery<TPayload = unknown> {
  readonly deliveryId: string
  readonly eventName: string
  readonly orderedIds: readonly string[]
  readonly payload: TPayload
  readonly compensatesDeliveryId?: string
}

export interface SharedPublicationBatch<TPayload = unknown> {
  readonly batchId: string
  readonly channel: string
  readonly deliveries: readonly SharedPublicationDelivery<TPayload>[]
}

export interface SharedPublicationSlice<TPayload = unknown> {
  readonly sliceId: string
  readonly orderedIds: readonly string[]
  readonly batches: readonly SharedPublicationBatch<TPayload>[]
}

export interface SharedPublication {
  readonly publicationId: string
  readonly artifactId: string
  readonly transactionId: number
  readonly origin: SharedPublicationOrigin
  readonly mode: 'atomic' | 'progressive'
  readonly slices: readonly SharedPublicationSlice[]
  readonly compensatesPublicationId?: string
}

export interface ProviderIdentity {
  readonly documentId: string
  readonly roomId: string
  readonly actorId: string
  readonly connectionMetadata?: Readonly<Record<string, unknown>>
}

export interface ProviderAwarenessMessage {
  readonly actorId: string
  readonly clock: number
  readonly state: unknown
}

export interface ProviderAwarenessDisconnect {
  readonly actorId: string
  readonly reason: 'disconnect'
}

export interface PropertyComponentRawData {
  id: string
  type: string
  [key: string]: unknown
}

export interface ElementRawData {
  id: string
  name: string
  type: string
  parentId?: string
  visible: boolean
  lock: boolean
  props?: Record<string, string>
  children?: string[]
  [key: string]: unknown
}

export interface GroupRawData extends ElementRawData {
  children: string[]
}

export interface AppDocumentData {
  version: string
  sceneTree: {
    workspace: string
    workspaceList: string[]
    elements: Record<string, ElementRawData | GroupRawData>
  }
  props: Record<string, PropertyComponentRawData>
  systemContext?: Record<string, unknown>
}

export interface MutationOptions {
  readonly undoable?: boolean
  readonly rollbackable?: boolean
  readonly shared?: string
  readonly sharedDelivery?: 'transaction-end' | 'immediate'
  readonly history?: Readonly<{
    mode: 'replace-latest'
    key: string
  }>
}

export interface AddRemoveElementEntry {
  readonly data: ElementRawData
  readonly parentId: string
  readonly index: number
}

export interface HierarchyLocation {
  readonly parentId: string
  readonly index: number
}

export interface HierarchyMove {
  readonly elementId: string
  readonly before: HierarchyLocation
  readonly after: HierarchyLocation
}

export interface SubtreeRemovalEntry {
  readonly elementId: string
  readonly parentId: string
  readonly index: number
  readonly data: ElementRawData | GroupRawData
}

export interface SubtreeChange {
  readonly action: 'removeSubtree' | 'restoreSubtree'
  readonly undoAction: 'removeSubtree' | 'restoreSubtree'
  readonly eventName: string
  readonly elementId: string
  readonly removed: readonly SubtreeRemovalEntry[]
  readonly rootParentChildrenAfter: readonly string[]
  readonly options?: MutationOptions
}

export interface SceneTreeRestoreSnapshot {
  readonly elementId: string
  readonly removed: readonly SubtreeRemovalEntry[]
  readonly rootParentChildrenAfter: readonly string[]
}

export interface PropsRestoreSnapshot {
  readonly components: readonly PropertyComponentRawData[]
}

export interface UpdateElementDataChange {
  readonly action: 'updateElementData'
  readonly eventName: string
  readonly id: string
  readonly changes: readonly Readonly<{
    key: 'name' | 'visible' | 'lock'
    before: string | boolean
    after: string | boolean
  }>[]
  readonly options?: MutationOptions
}

export interface PropertyComponentValuesUpdate {
  readonly propertyId: string
  readonly values: Readonly<Record<string, unknown>>
}

export type CanonicalChange =
  | Readonly<{
      kind: 'property-components'
      records?: readonly Readonly<{
        propertyId: string
        key: string
        set?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
        remove?: readonly string[]
      }>[]
      updates: readonly PropertyComponentValuesUpdate[]
    }>
  | Readonly<{
      kind: 'element-data'
      changes: readonly UpdateElementDataChange[]
    }>
  | Readonly<{
      kind: 'hierarchy-moves'
      moves: readonly HierarchyMove[]
    }>
  | Readonly<{
      kind: 'subtree-removal'
      change: SubtreeChange
    }>
  | Readonly<{
      kind: 'subtree-restore'
      sceneSnapshot: SceneTreeRestoreSnapshot
      propsSnapshot: PropsRestoreSnapshot
    }>
  | Readonly<{
      kind: 'element-creation'
      elements: readonly ElementRawData[]
      properties: readonly PropertyComponentRawData[]
      parentId: string
      index: number
    }>
  | Readonly<{
      kind: 'element-removal'
      removals: readonly Readonly<{
        data: ElementRawData
        parentId: string
        index: number
      }>[]
    }>

export interface ApplyRemoteCanonicalChangeSlicesInput {
  readonly origin: SharedPublicationOrigin
  readonly slices: readonly (readonly CanonicalChange[])[]
}

export const EventTypes = {
  ADD_ELEMENT: 'addElement',
  ADD_ELEMENTS: 'addElements',
  REMOVE_ELEMENT: 'removeElement',
  REMOVE_ELEMENTS: 'removeElements',
  MOVE_ELEMENTS: 'moveElements',
  CHANGE_SUBTREE: 'changeSubtree',
  UPDATE_ELEMENT_DATA: 'updateElementData',
  ADD_PROPERTY: 'addProperty',
  REMOVE_PROPERTY: 'removeProperty',
  UPDATE_PROPERTY: 'updateProperty'
} as const

export const SCENE_TREE_ACTIONS = {
  ADD_ELEMENT: 'addElement',
  ADD_ELEMENTS: 'addElements',
  REMOVE_ELEMENT: 'removeElement',
  REMOVE_ELEMENTS: 'removeElements',
  MOVE_ELEMENTS: 'moveElements',
  REMOVE_SUBTREE: 'removeSubtree',
  RESTORE_SUBTREE: 'restoreSubtree',
  UPDATE_ELEMENT_DATA: 'updateElementData'
} as const

export const SharedDataChannelNames = {
  SCENE_TREE: 'sceneTree',
  PROPS: 'props'
} as const
