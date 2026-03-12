import { Input, PropertyControl } from '@asyra/design-system'
import { useX, useY } from '../providers'
import { useCallback } from 'react'
import { changeElementComputedData } from '../controllers/scene-tree'
import { formatInputNumber, parseFiniteInputNumber } from './number-input'

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
    <div className="grid grid-cols-2 items-center gap-2 pl-4 pr-2 h-8 min-h-8">
      <PropertyControl>
        <Input
          value={formatInputNumber(x)}
          prefix="X"
          onChange={handleChangeX}
          noOutline
          data-testid="prop-x"
        />
      </PropertyControl>
      <PropertyControl>
        <Input
          value={formatInputNumber(y)}
          prefix="Y"
          onChange={handleChangeY}
          noOutline
          data-testid="prop-y"
        />
      </PropertyControl>
    </div>
  )
}

export default Position
