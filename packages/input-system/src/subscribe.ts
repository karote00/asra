import {
  subscribeToSwitchInputSystemWatchedElement,
  subscribeToRenderPointerCaptureStart,
  subscribeToRenderPointerCaptureEnd
} from '@asyra/reactive-events'
import inputSystem from './input-system.js'

export const initInputSystemSubscribe = () => {
  subscribeToSwitchInputSystemWatchedElement(({ payload }) => {
    inputSystem.switchWatchedElement(payload.watchedElement)
  })

  subscribeToRenderPointerCaptureStart(({ payload }) => {
    if (!payload.blockInput) {
      return
    }
    inputSystem.setPointerCaptureBlock(true, payload.targetId)
  })

  subscribeToRenderPointerCaptureEnd(({ payload }) => {
    if (!payload.blockInput) {
      return
    }
    inputSystem.setPointerCaptureBlock(false, payload.targetId)
  })
}
