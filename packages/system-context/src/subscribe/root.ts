import {
  finishRequestSystemSnapshot,
  subscribeToRequestSystemSnapshot
} from '@asra/reactive-events'
import { RootAPIs } from '../types'

export const initRootSubscribe = (apis: RootAPIs) => {
  subscribeToRequestSystemSnapshot(({ payload }) => {
    const systemSnapshot = apis.getSystemSnapshot()
    finishRequestSystemSnapshot(payload.requestId, systemSnapshot)
  })
}
