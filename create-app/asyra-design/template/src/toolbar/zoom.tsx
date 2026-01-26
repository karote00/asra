import { Text } from '@asyra/design-system'
import { useZoom } from '../providers'

const Zoom = () => {
  const zoom = useZoom()

  return (
    <div className="flex">
      <Text label="Zoom" />
      <div
        className="w-14 text-right"
        data-testid="zoom-level"
        data-value={zoom}
      >
        <Text label={`${(zoom * 100).toFixed(1)}%`} />
      </div>
    </div>
  )
}

export default Zoom
