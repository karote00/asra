import { subscribeToCoreAddElement } from '@asra/reactive-events'
import core from './core'

export const initCoreSubscribes = () => {
  subscribeToCoreAddElement(({ payload }) => {
    core.sceneTreeManager.addRectangle(payload)
  })
}
