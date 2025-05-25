import { Input } from '@asra/design-system'
import { useX, useY } from '../providers'
import { useCallback } from 'react'
import { changeElementComputedData } from '../controllers/scene-tree'

const Position = () => {
  const x = useX()
  const y = useY()

  const handleChangeX = useCallback(
    (newValue: string) => {
      changeElementComputedData('x', Number(newValue))
    },
    [changeElementComputedData]
  )

  const handleChangeY = useCallback(
    (newValue: string) => {
      changeElementComputedData('y', Number(newValue))
    },
    [changeElementComputedData]
  )

  return (
    <div className="flex items-center gap-2 text-gray-200 w-full px-3 py-1">
      <div className="w-1/2">
        <Input value={x} prefix="X" onChange={handleChangeX} />
      </div>
      <div className="w-1/2">
        <Input value={y} prefix="Y" onChange={handleChangeY} />
      </div>
    </div>
  )
}

export default Position
