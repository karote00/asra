import { DataTypes } from './constants'

export type SharedDeliveryMode = 'transaction-end' | 'immediate'

export interface MutationOptions {
  undoable?: boolean
  rollbackable?: boolean
  shared?: string
  sharedDelivery?: SharedDeliveryMode
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
