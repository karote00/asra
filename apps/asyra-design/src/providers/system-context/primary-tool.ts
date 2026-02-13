import { useProperty } from '../../hooks'

export const usePrimaryTool = (): string => {
  return useProperty<string>('primaryTool')
}
