import { Input } from '@asra/design-system'
import { useX, useY } from '../providers/properties'

const Position = () => {
  const x = useX()
  const y = useY()

  return (
    <div className="flex items-center gap-2 text-gray-200 w-full px-3 py-1">
      <div className="w-1/2">
        <Input value={x} prefix="X" />
      </div>
      <div className="w-1/2">
        <Input value={y} prefix="Y" />
      </div>
    </div>
  )
}

export default Position
