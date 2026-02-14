import { DimensionData, PositionData } from '../types'
import { EntityType, EntityTypes } from './enum'

export interface BaseRawData {
  id: string
  name: string
}

export interface PropsRawData {
  position: string
  dimension: string
  [key: string]: string
}

export interface ElementRawData extends BaseRawData {
  type: EntityType
  visible: boolean
  lock: boolean
  props?: PropsRawData
}

export interface RectangleRawData extends ElementRawData {
  row?: number
}

export interface GroupRawData extends ElementRawData {
  children: string[]
}

export interface FrameRawData extends GroupRawData {
  aotuLayout?: boolean
}

export interface WorkspaceRawData extends GroupRawData {
  children: string[]
}

export interface SceneTreeRawData {
  workspace: string
  workspaceList: string[]
  elements: Record<string, ElementRawData | GroupRawData>
}

export type CreateElementData = PositionData &
  Partial<DimensionData> &
  Partial<ElementRawData> &
  Record<string, unknown>
