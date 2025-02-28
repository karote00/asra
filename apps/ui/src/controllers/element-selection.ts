import { elementSelectionManager } from '../contexts'

export const selectElements = (elementIds: string[]) => {
  elementSelectionManager.select(elementIds)
}
