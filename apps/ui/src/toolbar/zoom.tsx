import { Text } from '@asra/design-system'
import { useZoom } from '../providers/system'

const Zoom = () => {
  const zoom = useZoom()

  return <Text label={`Zoom ${zoom}`} />
}

export default Zoom
