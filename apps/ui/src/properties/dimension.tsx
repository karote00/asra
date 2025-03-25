import { Input } from '@asra/design-system'

const Dimension = () => {
  const width = '100'
  const height = '200'

  return (
    <div className="flex items-center gap-2 text-gray-200 w-full px-3 py-1">
      <div className="w-1/2">
        <Input value={width} prefix="W" />
      </div>
      <div className="w-1/2">
        <Input value={height} prefix="H" />
      </div>
    </div>
  )
}

export default Dimension
