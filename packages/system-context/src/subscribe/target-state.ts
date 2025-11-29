import { subscribeToUpdateHoveredElementId } from '@asra/reactive-events'
import { TargetStateAPIs } from '../types'

export const initTargetStateSubscribe = (apis: TargetStateAPIs) => {
  subscribeToUpdateHoveredElementId(({ payload }) => {
    apis.updateHoveredElementId(payload.elementId)
  })
}
