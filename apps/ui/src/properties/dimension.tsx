import { Input } from '@asra/design-system'
import { useHeight, useWidth } from '../providers/properties'
import { useCallback } from 'react'
import { changeElementComputedData } from '../controllers/scene-tree'

const Dimension = () => {
  const width = useWidth()
  const height = useHeight()

  const handleChangeWidth = useCallback(
    (newValue: string) => {
      changeElementComputedData('width', Number(newValue))
    },
    [changeElementComputedData]
  )

  const handleChangeHeight = useCallback(
    (newValue: string) => {
      changeElementComputedData('height', Number(newValue))
    },
    [changeElementComputedData]
  )

  return (
    <div className="flex items-center gap-2 text-gray-200 w-full px-3 py-1">
      <div className="w-1/2">
        <Input value={width} prefix="W" onChange={handleChangeWidth} />
      </div>
      <div className="w-1/2">
        <Input value={height} prefix="H" onChange={handleChangeHeight} />
      </div>
    </div>
  )
}

export default Dimension
