import { useProperty } from '../../hooks'
import { PresetSystemPropertyKeys } from '@asyra/preset'

export const usePrimaryTool = (): string => {
  return useProperty<string>(PresetSystemPropertyKeys.PRIMARY_TOOL)
}
