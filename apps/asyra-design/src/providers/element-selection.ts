import { useProperty } from '../hooks'

export const useElementSelection = (): Set<string> =>
  useProperty<Set<string>>('elementSelection')
