import { DataTypes } from './types'

export interface ChangeHandler {
  addChange(data: {
    elementId: string
    key: string
    before: DataTypes
    after: DataTypes
  }): void
}
