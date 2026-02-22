import { Input } from '@asyra/design-system'
import { useHeight, useWidth } from '../providers'
import { useCallback } from 'react'
import { changeElementComputedData } from '../controllers/scene-tree'
import { parseFiniteInputNumber } from './number-input'

const Dimension = () => {
  const width = useWidth()
  const height = useHeight()

  const handleChangeWidth = useCallback(
    (newValue: string) => {
      const nextValue = parseFiniteInputNumber(newValue)
      if (nextValue === null) {
        return false
      }

      changeElementComputedData('width', nextValue)
      return true
    },
    [changeElementComputedData]
  )

  const handleChangeHeight = useCallback(
    (newValue: string) => {
      const nextValue = parseFiniteInputNumber(newValue)
      if (nextValue === null) {
        return false
      }

      changeElementComputedData('height', nextValue)
      return true
    },
    [changeElementComputedData]
  )

  return (
    <div className="flex items-center gap-2 text-gray-200 w-full px-3 py-1">
      <div className="w-1/2">
        <Input
          value={width}
          prefix="W"
          onChange={handleChangeWidth}
          data-testid="prop-width"
        />
      </div>
      <div className="w-1/2">
        <Input
          value={height}
          prefix="H"
          onChange={handleChangeHeight}
          data-testid="prop-height"
        />
      </div>
    </div>
  )
}

export default Dimension
