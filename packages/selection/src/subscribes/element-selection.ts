import { subscribeToSelectElements } from '@asra/reactive-events'
import { elementSelection } from '../selections/element-selection'

export const initElementSelectionSubscribes = () => {
  subscribeToSelectElements(({ elementIds }) => {
    elementSelection.select(elementIds)
  })
}
