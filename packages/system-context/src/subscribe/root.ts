import {
  finishRequestSystemContextSnapshot,
  subscribeToRequestSystemContextSnapshot
} from '@asra/reactive-events'
import { RootAPIs } from '../types'

export const initRootSubscribe = (apis: RootAPIs) => {
  subscribeToRequestSystemContextSnapshot(({ payload }) => {
    const systemContextSnapshot = apis.getSystemContextSnapshot()
    finishRequestSystemContextSnapshot(payload.requestId, systemContextSnapshot)
  })
}
