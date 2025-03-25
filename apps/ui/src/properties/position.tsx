import { Input } from '@asra/design-system'

const Position = () => {
  const x = '20'
  const y = '30'

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
