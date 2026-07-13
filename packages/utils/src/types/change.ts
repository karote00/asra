import { DataTypes } from './constants'

export interface MutationOptions {
  undoable?: boolean
  shared?: string
  sharedDelivery?: 'transaction-end' | 'immediate'
}

export interface ChangeHandler {
  addChange(data: {
    id: string
    key: string
    before: DataTypes
    after: DataTypes
    options?: MutationOptions
  }): void
}

export type EvnetOptions = MutationOptions
