import { DefaultKeySnapshot, DefaultMoseSnapshot } from '@asyra/utils'
import {
  subscribeToUpdateHoveredElementId,
  subscribeToUpdateKeyState,
  subscribeToUpdateMouseState
} from '@asyra/reactive-events'
import { SystemContextAPIs } from '../types'

export const initSystemContextSubscribe = (apis: SystemContextAPIs) => {
  subscribeToUpdateMouseState(({ payload }) => {
    const currentDragStart =
      apis.getManagedProperty<typeof payload.dragStart>('mouseDragStart') ??
      DefaultMoseSnapshot.dragStart

    apis.setManagedProperty(
      'mouseDragStart',
      payload.dragStart ? { ...payload.dragStart } : currentDragStart
    )
    apis.setManagedProperty('mousePosition', { ...payload.position })
    apis.setManagedProperty('mouseDelta', { ...payload.delta })
    apis.setManagedProperty('mouseButton', payload.button)
    apis.setManagedProperty('mouseDown', payload.down)
    apis.setManagedProperty('mouseDragging', payload.dragging)
  })

  subscribeToUpdateKeyState(({ payload }) => {
    const nextKeyState = { ...DefaultKeySnapshot, ...payload }
    apis.setManagedProperty('keyShift', nextKeyState.shift)
    apis.setManagedProperty('keyCtrl', nextKeyState.ctrl)
    apis.setManagedProperty('keyAlt', nextKeyState.alt)
    apis.setManagedProperty('keyMeta', nextKeyState.meta)
  })

  subscribeToUpdateHoveredElementId(({ payload }) => {
    apis.setManagedProperty('hoveredElementId', payload.elementId)
  })
}
