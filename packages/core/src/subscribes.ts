import { subscribeToCoreAddElement, addRectangle } from '@asra/reactive-events'

export const initCoreSubscribes = () => {
  subscribeToCoreAddElement(({ payload }) => {
    addRectangle(payload)
  })
}
