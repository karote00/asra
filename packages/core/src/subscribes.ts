import {
  subscribeToCoreAddElement,
  subscribeToZoomFit
} from '@asra/reactive-events'
import core from './core'

export const initCoreSubscribes = () => {
  subscribeToCoreAddElement(({ payload }) => {
    core.addRectangle(payload)
  })

  subscribeToZoomFit(({ payload }) => {
    // core.zoomFit()
  })
}
