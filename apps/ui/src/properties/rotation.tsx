import { Input } from '@asra/design-system'

const Rotation = () => {
  const rotation = '30'

  return (
    <div className="flex items-center gap-2 text-gray-200 w-full px-3 py-1">
      <div className="w-1/2">
        <Input value={rotation} prefix="R" onChange={() => {}} />
      </div>
    </div>
  )
}

export default Rotation
