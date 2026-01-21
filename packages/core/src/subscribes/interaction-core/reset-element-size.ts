import { subscribeToDecideToResetElementSize } from '@asra/reactive-events'
import { DataTypes } from '@asra/utils'

export const initResetElementSizeSubscriber = (deps: {
  changeComputedData: (key: string, data: DataTypes) => void
}) => {
  subscribeToDecideToResetElementSize((event) => {
    const { dimension } = event.payload
    deps.changeComputedData('width', dimension.width)
    deps.changeComputedData('height', dimension.height)
  })
}
