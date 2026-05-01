import { useProperty } from '../../hooks'

export const useStrokeDebugDisableVisualOverlapCollapse = (): boolean => {
  return useProperty<boolean>('strokeDebugDisableVisualOverlapCollapse')
}
