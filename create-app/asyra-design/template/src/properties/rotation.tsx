import { Input, PropertyControl } from '@asyra/design-system'
import { useRotation } from '../providers'
import { useCallback } from 'react'
import { updateSelectedElementProperties } from '../controllers/scene-tree'
import { formatInputNumber, parseFiniteInputNumber } from './number-input'

const Rotation = () => {
  const rotation = useRotation()

  const handleChangeRotation = useCallback(
    (newValue: string) => {
      const nextValue = parseFiniteInputNumber(newValue)
      if (nextValue === null) {
        return false
      }

      updateSelectedElementProperties('rotation', nextValue)
      return true
    },
    [updateSelectedElementProperties]
  )

  return (
    <div className="grid grid-cols-2 items-center gap-2 pl-4 pr-2 h-8 min-h-8">
      <PropertyControl>
        <Input
          value={formatInputNumber(rotation)}
          prefix="R"
          suffix="°"
          onChange={handleChangeRotation}
          noOutline
          data-testid="prop-rotation"
        />
      </PropertyControl>
      {/* Spacer for alignment with 2-column rows above */}
      <div />
    </div>
  )
}

export default Rotation
