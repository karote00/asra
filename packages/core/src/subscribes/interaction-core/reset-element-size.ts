import { subscribeToDecideToResetElementSize } from '@asyra/reactive-events'
import { DataTypes } from '@asyra/utils'

export const initResetElementSizeSubscriber = (deps: {
  changeComputedData: (key: string, data: DataTypes) => void
}) => {
  subscribeToDecideToResetElementSize((event) => {
    const { dimension } = event.payload
    deps.changeComputedData('width', dimension.width)
    deps.changeComputedData('height', dimension.height)
  })
}
