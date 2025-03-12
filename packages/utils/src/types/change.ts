import { DataTypes } from './constants'

export interface ChangeHandler {
  addChange(data: {
    id: string
    key: string
    before: DataTypes
    after: DataTypes
  }): void
}

export interface EvnetOptions {
  undoable?: boolean
}
