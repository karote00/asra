import { Input, PropertyControl } from '@asyra/design-system'
import { useHeight, useWidth } from '../providers'
import { useCallback } from 'react'
import { updateSelectedElementProperties } from '../controllers/scene-tree'
import { formatInputNumber, parseFiniteInputNumber } from './number-input'

const Dimension = () => {
  const width = useWidth()
  const height = useHeight()

  const handleChangeWidth = useCallback(
    (newValue: string) => {
      const nextValue = parseFiniteInputNumber(newValue)
      if (nextValue === null) {
        return false
      }

      updateSelectedElementProperties('width', nextValue)
      return true
    },
    [updateSelectedElementProperties]
  )

  const handleChangeHeight = useCallback(
    (newValue: string) => {
      const nextValue = parseFiniteInputNumber(newValue)
      if (nextValue === null) {
        return false
      }

      updateSelectedElementProperties('height', nextValue)
      return true
    },
    [updateSelectedElementProperties]
  )

  return (
    <div className="grid grid-cols-2 items-center gap-2 pl-4 pr-2 h-8 min-h-8">
      <PropertyControl>
        <Input
          value={formatInputNumber(width)}
          prefix="W"
          onChange={handleChangeWidth}
          noOutline
          data-testid="prop-width"
        />
      </PropertyControl>
      <PropertyControl>
        <Input
          value={formatInputNumber(height)}
          prefix="H"
          onChange={handleChangeHeight}
          noOutline
          data-testid="prop-height"
        />
      </PropertyControl>
    </div>
  )
}

export default Dimension
