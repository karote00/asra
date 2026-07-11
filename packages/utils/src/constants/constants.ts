export interface EVENT_OPTIONS {
  undoable?: boolean
  shared?: string
  sharedDelivery?: 'transaction-end' | 'immediate'
}
