import type { CanonicalElementRemoval } from '@asyra/scene-tree'
import type {
  ElementRawData,
  HierarchyMove,
  PropertyComponentRawData,
  PropsRestoreSnapshot,
  SceneTreeRestoreSnapshot,
  SubtreeChange,
  UpdateElementDataChange
} from '@asyra/utils'
import type { PropertyComponentValuesUpdate } from './props'

export type CanonicalChange =
  | Readonly<{
      kind: 'property-components'
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
      removals: readonly CanonicalElementRemoval[]
    }>

export interface CanonicalChangeAPIs {
  applyCanonicalChanges(changes: readonly CanonicalChange[]): void
}
