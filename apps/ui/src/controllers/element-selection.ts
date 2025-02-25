import { elementSelection } from '../contexts'

export const selectElements = (elementIds: string[]) => {
  elementSelection.select(elementIds)
}
