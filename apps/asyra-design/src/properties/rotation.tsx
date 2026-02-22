import { Input } from '@asyra/design-system'
import { useRotation } from '../providers'
import { useCallback } from 'react'
import { changeElementComputedData } from '../controllers/scene-tree'
import { parseFiniteInputNumber } from './number-input'

const Rotation = () => {
  const rotation = useRotation()

  const handleChangeRotation = useCallback(
    (newValue: string) => {
      const nextValue = parseFiniteInputNumber(newValue)
      if (nextValue === null) {
        return false
      }

      changeElementComputedData('rotation', nextValue)
      return true
    },
    [changeElementComputedData]
  )

  return (
    <div className="flex items-center gap-2 text-gray-200 w-full px-3 py-1">
      <div className="w-full">
        <Input
          value={rotation}
          prefix="R"
          onChange={handleChangeRotation}
          data-testid="prop-rotation"
        />
      </div>
    </div>
  )
}

export default Rotation
