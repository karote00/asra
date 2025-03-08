import { DataTypes } from './constants'

export interface ChangeHandler {
  addChange(data: {
    elementId: string
    key: string
    before: DataTypes
    after: DataTypes
  }): void
}

export interface EvnetOptions {
  undoable?: boolean
}
