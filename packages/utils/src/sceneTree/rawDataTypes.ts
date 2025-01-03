import { EntityTypes } from './enum'

export interface BaseRawData {
  id: string
  name: string
}

export interface PropsRawData {
  width: string
}

export interface ComputedRawData {
  width: number
}

export interface ElementRawData extends BaseRawData {
  type: EntityTypes
  props?: PropsRawData
  lock: boolean
  visible: boolean
}

export interface RectangleRawData extends ElementRawData {
  row?: number
}

export interface GroupRawData extends ElementRawData {
  children: (GroupRawData | ElementRawData)[]
}

export interface FrameRawData extends GroupRawData {
  aotuLayout?: boolean
}

export interface WorkspaceRawData extends GroupRawData {
  children: ElementRawData[]
}

export interface SceneTreeRawData {
  workspace: string
  workspaceList: WorkspaceRawData[]
}
