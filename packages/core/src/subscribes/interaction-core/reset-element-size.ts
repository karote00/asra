import { subscribeToDecideToResetElementSize } from '@asra/reactive-events'
import { DataTypes } from '@asra/utils'

export const initResetElementSizeSubscriber = (deps: {
    changeComputedData: (key: string, data: DataTypes) => void
}) => {
    subscribeToDecideToResetElementSize(async (event) => {
        const { dimension } = event.payload

        // Update the element's width and height
        await deps.changeComputedData('width', dimension.width)
        await deps.changeComputedData('height', dimension.height)
    })
}
