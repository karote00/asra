import { useProperty } from '../../hooks'
import { PresetSystemPropertyKeys } from '@asyra/preset'

export const useZoom = (): number =>
  useProperty<number>(PresetSystemPropertyKeys.ZOOM)
