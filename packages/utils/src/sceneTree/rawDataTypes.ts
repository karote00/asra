import { EntityTypes } from './enum'

export type BaseRawData = {
  id?: string
  name?: string
}

export type PropsRawData = {}

export type ComputedRawData = {}

export type ElementRawData = BaseRawData & {
  type: EntityTypes
  props?: PropsRawData
}

export type RectangleRawData = ElementRawData & {}

export type GroupRawData = ElementRawData & {}

export type FrameRawData = ElementRawData & {}
export type WorkspaceRawData = BaseRawData & {
  children: ElementRawData[]
}

export type SceneTreeRawData = {
  workspace: string
  workspaceList: WorkspaceRawData[]
}
