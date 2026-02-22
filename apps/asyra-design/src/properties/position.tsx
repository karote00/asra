import { Input } from '@asyra/design-system'
import { useX, useY } from '../providers'
import { useCallback } from 'react'
import { changeElementComputedData } from '../controllers/scene-tree'
import { parseFiniteInputNumber } from './number-input'

const Position = () => {
  const x = useX()
  const y = useY()

  const handleChangeX = useCallback(
    (newValue: string) => {
      const nextValue = parseFiniteInputNumber(newValue)
      if (nextValue === null) {
        return false
      }

      changeElementComputedData('x', nextValue)
      return true
    },
    [changeElementComputedData]
  )

  const handleChangeY = useCallback(
    (newValue: string) => {
      const nextValue = parseFiniteInputNumber(newValue)
      if (nextValue === null) {
        return false
      }

      changeElementComputedData('y', nextValue)
      return true
    },
    [changeElementComputedData]
  )

  return (
    <div className="flex items-center gap-2 text-gray-200 w-full px-3 py-1">
      <div className="w-1/2">
        <Input
          value={x}
          prefix="X"
          onChange={handleChangeX}
          data-testid="prop-x"
        />
      </div>
      <div className="w-1/2">
        <Input
          value={y}
          prefix="Y"
          onChange={handleChangeY}
          data-testid="prop-y"
        />
      </div>
    </div>
  )
}

export default Position
